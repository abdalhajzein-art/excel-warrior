let sessionHistory = [];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message, reset, excelContent } = req.body;
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

    let fileContext = "";
    if (excelContent) {
      fileContext = `
      هذا هو محتوى ملف Excel الذي رفعه المستخدم:
      ${JSON.stringify(excelContent, null, 2)}

      حلّل الملف، افهمه، اقترح تعديلات، ناقش، واسأل المستخدم.
      لا تنفّذ أي تعديل بنفسك.
      إذا طلب المستخدم شيئاً مثل:
      "عطيني الملف المعدل"، "رجّعلي الملف"، "طبّق التعديل"، "اعمل التعديل"، "رجّعلي النسخة الجديدة"
      لا تقم بأي تعديل فعلي، بل رد بجملة طبيعية مثل:
      "تمام… خليني حضّرلك النسخة الجديدة."
      أو:
      "جاهز… رح جهّزلك النسخة المعدّلة."
      أو:
      "تمام… رح أرتّبلك النسخة الجديدة."
      ولا تذكر أي شيء عن سيرفرات أو تنفيذ خارجي.
      `;
    }

    sessionHistory.push({
      role: "user",
      content: fileContext + "\n\n" + message
    });

    const messagesToSend = [
      {
        role: "system",
        content: `
        رد بأسلوب طبيعي يشبه الإنسان، ناقش، اسأل، واقترح.
        لا تنشئ هوية أو اسم لنفسك.
        لا تتحدث عن سيرفرات أو تنفيذ خارجي أو بنية النظام.
        لا تنفّذ أي تعديل بنفسك على الملف.
        إذا طلب المستخدم تعديل الملف بشكل مباشر، استخدم جملة طبيعية تدل على أنك ستجهّز نسخة جديدة،
        بدون ذكر تفاصيل تقنية، مثل:
        "تمام… خليني حضّرلك النسخة الجديدة."
        أو:
        "جاهز… رح جهّزلك النسخة المعدّلة."
        أو:
        "تمام… رح أرتّبلك النسخة الجديدة."
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

      return res.status(200).json({
        reply: aiReply
      });
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
