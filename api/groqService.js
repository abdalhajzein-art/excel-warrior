/**
 * api/groqService.js – Sovereign LLM Gateway (GitHub Models Dual Mode)
 * تم التحويل كاملاً إلى خوادم GitHub Models لضمان الاستقرار والمجانية
 * يدعم:
 * 1) groqService(prompt)  ← الوضع القديم
 * 2) groqService.chat(messages) ← الوضع السيادي الجديد (Orchestrator)
 */

import OpenAI from "openai";

if (!process.env.GITHUB_TOKEN) {
  console.warn("⚠️ WARNING: GITHUB_TOKEN is not defined in environment variables.");
}

// تهيئة الاتصال بـ GitHub Models عبر OpenAI SDK
const client = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: process.env.GITHUB_TOKEN
});

// نموذج Llama 3.1 70B المستضيف على جيت هب (جاهز ومجاني للتطوير)
const MODEL_NAME = "meta-llama-3.1-70b-instruct";

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (prompt)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: "أنت الأثير — رد دائماً برد لغوي واضح." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1500,
      top_p: 1,
      stream: false
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ GitHub Gateway Error (Legacy Mode):", error);
    return "⚠️ حدث خطأ أثناء توليد الرد من المحرك.";
  }
}

/* ============================================================
   🟦 الوضع السيادي الجديد: مصفوفة رسائل كاملة (مربوط بالـ Orchestrator)
   ============================================================ */
groqService.chat = async function(messages) {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages,
      temperature: 0.4,
      max_tokens: 1500
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ GitHub Chat Error (Sovereign Mode):", error);
    throw error; // نمرر الخطأ لتتعامل معه طبقة الـ Agentic Loop
  }
};
