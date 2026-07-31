/**
 * api/groqService.js – Sovereign LLM Gateway (النسخة الصحيحة)
 * بوابة نظيفة وخفيفة للتواصل مع Groq بدون أي ذكاء إضافي.
 */

import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function groqService(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "أنت الأثير — رد دائماً برد لغوي واضح." },
        { role: "user", content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1500
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Gateway Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد.";
  }
}
