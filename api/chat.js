import { SYSTEM_PROMPT } from "./agent/system.js";

let sessionHistory = [];

/* ============================
   فهم النية (ممكن نلغيه لاحقًا)
============================ */
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes("ضيف") || msg.includes("اضافة") || msg.includes("عمود"))
    return "add_column";

  if (msg.includes("احذف") || msg.includes("حذف") || msg.includes("شيل"))
    return "delete_column";

  if (msg.includes("عدل") || msg.includes("تعديل") || msg.includes("غير"))
    return "modify_data";

  return "chat";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, excelJSON, reset } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    /* ============================
       جلسة جديدة
============================ */
    if (reset === true) {
      sessionHistory = [];
      return res.status(200).json({ reply: "🔄 تم بدء جلسة جديدة." });
    }

    if (!message) {
      return res.status(400).json({ reply: "⚠️ الرسالة فارغة." });
    }

    /* ============================
       بناء سياق الملف الحقيقي — نسخة جديدة
============================ */
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

    /* ============================
       إضافة رسالة المستخدم للجلسة
============================ */
    sessionHistory.push({
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

    /* ============================
       بناء الرسالة للذكاء
============================ */
    const messagesToSend = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...sessionHistory
    ];

    /* ============================
       استدعاء Groq
============================ */
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

    /* ============================
       إصلاح خطأ JSON
============================ */
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

    /* ============================
       حفظ رد الذكاء
============================ */
    sessionHistory.push({ role: "assistant", content: aiReply });

    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    return res.status(500).json({
      reply: "⚠️ خطأ في الاتصال: " + error.message
    });
  }
   }
