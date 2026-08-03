/**
 * api/core/kernel.js – Alatheer Sovereign Kernel
 * ✅ يستورد SYSTEM_PROMPT من system.js كمصدر وحيد
 * ✅ يعالج طلب التحميل مباشرة دون الذهاب إلى Gemini
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from "fs";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟",
            fileBase64: null,
            fileName: null
        };
    }

    const extractedContent = ctx.extractedContent || null;
    const fileName = ctx.fileName || "الملف";

    // ✅ معالجة طلب التحميل مباشرة (قبل أي شيء آخر)
    if (message.includes('رابط') || message.includes('تحميل') || 
        message.includes('الملف') || message.includes('download')) {
        if (ctx.filePath && fs.existsSync(ctx.filePath)) {
            try {
                const fileBuffer = fs.readFileSync(ctx.filePath);
                const fileBase64 = fileBuffer.toString('base64');
                console.log(`📥 [Kernel] تجهيز تحميل للملف: ${fileName}`);
                
                // ✅ نعيد الرد مباشرة، ولا نذهب إلى Gemini
                return {
                    reply: `📥 **تم تجهيز الملف "${fileName}" للتحميل.**\n\nيمكنك تنزيله من الرابط أدناه.`,
                    fileName: fileName,
                    fileBase64: fileBase64
                };
            } catch (err) {
                console.warn(`⚠️ [Kernel] فشل قراءة الملف: ${err.message}`);
                // نكمل إلى Gemini إذا فشل التحميل
            }
        }
    }

    // ✅ بناء سياق الملف
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

    // ✅ بناء قائمة المحادثة
    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    
    let systemContent = SYSTEM_PROMPT;
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

    try {
        console.log(`🧠 [Kernel] إرسال الطلب إلى النموذج...`);

        const reply = await geminiService.chat(conversationMessages, {
            fileName: ctx.fileName,
            extractedContent: ctx.extractedContent
        });

        finalReplyText = reply;

    } catch (error) {
        console.error("❌ [Kernel] خطأ:", error);
        finalReplyText = `⚠️ حدث خطأ: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText.trim(),
        fileName: returnedFileName,
        fileBase64,
    };
                        }
