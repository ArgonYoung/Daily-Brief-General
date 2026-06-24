import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const brief = await prisma.briefSchedule.findUnique({
      where: { id: params.id },
      include: {
        mappings: {
          include: {
            module: true,
            userModuleConfig: true,
          },
          orderBy: { sortOrder: "asc" },
        },
        logs: {
          orderBy: { triggeredAt: "desc" },
          take: 10,
        },
      },
    });

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    if (brief.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all available modules for additions
    const modules = await prisma.module.findMany();

    return NextResponse.json({ brief, availableModules: modules });
  } catch (error: any) {
    console.error("GET /api/briefs/[id] failed:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch brief details" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const brief = await prisma.briefSchedule.findUnique({
      where: { id: params.id },
    });

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    if (brief.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await req.json();

    // 1. Update schedule details
    await prisma.briefSchedule.update({
      where: { id: params.id },
      data: {
        name: data.name,
        cronExpression: data.cronExpression,
        timezone: data.timezone,
        notionPageId: data.notionPageId,
        notionTokenEncrypted: data.notionTokenEncrypted,
        isEnabled: data.isEnabled,
        llmBaseUrl: data.llmBaseUrl,
        llmModelName: data.llmModelName,
        llmApiKeyEncrypted: data.llmApiKeyEncrypted,
        userName: data.userName ?? "",
        aiPersona: data.aiPersona ?? "",
        closingEnabled: data.closingEnabled ?? true,
        emailEnabled: data.emailEnabled ?? false,
      },
    });

    // 2. Clean old mappings and write reordered/updated module configurations
    if (data.mappings) {
      // Delete existing mappings first
      await prisma.briefModuleMapping.deleteMany({
        where: { briefScheduleId: params.id },
      });

      // Re-create updated configs and mappings in sortOrder
      for (let i = 0; i < data.mappings.length; i++) {
        const item = data.mappings[i];

        // Upsert UserModuleConfig — avoids FK issues from findFirst+create pattern
        const existingConfig = await prisma.userModuleConfig.findFirst({
          where: { userId: user.id, moduleId: item.moduleId },
        });

        let configId: string;
        if (existingConfig) {
          const updated = await prisma.userModuleConfig.update({
            where: { id: existingConfig.id },
            data: { values: item.values },
          });
          configId = updated.id;
        } else {
          const created = await prisma.userModuleConfig.create({
            data: {
              userId: user.id,
              moduleId: item.moduleId,
              values: item.values,
            },
          });
          configId = created.id;
        }

        // Write mapping
        await prisma.briefModuleMapping.create({
          data: {
            briefScheduleId: params.id,
            userModuleConfigId: configId,
            moduleId: item.moduleId,
            sortOrder: i,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PUT /api/briefs/[id] failed:", error);
    return NextResponse.json({ error: error.message || "Failed to update brief" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const brief = await prisma.briefSchedule.findUnique({
      where: { id: params.id },
    });

    if (!brief) {
      return NextResponse.json({ error: "Brief not found" }, { status: 404 });
    }

    if (brief.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.briefSchedule.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/briefs/[id] failed:", error);
    return NextResponse.json({ error: error.message || "Failed to delete brief" }, { status: 500 });
  }
}
