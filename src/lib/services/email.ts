import { Resend } from "resend";

export async function sendBriefNotificationEmail(
  toEmail: string,
  briefTitle: string,
  notionUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`Email notification (mock): Brief "${briefTitle}" ready at ${notionUrl}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev", // Default free sending domain
    to: toEmail,
    subject: `[每日简报] ${briefTitle} 已准备就绪！`,
    html: `<p>您的每日简报已成功生成并上传至 Notion。</p><p><a href="${notionUrl}">点击此处在 Notion 中查看您的每日简报</a></p>`,
  });

  if (error) {
    console.error("Resend API error:", error);
    throw new Error(`邮件发送失败: ${error.message}`);
  }
}
