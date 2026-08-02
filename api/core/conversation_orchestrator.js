/**
 * api/core/conversation_orchestrator.js – النسخة السيادية المصححة لتمرير الملفات
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);

    // رصد نية المستخدم لإلغاء أو تطهير الملف الحالي والبدء بصفحة جديدة
    const lowerMsg = message.toLowerCase();
    const isResetFile = lowerMsg.includes("انسى الملف") || 
                        lowerMsg.includes("اغلق الملف") || 
                        lowerMsg.includes("ملف جديد") || 
                        lowerMsg.includes("احذف الملف") ||
                        lowerMsg.includes("سكر الملف");

    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح سياق الملف النشط للجلسة.`);
      session.activeFile = null;
    }

    let fileData = extraCtx.fileData || null;
    let fileName = extraCtx.fileName || null;
    const hasFile = !!fileData;

    if (hasFile) {
      session.activeFile = { fileData, fileName };
    } else if (session.activeFile && !isResetFile) {
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
    }

    const locationContext = extraCtx.locationContext || "";

    memory.appendChatHistory(sessionId, { role: "user", content: message });

    const fusedMemory = fusionMemory.apply(sessionId);

    let history = memory.getChatHistory(sessionId, 30);

    history = history.map(msg => ({
      ...msg,
      content: (msg.content || "").slice(0, 2000)
    }));

    const kernelContext = {
      history,
      locationContext,
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      },
      fileData,
      fileName
    };

    // استدعاء الكرنل للحصول على النتيجة (نص أو كائن يحوي بيانات الملف)
    const kernelOutput = await kernel(sessionId, message, kernelContext);

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = null;

    // 🛡️ معالجة ذكية ومضبوطة لمخرجات الكرنل
    if (typeof kernelOutput === "string") {
      reply = kernelOutput;
    } else if (kernelOutput && typeof kernelOutput === "object") {
      reply = kernelOutput.reply || kernelOutput.message || kernelOutput.response || reply;
      fileBase64 = kernelOutput.fileBase64 || kernelOutput.file_base64 || null;
      returnedFileName = kernelOutput.fileName || kernelOutput.file_name || null;
    }

    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

    // 🚀 إعادة تمرير الملف واسمه بشكل صحيح للطبقات التالية بدلاً من الـ null!
    return {
      ok: true,
      reply,
      fileBase64,
      fileName: returnedFileName
    };

  } catch (err) {
    console.error("🔥 [Orchestrator Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
      error: err.message,
      fileBase64: null,
      fileName: null
    };
  }
}
