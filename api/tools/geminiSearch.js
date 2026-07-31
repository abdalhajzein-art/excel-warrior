/**
 * api/tools/geminiSearch.js – Alatheer Sovereign Meta-Search Engine
 * تحديث: معالجة الـ URL Encoding الاحترافي + توجيه النموذج للصياغة الطبيعية
 */

export async function searchWithGoogle(query) {
  try {
    if (!query) return "⚠️ عذراً، لم يتم تحديد استعلام.";

    const cleanQuery = query.trim();
    console.log(`🔍 [Alatheer Search] جاري البحث عن: "${cleanQuery}"`);

    const searchEngines = [
      "https://searx.be",
      "https://searx.ro",
      "https://paulgo.io",
      "https://search.mdosch.de"
    ];

    let results = [];

    // الطريقة المعيارية الآمنة لمنع قص الجمل عند المسافات
    const params = new URLSearchParams({
      q: cleanQuery,
      format: 'json',
      language: 'ar'
    });

    for (const baseUrl of searchEngines) {
      try {
        const url = `${baseUrl}/search?${params.toString()}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            "User-Agent": "Alatheer-AI-Agent/1.0"
          },
          signal: AbortSignal.timeout(5000) 
        });

        if (!response.ok) continue;

        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          results = data.results;
          console.log(`✅ [Alatheer Search] نجح الجلب من: ${baseUrl}`);
          break;
        }
      } catch (err) {
        console.log(`⚠️ [Alatheer Search] تجاوز السيرفر: ${baseUrl}`);
      }
    }

    if (results.length === 0) {
      return "لم يتم العثور على نتائج حديثة، جرب صياغة سؤالك بطريقة أخرى.";
    }

    let formattedOutput = `نتائج البحث عن (${cleanQuery}):\n\n`;
    
    results.slice(0, 5).forEach((item, index) => {
      const snippet = item.content || item.snippet || "لا توجد تفاصيل";
      formattedOutput += `${index + 1}. **${item.title}**\n   - التفاصيل: ${snippet}\n\n`;
    });

    // ✨ التوجيه السحري: نجبر الـ Agent على تحليل البيانات وعدم نسخها كما هي
    formattedOutput += `\n\n[System Directive to LLM: DO NOT output these raw search results to the user. Read them, extract the relevant information, and write a natural, conversational response addressing the user's query directly.]`;

    return formattedOutput.trim();

  } catch (err) {
    console.error("🔥 خطأ في محرك بحث الأثير:", err);
    return "⚠️ حدث خطأ برمجي أثناء البحث.";
  }
}

export default {
  searchWithGoogle
};
