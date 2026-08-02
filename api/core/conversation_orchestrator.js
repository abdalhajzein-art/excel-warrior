/**
 * api/core/conversation_orchestrator.js
 * النسخة السيادية النهائية – معالجة مباشرة عبر عقل جيميني بدون ملخصات جافة
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
      // حفظ الملف واسمه في ذاكرة الجلسة المؤقتة لتتذكره المحادثة في كل الأسئلة اللاحقة
      session.activeFile = { fileData, fileName };
    } else if (session.activeFile && !isResetFile) {
      // استرجاع الملف المحفوظ مسبقاً طالما لم يطلب المستخدم تطهير السياق
      fileData = session.activeFile.fileData;
      fileName = session.activeFile.fileName;
    }

    const locationContext = extraCtx.locationContext || "";

    // 🟩 إضافة رسالة المستخدم للذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // 🟩 استخراج الذاكرة المدمجة
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       🟦 مسار المراسلة والمعالجة الذكية عبر الكرنل (جيميني) مباشرة
       ============================================================ */

    let history = memory.getChatHistory(sessionId, 30);

    // فلتر حماية ذكي يمنع ضغط النموذج بالرسائل الطويلة
    history = history.map(msg => ({
      ...msg,
      content: msg.content.slice(0, 2000)
    }));

    const kernelContext = {
      history,
      locationContext,
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      },
      fileData,   // بيانات الملف (سواء جديدة مرفقة الآن أو مسترجعة من الذاكرة المؤقتة)
      fileName    // اسم الملف
    };

    // إرسال الطلب لعقل الأثير (جيميني) ليحلل الملف ويصيغ الرد بذكائه الطبيعي
    const reply = await kernel(sessionId, message, kernelContext);

    memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

    return {
      ok: true,
      reply,
      fileBase64: null,
      fileName: null
    };

  } catch (err) {
    console.error("🔥 [Orchestrator Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ بالنظام أثناء المعالجة: ${err.message}`,
      error: err.message
    };
  }
}
