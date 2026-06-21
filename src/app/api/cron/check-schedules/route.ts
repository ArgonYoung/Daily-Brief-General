import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Checks whether the current time (in the schedule's timezone) matches
 * the given cron expression (only minute and hour parts are compared,
 * since this app only uses "MM HH * * *" style daily schedules).
 */
function matchesCronNow(cronExpr: string, timezone: string): boolean {
  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    const [minutePart, hourPart] = parts;

    // Get current hour and minute in the target timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const formatted = formatter.format(now); // e.g. "07:30"
    const [hourStr, minuteStr] = formatted.split(":");
    const currentHour = parseInt(hourStr, 10);
    const currentMinute = parseInt(minuteStr, 10);

    const matchesPart = (part: string, value: number): boolean => {
      if (part === "*") return true;
      // Support comma-separated values e.g. "0,30"
      return part.split(",").some((p) => parseInt(p.trim(), 10) === value);
    };

    return matchesPart(minutePart, currentMinute) && matchesPart(hourPart, currentHour);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Optional: verify CRON_SECRET to prevent unauthorized triggers
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Fetch all enabled schedules
  const activeSchedules = await prisma.briefSchedule.findMany({
    where: { isEnabled: true },
    include: {
      user: true,
      logs: {
        orderBy: { triggeredAt: "desc" },
        take: 1,
      },
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const workerUrl = `${appUrl}/api/worker/generate-brief`;

  const triggered: string[] = [];
  const skipped: string[] = [];

  for (const schedule of activeSchedules) {
    // 1. Time matching: does current time in this schedule's timezone match its cron expression?
    if (!matchesCronNow(schedule.cronExpression, schedule.timezone)) {
      skipped.push(`${schedule.name} (time mismatch)`);
      continue;
    }

    // 2. Deduplication: skip if already triggered successfully in the last 30 minutes
    const lastLog = schedule.logs[0];
    if (lastLog) {
      const minutesSinceLastRun =
        (Date.now() - new Date(lastLog.triggeredAt).getTime()) / 1000 / 60;
      if (minutesSinceLastRun < 30) {
        skipped.push(`${schedule.name} (ran ${Math.round(minutesSinceLastRun)}m ago)`);
        continue;
      }
    }

    // 3. Trigger the worker
    try {
      console.log(`[Scheduler] Triggering brief "${schedule.name}" (${schedule.id})`);
      // Fire-and-forget: don't await so we can respond quickly
      fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefScheduleId: schedule.id }),
      }).catch((err) => {
        console.error(`[Scheduler] Failed to trigger worker for ${schedule.id}:`, err);
      });
      triggered.push(schedule.name);
    } catch (err) {
      console.error(`[Scheduler] Error triggering ${schedule.name}:`, err);
    }
  }

  return NextResponse.json({
    status: "ok",
    triggered,
    skipped,
    checkedAt: new Date().toISOString(),
  });
}
