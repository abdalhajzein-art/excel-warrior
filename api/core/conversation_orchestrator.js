/**
 * api/core/conversation_orchestrator.js – Sovereign Clean Orchestrator
 * النسخة السيادية النهائية – إدارة الجلسات والسياق بخفة تامة وبدون أي محركات مكسورة.
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

/* ============================================================
   📊 بناء ملخص سياق الملف للـ Kernel
   ============================================================ */
function formatFileContextForKernel(activeFile) {
    if (!activeFile) return null;

    const { fileName, metadata, extractedContent } = activeFile;
    let summary = `📄 **الملف النشط:** ${fileName}\n`;

    if (metadata) {
        summary += `📊 **الأبعاد:** ${metadata.sheets || 1} شيت | ${metadata.rows || 0} صف | ${metadata.columns || 0} عمود\n`;
    }

    if (extractedContent?.text) {
        const sample = extractedContent.text.slice(0, 3000);
        summary += `📝 **عينة بيانات:**\n${sample}\n`;
    }

    return summary;
}

/* ============================================================
   🎛️ الـ Orchestrator السيادي النظيف
   ============================================================ */
export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId} | "${(message || "").substring(0, 50)}..."`);

        const session = memory.getSession(sessionId) || memory.createSession(sessionId);

        /* ============================================================
           1) إدارة حالة الملف (فتح / إغلاق / استبدال)
           ============================================================ */
        const lowerMsg = (message || "").toLowerCase();
        const resetRegex = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/;
        const isResetFile = resetRegex.test(lowerMsg);

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
            session.activeFile = null;
            delete session.intentCache;
        }

        const hasNewFile = extraCtx.fileData || extraCtx.filePath;

        if (hasNewFile) {
            session.activeFile = {
                fileName: extraCtx.fileName,
                filePath: extraCtx.filePath,
                metadata: extraCtx.metadata,
                extractedContent: extraCtx.extractedContent,
                timestamp: Date.now()
            };
        }

        /* ============================================================
           2) حفظ رسالة المستخدم
           ============================================================ */
        memory.appendChatHistory(sessionId, { role: "user", content: message });

        /* ============================================================
           3) دمج الذاكرة العميقة
           ============================================================ */
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 50).map(msg => ({
            ...msg,
            content: (msg.content || "").slice(0, 15000)
        }));

        /* ============================================================
           4) بناء سياق الـ Kernel
           ============================================================ */
        const kernelContext = {
            history,
            fusedMemory,
            activeFileSummary: formatFileContextForKernel(session.activeFile),
            activeFile: session.activeFile
        };

        /* ============================================================
           5) تسليم القيادة للـ Kernel
           ============================================================ */
        console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel...`);
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        let reply = kernelOutput.reply || "تم يا شريكي.";
        let returnedFileName = kernelOutput.fileName || session.activeFile?.fileName || null;
        let fileBase64 = kernelOutput.fileBase64 || null;

        /* ============================================================
           6) حفظ رد المساعد
           ============================================================ */
        memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

        /* ============================================================
           7) تمرير العمليات للجسر (النقطة الجوهرية)
           ============================================================ */
        const operations = kernelOutput.operations || [];

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
            reply: `⚠️ صار خطأ أثناء تنظيم السياق: ${err.message}`,
            error: err.message,
            fileBase64: null,
            fileName: null,
            operations: []
        };
    }
           }
