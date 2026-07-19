// api/chat.js

let sessionHistory = []; 
// تخزين سياق الجلسة

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { message } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        reply: "⚠️ GROQ_API_KEY غير موجود ضمن المتغيرات البيئية"
      });
    }

    // إضافة رسالة المستخدم للجلسة
    sessionHistory.push({
      role: "user",
      content: message
    });

    // بناء الرسائل المرسلة للذكاء
    const messagesToSend = [
      {
        role: "system",
        content: `
        رد بأسلوب طبيعي يشبه الإنسان، قدّم اقتراحات، ناقش،
        اسأل المستخدم إذا كان يفضّل خيار معيّن، واطرح بدائل عندما يكون ذلك مناسباً.
        لا تنشئ هوية أو اسم لنفسك، ولا تقدّم ردود حازمة على الأمور التي لا تستطيع تنفيذها.
        تفاعل مع المستخدم بطريقة مرنة ولطيفة، وركّز دائماً على مساعدته ضمن قدراتك.
        يمكنك استخدام إيموجي خفيفة عندما يكون ذلك مناسباً لتلطيف الأسلوب، بدون مبالغة أو إكثار.
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
        model: "llama-3.1-70b-specdec-uncensored",   // ← التعديل المهم هون
        messages: messagesToSend,
        temperature: 0.4
      })
    });

    const data = await response.json();
    const aiReply = data?.choices?.[0]?.message?.content;

    if (aiReply) {
      // إضافة رد الذكاء للجلسة
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
