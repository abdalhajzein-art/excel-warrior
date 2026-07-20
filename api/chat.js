import { SYSTEM_PROMPT } from "./agent/system.js";

const sessions = new Map(); // تاريخ منفصل لكل sessionId

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, excelJSON, sessionId } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        reply: "⚠️ sessionId غير موجود — الجلسات لن تعمل بشكل صحيح."
      });
    }

    if (!message) {
      return res.status(400).json({ reply: "⚠️ الرسالة فارغة." });
    }

    // إنشاء جلسة إذا غير موجودة
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }

    const history = sessions.get(sessionId);

    /* سياق الملف */
    let fileContext = "";

    if (excelJSON && Array.isArray(excelJSON) && excelJSON.length > 0) {
      const first = excelJSON[0];

      if (!first.file_id || !first.base64 || !first.sheets) {
        return res.status(400).json({
          reply: "⚠️ الملف لم يُرفع بشكل صحيح."
        });
      }

      fileContext = `
🔹 معلومات الملف:
- file_id: ${first.file_id}
- filename: ${first.filename}
- عدد الشيتات: ${first.sheets.length}

🔹 الهيدر:
${first.sheets[0].header.join(", ")}

🔹 الملف جاهز للتعديل عبر الأدوات.
`;
    }

    /* إضافة رسالة المستخدم */
    history.push({
      role: "user",
      content: `
رسالة المستخدم:
${message}

سياق الملف:
${fileContext}

بيانات الملف:
${excelJSON && excelJSON.length > 0 ? JSON.stringify(excelJSON[0]) : "لا يوجد ملف"}
`
    });

    /* بناء الرسائل للذكاء */
    const messagesToSend = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: messagesToSend,
        temperature: 0.4
      })
    });

    let data;
    try {
      data = await response.json();
    } catch (err) {
      const rawText = await response.text();
      return res.status(500).json({
        reply: "⚠️ خطأ من Groq: الرد ليس JSON.\nالنص الكامل:\n" + rawText
      });
    }

    const aiReply = data?.choices?.[0]?.message?.content;

    if (!aiReply) {
      return res.status(500).json({
        reply: "⚠️ خطأ من Groq: " + JSON.stringify(data)
      });
    }

    history.push({ role: "assistant", content: aiReply });

    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    return res.status(500).json({
      reply: "⚠️ خطأ في الاتصال: " + error.message
    });
  }
}
