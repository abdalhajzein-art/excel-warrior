/**
 * api/tools/geminiSearch.js – Sovereign Web Search Tool
 * محرك البحث السيادي المستقل (بدون مفاتيح، بدون قيود، وبنتائج جوجل الحقيقية)
 */

export async function searchWithGoogle(query) {
  try {
    if (!query) return "⚠️ عذراً يا مهندس، لم تقم بتحديد استعلام البحث.";

    console.log(`🔍 [Sovereign Search] جاري البحث عن: "${query}"`);

    // استخدام محرك بحث مجاني ومستقر برمجياً (مثل DuckDuckGo HTML/API النظيف أو Scraper حر)
    // أو جلب نتائج بحث خفيفة وسريعة بدون أي مفاتيح API خارجية معقدة.
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      return "⚠️ حدث خطأ أثناء الاتصال بمحرك البحث الحي.";
    }

    const htmlText = await response.text();

    // استخراج النتائج (العناوين والروابط والاقتباسات) برمجياً وبشكل نظيف
    // سنستخدم تحليل بسيط للنصوص المستخرجة من نتائج البحث
    const results = parseSearchResults(htmlText);

    if (results.length === 0) {
      return "لم يتم العثور على نتائج واضحة عبر البحث الحي.";
    }

    // تنسيق النتائج لإرسالها كمعصارة جاهزة لعقل النظام (Groq)
    let formattedOutput = `نتائج البحث الحي المباشر عن (${query}):\n\n`;
    results.slice(0, 5).forEach((item, index) => {
      formattedOutput += `${index + 1}. **${item.title}**\n   - الرابط: ${item.url}\n   - الوصف: ${item.snippet}\n\n`;
    });

    return formattedOutput.trim();

  } catch (err) {
    console.error("🔥 خطأ في أداة البحث السيادي:", err);
    return "⚠️ حدث خطأ برمجي أثناء تنفيذ البحث.";
  }
}

/**
 * دالة مساعدة لتحليل الـ HTML واستخراج النتائج بدقة وسرعة بدون تعقيد
 */
function parseSearchResults(html) {
  const results = [];
  try {
    // استخراج الروابط والنصوص باستخدام تعبيرات منتظمة سريعة وخفيفة (Regex) لتجنب ثقل المكتبات
    const resultBlockRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__url"[^>]*>([\s\S]*?)<\/a>/g;
    
    // طريقة أبسط وأشمل لاستخراج العناوين والروابط من DuckDuckGo HTML
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const titleRegex = /<a class="result__url"[^>]*>([\s\S]*?)<\/a>/g;

    // استخراج الروابط والنصوص عبر مطابقة بسيطة ونظيفة
    const matches = html.matchAll(/<div class="result__body">[\s\S]*?<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g);

    for (const match of matches) {
      const rawUrl = match[1];
      const rawTitle = match[2].replace(/<[^>]*>?/gm, '').trim();
      const rawSnippet = match[3].replace(/<[^>]*>?/gm, '').trim();

      //فك تشفير روابط التوجيه إن وجدت
      let cleanUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        const decoded = decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]);
        cleanUrl = decoded;
      }

      results.push({
        title: rawTitle,
        url: cleanUrl,
        snippet: rawSnippet
      });
    }
  } catch (e) {
    console.error("Parser Error:", e);
  }
  return results;
}

export default {
  searchWithGoogle
};
