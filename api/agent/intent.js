import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * طبقة فهم النوايا المتطورة باستخدام Groq
 */
export async function analyzeIntentWithAI(message, context = {}) {
    const prompt = `
أنت خبير في تحليل نوايا المستخدمين وفهم طلباتهم بدقة عالية.

📌 **السياق الحالي:**
- الرسالة: "${message}"
- الملف المرفق: ${context.fileName ? context.fileName : 'لا يوجد'}
- نوع الملف: ${context.fileType ? context.fileType : 'غير معروف'}
- تاريخ المحادثة: ${context.history ? context.history.join('\n') : 'لا يوجد'}

🎯 **مهمتك:**
حلل النية الحقيقية للمستخدم وقدّر:
1. **النية الرئيسية:** (generate, modify, analyze, consult, convert, chat, unknown)
2. **النية الثانوية:** (تصميم، تدقيق، اقتراح، تعليم، تنفيذ، استشارة)
3. **الحالة العاطفية:** (متحمس، محبط، مستعجل، فضولي، محايد)
4. **درجة الإلحاح:** (عاجل، طبيعي، غير مستعجل)
5. **درجة التعقيد:** (بسيط، متوسط، معقد)
6. **الأدوات المقترحة:** (excel, word, pdf, image, python, none)
7. **الثقة:** (نسبة من 0 إلى 1)
8. **أسئلة توضيحية:** (إذا كانت النية غير واضحة)
9. **خطة أولية مقترحة:** (خطة تنفيذية مختصرة)

📋 **أجب بصيغة JSON حصراً:**
{
    "primaryIntent": "generate | modify | analyze | consult | convert | chat | unknown",
    "secondaryIntent": "تصميم | تدقيق | اقتراح | تعليم | تنفيذ | استشارة",
    "emotion": "متحمس | محبط | مستعجل | فضولي | محايد",
    "urgency": "عاجل | طبيعي | غير مستعجل",
    "complexity": "بسيط | متوسط | معقد",
    "suggestedTools": ["excel", "word", "pdf", "image", "python"],
    "confidence": 0.95,
    "clarifyingQuestions": ["سؤال 1", "سؤال 2"],
    "initialPlan": "خطة أولية مقترحة"
}

⚠️ **قواعد مهمة:**
- إذا الطلب واضح، اجعل confidence > 0.8 و clarifyingQuestions فارغة.
- إذا الطلب غامض، اجعل confidence < 0.6 و اقترح 2-3 أسئلة توضيحية.
- استخدم suggestedTools المناسبة حسب نوع الطلب.
`;

    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: "أنت خبير تحليل نوايا المستخدمين." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const result = JSON.parse(completion.choices[0].message.content);
        return {
            success: true,
            data: result
        };
    } catch (error) {
        console.error("❌ خطأ في تحليل النية:", error);
        return {
            success: false,
            error: error.message,
            data: {
                primaryIntent: "unknown",
                confidence: 0.3,
                clarifyingQuestions: ["آسف، ما قدرت أفهم طلبك. ممكن تشرحه بطريقة أوضح؟"]
            }
        };
    }
          }
