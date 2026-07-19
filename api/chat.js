let sessionHistory = [];

/* ============================
   المطابقة الذكية للهيدر
============================ */
function normalizeArabic(text) {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^ء-ي0-9 ]/g, "")
    .trim();
}

function findClosestHeader(userWord, headers) {
  const normalizedUser = normalizeArabic(userWord);

  let bestMatch = null;
  let bestScore = 0;

  headers.forEach(h => {
    const normalizedHeader = normalizeArabic(h);

    let score = 0;

    if (normalizedHeader === normalizedUser) score += 5;
    if (normalizedHeader.includes(normalizedUser)) score += 3;
    if (normalizedUser.includes(normalizedHeader)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = h;
    }
  });

  return bestMatch;
}

/* ============================
   استخراج اسم العمود من كلام المستخدم
============================ */
function extractColumnNameFromMessage(msg) {
  const keywords = ["بعد", "جنب", "بجانب", "following", "next to"];
  let cleaned = msg;

  keywords.forEach(k => cleaned = cleaned.replace(k, ""));
  return cleaned.trim();
}

/* ============================
   فهم النية
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
       إصلاح زر جلسة جديدة
============================ */
    if (reset === true) {
      sessionHistory = [];
      return res.status(200).json({ reply: "🔄 تم بدء جلسة جديدة." });
    }

    if (!message) {
      return res.status(400).json({ reply: "⚠️ الرسالة فارغة." });
    }

    /* ============================
       مسح الجلسة إذا الرسالة ليست تعديل
============================ */
    const msg = message.toLowerCase();
    const isEditIntent =
      msg.includes("ضيف") ||
      msg.includes("اضافة") ||
      msg.includes("عمود") ||
      msg.includes("تعديل") ||
      msg.includes("غياب") ||
      msg.includes("اجازة");

    if (!isEditIntent) {
      sessionHistory = [];
    }

    const intent = detectIntent(message);

    /* ============================
       قراءة الهيدر الحقيقي
============================ */
    const headers = excelJSON?.sheets?.[0]?.header || [];

    /* ============================
       بناء سياق الملف
============================ */
    let fileContext = "";
    if (excelJSON) {
      fileContext = `
      الهيدر الحقيقي:
      ${headers.join(", ")}

      مهمتك:
      - افهم الهيدر الحقيقي.
      - استخدم المطابقة الذكية لاختيار العمود الصحيح.
      - لا تعتمد على ما يكتبه المستخدم حرفيًا.
      - ابنِ خريطة تعديل واضحة (editMap).
      - اسأل المستخدم قبل التنفيذ.
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

    /* ============================
       بناء الرسالة للذكاء
============================ */
    const messagesToSend = [
      {
        role: "system",
        content: `
        أنت مساعد ذكي يفهم النية، ويستخدم الهيدر الحقيقي من JSON.
        استخدم المطابقة الذكية لاختيار العمود الصحيح.
        لا تعتمد على الكتابة الحرفية للمستخدم.
        لا تنفّذ أي تعديل بنفسك.
        فقط ابنِ editMap واسأل المستخدم:
        "تمام… هذا التعديل جاهز. بدك أنفّذ؟"
        `
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

    const data = await response.json();
    const aiReply = data?.choices?.[0]?.message?.content;

    if (!aiReply) {
      return res.status(500).json({
        reply: "⚠️ خطأ من Groq: " + JSON.stringify(data)
      });
    }

    sessionHistory.push({ role: "assistant", content: aiReply });

    return res.status(200).json({ reply: aiReply });

  } catch (error) {
    return res.status(500).json({
      reply: "⚠️ خطأ في الاتصال: " + error.message
    });
  }
}
