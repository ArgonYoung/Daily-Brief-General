export interface LLMConfig {
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
}

export async function getLLMSummary(moduleOutputs: string[], config?: LLMConfig): Promise<string> {
  const apiKey = config?.apiKey || process.env.DEEPSEEK_API_KEY;
  const baseUrl = config?.baseUrl || "https://api.deepseek.com/v1";
  const modelName = config?.modelName || "deepseek-chat";

  if (!apiKey) {
    return `### Daily Brief (Raw Modules Output)\n\n` + moduleOutputs.join("\n\n");
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: `你是一个专业的个人晨间简报排版主编。
你的任务是将各模块的输入内容融合成一篇排版精美、结构清晰的中文晨间每日简报。

格式与语法规范：
1. 语言：必须全篇使用中文（除了原始的外文名称/歌名等）。
2. 直接输出内容：严禁输出任何“好的，以下是简报”或“希望您喜欢”等前缀、后缀或客套话。直接从简报正文内容开始输出。
3. 允许使用的 Markdown 标记（只能且必须使用这些标记进行结构化）：
   - 标题：使用 "# " (一级标题), "## " (二级标题), "### " (三级标题)
   - 段落分割线：使用 "---"
   - 引用块：使用 "> "
   - 无序列表：使用 "- " (减号后加空格)
   - 加粗：使用 "**文字**" 标记需要强调的字词
4. 禁止使用的标记：禁止使用斜体 (*文字* 或 _文字_)、反引号、代码块或任何其他未列出的 Markdown 符号。
5. 整体美观度：模块与模块之间使用 "---" 进行物理分隔。小标题使用 "##" 或 "###"。名言使用 "> " 引用。`,
          },
          {
            role: "user",
            content: `请根据以下各模块的输入，融合成一篇排版精美的每日简报：\n\n${moduleOutputs.join("\n\n")}`,
          },
        ],
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    } else {
      console.error("LLM summary API failed with status:", response.status);
    }
  } catch (err) {
    console.error("LLM summary request failed:", err);
  }

  return `### Daily Brief (Raw Modules Output)\n\n` + moduleOutputs.join("\n\n");
}

export async function llmComplete(prompt: string, config?: LLMConfig): Promise<string> {
  const apiKey = config?.apiKey || process.env.DEEPSEEK_API_KEY;
  const baseUrl = config?.baseUrl || "https://api.deepseek.com/v1";
  const modelName = config?.modelName || "deepseek-chat";

  if (!apiKey) {
    const p = prompt.toLowerCase();
    if (p.includes("女仆") || p.includes("maid")) {
      return "主人，早上好！今天也是元气满满的一天，请让女仆为您奉上今日的简报吧。";
    }
    if (p.includes("jarvis") || p.includes("stark") || p.includes("贾维斯")) {
      return "Good morning, Mr. Stark. The daily briefing is prepared. I have updated all systems.";
    }
    return "早上好，主人。今日简报已准备就绪，祝您拥有美好的一天。";
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant. Execute the instruction directly and concisely, without any conversational packaging or explanation. Answer in the requested persona.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content.trim();
    } else {
      console.error("LLM complete API failed with status:", response.status);
    }
  } catch (err) {
    console.error("LLM complete failed, falling back:", err);
  }

  return "早上好，主人。今日简报已准备就绪。";
}
