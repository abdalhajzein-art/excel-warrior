/**
 * api/groqService.js – Sovereign Heavy Kernel (النسخة النهائية المحصنة - أولوية الذاكرة الداخلية)
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
       🌐 الذكاء الحي المحدود: البحث حصراً للبيانات اللحظية والمتغيرة مع الزمن
       ============================================================ */
    const realTimeKeywords = [
      "طقس", "الجو", "حرارة اليوم", "مطر اليوم",
      "سعر اليوم", "أسعار اليوم", "سعر العملة", "سعر الذهب", "سعر البيتكوين",
      "أخبار اليوم", "حدث اليوم", "نتائج الماتش", "مباراة اليوم",
      "رابط تحميل", "موقع رسمي", "أحدث إصدار", "تحديث 2026", "2026"
    ];
    
    // البحث لا يتم إلا للضرورة القصوى للبيانات اللحظية أو بالطلب الإجباري
    const needsSearch = extra.forceSearch || realTimeKeywords.some(kw => prompt.includes(kw));
    const locationContext = extra.locationContext || ""; 

    let liveSearchContext = "";
    if (needsSearch) {
      try {
        const searchQuery = locationContext ? `${prompt} ${locationContext}` : prompt;
        const searchResult = await autoSearch(searchQuery);
        if (searchResult && !searchResult.includes("⚠️") && !searchResult.includes("لم يتم العثور")) {
          liveSearchContext = `\n\n[بيانات حية وموثوقة مسترجعة من بحث جوجل - التزم بها حصراً للبيانات الآنية]:\n${searchResult}\n`;
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
      contextInjection += `\n\n${locationContext} (ملاحظة سيادية: إذا صحح المستخدم مكانه شفهياً، اعتمد مكانه الحقيقي وتجاهل الإحداثيات التقنية).\n`;
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
       🧠 تنفيذ الطلب عبر Groq (الاعتماد على الذاكرة الداخلية الضخمة)
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
