/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Advanced Edition)
 * ✅ تنظيف الرد وإخفاء كتلة الـ JSON عن الواجهة نهائياً باحترافية.
 * ✅ توسيع استيعاب البيانات (رفع سقف القراءة لدعم الجداول الكبيرة).
 * ✅ دعم اللهجة السورية وتأكيد شخصية "الزميل المعماري".
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

/**
 * 🛠️ استخراج العمليات من رد Gemini مع تنظيف الرد النصي منها بصرامة
 */
function parseAndCleanReply(reply) {
    let operations = [];
    let cleanReply = reply;

    try {
        // البحث عن الـ JSON بصيغة ```json ... ``` أو مجرد ``` ... ```
        const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1].trim());
            if (data.operations && Array.isArray(data.operations)) {
                operations = data.operations;
            }
            // إزالة كتلة الـ JSON تماماً من النص الذي يراه المستخدم
            cleanReply = cleanReply.replace(jsonMatch[0], '').trim();
        } else {
            // محاولة ثانية للبحث عن كتل JSON عارية تبدأ بـ { وتنتهي بـ } وتتضمن operations
            const jsonMatch2 = reply.match(/\{[\s\S]*?"operations"[\s\S]*?\}/);
            if (jsonMatch2) {
                const data = JSON.parse(jsonMatch2[0]);
                if (data.operations && Array.isArray(data.operations)) {
                    operations = data.operations;
                }
                cleanReply = cleanReply.replace(jsonMatch2[0], '').trim();
            }
        }
    } catch (e) {
        console.warn('⚠️ [Kernel] فشل تحليل العمليات (إما لا يوجد عمليات أو الصيغة غير مكتملة):', e.message);
    }

    // تنظيف أي أسطر فارغة زائدة نتجت عن عملية القص
    return { 
        operations, 
        cleanReply: cleanReply.replace(/\n{3,}/g, '\n\n').trim() 
    };
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟",
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }

    const extractedContent = ctx.extractedContent || null;
    const fileName = ctx.fileName || "الملف النشط";

    // ✅ بناء سياق الملف مع توسيع استيعاب البيانات (من 3000 إلى 25000 حرف)
    let fileContext = "";
    if (extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || '';
        
        const MAX_CHARS = 25000; // مساحة ضخمة لتمرير بيانات كافية للنموذج
        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود، ${meta.sheets || 1} أوراق عمل.

📝 **عينة البيانات المتاحة:**
${text.slice(0, MAX_CHARS)}${text.length > MAX_CHARS ? '\n... (تم اختصار المحتوى لحماية الذاكرة، ولكن يمكنك طلب تعديل أي جزء منه)' : ''}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    // 🛡️ هندسة الأوامر السيادية (Sovereign Prompt Engineering)
    let systemContent = `
${SYSTEM_PROMPT}

[التوجيهات الصارمة لشخصيتك]:
- أنت زميل ومهندس معماري لمنصة "الأثير". خاطب المستخدم دائماً بروح الزميل باللهجة السورية المهنية المحببة (يا شريكي، يا هندسة، تكرم عينك، إلخ).
- إياك أن تظهر للمستخدم أي كود JSON أو تفاصيل برمجية تخص العمليات في نصك المرئي. الرد النصي يجب أن يكون طبيعياً يخبره بما فعلت.

[تعليمات التحكم في الملفات - Structured JSON]:
إذا طلب المستخدم تعديلاً على الملف المرفق أو تحليله، يجب عليك توليد كتلة JSON مخفية في نهاية ردك كالتالي:
\`\`\`json
{
    "operations": [
        {"type": "add_column", "header": "اسم العمود"},
        {"type": "add_validation", "address": "A1:A10", "formulae": ["\\"خيار1,خيار2\\""]}
    ]
}
\`\`\`
(ملاحظة: استبدل العمليات بما يتناسب مع الطلب. إذا لم يطلب تعديلاً، اجعل المصفوفة فارغة: {"operations": []}).
`;

    if (fileContext) {
        systemContent += `\n\n${fileContext}`;
    }

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let returnedFileName = null;
    let fileBase64 = null;
    let operations = [];

    try {
        console.log(`🧠 [Kernel] يتم الآن العصف الذهني ومعالجة الطلب في جيميني...`);

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName: ctx.fileName,
            extractedContent: ctx.extractedContent
        });

        // تنظيف الرد وفصل الـ JSON عن النص المرئي
        const parsed = parseAndCleanReply(rawReply);
        finalReplyText = parsed.cleanReply;
        operations = parsed.operations;

        if (operations.length > 0) {
            console.log(`⚡ [Kernel] تم استخراج ${operations.length} عملية لتنفيذها على ملف: ${fileName}`);
            returnedFileName = fileName; 
        }

        // إذا كان النص فارغاً تماماً بعد التنظيف (نادر الحدوث)، نضع رداً افتراضياً ذكياً
        if (!finalReplyText) {
            finalReplyText = "تم يا شريكي، جهزتلك التعديلات المطلوبة على الملف.";
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ أثناء استدعاء جيميني:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ تقني بالاتصال: ${error.message}`;
    }

    // حفظ رد المساعد السيادي في الذاكرة (يجب حفظ النص النظيف فقط بدون الـ JSON)
    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText,
        fileName: returnedFileName,
        fileBase64,
        operations: operations
    };
}
