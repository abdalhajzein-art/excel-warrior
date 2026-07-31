/**
 * api/tools/geminiSearch.js – Google Gemini Search Grounding Tool (Flash 3.5)
 * النسخة المتوافقة مع المفتاح المجاني + بحث جوجل الحي
 */

export async function searchWithGoogle(query) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "⚠️ مفتاح GEMINI_API_KEY غير متوفر في متغيرات البيئة على Railway.";
    }

    if (!query) return "⚠️ عذراً يا مهندس، لم تقم بتحديد استعلام البحث.";

    // ⭐ Flash 3.5 – النسخة المجانية التي تدعم Google Search Grounding
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `قم بالبحث في الويب بدقة وأعطني الإجابة مباشرة وباللغة العربية مع التفاصيل والمصادر بناءً على السؤال التالي: ${query}`
            }
          ]
        }
      ],

      // ⭐ صيغة الأدوات الجديدة
      tools: [
        {
          googleSearch: {
            enableSearch: true
          }
        }
      ],

      // ⭐ إعدادات التوليد
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      },

      // ⭐ إعدادات الأمان
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("🔥 خطأ استجابة Google API:", errText);
      return "⚠️ حدث خطأ أثناء الاتصال بمحرك بحث جوجل.";
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate || !candidate.content?.parts?.[0]?.text) {
      return "لم يتم العثور على نتائج واضحة عبر بحث جوجل الحقيقي.";
    }

    let reply = candidate.content.parts[0].text;

    // ⭐ مصادر البحث الحي
    const groundingMetadata = candidate.groundingMetadata;
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      const sources = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web && chunk.web.uri)
        .map(chunk => `- ${chunk.web.title || chunk.web.uri}: ${chunk.web.uri}`)
        .slice(0, 3);

      if (sources.length > 0) {
        reply += `\n\nالمصادر:\n` + sources.join("\n");
      }
    }

    return reply.trim();

  } catch (err) {
    console.error("🔥 خطأ في أداة بحث جوجل:", err);
    return "⚠️ حدث خطأ برمجي أثناء تنفيذ بحث جوجل.";
  }
}

export default {
  searchWithGoogle
};
