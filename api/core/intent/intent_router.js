/**
 * api/core/intent/intent_router.js – Sovereign Intent Router (Final Edition)
 * نية خفيفة: type + intent فقط، بدون JSON ضخم.
 */

import groqService from "../../groqService.js";

export default async function routeIntent(message = "", hasFile = false) {
  const text = message.trim();

  // 🟩 رسائل قصيرة جداً → دردشة
  if (!text && !hasFile) {
    return { type: "chat", intent: "chat" };
  }

  // 🟦 Micro Prompt خفيف جداً
  const systemPrompt = `
أنت محلل نوايا. رجّع JSON خفيف جداً:
{
  "type": "chat | file | tool | system",
  "intent": "نية مختصرة جداً مثل: chat, read_file, modify_file, tool_usage"
}
`.trim();

  const prompt = `${systemPrompt}\n\nرسالة: "${text}"`;

  try {
    const response = await groqService(prompt);

    // تنظيف أي Markdown
    const cleaned = response
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // 🟧 نضمن إنو خفيف
    return {
      type: parsed.type || "chat",
      intent: parsed.intent || "chat"
    };

  } catch (err) {
    console.error("🔥 [Intent Router Error]:", err);

    // 🟥 fallback خفيف
    return {
      type: "chat",
      intent: "chat"
    };
  }
}
