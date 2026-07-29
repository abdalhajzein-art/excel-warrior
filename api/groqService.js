/**
 * api/groqService.js – Sovereign Kernel (نسخة خفيفة)
 * محرّك ذكاء بسيط: رسالة → رد نصي فقط
 */

import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];

    // ⭐ إذا في تاريخ → نمرّره
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

    // ⭐ رسالة المستخدم
    messages.push({ role: "user", content: prompt });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.2,
      max_tokens: 800
    });

    return completion.choices[0].message.content.trim();

  } catch (err) {
    console.error("🔥 خطأ في kernel:", err);
    return "⚠️ حدث خطأ أثناء معالجة الذكاء.";
  }
}