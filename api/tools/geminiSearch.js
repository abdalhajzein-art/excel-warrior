/**
 * api/tools/geminiSearch.js – Google Gemini Search Grounding Tool
 * أداة البحث المستقلة عبر Google Gemini API مع تفعيل البحث الحي (Google Search Grounding)
 */

export async function searchWithGoogle(query) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "⚠️ مفتاح GEMINI_API_KEY غير متوفر في متغيرات البيئة على Railway.";
    }

    if (!query) return "⚠️ عذراً يا مهندس، لم تقم بتحديد استعلام البحث.";

    // استخدام نموذج Gemini يدعم بحث الويب الحي
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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
      tools: [
        {
          googleSearch: {}
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

    // استخراج مصادر الـ Grounding Links وإضافتها للرد
    const groundingMetadata = candidate.groundingMetadata;
    if (groundingMetadata && groundingMetadata.groundingChunks) {
      const sources = groundingMetadata.groundingChunks
        .filter(chunk => chunk.web && chunk.web.uri)
        .map(chunk => `- [${chunk.web.title || chunk.web.uri}](${chunk.web.uri})`)
        .slice(0, 3);

      if (sources.length > 0) {
        reply += `\n\n**المصادر:**\n` + sources.join("\n");
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
