import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBriefPayload } from "@/lib/brief-pipeline";

/**
 * Render API — returns a structured JSON brief payload for external consumers
 * (e.g. Hermes skill that creates a Feishu document).
 *
 * Auth: Bearer token via RENDER_API_KEY env var.
 *
 * POST /api/briefs/render
 * Body: { "briefScheduleId": "<uuid>", "skipClosing": true|false }
 * Response: BriefPayload JSON
 */
export async function POST(req: NextRequest) {
  // 1. API key auth
  const apiKey = process.env.RENDER_API_KEY;
  if (apiKey) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await req.json();
    const { briefScheduleId, skipClosing } = body;

    if (!briefScheduleId) {
      return NextResponse.json(
        { error: "briefScheduleId is required" },
        { status: 400 }
      );
    }

    // Verify schedule exists and is enabled
    const schedule = await prisma.briefSchedule.findUnique({
      where: { id: briefScheduleId },
      select: { id: true, isEnabled: true, closingEnabled: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    if (!schedule.isEnabled) {
      return NextResponse.json({ error: "Schedule is disabled" }, { status: 403 });
    }

    // 2. Generate payload
    // skipClosing from request body overrides schedule setting
    const shouldSkipClosing = skipClosing ?? !schedule.closingEnabled;

    const payload = await generateBriefPayload(briefScheduleId, {
      skipClosing: shouldSkipClosing,
    });

    // 3. Log execution
    await prisma.briefLog.create({
      data: {
        briefScheduleId,
        status: "SUCCESS",
      },
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("[Render API] Error:", err);

    // Try to log failure if we have a schedule ID
    try {
      const body = await req.json().catch(() => ({}));
      if (body.briefScheduleId) {
        await prisma.briefLog.create({
          data: {
            briefScheduleId: body.briefScheduleId,
            status: "FAILED",
            errorMessage: err.message || "Unknown error",
          },
        });
      }
    } catch {
      // ignore logging errors
    }

    return NextResponse.json(
      { error: err.message || "Failed to generate brief" },
      { status: 500 }
    );
  }
}
