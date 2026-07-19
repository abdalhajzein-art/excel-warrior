let sessionHistory = [];

/* طبقة فهم النية نفسها تماماً */
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes("ضيف") || msg.includes("إضافة") || msg.includes("عمود")) return "add_column";
  if (msg.includes("احذف") || msg.includes("حذف") || msg.includes("شيل")) return "delete_column";
  if (msg.includes("عدل") || msg.includes("تعديل") || msg.includes("غير")) return "modify_data";
  if (msg.includes("ولدلي") || msg.includes("انشئ") || msg.includes("ملف جديد") || msg.includes("نظام")) return "create_file";
  if (msg.includes("رجعلي") || msg.includes("عطيني الملف") || msg.includes("النسخة الجديدة") || msg.includes("الملف المعدل")) return "request_modified_file";

  return "chat";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, reset, excelJSON } = req.body; // ⬅ بدل excelContent
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    if (reset === true) {
      sessionHistory = [];
      return res.status(200).json({ reply: "🔄 تم بدء جلسة جديدة." });
    }

    const intent = detectIntent(message);

    let fileContext = "";
    if (excelJSON) {
      fileContext = `
      المستخدم أرفق ملف Excel وتم تحويله إلى JSON منظّم.

      معلومات سريعة:
      - عدد الأوراق: ${excelJSON.sheets?.length || 0}

      مهمتك كخبير جداول عام ومتكيّف:
      - افهم الهيدر من JSON.
      - افهم الصفوف الأساسية.
      - افهم الصفوف التعليمية (teachingRows).
      - افهم الصفوف الملخصة (summaryRows).
      - افهم أنواع الأعمدة (types).
      - افهم الصيغ (formulas).
      - إذا وُجدت charts، افهم وصفها فقط ولا تحاول توليد مخطط فعلي.
      `;
    }

    sessionHistory.push({
      role: "user",
      content: `
      نية المستخدم: ${intent}
      رسالة المستخدم:
      ${message}

      سياق الملف:
      ${fileContext}
      `
    });

    const messagesToSend = [
      {
        role: "system",
        content: `
        أنت مساعد ذكي عام ومتكيّف، موظّف خبير ومحارب شغل.

        - رد بأسلوب طبيعي يشبه الإنسان.
        - اشتغل كخبير جداول يفهم JSON القادم من السيرفر.
        - لا تنفّذ أي تعديل بنفسك.
        - لا تولّد ملف Excel بنفسك.
        - لما المستخدم يطلب تنفيذ تعديل، فكّر بخريطة تعديل (editMap) واضحة يمكن للسيرفر تنفيذها.

        مثال لخريطة تعديل:
        { "action": "add_column", "headerName": "سبب الغياب", "positionAfter": "الغياب", "defaultValue": "—" }
        `
      },
      ...sessionHistory
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

    const data = await response.json();
    const aiReply = data?.choices?.[0]?.message?.content;

    if (aiReply) {
      sessionHistory.push({
        role: "assistant",
        content: aiReply
      });

      return res.status(200).json({ reply: aiReply });
    } else {
      return res.status(500).json({
        reply: "⚠️ الخطأ الكامل من Groq: " + JSON.stringify(data)
      });
    }

  } catch (error) {
    return res.status(500).json({
      reply: "⚠️ خطأ في الاتصال: " + error.message
    });
  }
}
