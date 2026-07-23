import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * طبقة فهم النوايا – النسخة المحترفة
 */
export async function analyzeIntent(message, context = {}) {
    const prompt = `
أنت محلل نوايا ذكي. مهمتك فهم طلب المستخدم بدقة شديدة.

الرسالة: "${message}"
الملف المرفق: ${context.fileName ? context.fileName : "لا يوجد"}
نوع الملف: ${context.fileType ? context.fileType : "غير معروف"}

🎯 استخرج:
1) النية الأساسية فقط:
   - modify (تعديل ملف)
   - generate (إنشاء ملف جديد)
   - analyze (تحليل ملف)
   - convert (تحويل صيغة)
   - chat (دردشة)
   - unknown (غير واضح)

2) هل الطلب واضح؟ true/false

3) ملخص قصير للطلب

4) أسئلة توضيحية إذا كان غير واضح

📋 أجب بصيغة JSON فقط:
{
  "intent": "modify | generate | analyze | convert | chat | unknown",
  "isClear": true,
  "summary": "ملخص قصير",
  "questions": []
}
`;

    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: "أنت محلل نوايا ذكي ودقيق." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        return {
            success: true,
            data: JSON.parse(completion.choices[0].message.content)
        };

    } catch (error) {
        console.error("❌ خطأ في تحليل النية:", error);
        return {
            success: false,
            data: {
                intent: "unknown",
                isClear: false,
                summary: "تعذر فهم الطلب",
                questions: ["ممكن تعيد صياغة طلبك؟"]
            }
        };
    }
}
