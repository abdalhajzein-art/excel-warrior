/**
 * api/groqService.js – Clean Sovereign Gateway
 * بوابة خفيفة ونظيفة لتنفيذ طلبات Groq مع دعم البحث الحي السيادي المستقل
 */

import { Groq } from "groq-sdk";
import { searchWithGoogle } from "./tools/geminiSearch.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ============================================================
   🔍 Sovereign Live Search Tool Integration
   ============================================================ */
async function executeLiveSearch(query) {
  try {
    if (!query) return "⚠️ لم يتم تحديد استعلام البحث.";
    // استدعاء محرك البحث السيادي المستقل (بدون مفاتيح وبدون أخطاء 429)
    return await searchWithGoogle(query);
  } catch (err) {
    console.error("🔥 خطأ في تنفيذ البحث السيادي:", err);
    return "⚠️ حدث خطأ برمجي أثناء تنفيذ البحث.";
  }
}

export default async function kernel(prompt, extra = {}) {
  try {
    const messages = [];
    let needsSearch = extra.forceSearch || false;
    let searchQuery = prompt;

    // 1. إذا كان هناك نظام برومبت مخصص تم تمريره، نستخدمه
    if (extra.systemPrompt) {
      messages.push({ role: "system", content: extra.systemPrompt });
    }

    // 2. تحليل النية للبحث الذكي إذا لزم الأمر
    if (!needsSearch && extra.enableIntentRouter !== false) {
      const routerPrompt = `أنت محلل نوايا هندسي مجرد. حلل رسالة المستخدم الأخيرة. أرجع needs_search: true فقط إذا كانت الإجابة تتطلب معلومات متغيرة زمنياً (طقس، أسعار، أخبار). أرجع JSON حصراً: {"needs_search": true/false, "search_query": "..."}`;
      
      try {
        const routerMessages = [{ role: "system", content: routerPrompt }];
        if (Array.isArray(extra.history)) {
          routerMessages.push(...extra.history.slice(-2).map(h => ({ role: h.role, content: h.content })));
        }
        routerMessages.push({ role: "user", content: prompt });

        const intentResponse = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: routerMessages,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 150
        });

        const intentData = JSON.parse(intentResponse.choices[0].message.content);
        needsSearch = intentData.needs_search;
        if (needsSearch && intentData.search_query) {
          searchQuery = intentData.search_query;
        }
      } catch (e) {
        // تجاهل أخطاء الروتر المساعدة للطلب العادي
      }
    }

    // 3. تنفيذ البحث الحي وحقنه إن تطلب الأمر
    if (needsSearch) {
      const searchResult = await executeLiveSearch(searchQuery);
      if (searchResult) {
        messages.push({
          role: "system",
          content: `[بيانات حية مسترجعة من محرك البحث السيادي]:\n${searchResult}`
        });
      }
    }

    // 4. إدراج تاريخ المحادثة
    if (Array.isArray(extra.history)) {
      extra.history.forEach(h => {
        messages.push({
          role: h.role === "assistant" ? "assistant" : "user",
          content: h.content
        });
      });
    }

    // 5. رسالة المستخدم الحالية
    messages.push({ role: "user", content: prompt });

    // 6. الاستعلام النهائي من Groq
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      temperature: extra.temperature || 0.6,
      max_tokens: extra.max_tokens || 1500
    });

    return completion.choices[0].message.content.trim();

  } catch (error) {
    console.error("❌ Groq Gateway Error:", error);
    throw error;
  }
}

