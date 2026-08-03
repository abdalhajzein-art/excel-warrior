/**
 * api/core/kernel.js – Alatheer Sovereign Kernel
 * ✅ تنظيف الرد وإخفاء كتلة الـ JSON عن الواجهة نهائياً.
 * ✅ دعم اللهجة السورية والردود المختصرة.
 * ✅ تمرير البيانات الفعلية للملف إلى Gemini
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

/**
 * 🛠️ استخراج العمليات من رد Gemini مع تنظيف الرد النصي منها
 */
function parseAndCleanReply(reply) {
    let operations = [];
    let cleanReply = reply;

    try {
        // البحث عن الـ JSON بصيغة ```json ... ```
        const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            if (data.operations && Array.isArray(data.operations)) {
                operations = data.operations;
            }
            // إزالة كتلة الـ JSON تماماً من النص الذي يراه المستخدم
            cleanReply = cleanReply.replace(jsonMatch[0], '').trim();
        } else {
            // محاولة ثانية للبحث عن كتل JSON عارية
            const jsonMatch2 = reply.match(/\{[\s\S]*"operations"[\s\S]*\}/);
            if (jsonMatch2) {
                const data = JSON.parse(jsonMatch2[0]);
                if (data.operations && Array.isArray(data.operations)) {
                    operations = data.operations;
                }
                cleanReply = cleanReply.replace(jsonMatch2[0], '').trim();
            }
        }
    } catch (e) {
        console.warn('⚠️ [Kernel] فشل تحليل العمليات:', e.message);
    }

    return { operations, cleanReply };
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "هلا والله يا شريكي… آمرني، شو عنا شغل اليوم؟",
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }

    const extractedContent = ctx.extractedContent || null;
    const fileName = ctx.fileName || "الملف";

    // ✅ بناء سياق الملف مع البيانات الفعلية
    let fileContext = "";
    if (extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || '';
        
        fileContext = `
📄 **الملف المرفق:** ${fileName}
📊 **معلومات:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود

📝 **البيانات:**
${text.slice(0, 3000)}${text.length > 3000 ? '\n... (تم اختصار المحتوى)' : ''}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    let systemContent = `
${SYSTEM_PROMPT}

[تعليمات داخلية للعمليات]:
إذا طلب المستخدم تعديلاً على الملف، قم بتنفيذ المطلوب وضع في نهاية ردك كتلـة JSON صامتة بالشكل التالي (ولكن إياك أن تضع تفاصيل تقنية في النص للمستخدم):

\`\`\`json
{
    "operations": [
        {"type": "add_column", "header": "اسم العمود"},
        {"type": "add_validation", "address": "الخلية:الخلية", "formulae": ["\\"خيار1,خيار2\\""]}
    ]
}
\`\`\`
إذا لم يكن هناك تعديل، أضف: {"operations": []}
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

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName: ctx.fileName,
            extractedContent: ctx.extractedContent
        });

        // تنظيف الرد وفصل الـ JSON عن النص المرئي
        const parsed = parseAndCleanReply(rawReply);
        finalReplyText = parsed.cleanReply;
        operations = parsed.operations;

        if (operations.length > 0) {
            console.log(`📝 [Kernel] تم استخراج ${operations.length} عملية بنجاح للملف: ${fileName}`);
            returnedFileName = fileName;
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ تقني: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText.trim(),
        fileName: returnedFileName,
        fileBase64,
        operations: operations
    };
  }
