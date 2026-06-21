import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSandbox } from "@/lib/sandbox/runner";
import { getLLMSummary, llmComplete } from "@/lib/services/llm";
import { pushBriefToNotion } from "@/lib/services/notion";
import { sendBriefNotificationEmail } from "@/lib/services/email";

export async function POST(req: NextRequest) {
  try {
    const { briefScheduleId } = await req.json();

    const schedule = await prisma.briefSchedule.findUnique({
      where: { id: briefScheduleId },
      include: {
        user: true,
        mappings: {
          include: {
            userModuleConfig: {
              include: { module: true },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
    }

    const results: string[] = [];
    let success = true;
    let errorMsg: string | null = null;

    try {
      // 1. Run all module mappings configured for this brief inside the sandbox
      const llmConfig = {
        baseUrl: schedule.llmBaseUrl,
        modelName: schedule.llmModelName,
        apiKey: schedule.llmApiKeyEncrypted,
      };

      const outputParts: string[] = [];

      // 1.1 Opening greeting based on target timezone current hour
      const tz = schedule.timezone || "Asia/Shanghai";
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      });
      const hour = parseInt(formatter.format(new Date()), 10);
      
      let period = "早上好";
      if (hour >= 12 && hour < 14) period = "中午好";
      else if (hour >= 14 && hour < 19) period = "下午好";
      else if (hour >= 19 || hour < 5) period = "晚上好";

      const userName = (schedule.userName && schedule.userName.trim())
        ? schedule.userName.trim()
        : schedule.user.email.split("@")[0];
      outputParts.push(`${period}，${userName}！`);
      outputParts.push("---");

      // 1.2 Run modules and construct body parts
      const resultsTextList: string[] = [];
      for (const mapping of schedule.mappings) {
        const config = mapping.userModuleConfig;
        const moduleCode = config.module.code;
        const values = (config.values as Record<string, any>) || {};

        const output = await runSandbox(moduleCode, values, {
          fetch: async (url, init) => fetch(url, init),
          llmComplete: async (prompt) => {
            return llmComplete(prompt, llmConfig);
          },
        });

        outputParts.push(`**${config.module.name}**`);
        outputParts.push(output);
        outputParts.push("---");

        resultsTextList.push(`${config.module.name}: ${output}`);
      }

      // 1.3 Generate closing warm recommendation based on overall modules output
      let closingRec = "祝您今天拥有美好的心情，工作顺利！";
      if (resultsTextList.length > 0) {
        const personaLine = (schedule.aiPersona && schedule.aiPersona.trim())
          ? `请按照以下风格和语气进行回应：${schedule.aiPersona.trim()}。\n`
          : "";
        const prompt = `请根据以下今日简报内容，写一句非常简短的结束语或建议。
${personaLine}要求：
1. 语言：中文。
2. 字数在30字以内，极其精炼，并且亲切自然。
3. 直接输出这一句话本身，不要带任何前缀（如"建议："、"助手："）或双引号等包裹。
内容：\n${resultsTextList.join("\n")}`;
        
        closingRec = await llmComplete(prompt, llmConfig);
        // Strip outer quotes if the LLM wrapped it
        closingRec = closingRec.replace(/^["'“”]/, "").replace(/["'“”]$/, "");
      }
      
      outputParts.push(closingRec);
      const summary = outputParts.join("\n");

      // 3. Prepare title using target timezone
      const dateStr = new Date().toLocaleDateString("zh-CN", { timeZone: schedule.timezone });
      const title = `${schedule.name} (${dateStr})`;

      // 4. Push to Notion
      const notionUrl = await pushBriefToNotion(
        schedule.notionTokenEncrypted, // In prod, decrypt this
        schedule.notionPageId,
        title,
        summary
      );

      // 5. Send notification email (only if user has enabled it)
      if (schedule.emailEnabled) {
        await sendBriefNotificationEmail(schedule.user.email, title, notionUrl);
      }
    } catch (err: any) {
      success = false;
      errorMsg = err.message || "Unknown brief generation error";
      console.error(`[Worker Error] Brief schedule ${briefScheduleId} failed:`, err);
    }

    // 6. Log execution to database
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
