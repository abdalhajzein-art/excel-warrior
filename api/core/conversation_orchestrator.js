/**
 * api/core/conversation_orchestrator.js – Sovereign Universal Orchestrator (Multi-Turn State Sync Edition)
 * ✅ يمرر العمليات من kernel إلى chat.js
 * ✅ يدير حالة الملفات بشكل ذكي ويحافظ على الذاكرة العميقة (Deep Memory)
 * 🔄 يدعم التعديل المتتابع المترابط (Syncs Active File to latest modified version)
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

/**
 * 📊 دالة مساعدة لتنسيق ملخص الملف للـ Kernel ليفهم هيكلية الجدول بدقة
 */
function formatFileContextForKernel(activeFile) {
    if (!activeFile) return null;

    const { fileName, metadata, extractedContent } = activeFile;
    let summary = `📄 **الملف النشط حالياً في الجلسة:** ${fileName}\n`;

    if (metadata) {
        summary += `📊 **البيانات المتاحة:** ${metadata.sheets || 1} شيت | ${metadata.rows || 0} صف | ${metadata.columns || 0} أعمدة\n`;
    }

    if (extractedContent && extractedContent.text) {
        // اقتطاع عينة ملائمة من نص الملف ليفهم النموذج أسماء الأعمدة الهيكلية
        const sampleText = extractedContent.text.slice(0, 3000);
        summary += `📝 **عينة من البيانات واسماء الأعمدة:**\n${sampleText}\n`;
    }

    return summary;
}

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId} | الرسالة: "${message.substring(0, 50)}..."`);

        const session = memory.getSession(sessionId) || memory.createSession(sessionId);

        // 1. رصد نية إنهاء أو إعادة ضبط الملف النشط (باستخدام تعبير نمطي قوي Regex)
        const lowerMsg = (message || "").toLowerCase();
        const resetRegex = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/;
        const isResetFile = resetRegex.test(lowerMsg);

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم إغلاق ومسح سياق الملف النشط للجلسة بطلب من المستخدم.`);
            session.activeFile = null;
            if (session.intentCache) {
                delete session.intentCache;
            }
        }

        // 2. إدارة حالة الملف بمرونة وسيادة
        let fileData = extraCtx.fileData || null;
        let fileName = extraCtx.fileName || null;
        let filePath = extraCtx.filePath || null;
        const metadata = extraCtx.metadata || null;
        const extractedContent = extraCtx.extractedContent || null;
        const modifiedResult = extraCtx.modifiedResult || null;
        
        const hasNewFile = !!fileData || !!filePath;

        if (hasNewFile && !session.activeFile) {
            // استلام ملف جديد لأول مرة في الجلسة
            session.activeFile = {
                fileData: null, // لا نخزن Base64 لتوفير الذاكرة
                fileName, 
                filePath, 
                metadata, 
                extractedContent, 
                modifiedResult,
                timestamp: Date.now()
            };
        } else if (session.activeFile && !isResetFile) {
            if (!hasNewFile) {
                // استمرار النقاش على الملف القديم المرفوع سابقاً
                console.log(`🔄 [Orchestrator] استرجاع الملف النشط من الذاكرة: ${session.activeFile.fileName}`);
            } else {
                // استبدال الملف القديم بملف جديد تم رفعه الآن
                console.log(`🔄 [Orchestrator] استبدال الملف القديم بملف جديد: ${fileName}`);
                session.activeFile = {
                    fileData: null,
                    fileName, 
                    filePath, 
                    metadata, 
                    extractedContent, 
                    modifiedResult,
                    timestamp: Date.now()
                };
                if (session.intentCache) delete session.intentCache;
            }
        }

        // 3. تسجيل رسالة المستخدم في التاريخ
        memory.appendChatHistory(sessionId, { role: "user", content: message });

        // 4. تجميع الذاكرة العميقة (Deep Context Fusion)
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 50); // سعة 50 رسالة

        history = history.map(msg => ({
            ...msg,
            content: (msg.content || "").slice(0, 15000) 
        }));

        // 5. بناء السياق المتقدم للمعالج المركزي (Kernel)
        const fileContextSummary = formatFileContextForKernel(session.activeFile);

        const kernelContext = {
            history,
            locationContext: extraCtx.locationContext || "",
            fusedMemory: {
                userProfile: fusedMemory.userProfile || null,
                lastTopics: fusedMemory.lastTopics || [],
                tags: fusedMemory.tags || []
            },
            // نمرر ملخص وسياق الملف النشط المُنقح
            activeFileSummary: fileContextSummary,
            activeFile: session.activeFile ? {
                fileName: session.activeFile.fileName,
                filePath: session.activeFile.filePath,
                metadata: session.activeFile.metadata,
                extractedContent: session.activeFile.extractedContent
            } : null
        };

        // 6. تسليم القيادة المطلقة للـ Kernel (العقل المركزي)
        console.log(`🧠 [Orchestrator] تسليم القيادة إلى Kernel لمعالجة الطلب...`);
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        // 7. تفكيك المخرجات وتحديث الذاكرة
        let reply = "تم إنجاز طلبك بنجاح!";
        let fileBase64 = null;
        let returnedFileName = null;
        let operations = [];

        if (typeof kernelOutput === "string") {
            reply = kernelOutput;
        } else if (kernelOutput && typeof kernelOutput === "object") {
            reply = kernelOutput.reply || kernelOutput.message || reply;
            fileBase64 = kernelOutput.fileBase64 || null;
            returnedFileName = kernelOutput.fileName || null;
            operations = kernelOutput.operations || [];
        }

        // 🔄 8. بروتوكول مزامنة الحالة (إذا تم تغيير الملف أو إنشاء ملف جديد)
        if (returnedFileName && extraCtx.newFilePath) {
            console.log(`📝 [Orchestrator] مزامنة حالة الملف النشط مع النسخة المعدلة الجديدة: ${returnedFileName}`);
            session.activeFile.filePath = extraCtx.newFilePath;
            session.activeFile.fileName = returnedFileName;
        }

        // حفظ رد النظام في الذاكرة
        memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

        return {
            ok: true,
            reply,
            fileBase64,
            fileName: returnedFileName,
            operations
        };

    } catch (err) {
        console.error("🔥 [Orchestrator Critical Error]:", err);
        return {
            ok: false,
            reply: `⚠️ واجه النظام تحدياً أثناء تنظيم السياق. التفاصيل: ${err.message}`,
            error: err.message,
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }
}

