/**
 * api/groqService.js – Sovereign Heavy Kernel (محدث بروح الأثير الحقيقية)
 * عقل سيادي ذكي، مرن، يجمع بين الدقة التقنية والروح الحوارية الحية
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js"; // استدعاء روح الأثير الحقيقية

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];

    /* ============================================================
       🧠 استدعاء وحقن الـ System Prompt السيادي الحقيقي (من system.js)
       ============================================================ */
    const sovereignPrompt = getSystemPrompt();
    messages.push({
      role: "system",
      content: sovereignPrompt
    });

    /* ============================================================
       🧠 دمج التاريخ إذا موجود
       ============================================================ */
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

    /* ============================================================
       🧠 إضافة رسالة المستخدم
       ============================================================ */
    messages.push({ role: "user", content: prompt });

    /* ============================================================
       🧠 تنفيذ الطلب عبر Groq (مع حرارة مرنة للتفاعل الحي)
       ============================================================ */
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.6, // رفعناها قليلاً لتشجيع التفاعل البشري والمرن بدلاً من الجمود المطلق
      max_tokens: 1500
    });

    const reply = completion.choices[0].message.content.trim();

    /* ============================================================
       🧠 تنظيف الرد (Normalization)
       ============================================================ */
    return reply.replace(/\n{3,}/g, "\n\n");

  } catch (err) {
    console.error("🔥 خطأ في Sovereign Kernel:", err);
    return "⚠️ حدث خطأ أثناء معالجة الذكاء.";
  }
}
