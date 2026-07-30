/**
 * api/core/conversation_orchestrator.js
 * Sovereign Final Heavy Orchestrator – نسخة سيادية كاملة بعد دمج الملفات
 */

import memory from "./memory.js";
import detectIntent from "./intent/intent_file.js";
import kernel from "../groqService.js";

/* ============================================================
   🟩 المحركات السيادية الجديدة (بدل القديمة)
   ============================================================ */
import { excelRead, excelModify, excelCreate } from "../tools/excel.js";
import { pdfRead, pdfConvert, pdfCreate } from "../tools/pdf.js";
import { wordCreate } from "../tools/word.js";
import { pptCreate } from "../tools/ppt.js";
import { imageConvert } from "../tools/image.js";
import { libreConvert } from "../tools/libre.js";

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    const session = memory.getSession(sessionId);

    /* ============================================================
       🟧 الملف القادم من /api/upload
       ============================================================ */
    const fileResult = extraCtx.fileResult || null;

    /* ============================================================
       🟦 إذا في ملف → نية الملف فقط (بدون kernel)
       ============================================================ */
    if (fileResult && fileResult.fileName) {
      const fileName = fileResult.fileName.toLowerCase();
      const intent = detectIntent(message);

      let result = null;

      /* ============================================================
         🟥 اختيار المحرك حسب الامتداد
         ============================================================ */
      if (fileName.endsWith(".pdf")) {
        if (intent === "read_file") result = await pdfRead(fileResult.filePath);
        else if (intent === "convert_file") result = await pdfConvert(fileResult.filePath, "pdf");
        else if (intent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }

      else if (fileName.endsWith(".docx")) {
        if (intent === "convert_file") result = await libreConvert(fileResult.filePath, "pdf");
        else if (intent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }

      else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        if (intent === "read_file") result = await excelRead(fileResult.filePath);
        else if (intent === "modify_file") {
          const fn = (row) => row;
          result = await excelModify(fileResult.filePath, fn);
        } else if (intent === "summarize_file") {
          const content = await excelRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await excelRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }

      else if (fileName.match(/\.(png|jpg|jpeg|webp|tiff|avif)$/)) {
        if (intent === "convert_file") {
          result = await imageConvert(fileResult.filePath, "png");
        } else {
          result = {
            ok: true,
            reply: "📷 هذا ملف صورة — لا يمكن استخراج نص منه.",
            fileBase64: null,
            fileName: null
          };
        }
      }

      else {
        const analysis = await pdfRead(fileResult.filePath);
        result = buildLocalDiscussionResult(fileResult, analysis);
      }

      /* ============================================================
         🟦 حفظ الرد في الذاكرة السيادية
         ============================================================ */
      memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: result.reply
      });

      return result;
    }

    /* ============================================================
       🟦 إذا ما في ملف → دردشة عبر kernel
       ============================================================ */
    const history = memory.getPersonaHistory(sessionId, 12);

    memory.appendPersonaHistory(sessionId, { role: "user", content: message });

    const output = await kernel(message, { history });
    const final = typeof output === "string" ? output : JSON.stringify(output);

    memory.appendPersonaHistory(sessionId, { role: "assistant", content: final });

    return {
      ok: true,
      reply: final,
      fileBase64: null,
      fileName: null
    };

  } catch (err) {
    console.error("🔥 خطأ في Sovereign Final Orchestrator:", err);
    return {
      ok: false,
      reply: "⚠️ حدث خطأ أثناء التنفيذ.",
      error: err.message,
      fileBase64: null,
      fileName: null
    };
  }
}

/* ============================================================
   🧠 تلخيص محلي
   ============================================================ */
function buildLocalSummaryResult(content) {
  const data = content?.data;
  const reply = content?.reply;

  if (data && typeof data.text === "string") {
    const text = data.text.trim();
    const preview = text.slice(0, 500);
    return {
      ok: true,
      reply: `ملخص محلي:\n\n${preview}${text.length > 500 ? "..." : ""}`,
      fileBase64: null,
      fileName: null
    };
  }

  if (data && Array.isArray(data.preview)) {
    return {
      ok: true,
      reply: `ملخص جدول Excel:\n- صفوف: ${data.rows}\n- ورقة: ${data.sheetName}`,
      fileBase64: null,
      fileName: null
    };
  }

  return {
    ok: true,
    reply: reply || "لا يوجد محتوى قابل للتلخيص.",
    fileBase64: null,
    fileName: null
  };
}

/* ============================================================
   🧠 نقاش محلي
   ============================================================ */
function buildLocalDiscussionResult(file, analysis) {
  const name = file.fileName;
  const data = analysis?.data || {};
  const parts = [];

  parts.push(`نقاش محلي حول الملف: ${name}`);

  if (typeof data.pages === "number") parts.push(`- عدد الصفحات: ${data.pages}`);
  if (data.sheetName) parts.push(`- ورقة Excel: ${data.sheetName}`);
  if (Array.isArray(data.columns)) parts.push(`- الأعمدة: ${data.columns.join(", ")}`);
  if (typeof data.characters === "number") parts.push(`- عدد الحروف: ${data.characters}`);
  if (data.hasImages !== undefined) parts.push(`- يحتوي صور: ${data.hasImages ? "نعم" : "لا"}`);
  if (data.hasTables !== undefined) parts.push(`- يحتوي جداول: ${data.hasTables ? "نعم" : "لا"}`);

  parts.push("\nهذا النقاش محلي بالكامل بدون ذكاء لغوي.");

  return {
    ok: true,
    reply: parts.join("\n"),
    fileBase64: null,
    fileName: null
  };
}