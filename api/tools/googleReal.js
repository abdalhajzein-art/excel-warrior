/**
 * 🔍 Google Real Search via DuckDuckGo Proxy (!g)
 * نطاق بحث كامل من جوجل – بدون مفاتيح – بدون API – بدون Gemini.
 * نستخدم DuckDuckGo لإعادة توجيه البحث إلى جوجل ثم نscrape صفحة جوجل نفسها.
 */

export async function googleReal(query) {
  try {
    if (!query) return "⚠️ لم يتم تحديد استعلام بحث.";

    // ⭐ DuckDuckGo → Google Proxy
    const url = `https://duckduckgo.com/?q=!g+${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (excel-warrior)"
      },
      redirect: "follow" // ⭐ مهم جداً ليتبع التحويل إلى جوجل
    });

    if (!res.ok) {
      return "⚠️ تعذّر الوصول إلى جوجل عبر DuckDuckGo.";
    }

    const html = await res.text();

    // ⭐ استخراج نتائج جوجل من صفحة HTML
    const results = [];
    const regex = /<a href="\/url\?q=([^"]+)"[^>]*>(.*?)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const link = decodeURIComponent(match[1].split("&")[0]);
      const title = match[2].replace(/<[^>]+>/g, "");
      results.push({ title, link });
    }

    if (!results.length) {
      return "⚠️ لم يتم العثور على نتائج جوجل.";
    }

    const top = results.slice(0, 5).map(r => {
      return `• **${r.title}**\n${r.link}\n`;
    });

    return `🔎 **نتائج جوجل الحقيقية (بدون مفاتيح):**\n\n${top.join("\n")}`;

  } catch (err) {
    console.error("🔥 خطأ في googleReal:", err);
    return "⚠️ حدث خطأ أثناء تنفيذ بحث جوجل.";
  }
}

export default { googleReal };
