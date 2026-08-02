/**
 * api/core/conversation_orchestrator.js
 * النسخة السيادية العامة – محرك مطلق لأي نوع ملف أو بيانات
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);

    // ⭐ الطريقة الجديدة: استقبال full.data مباشرة
    const fileData = extraCtx.fileData || null;
    const fileName = extraCtx.fileName || null;

    const locationContext = extraCtx.locationContext || "";

    const hasFile = !!fileData;

    // 🟩 إضافة رسالة المستخدم للذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // 🟩 استخراج الذاكرة المدمجة
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       🟧 مسار الملفات — عام ومطلق
       ============================================================ */
    if (hasFile) {
      const summary = buildGenericSummary(fileData, fileName);

      memory.appendChatHistory(sessionId, { role: "assistant", content: summary });

      return {
        ok: true,
        reply: summary,
        fileBase64: null,
        fileName: null
      };
    }

    /* ============================================================
       🟦 مسار الدردشة (الكرنل)
       ============================================================ */

    let history = memory.getChatHistory(sessionId, 30);

    // فلتر حماية ذكي يمنع ضغط النموذج
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
      fileData   // ⭐ تمرير full.data للكرنل مباشرة
    };

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

/* ============================================================
   🧠 دوال التلخيص العامة لأي نوع بيانات
   ============================================================ */

function buildGenericSummary(fullData, fileName) {
  try {
    if (!fullData || typeof fullData !== "object") {
      return `📄 تم استلام الملف "${fileName}" لكن بدون بيانات قابلة للمعالجة.`;
    }

    // ⭐ إذا كان فيه sheets → Excel
    if (fullData.sheets) {
      const sheetNames = Object.keys(fullData.sheets);
      const firstSheet = fullData.sheets[sheetNames[0]];

      return `
📄 تم استلام الملف "${fileName}" بنجاح.

نوع البيانات: جدول متعدد الشيتات
عدد الشيتات: ${sheetNames.length}
أول شيت: ${sheetNames[0]}
عدد الصفوف: ${firstSheet.rows}
عدد الأعمدة: ${firstSheet.columns.length}

جاهز أعطيك أي تحليل تريده.
      `.trim();
    }

    // ⭐ إذا كان فيه preview → جدول بسيط
    if (Array.isArray(fullData.preview)) {
      return `
📄 تم استلام الملف "${fileName}" بنجاح.

نوع البيانات: جدول بسيط
عدد الصفوف: ${fullData.rows}
عدد الأعمدة: ${fullData.columns?.length || 0}

جاهز أعطيك تفاصيل أكثر.
      `.trim();
    }

    // ⭐ إذا كان فيه نص
    if (fullData.text) {
      const preview = fullData.text.slice(0, 500);
      return `
📄 تم استلام الملف "${fileName}" بنجاح.

نوع البيانات: نص
معاينة:
${preview}${fullData.text.length > 500 ? "..." : ""}

جاهز أعطيك ملخص أو تحليل.
      `.trim();
    }

    // ⭐ fallback عام
    return `
📄 تم استلام الملف "${fileName}" بنجاح.

نوع البيانات: غير معروف
جاهز أعطيك تحليل عام أو استخراج معلومات.
    `.trim();

  } catch (err) {
    return `⚠️ خطأ أثناء بناء ملخص الملف: ${err.message}`;
  }
  }
