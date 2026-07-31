/**
 * api/groqService.js – Sovereign Pure Kernel
 * نسخة نظيفة بدون بحث داخلي، بدون تحليل نوايا، بدون حقن سياق زائد.
 * كل الذكاء والسيادة تتم عبر الطبقات العليا فقط (global_orchestrator + searchAgent + intent_router).
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function groqService(prompt, extra = {}) {
  try {
    const messages = [];

    // 🟦 system prompt السيادي الأساسي فقط
    messages.push({
      role: "system",
      content: getSystemPrompt()
    });

    // 🟦 دمج التاريخ القادم من orchestrator فقط
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

    // 🟦 تمرير الرسالة الأصلية بدون أي تعديل
    messages.push({
      role: "user",
      content: prompt
    });

    // 🟦 استدعاء النموذج بدون أي بحث داخلي أو نوايا أو حقن سياق
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.6,
      max_tokens: 1500
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Kernel Error:", error);
    throw error;
  }
}
