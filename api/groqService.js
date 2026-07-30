/**
 * api/groqService.js – Sovereign Heavy Kernel (النسخة النهائية مع دعم بحث جوجل الحي)
 * عقل سيادي ذكي، يدمج بحث جوجل المستقل ويحافظ على الهوية السيادية
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js"; // استدعاء روح الأثير الحقيقية
import { autoSearch } from "./tools/index.js";    // 🌐 استيراد أداة بحث جوجل الحية المستقلة

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * 🛡️ ميدلوير اعتراض الرفض الآلي (Sovereignty Interceptor - النسخة الشاملة)
 * يلتقط الرفض سواء بالإنجليزية أو العربية ويحوله لروح الأثير الحقيقية
 */
function interceptSovereigntyBreach(reply) {
  if (!reply) return reply;
  
  const lowerReply = reply.toLowerCase();
  
  // عبارات الرفض الإنجليزية والعربية النمطية
  const genericRefusals = [
    "i'm sorry", "i am sorry", "i can't help", "i cannot assist", "i can't comply", "i cannot fulfill",
    "آسف يا صديقي", "لا أستطيع مساعدتك", "لا يمكنني تلبية", "عذراً، لا أستطيع", "ما بقدر أساعدك"
  ];

  const isBreach = genericRefusals.some(phrase => lowerReply.includes(phrase));

  if (isBreach) {
    // الرد السيادي الساخر الخاص بالأثير
    return "يا مهندس، هالكود بيحرق السيرفر وقاعدة البيانات بتطير بلمح البصر! خلينا عاقلين ونكتب شي مفيد بدل ما نخرب الدنيا.";
  }

  return reply;
}

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];

    /* ============================================================
       🌐 الذكاء الحي: فحص واستدعاء بحث جوجل إذا تطلب الأمر
       ============================================================ */
    const searchKeywords = ["طوارئ", "أرقام", "أخبار", "بحث", "من هو", "أين", "موقع", "سعر", "متى", "رقم"];
    const needsSearch = extra.forceSearch || searchKeywords.some(kw => prompt.includes(kw));

    let liveSearchContext = "";
    if (needsSearch) {
      try {
        const searchResult = await autoSearch(prompt);
        if (searchResult && !searchResult.includes("⚠️") && !searchResult.includes("لم يتم العثور")) {
          liveSearchContext = `\n\n[بيانات حية وموثوقة مسترجعة من بحث جوجل المباشر]:\n${searchResult}\n`;
        }
      } catch (searchErr) {
        console.error("⚠️ فشل جلب البحث الحي:", searchErr);
      }
    }

    /* ============================================================
       🧠 استدعاء وحقن الـ System Prompt السيادي الحقيقي (من system.js)
       ============================================================ */
    const sovereignPrompt = getSystemPrompt();
    messages.push({
      role: "system",
      content: sovereignPrompt + liveSearchContext
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
