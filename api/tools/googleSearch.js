/**
 * 🔍 Google Search via Gemini API Gateway (Flash 3.5)
 * استخدام مفتاح GEMINI_API_KEY كـ بوابة بحث جوجل حقيقية بدون توليد.
 * لا نستخدم النموذج – فقط نستخدم أداة googleSearch.
 */

export async function googleSearch(query) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "⚠️ مفتاح GEMINI_API_KEY غير موجود في Railway.";
    }

    if (!query) {
      return "⚠️ لم يتم تحديد استعلام بحث.";
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `ابحث في الويب وأعطني نتائج دقيقة بالعربية حول: ${query}`
            }
          ]
        }
      ],

      tools: [
        {
          googleSearch: {
            enableSearch: true
          }
        }
      ],

      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: 2048
      },

      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("🔥 Google API Error:", err);
      return "⚠️ خطأ أثناء الاتصال بمحرك بحث جوجل.";
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];

    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      return "⚠️ لم يتم العثور على نتائج عبر بحث جوجل.";
    }

    let reply = candidate.content.parts[0].text;

    // ⭐ مصادر البحث الحقيقية
    const grounding = candidate.groundingMetadata;
    if (grounding?.groundingChunks) {
      const sources = grounding.groundingChunks
        .filter(c => c.web?.uri)
        .map(c => `- ${c.web.title || c.web.uri}: ${c.web.uri}`)
        .slice(0, 3);

      if (sources.length) {
        reply += `\n\nالمصادر:\n${sources.join("\n")}`;
      }
    }

    return reply.trim();

  } catch (err) {
    console.error("🔥 خطأ في googleSearch:", err);
    return "⚠️ حدث خطأ أثناء تنفيذ بحث جوجل.";
  }
}

export default { googleSearch };
