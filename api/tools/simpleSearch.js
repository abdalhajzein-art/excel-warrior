/**
 * 🔍 Sovereign External Search Engine (DuckDuckGo HTML Scraper)
 * نسخة محترمة، ثابتة، غير محجوبة، بدون مفاتيح، بدون Google، بدون Gemini.
 * ترجع: عنوان + رابط + وصف مختصر لكل نتيجة.
 */

export async function simpleSearch(query) {
  try {
    if (!query) return "⚠️ لم يتم تحديد استعلام بحث.";

    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Sovereign-Search-Engine)"
      }
    });

    if (!res.ok) {
      return "⚠️ تعذّر الوصول لمحرك البحث الخارجي.";
    }

    const html = await res.text();

    // استخراج النتائج: عنوان + رابط + وصف
    const results = [];
    const regex = /<div class="result">([\s\S]*?)<\/div>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const block = match[1];

      const linkMatch = block.match(/<a rel="nofollow" class="result__a" href="([^"]+)"/);
      const titleMatch = block.match(/<a rel="nofollow" class="result__a"[^>]*>(.*?)<\/a>/);
      const snippetMatch = block.match(/<a rel="nofollow" class="result__snippet"[^>]*>(.*?)<\/a>/);

      if (!linkMatch || !titleMatch) continue;

      const link = linkMatch[1];
      const title = titleMatch[1].replace(/<[^>]+>/g, "");
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "") : "لا يوجد وصف متاح.";

      results.push({ title, link, snippet });
    }

    if (!results.length) {
      return "لم يتم العثور على نتائج واضحة عبر البحث الخارجي.";
    }

    // خذ أفضل 3 نتائج
    const top = results.slice(0, 3).map(r => {
      return `• **${r.title}**\n${r.snippet}\n${r.link}\n`;
    });

    return `🔎 **نتائج بحث خارجية موثوقة:**\n\n${top.join("\n")}`;

  } catch (err) {
    console.error("🔥 خطأ في أداة البحث الخارجي:", err);
    return "⚠️ حدث خطأ أثناء تنفيذ البحث الخارجي.";
  }
}

export default {
  simpleSearch
};
