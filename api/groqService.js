/**
 * api/groqService.js – Sovereign Heavy Kernel (النسخة المدعومة بالوعي السياقي المستمر)
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
       🌐 الذكاء الحي المحدود + الوعي السياقي المستمر (Contextual Intent)
       ============================================================ */
    const realTimeKeywords = [
      "طقس", "الجو", "حرارة اليوم", "مطر اليوم",
      "سعر اليوم", "أسعار اليوم", "سعر العملة", "سعر الذهب", "سعر البيتكوين",
      "أخبار اليوم", "حدث اليوم", "نتائج الماتش", "مباراة اليوم",
      "رابط تحميل", "موقع رسمي", "أحدث إصدار", "تحديث 2026", "2026"
    ];
    
    let needsSearch = extra.forceSearch || realTimeKeywords.some(kw => prompt.includes(kw));

    // 🧠 رصد السياق المستمر: هل آخر سؤال سأله المستخدم كان استعلاماً حياً (مثل الطقس)، والآن يصحح مكانه؟
    let lastUserMessage = "";
    let wasLastQueryRealTime = false;

    if (!needsSearch && Array.isArray(extra.history) && extra.history.length > 0) {
      const userMsgs = extra.history.filter(h => h.role === "user");
      if (userMsgs.length > 0) {
        lastUserMessage = userMsgs[userMsgs.length - 1].content;
        wasLastQueryRealTime = realTimeKeywords.some(kw => lastUserMessage.includes(kw));
        
        if (wasLastQueryRealTime) {
          // تفعيل البحث تلقائياً لأن المستخدم يوضح أو يصحح معطى لسؤال سابق يتطلب بيانات حية
          needsSearch = true;
        }
      }
    }

    const locationContext = extra.locationContext || ""; 

    let liveSearchContext = "";
    if (needsSearch) {
      try {
        let searchQuery = prompt;

        // ذكاء صياغة الاستعلام بناءً على السياق المستمر
        const isWeatherRelated = prompt.includes("طقس") || prompt.includes("الجو") || (wasLastQueryRealTime && lastUserMessage.match(/(طقس|الجو)/));

        if (isWeatherRelated) {
          if (!prompt.includes("طقس") && !prompt.includes("الجو")) {
            // إذا كانت الرسالة الحالية عبارة عن مكان فقط (مثل: "انا بدمشق")
            searchQuery = `حالة الطقس في ${prompt}`;
          } else {
            searchQuery = prompt;
          }
        } else if (locationContext) {
          searchQuery = `${prompt} ${locationContext}`;
        }

        const searchResult = await autoSearch(searchQuery);
        if (searchResult && !searchResult.includes("⚠️") && !searchResult.includes("لم يتم العثور")) {
          liveSearchContext = `\n\n[بيانات حية وموثوقة مسترجعة من بحث جوجل بناءً على التصحيح السياقي - التزم بها حصراً]:\n${searchResult}\n`;
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
      contextInjection += `\n\n${locationContext} (ملاحظة سيادية: اعتمد مكان المستخدم الحقيقي الذي يذكره شفهياً وتجاهل إحداثيات الـ VPN أو الشبكة).\n`;
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

