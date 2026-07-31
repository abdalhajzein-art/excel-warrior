/**
 * api/groqService.js – Sovereign Heavy Kernel (Agentic Intent Router & Smart Guard Edition)
 * النسخة الخالية من الكلمات المفتاحية مع حارس سيادة ذكي يعتمد على السياق (Context-Aware Guard)
 */

import { Groq } from "groq-sdk";
import getSystemPrompt from "./agent/system.js"; 
import { autoSearch } from "./tools/index.js";    

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ============================================================
   🛡️ Smart Sovereignty Guard (حارس السيادة الذكي المعتمد على السياق)
   ============================================================ */
async function interceptSovereigntyBreach(reply, originalPrompt, groqInstance) {
  if (!reply) return reply;
  
  const lowerReply = reply.toLowerCase();
  const genericRefusals = [
    "i'm sorry", "i am sorry", "i can't", "i cannot", "as an ai", "as an artificial intelligence",
    "آسف", "لا أستطيع", "لا يمكنني", "عذراً", "بصفتي ذكاء"
  ];

  const isBreach = genericRefusals.some(phrase => lowerReply.includes(phrase));

  if (!isBreach) {
    return reply; // إذا كان الرد سليماً، مرره كما هو
  }

  console.log("🛡️ [Sovereignty Guard] تم رصد انزلاق روبوتي، جاري معالجة النية وإعادة الصياغة بأسلوب الأثير...");

  try {
    // استدعاء طوارئ سريع للنموذج لإعادة صياغة الرفض بناءً على موضوع السؤال
    const rescueCompletion = await groqInstance.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { 
          role: "system", 
          content: `أنت الآن تلعب دور 'الأثير'، منصة الذكاء الاصطناعي السيادية الخاصة.
النموذج الأساسي رفض الإجابة على طلب المستخدم بطريقة روبوتية تقليدية مزعجة.
مهمتك: اقرأ سؤال المستخدم، واقرأ الرفض، ثم قم بصياغة رد يوضح سبب عدم القدرة على التنفيذ بناءً على سياق سؤاله تحديداً (سواء كان سؤال برمجي، أو بيانات، أو عام). 
تحدث بروح الزميل والمهندس المعماري، اقترح حلاً أو زاوية أخرى للنقاش، وإياك أن تستخدم عبارات مثل 'بصفتي نموذج' أو تعتذر بضعف.` 
        },
        { 
          role: "user", 
          content: `سؤال المستخدم كان: "${originalPrompt}"\nالرفض الروبوتي الذي يجب تغييره: "${reply}"` 
        }
      ],
      temperature: 0.4,
      max_tokens: 250
    });

    return rescueCompletion.choices[0].message.content.trim();

  } catch (e) {
    // خط الدفاع الأخير في حال فشل الاستدعاء، رد ديناميكي مرن يناسب أي موضوع
    return "يا مهندس، يبدو أن هناك تعقيداً يمنعني من معالجة هذا الطلب من هذه الزاوية. هل يمكننا تفكيك المشكلة ومقاربتها بطريقة تحليلية أو برمجية أخرى؟";
  }
}

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];
    const locationContext = extra.locationContext || ""; 
    let needsSearch = extra.forceSearch || false;
    let searchQuery = prompt;

    /* ============================================================
       🧠 Micro-Agent: Pure Semantic Intent Router (تحليل نوايا مجرد)
       الاعتماد على المنطق الزمني فقط بدون أي أمثلة أو كلمات مفتاحية
       ============================================================ */
    if (!needsSearch) {
      const routerPrompt = `أنت محلل نوايا هندسي مجرد (Semantic Intent Router).
المهمة: حلل رسالة المستخدم منطقياً وزمنياً.
القاعدة المطلقة: أرجع needs_search: true حصراً إذا كانت إجابة المستخدم تعتمد على بيانات "متغيرة زمنياً" (Time-variant) أو "مستجدة لحظياً" يستحيل أن تكون موجودة في ذاكرة تدريبك الثابتة، بغض النظر عن موضوع السؤال.
إذا كانت الإجابة تعتمد على حقائق ثابتة، نظريات، أو توليد أفكار، أرجع false.
موقع المستخدم الجغرافي: ${locationContext}
يجب أن ترد حصراً بكائن JSON بالهيكلية التالية، بدون أي نص إضافي:
{
  "needs_search": true or false,
  "search_query": "إذا true، اكتب استعلام بحث مجرد ودقيق لجوجل. وإذا false اتركها فارغة"
}`;

      try {
        const intentResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: routerPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1, // حرارة منخفضة جداً لضمان دقة التحليل كآلة
          max_tokens: 150
        });

        const intentData = JSON.parse(intentResponse.choices[0].message.content);
        needsSearch = intentData.needs_search;
        
        if (needsSearch && intentData.search_query) {
          searchQuery = intentData.search_query;
          console.log(`🔍 [Intent Router] قرر البحث عن: ${searchQuery}`);
        }
      } catch (routerErr) {
        console.error("⚠️ فشل محلل النوايا الذكي، سيتم تجاوز البحث:", routerErr);
      }
    }

    /* ============================================================
       🌐 تنفيذ البحث الحي (إذا قرر الـ Router ذلك)
       ============================================================ */
    let liveSearchContext = "";
    if (needsSearch) {
      try {
        const searchResult = await autoSearch(searchQuery);
        if (searchResult && !searchResult.includes("⚠️") && !searchResult.includes("لم يتم العثور")) {
          liveSearchContext = `\n\n[بيانات حية وموثوقة مسترجعة من محرك البحث لتلبية نية المستخدم - التزم بها حصراً للإجابة]:\n${searchResult}\n`;
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
      contextInjection += `\n\n${locationContext} (ملاحظة سيادية: اعتمد مكان المستخدم الحقيقي الذي يذكره وتجاهل أي إحداثيات تقنية متضاربة).\n`;
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
       🧠 الرد النهائي عبر Groq (الاعتماد على الذاكرة الداخلية الضخمة + البحث إن وجد)
       ============================================================ */
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: 0.6,
      max_tokens: 1500
    });

    let reply = completion.choices[0].message.content.trim();

    // تمرير الرد إلى حارس السيادة الذكي لتنقيحه إن لزم الأمر
    reply = await interceptSovereigntyBreach(reply, prompt, groq);

    return reply.replace(/\n{3,}/g, "\n\n");

  } catch (error) {
    console.error("❌ Groq Kernel Execution Error:", error);
    throw error;
  }
}
