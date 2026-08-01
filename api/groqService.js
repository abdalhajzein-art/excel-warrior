/**
 * api/groqService.js – Sovereign LLM Gateway (Dual Mode)
 * يدعم:
 * 1) groqService(prompt)  ← الوضع القديم
 * 2) groqService.chat(messages) ← الوضع السيادي الجديد
 */

import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ============================================================
   🟩 الوضع القديم: رسالة واحدة (prompt)
   ============================================================ */
export default async function groqService(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "أنت الأثير — رد دائماً برد لغوي واضح." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_completion_tokens: 1500,
      top_p: 1,
      stream: false
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Gateway Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد.";
  }
}

/* ============================================================
   🟦 الوضع السيادي الجديد: مصفوفة رسائل كاملة
   ============================================================ */
groqService.chat = async function(messages) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.4,
      max_completion_tokens: 1500
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Chat Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد.";
  }
};
