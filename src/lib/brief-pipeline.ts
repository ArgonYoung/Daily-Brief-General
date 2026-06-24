import { prisma } from "@/lib/prisma";
import { runSandbox } from "@/lib/sandbox/runner";
import { llmComplete } from "@/lib/services/llm";

export interface BriefSection {
  title: string;
  markdown: string;
}

export interface BriefPayload {
  title: string;
  greeting: string;
  sections: BriefSection[];
  closing: string | null;
  generatedAt: string;
}

export interface GenerateOptions {
  /** Skip closing generation (e.g. when the caller will generate its own closing) */
  skipClosing?: boolean;
}

/**
 * Core brief generation pipeline.
 * Runs all modules in the sandbox, collects their Markdown output,
 * and optionally generates a closing remark via LLM.
 *
 * This function is carrier-agnostic — it does not push to Notion or send emails.
 * Callers (Notion worker, Feishu render API, etc.) consume the returned
 * BriefPayload and handle delivery themselves.
 */
export async function generateBriefPayload(
  briefScheduleId: string,
  options: GenerateOptions = {}
): Promise<BriefPayload> {
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
    throw new Error("Schedule not found");
  }

  const llmConfig = {
    baseUrl: schedule.llmBaseUrl,
    modelName: schedule.llmModelName,
    apiKey: schedule.llmApiKeyEncrypted,
  };

  // 1. Greeting based on target timezone current hour
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

  const userName =
    schedule.userName && schedule.userName.trim()
      ? schedule.userName.trim()
      : schedule.user.email.split("@")[0];
  const greeting = `${period}，${userName}！`;

  // 2. Run modules
  const sections: BriefSection[] = [];
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

    sections.push({
      title: config.module.name,
      markdown: output,
    });
    resultsTextList.push(`${config.module.name}: ${output}`);
  }

  // 3. Closing remark (optional)
  let closing: string | null = null;
  const shouldGenerateClosing = !options.skipClosing && schedule.closingEnabled;

  if (shouldGenerateClosing && resultsTextList.length > 0) {
    const personaLine =
      schedule.aiPersona && schedule.aiPersona.trim()
        ? `请按照以下风格和语气进行回应：${schedule.aiPersona.trim()}。\n`
        : "";
    const prompt = `请根据以下今日简报内容，写一句非常简短的结束语或建议。
${personaLine}要求：
1. 语言：中文。
2. 字数在30字以内，极其精炼，并且亲切自然。
3. 直接输出这一句话本身，不要带任何前缀（如"建议："、"助手："）或双引号等包裹。
内容：
${resultsTextList.join("\n")}`;

    closing = await llmComplete(prompt, llmConfig);
    // Strip outer quotes if the LLM wrapped it
    closing = closing.replace(/^["'""]/g, "").replace(/["'""]$/g, "");
  }

  // 4. Title
  const dateStr = new Date().toLocaleDateString("zh-CN", { timeZone: schedule.timezone });
  const title = `${schedule.name} (${dateStr})`;

  return {
    title,
    greeting,
    sections,
    closing,
    generatedAt: new Date().toISOString(),
  };
}
