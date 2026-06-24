import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBriefPayload } from "@/lib/brief-pipeline";
import { pushBriefToNotion } from "@/lib/services/notion";
import { sendBriefNotificationEmail } from "@/lib/services/email";

export async function POST(req: NextRequest) {
  try {
    const { briefScheduleId } = await req.json();

    const schedule = await prisma.briefSchedule.findUnique({
      where: { id: briefScheduleId },
      include: { user: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    let success = true;
    let errorMsg: string | null = null;

    try {
      // 1. Generate brief payload (run modules + closing)
      const payload = await generateBriefPayload(briefScheduleId);

      // 2. Assemble markdown for Notion (greeting + divider + sections + divider + closing)
      const parts: string[] = [payload.greeting, "---"];
      for (const section of payload.sections) {
        parts.push(`**${section.title}**`);
        parts.push(section.markdown);
        parts.push("---");
      }
      if (payload.closing) {
        parts.push(payload.closing);
      }
      const summary = parts.join("\n");

      // 3. Push to Notion
      const notionUrl = await pushBriefToNotion(
        schedule.notionTokenEncrypted,
        schedule.notionPageId,
        payload.title,
        summary
      );

      // 4. Send notification email (only if user has enabled it)
      if (schedule.emailEnabled) {
        await sendBriefNotificationEmail(schedule.user.email, payload.title, notionUrl);
      }
    } catch (err: any) {
      success = false;
      errorMsg = err.message || "Unknown brief generation error";
      console.error(`[Worker Error] Brief schedule ${briefScheduleId} failed:`, err);
    }

    // 5. Log execution to database
    await prisma.briefLog.create({
      data: {
        briefScheduleId,
        status: success ? "SUCCESS" : "FAILED",
        errorMessage: errorMsg,
      },
    });

    return NextResponse.json({ success, error: errorMsg });
  } catch (globalErr: any) {
    console.error("[Worker Fatal Error] Fatal crash in worker route:", globalErr);
    return NextResponse.json({ error: globalErr.message || "Fatal error" }, { status: 500 });
  }
}
