/**
 * api/core/conversation_orchestrator.js – Sovereign Universal Orchestrator
 * المنسق السيادي العام: إدارة سياق الجلسة والملفات وتمريرها بمرونة مطلقة بدون قيود لغوية.
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);

    // 1. رصد نية إنهاء أو إعادة ضبط الملف النشط فقط
    const lowerMsg = (message || "").toLowerCase();
    const isResetFile = lowerMsg.includes("انسى الملف") || 
                        lowerMsg.includes("اغلق الملف") || 
                        lowerMsg.includes("ملف جديد") || 
                        lowerMsg.includes("احذف الملف") ||
                        lowerMsg.includes("سكر الملف");

    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح سياق الملف النشط للجلسة.`);
      session.activeFile = null;
    }

    // 2. إدارة حالة الملف (استلام جديد أو استرجاع من الذاكرة المؤقتة للجلسة)
    let fileData = extraCtx.fileData || null;
    let fileName = extraCtx.fileName || null;
    let filePath = extraCtx.filePath || null;
    const hasFile = !!fileData || !!filePath;

    if (hasFile) {
      session.activeFile = { fileData, fileName, filePath };
    } else if (session.activeFile && !isResetFile) {
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
      filePath = session.activeFile.filePath;
    }

    // 3. تسجيل رسالة المستخدم في التاريخ
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // 4. تجميع الذاكرة والسياق العام
    const fusedMemory = fusionMemory.apply(sessionId);
    let history = memory.getChatHistory(sessionId, 30);
    
    // تقليم ذكي لحماية نافذة السياق من التضخم
    history = history.map(msg => ({
      ...msg,
      content: (msg.content || "").slice(0, 2000)
    }));

    const kernelContext = {
      history,
      locationContext: extraCtx.locationContext || "",
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      },
      fileData,
      fileName,
      filePath,
      activeFile: session.activeFile || null
    };

    // 5. إرسال السياق كاملاً لعقل الكرنل لمعالجة الطلب أياً كان محتواه أو نوعه
    const kernelOutput = await kernel(sessionId, message, kernelContext);

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let returnedFileName = fileName;

    // معالجة مرنة لمخرجات الكرنل (سواء نص أو كائن متكامل يحمل ملفاً ناتجاً)
    if (typeof kernelOutput === "string") {
      reply = kernelOutput;
    } else if (kernelOutput && typeof kernelOutput === "object") {
      reply = kernelOutput.reply || kernelOutput.message || reply;
      fileBase64 = kernelOutput.fileBase64 || null;
      returnedFileName = kernelOutput.fileName || returnedFileName;
    }

    // تسجيل رد المساعد في التاريخ
    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

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

