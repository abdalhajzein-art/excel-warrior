/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Clean & Lean Edition)
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

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

    const activeFile = ctx.activeFile || null;
    const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;
    const fileName = ctx.fileName || activeFile?.fileName || "الملف النشط";
    const filePath = activeFile?.filePath || null;

    // بناء سياق الملف فقط (دون توجيهات إضافية)
    let fileContext = ctx.activeFileSummary || "";
    if (!fileContext && extractedContent && !extractedContent.error) {
        const meta = extractedContent.metadata || {};
        const text = extractedContent.text || "";
        const MAX_CHARS = 25000;

        fileContext = `
📄 **معلومات الملف النشط:** [${fileName}]
📊 **الأبعاد:** ${meta.rows || 0} صف، ${meta.columns || 0} عمود.

📝 **عينة البيانات:**
${text.slice(0, MAX_CHARS)}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

    /* ============================================================
       🧠 بناء التعليمات النهائية (دمج البرومبت الأساسي مع سياق الملف)
       ============================================================ */
    let systemContent = SYSTEM_PROMPT; // استخدام البرومبت النظيف من system.js

    // إضافة سياق الملف فقط إذا كان موجوداً
    if (fileContext) {
        systemContent += `\n\n[سياق الملف الحالي للرجوع إليه]:\n${fileContext}`;
    }

    const conversationMessages = [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    let finalReplyText = "";
    let operations = [];
    let fileBase64 = null;
    let returnedFileName = fileName;

    try {
        console.log(`🧠 [Kernel] معالجة الطلب في جيميني...`);

        const rawReply = await geminiService.chat(conversationMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
        });

        finalReplyText = rawReply || "تم يا شريكي.";

        // استخراج JSON (لا تغيير هنا)
        const jsonMatch =
            finalReplyText.match(/```json\s*([\s\S]*?)\s*```/) ||
            finalReplyText.match(/\{[\s\S]*"operations"[\s\S]*\}/);

        if (jsonMatch) {
            try {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                if (parsed.operations && Array.isArray(parsed.operations)) {
                    operations = parsed.operations;
                }
            } catch (parseErr) {
                console.error("⚠️ [Kernel] فشل تحليل JSON:", parseErr);
            }
        }

        finalReplyText = finalReplyText.replace(/```json[\s\S]*?```/g, "").trim();

        /* ============================================================
           ⚙️ تنفيذ جسر بايثون
           ============================================================ */
        if (operations.length > 0 && filePath && fs.existsSync(filePath)) {
            const scriptPath = path.join(process.cwd(), "api/core/excel_bridge.py");
            const opsJson = JSON.stringify(operations);
            
            console.log(`⚡ [Python Bridge] تنفيذ ${operations.length} عملية على الملف...`);
            
            // تمرير العمليات للجسر
            const stdout = execFileSync("python3", [scriptPath, filePath, opsJson], { encoding: "utf8" });
            const res = JSON.parse(stdout);
            
            if (res.success) {
                finalReplyText += `\n\n✅ تم التنفيذ بنجاح يا شريكي، والملف جاهز للتحميل!`;
                const updatedBuffer = fs.readFileSync(filePath);
                fileBase64 = updatedBuffer.toString("base64");
            } else {
                finalReplyText += `\n⚠️ صار خطأ أثناء التنفيذ البرمجي: ${res.error}`;
                console.error("❌ [Python Error]:", res.error);
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `معليش يا شريكي، صار في خطأ بالاتصال: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText,
        fileName: returnedFileName,
        fileBase64,
        operations,
    };
}

