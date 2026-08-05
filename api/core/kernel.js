/**
 * api/core/kernel.js – Alatheer Sovereign Kernel
 * ✅ الاعتماد على التنفيذ الديناميكي (Zero-Middleman Architecture)
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython } from "./dynamic_executor.js"; // الجسر الجديد!
import fs from "fs";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return { reply: "هلا والله يا شريكي... آمرني، شو عنا شغل اليوم؟", fileBase64: null, fileName: null, operations: [] };
    }

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";
    const filePath = ctx.filePath || activeFile?.filePath || null;

    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        fileContext = `📄 **معلومات الملف:** [${fileName}]\n📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.\n📝 **عينة:**\n${text.slice(0, 25000)}`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    let systemContent = SYSTEM_PROMPT;
    if (fileContext) systemContent += `\n\n[سياق الملف الحالي للرجوع إليه]:\n${fileContext}`;

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let fileBase64 = null;
    let executionResult = null;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);
        const rawReply = await geminiService.chat(conversationMessages, { fileName, extractedContent, systemInstruction: systemContent });
        finalReplyText = rawReply || "تم يا شريكي.";

        // ✅ البحث عن كود بايثون بدلاً من JSON
        const pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);

        if (pythonMatch && filePath && fs.existsSync(filePath)) {
            const pythonCode = pythonMatch[1].trim();
            
            // إزالة بلوك الكود من الرد حتى لا يظهر للمستخدم
            finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();
            
            console.log(`⚡ [Kernel] تم استخراج سكربت بايثون ديناميكي، جاري التنفيذ...`);
            executionResult = await executeDynamicPython(pythonCode, filePath);
            
            if (executionResult && executionResult.success) {
                finalReplyText += `\n\n✅ تم تنفيذ السكربت على الملف بنجاح يا شريكي، والملف جاهز للتحميل!`;
                fileBase64 = fs.readFileSync(filePath).toString("base64");
            } else {
                finalReplyText += `\n\n❌ **فشل التنفيذ:** \n\`\`\`text\n${executionResult?.error || 'خطأ غير معروف'}\n\`\`\``;
                console.error("❌ [Execution Error]:", executionResult?.error);
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

    return { reply: finalReplyText, fileName, fileBase64, operations: [], execution: executionResult };
}
