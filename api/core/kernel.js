/**
 * api/core/kernel.js – Alatheer Sovereign Kernel
 * ✅ الاعتماد على executor منفصل ونظيف
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeOperations } from "./excel_executor.js";
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
    let operations = [];
    let fileBase64 = null;
    let executionResult = null;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);
        const rawReply = await geminiService.chat(conversationMessages, { fileName, extractedContent, systemInstruction: systemContent });
        finalReplyText = rawReply || "تم يا شريكي.";

        const jsonMatch = finalReplyText.match(/```json\s*([\s\S]*?)\s*```/) || finalReplyText.match(/\{[\s\S]*"operations"[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
                if (parsed.operations && Array.isArray(parsed.operations)) operations = parsed.operations;
            } catch (err) {
                console.error("⚠️ [Kernel] فشل تحليل JSON:", err);
            }
        }
        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

        // ✅ استخدام الجسر النظيف لتنفيذ العمليات
        if (operations.length > 0 && filePath && fs.existsSync(filePath)) {
            console.log(`⚡ [Kernel] تنفيذ ${operations.length} عملية عبر Excel Executor...`);
            executionResult = await executeOperations(filePath, operations);
            
            if (executionResult && executionResult.success) {
                finalReplyText += `\n\n✅ تم التنفيذ بنجاح يا شريكي، والملف جاهز للتحميل!`;
                fileBase64 = fs.readFileSync(filePath).toString("base64");
            } else {
                finalReplyText += `\n\n❌ **فشل التنفيذ:** ${executionResult?.error || 'خطأ غير معروف'}`;
                console.error("❌ [Execution Error]:", executionResult?.error);
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

    return { reply: finalReplyText, fileName, fileBase64, operations, execution: executionResult };
}

