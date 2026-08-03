/**
 * api/core/kernel.js – Alatheer Sovereign Kernel
 * ✅ النسخة المعمارية النقية: تعتمد كلياً على ذكاء Gemini في فهم النوايا (Intent Routing).
 * ✅ خالية من الشروط الصلبة (No Hardcoded Keywords).
 * ✅ تستورد SYSTEM_PROMPT من system.js كمصدر وحيد للتعليمات.
 * ✅ تستخرج العمليات من الرد لتمريرها لمحرك التعديل الشامل.
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

/**
 * 🛠️ استخراج العمليات من رد Gemini
 */
function extractOperationsFromReply(reply) {
    try {
        // محاولة استخراج JSON من كتلة ```json
        const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            if (data.operations && Array.isArray(data.operations)) {
                return data.operations;
            }
        }
        // محاولة ثانية: البحث عن JSON مباشرة
        const jsonMatch2 = reply.match(/\{[\s\S]*"operations"[\s\S]*\}/);
        if (jsonMatch2) {
            const data = JSON.parse(jsonMatch2[0]);
            if (data.operations && Array.isArray(data.operations)) {
                return data.operations;
            }
        }
    } catch (e) {
        console.warn('⚠️ [Kernel] فشل استخراج العمليات من الرد:', e.message);
    }
    return [];
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟",
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }

    const extractedContent = ctx.extractedContent || null;
    const fileName = ctx.fileName || "الملف";

    // ✅ بناء سياق الملف (إن وجد)
    let fileContext = "";
    if (extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || '';
        
        fileContext = `
📄 **الملف المرفق:** ${fileName}
📊 **معلومات:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود، ${meta.sheets || 1} ورقة
${meta.hasFormulas ? '📐 يحتوي على صيغ' : ''}

📝 **البيانات:**
${text.slice(0, 1500)}${text.length > 1500 ? '\n... (مختصر)' : ''}
`;
    }

    // ✅ بناء قائمة المحادثة مع تعليمات صارمة لاستخراج العمليات
    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    let systemContent = `
${SYSTEM_PROMPT}

[تعليمات إضافية للتعديلات]:
إذا طلب المستخدم تعديلاً على الملف، قم بما يلي:
1. صف التعديل بالعربية كما تفعل عادة.
2. في نهاية ردك، أضف كتلة JSON تحتوي على العمليات المطلوبة بالصيغة التالية:

\`\`\`json
{
    "operations": [
        {"type": "add_column", "header": "اسم العمود"},
        {"type": "add_validation", "address": "الخلية:الخلية", "formulae": ["\\"خيار1,خيار2,خيار3\\""]},
        {"type": "add_formula", "address": "الخلية", "formula": "الصيغة"},
        {"type": "color_cells", "range": "النطاق", "color": "لون"}
    ]
}
\`\`\`

ملاحظة: إذا لم يكن هناك تعديل، أضف كتلة JSON فارغة: {"operations": []}
`;

    if (fileContext) {
        systemContent += `\n\n[محتوى الملف]:\n${fileContext}`;
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
        console.log(`🧠 [Kernel] إرسال الطلب إلى النموذج...`);

        const reply = await geminiService.chat(conversationMessages, {
            fileName: ctx.fileName,
            extractedContent: ctx.extractedContent
        });

        finalReplyText = reply;
        
        // ✅ استخراج العمليات من الرد
        operations = extractOperationsFromReply(reply);
        if (operations.length > 0) {
            console.log(`📝 [Kernel] تم استخراج ${operations.length} عملية من الرد للعمل على الملف: ${fileName}`);
            returnedFileName = fileName;
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `⚠️ حدث خطأ: ${error.message}`;
    }

    // حفظ المحادثة في الذاكرة
    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    // إرجاع المخرجات للـ Orchestrator أو Chat.js
    return {
        reply: finalReplyText.trim(),
        fileName: returnedFileName,
        fileBase64,
        operations: operations
    };
}
