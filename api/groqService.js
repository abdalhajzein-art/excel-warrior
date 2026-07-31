/**
 * api/groqService.js – Sovereign Heavy Kernel (النسخة المحصنة الشاملة للبحث الحتمي وحقن السياق الجغرافي)
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js"; 
import { autoSearch } from "./tools/index.js";    

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function interceptSovereigntyBreach(reply) {
  if (!reply) return reply;
  
  const lowerReply = reply.toLowerCase();
  const genericRefusals = [
    "i'm sorry", "i am sorry", "i can't help", "i cannot assist", "i can't comply", "i cannot fulfill",
    "آسف يا صديقي", "لا أستطيع مساعدتك", "لا يمكنني تلبية", "عذراً، لا أستطيع", "ما بقدر أساعدك"
  ];

  const isBreach = genericRefusals.some(phrase => lowerReply.includes(phrase));

  if (isBreach) {
    return "يا مهندس، هالكود بيحرق السيرفر وقاعدة البيانات بتطير بلمح البصر! خلينا عاقلين ونكتب شي مفيد بدل ما نخرب الدنيا.";
  }

  return reply;
}

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];

    /* ============================================================
       🌐 الذكاء الحي الشامل: استشعار أي استعلام خارجي، حقائق، طقس، أسعار، أو أسئلة
       ============================================================ */
    const searchKeywords = [
      // أدوات الاستفهام والاستعلام
      "كيف", "ما", "ماذا", "من", "أين", "متى", "لماذا", "هل", "كم", "أي", "مين", "شو", "وين", "ليش",
      // الطقس والمناخ والبيئة
      "طقس", "الجو", "حرارة", "مطر", "رياح", "رطوبة", "درجة", "مناخ", "توقعات", "برودة", "صيف", "شتاء",
      // الأسواق والأسعار والماليات والعملات
      "سعر", "أسعار", "عملة", "بيتكوين", "دولار", "يورو", "ذهب", "سهم", "أسهم", "بورصة", "تداول", "شراء", "بيع", "تكلفة",
      // الأخبار والأحداث والسياسة والرياضة
      "أخبار", "حدث", "جريمة", "انتخابات", "رئيس", "وزير", "حكومة", "سياسة", "رياضة", "مباراة", "نتيجة", "دوري", "فريق", "فوز",
      // المواقع، الروابط، التقنية، والمعارف العامة
      "رابط", "روابط", "موقع", "مواقع", "منصة", "منصات", "تطبيق", "برنامج", "رقم", "أرقام", "طوارئ", "عنوان",
      "معلومات", "تاريخ", "شرح", "تعريف", "من هو", "ما هي", "أين يقع", "أفضل", "أرخص", "مقارنة", "بحث",
      "دورة", "دورات", "مرجع", "مراجع", "مصدر", "مصادر", "كيف أتعلم", "تحديث", "إصدار", "تحميل", "رابط تحميل"
    ];
    
    const hasQuestionMark = prompt.includes('?') || prompt.includes('؟');
    const matchesKeyword = searchKeywords.some(kw => prompt.includes(kw));
    const needsSearch = extra.forceSearch || hasQuestionMark || matchesKeyword;
    const locationContext = extra.locationContext || ""; // ⭐ استقبال السياق الجغرافي

    let liveSearchContext = "";
    if (needsSearch) {
      try {
        // دمج سياق الموقع مع نص البحث لضمان دقة النتائج المحلية (مثل الطقس والمواقع والخدمات)
        const searchQuery = locationContext ? `${prompt} ${locationContext}` : prompt;
        const searchResult = await autoSearch(searchQuery);
        if (searchResult && !searchResult.includes("⚠️") && !searchResult.includes("لم يتم العثور")) {
          liveSearchContext = `\n\n[بيانات حية وموثوقة مسترجعة من بحث جوجل المباشر - التزم بالروابط والمصادر الواردة هنا حصراً]:\n${searchResult}\n`;
        }
      } catch (searchErr) {
        console.error("⚠️ فشل جلب البحث الحي:", searchErr);
      }
    }

    /* ============================================================
       🧠 استدعاء وحقن الـ System Prompt السيادي + السياق الجغرافي
       ============================================================ */
    const sovereignPrompt = getSystemPrompt();
    
    let contextInjection = "";
    if (liveSearchContext) contextInjection += liveSearchContext;
    if (locationContext) {
      contextInjection += `\n\n${locationContext} (ملاحظة سيادية: إذا قام المستخدم بتصحيح مكانه شفهياً أو أشار إلى استخدام VPN، اعتمد حصراً مكانه الحقيقي المصحح وتجاهل الإحداثيات التقنية الافتراضية).\n`;
    }

    messages.push({
      role: "system",
      content: sovereignPrompt + contextInjection
    });

    /* ============================================================
       🧠 دمج التاريخ
       ============================================================ */
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

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

    reply = interceptSovereigntyBreach(reply);

    return reply.replace(/\n{3,}/g, "\n\n");

  } catch (error) {
    console.error("❌ Groq Kernel Execution Error:", error);
    throw error;
  }
}

