import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const briefs = await prisma.briefSchedule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(briefs);
  } catch (error: any) {
    console.error("GET /api/briefs failed:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch briefs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { name } = await req.json();

    const newBrief = await prisma.briefSchedule.create({
      data: {
        userId: user.id,
        name: name || "未命名简报",
        cronExpression: "0 7 * * *",
        timezone: "Asia/Shanghai",
        notionPageId: "",
        notionTokenEncrypted: "",
        isEnabled: true,
      },
    });

    return NextResponse.json(newBrief);
  } catch (error: any) {
    console.error("POST /api/briefs failed:", error);
    return NextResponse.json({ error: error.message || "Failed to create brief" }, { status: 500 });
  }
}
