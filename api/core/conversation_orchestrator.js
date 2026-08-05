/**
 * api/core/conversation_orchestrator.js – Sovereign Clean Orchestrator
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

function formatFileContextForKernel(activeFile) {
    if (!activeFile) return null;

    const { fileName, metadata, extractedContent } = activeFile;
    let summary = `📄 **الملف النشط:** ${fileName}\n`;

    if (metadata) summary += `📊 **الأبعاد:** ${metadata.sheets || 1} شيت | ${metadata.rows || 0} صف | ${metadata.columns || 0} عمود\n`;
    if (extractedContent?.text) summary += `📝 **عينة بيانات:**\n${extractedContent.text.slice(0, 3000)}\n`;

    return summary;
}

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
    try {
        console.log(`📥 [Orchestrator] جلسة ${sessionId} | "${(message || "").substring(0, 50)}..."`);
        const session = memory.getSession(sessionId) || memory.createSession(sessionId);

        const lowerMsg = (message || "").toLowerCase();
        const isResetFile = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/.test(lowerMsg);

        if (isResetFile && session.activeFile) {
            console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
            session.activeFile = null;
            delete session.intentCache;
        }

        if (extraCtx.fileData || extraCtx.filePath) {
            session.activeFile = {
                fileName: extraCtx.fileName,
                filePath: extraCtx.filePath,
                metadata: extraCtx.metadata,
                extractedContent: extraCtx.extractedContent,
                timestamp: Date.now()
            };
        }

        memory.appendChatHistory(sessionId, { role: "user", content: message });
        const fusedMemory = fusionMemory.apply(sessionId);
        let history = memory.getChatHistory(sessionId, 50).map(msg => ({
            ...msg, content: (msg.content || "").slice(0, 15000)
        }));

        const kernelContext = {
            history,
            fusedMemory,
            activeFileSummary: formatFileContextForKernel(session.activeFile),
            activeFile: session.activeFile
        };

        console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel...`);
        const kernelOutput = await kernel(sessionId, message, kernelContext);

        memory.appendChatHistory(sessionId, { role: "assistant", content: kernelOutput.reply || "تم." });

        return {
            ok: true,
            reply: kernelOutput.reply,
            fileBase64: kernelOutput.fileBase64,
            fileName: kernelOutput.fileName || session.activeFile?.fileName,
            operations: kernelOutput.operations || []
        };

    } catch (err) {
        console.error("🔥 [Orchestrator Critical Error]:", err);
        return {
            ok: false, reply: `⚠️ صار خطأ: ${err.message}`, error: err.message, fileBase64: null, fileName: null, operations: []
        };
    }
}

