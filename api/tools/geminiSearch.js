/**
 * api/tools/geminiSearch.js – Sovereign Direct Google Search Tool
 * محرك البحث السيادي المباشر عبر جلب صفحات جوجل التقليدية (بدون مفاتيح، بدون قيود)
 */

export async function searchWithGoogle(query) {
  try {
    if (!query) return "⚠️ عذراً يا مهندس، لم تقم بتحديد استعلام البحث.";

    console.log(`🔍 [Direct Google Search] جاري البحث المباشر عن: "${query}"`);

    // استهداف صفحة بحث جوجل مباشرة بالطريقة التقليدية
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
      }
    });

    if (!response.ok) {
      return "⚠️ حدث خطأ أثناء الاتصال بمحرك بحث جوجل المباشر.";
    }

    const htmlText = await response.text();

    // تحليل نتائج صفحة جوجل الحقيقية
    const results = parseGoogleSearchResults(htmlText);

    if (results.length === 0) {
      return "لم يتم العثور على نتائج واضحة عبر بحث جوجل المباشر.";
    }

    let formattedOutput = `نتائج البحث المباشر من جوجل عن (${query}):\n\n`;
    results.slice(0, 5).forEach((item, index) => {
      formattedOutput += `${index + 1}. **${item.title}**\n   - الرابط: ${item.url}\n   - الوصف: ${item.snippet}\n\n`;
    });

    return formattedOutput.trim();

  } catch (err) {
    console.error("🔥 خطأ في محرك البحث المباشر لجوجل:", err);
    return "⚠️ حدث خطأ برمجي أثناء تنفيذ البحث المباشر.";
  }
}

/**
 * دالة تحليل هيكل HTML الخاص بصفحة نتائج جوجل التقليدية
 */
function parseGoogleSearchResults(html) {
  const results = [];
  try {
    // تعبير منتظم يلتقط العناوين والروابط من نتائج جوجل الكلاسيكية
    const matches = html.matchAll(/<div[^>]*class="[^"]*g[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/url\?q=([^&"]+)[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]*class="[^"]*(?:VwiC3b|yXK7lf|IsZvec)[^"]*"[^>]*>([\s\S]*?)<\/div>/g);

    for (const match of matches) {
      const rawUrl = match[1];
      const rawTitle = match[2].replace(/<[^>]*>?/gm, '').trim();
      const rawSnippet = match[3].replace(/<[^>]*>?/gm, '').trim();

      let cleanUrl = rawUrl;
      try {
        cleanUrl = decodeURIComponent(rawUrl);
      } catch (e) {}

      if (rawTitle && cleanUrl.startsWith('http')) {
        results.push({
          title: rawTitle,
          url: cleanUrl,
          snippet: rawSnippet || ""
        });
      }
    }

    // مطابقة احتياطية عامة في حال تغير هيكل جوجل قليلاً
    if (results.length === 0) {
      const simpleLinks = html.matchAll(/href="https?:\/\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let count = 0;
      for (const link of simpleLinks) {
        const url = `https://${link[1]}`;
        const title = link[2].replace(/<[^>]*>?/gm, '').trim();
        if (title.length > 5 && !url.includes('google.com') && count < 5) {
          results.push({ title, url, snippet: "نتيجة مباشرة من كشاف جوجل" });
          count++;
        }
      }
    }
  } catch (e) {
    console.error("Google Parser Error:", e);
  }
  return results;
}

export default {
  searchWithGoogle
};
