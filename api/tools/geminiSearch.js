/**
 * api/tools/geminiSearch.js – Alatheer Sovereign Meta-Search Engine
 * محرك الأثير التجميعي: يبحث في Google و Bing وغيرها ويعيد النتائج بصيغة JSON نظيفة بدون حظر
 */

export async function searchWithGoogle(query) {
  try {
    if (!query) return "⚠️ عذراً يا مهندس، لم تقم بتحديد استعلام البحث.";

    console.log(`🔍 [Alatheer Search] جاري البحث الاحترافي عن: "${query}"`);

    // قائمة بسيرفرات SearXNG العامة والمجانية (نظام Fallback لضمان الاستقرار 100%)
    const searchEngines = [
      "https://searx.be",
      "https://searx.ro",
      "https://paulgo.io",
      "https://search.mdosch.de"
    ];

    let results = [];

    // المحاولة عبر السيرفرات المتاحة حتى ننجح
    for (const baseUrl of searchEngines) {
      try {
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&language=ar`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            "User-Agent": "Alatheer-AI-Agent/1.0"
          },
          // تحديد وقت أقصى للرد (Timeout) حتى لا يعلق السيرفر
          signal: AbortSignal.timeout(5000) 
        });

        if (!response.ok) continue; // إذا كان السيرفر مشغولاً، جرب الذي بعده

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          results = data.results;
          console.log(`✅ [Alatheer Search] تم جلب النتائج بنجاح من: ${baseUrl}`);
          break; // نجحنا! نخرج من حلقة المحاولات
        }
      } catch (err) {
        // تجاهل خطأ السيرفر الحالي والانتقال للذي يليه بصمت
        console.log(`⚠️ [Alatheer Search] تجاوز السيرفر ${baseUrl}`);
      }
    }

    if (results.length === 0) {
      return "لم يتم العثور على نتائج حديثة أو أن جميع محركات البحث مشغولة حالياً.";
    }

    // تنسيق النتائج ليقرأها Groq ويستخرج منها الإجابة بذكاء
    let formattedOutput = `نتائج البحث المباشرة من الويب عن (${query}):\n\n`;
    
    // نأخذ أفضل 5 نتائج فقط لتوفير التوكنز وإعطاء زبدة الموضوع
    results.slice(0, 5).forEach((item, index) => {
      // تفادي النتائج الفارغة
      const snippet = item.content || item.snippet || "لا يوجد وصف إضافي";
      formattedOutput += `${index + 1}. **${item.title}**\n   - المصدر: ${item.url}\n   - التفاصيل: ${snippet}\n\n`;
    });

    return formattedOutput.trim();

  } catch (err) {
    console.error("🔥 خطأ في محرك بحث الأثير:", err);
    return "⚠️ حدث خطأ برمجي أثناء تنفيذ البحث الاحترافي.";
  }
}

export default {
  searchWithGoogle
};
