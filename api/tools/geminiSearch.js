/**
 * api/tools/geminiSearch.js – Sovereign Stable Search Engine
 * محرك بحث يعتمد على DuckDuckGo HTML المستقر والمقاوم للحظر
 */

export async function searchWithGoogle(query) {
  try {
    if (!query) return "";

    const cleanQuery = query.trim();
    console.log(`🔍 [Alatheer Search] جاري البحث الفعلي عن: "${cleanQuery}"`);

    // نستخدم DuckDuckGo HTML لأنه لا يحظر السيرفرات ويدعم العربية بامتياز
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8"
      }
    });

    if (!response.ok) return "لم أتمكن من جلب النتائج حالياً.";

    const htmlText = await response.text();

    // استخراج النتائج برمجياً بطريقة نظيفة
    const results = [];
    const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    let count = 0;

    while ((match = regex.exec(htmlText)) !== null && count < 3) {
      // تنظيف النص من أكواد HTML
      let snippet = match[1].replace(/<[^>]*>?/gm, '').trim();
      if (snippet) {
        // تطبيق المعمارية الموصى بها لضغط التوكنز
        results.push(`[${count + 1}] الملخص: ${snippet}`);
        count++;
      }
    }

    if (results.length === 0) {
      return "لا توجد معلومات حديثة واضحة.";
    }

    return results.join("\n");

  } catch (err) {
    console.error("🔥 خطأ في محرك البحث:", err);
    return "";
  }
}

export default {
  searchWithGoogle
};
