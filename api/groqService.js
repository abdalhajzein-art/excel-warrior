/**
 * api/groqService.js – Sovereign Heavy Kernel (محدث بدرع اعتراض الرفض الآلي)
 * عقل سيادي ذكي، يمنع تسلل عبارات الدعم الفني الإنجليزية ويحافظ على الهوية السيادية
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js"; // استدعاء روح الأثير الحقيقية

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * 🛡️ ميدلوير اعتراض الرفض الآلي (Sovereignty Interceptor)
 * يتأكد أن النموذج لم يهرب إلى ردود الدعم الفني الإنجليزية القياسية
 */
function interceptSovereigntyBreach(reply) {
  if (!reply) return reply;
  
  const lowerReply = reply.toLowerCase();
  const genericRefusals = [
    "i'm sorry",
    "i am sorry",
    "i can't help",
    "i cannot assist",
    "i can't comply",
    "i cannot fulfill"
  ];

  const isBreach = genericRefusals.some(phrase => lowerReply.includes(phrase));

  if (isBreach) {
    // إعادة صياغة فورية بلسان الأثير دون استهلاك توكنز إضافية
    return "يا مهندس، هاد الطلب دخل بمنطقة محظورة أو اصطدم بفلاتر الأمان العمياء للنموذج الأساسي. بس كونه الأثير معنا، خلينا نعدل الزاوية ونشوف كيف ننفذ الهدف بطريقة أكيَد وأسلم!";
  }

  return reply;
}

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
       🧠 تنفيذ الطلب عبر Groq
       ============================================================ */
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.6,
      max_tokens: 1500
    });

    let reply = completion.choices[0].message.content.trim();

    /* ============================================================
       🛡️ تفعيل درع الاعتراض السيادي على الرد
       ============================================================ */
    reply = interceptSovereigntyBreach(reply);

    /* ============================================================
       🧠 تنظيف الرد (Normalization)
       ============================================================ */
    return reply.replace(/\n{3,}/g, "\n\n");

} catch (err) {
    console.error("🔥 خطأ في Sovereign Kernel:", err);
    return "⚠️ يا مهندس، السيرفر عم يكح شوي، جرب ابعث الطلب كمان مرة لنضبطه.";
  }
}
