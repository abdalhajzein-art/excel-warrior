/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Advanced Architecture)
 * ✅ تنظيف الرد وإخفاء كتلة الـ JSON عن الواجهة نهائياً باحترافية.
 * ✅ توافق كامل مع مخرجات Orchestrator (سواء مرت بـ ctx المباشر أو عبر activeFile).
 * ✅ تزويد Gemini بمخطط العمليات المدعومة (Operations Schema) لمنع الهلوسة.
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
    let cleanReply = reply || "";

    try {
        // 1. البحث عن الـ JSON في كتل الماركداون ```json ... ```
        const jsonMatch = cleanReply.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1].trim());
            if (data.operations && Array.isArray(data.operations)) {
                operations = data.operations;
            }
            cleanReply = cleanReply.replace(jsonMatch[0], '').trim();
        } else {
            // 2. البحث عن JSON عارٍ يحتوي على operations
            const jsonMatch2 = cleanReply.match(/\{[\s\S]*?"operations"[\s\S]*?\}/);
            if (jsonMatch2) {
                const data = JSON.parse(jsonMatch2[0]);
                if (data.operations && Array.isArray(data.operations)) {
                    operations = data.operations;
                }
                cleanReply = cleanReply.replace(jsonMatch2[0], '').trim();
            }
        }
    } catch (e) {
        console.warn('⚠️ [Kernel] لم يتم استخراج عمليات من الرد (إما لا يوجد أو الصيغة غير مكتملة):', e.message);
    }

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

    // 🎯 إصلاح الربط: التوافق التام مع سياق Orchestrator
    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";

    // ✅ بناء سياق الملف مع توسيع استيعاب البيانات
    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || '';
        
        const MAX_CHARS = 25000;
        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود، ${meta.sheets || 1} أوراق عمل.

📝 **عينة البيانات المتاحة:**
${text.slice(0, MAX_CHARS)}${text.length > MAX_CHARS ? '\n... (تم اختصار المحتوى لحماية الذاكرة، ولكن يمكنك طلب تعديل أي جزء منه)' : ''}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    // 🛡️ هندسة الأوامر السيادية - المخطط القياسي للعمليات المدعومة
    let systemContent = `
${SYSTEM_PROMPT}

[التوجيهات الصارمة لشخصيتك]:
- أنت زميل ومهندس معماري لمنصة "الأثير". خاطب المستخدم دائماً بروح الزميل باللهجة السورية المهنية المحببة (يا شريكي، يا هندسة، تكرم عينك، إلخ).
- إياك أن تظهر للمستخدم أي كود JSON أو تفاصيل برمجية تخص العمليات في نصك المرئي. الرد النصي يجب أن يكون طبيعياً يخبره بما فعلت.

[تعليمات التحكم في الملفات - Structured JSON Schema]:
إذا طلب المستخدم تعديلاً على الملف، قم بتذييل ردك بكتلة JSON بالصيغة التالية حصراً:
\`\`\`json
{
    "operations": [
        {"type": "add_column", "header": "اسم العمود", "after": "اسم عمود سابق (اختياري)"},
        {"type": "add_validation", "address": "A2:A100", "formulae": ["\\"خيار1,خيار2\\""]},
        {"type": "add_row", "data": {"الاسم": "أحمد", "العنوان": "دمشق"}},
        {"type": "highlight", "range": "A1:Z1", "color": "#FFD700"}
    ]
}
\`\`\`
(إذا لم يطلب المستخدم أي تعديل عملي على الملف، أرجع المصفوفة فارغة: {"operations": []}).
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
            fileName,
            extractedContent
        });

        // تنظيف الرد وفصل الـ JSON عن النص المرئي
        const parsed = parseAndCleanReply(rawReply);
        finalReplyText = parsed.cleanReply;
        operations = parsed.operations;

        if (operations.length > 0) {
            console.log(`⚡ [Kernel] تم استخراج ${operations.length} عملية لتنفيذها على ملف: ${fileName}`);
            returnedFileName = fileName; 
        }

        if (!finalReplyText) {
            finalReplyText = "تم يا شريكي، جهزتلك التعديلات المطلوبة على الملف.";
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ أثناء استدعاء جيميني:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ تقني بالاتصال: ${error.message}`;
    }

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

