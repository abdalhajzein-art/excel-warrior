/**
 * api/core/conversation_orchestrator.js
 * النسخة السيادية الخفيفة – بدون نوايا بدائية وبدون جدار حماية
 */

import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";

/* ============================================================
   🟩 محركات الملفات
   ============================================================ */
import { excelRead, excelModify } from "../tools/excel.js";
import { pdfRead, pdfConvert } from "../tools/pdf.js";
import { wordCreate } from "../tools/word.js";
import { pptCreate } from "../tools/ppt.js";
import { imageConvert } from "../tools/image.js";
import { libreConvert } from "../tools/index.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId}: "${message}"`);

    const session = memory.getSession(sessionId);
    const fileResult = extraCtx.fileResult || null;
    const locationContext = extraCtx.locationContext || "";

    const hasFile = !!(fileResult && fileResult.fileName);

    // إضافة رسالة المستخدم للذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // استخراج الذاكرة المدمجة
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       🟧 مسار الملفات
       ============================================================ */
    if (hasFile) {
      const fileName = fileResult.fileName.toLowerCase();
      let result = null;

      if (fileName.endsWith(".pdf")) {
        const content = await pdfRead(fileResult.filePath);
        result = buildLocalSummaryResult(content);
      }
      else if (fileName.endsWith(".docx")) {
        const content = await pdfRead(fileResult.filePath);
        result = buildLocalSummaryResult(content);
      }
      else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const content = await excelRead(fileResult.filePath);
        result = buildLocalSummaryResult(content);
      }
      else if (fileName.match(/\.(png|jpg|jpeg|webp|tiff|avif)$/)) {
        result = {
          ok: true,
          reply: "📷 هذا ملف صورة — حالياً ما في استخراج نص منه.",
          fileBase64: null,
          fileName: null
        };
      }

      if (!result) {
        result = { ok: true, reply: `تم استلام الملف: ${fileResult.fileName}. شو حابب نعمل فيه؟` };
      }

      memory.appendChatHistory(sessionId, { role: "assistant", content: result.reply });

      return result;
    }

    /* ============================================================
       🟦 مسار الدردشة (الكرنل)
       ============================================================ */

    const kernelContext = {
      history: fusedMemory.history,
      locationContext,
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      }
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
   🧠 دوال التلخيص والنقاش المحلي
   ============================================================ */

function buildLocalSummaryResult(content) {
  const data = content?.data;
  const reply = content?.reply;

  if (data && typeof data.text === "string") {
    const text = data.text.trim();
    const preview = text.slice(0, 500);
    return {
      ok: true,
      reply: `ملخص محلي:\n\n${preview}${text.length > 500 ? "..." : ""}`
    };
  }

  if (data && Array.isArray(data.preview)) {
    return {
      ok: true,
      reply: `ملخص جدول Excel:\n- صفوف: ${data.rows}\n- ورقة: ${data.sheetName}`
    };
  }

  return {
    ok: true,
    reply: reply || "ما في محتوى واضح قابل للتلخيص."
  };
  }
