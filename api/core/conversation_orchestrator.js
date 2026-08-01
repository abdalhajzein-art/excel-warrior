/**
 * api/core/conversation_orchestrator.js
 * Sovereign Orchestrator (Semantic AI Edition) – المايسترو الذكي بالكامل
 * ملفات + دردشة + توجيه دلالي عبر الـ JSON + ذاكرة + جدار حماية
 */

import memory from "./memory.js";
import contextProtection from "./context_protection.js";
import routeIntent from "./intent/intent_router.js";
import kernel from "./kernel.js";
import fusionMemory from "./fusion_memory.js";

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

    // 🧠 التوجيه الدلالي
    const intentObj = await routeIntent(message, hasFile);
    console.log(`🧠 [Semantic Router] النية المكتشفة:`, intentObj);

    // 🛡️ جدار الحماية
    const shieldResult = contextProtection.check(sessionId, intentObj.intent, message);

    if (!shieldResult.ok && shieldResult.state === "noise_detected") {
      console.warn(`🛡️ [Shield] تم صد هجوم تشويش أو إدخال غير منطقي في الجلسة ${sessionId}`);
      return {
        ok: false,
        reply: "عذراً يا زميلي، المدخلات غير واضحة أو فيها تشويش. جرب تعيد صياغة طلبك. 🛑",
        fileBase64: null,
        fileName: null
      };
    }

    // إضافة رسالة المستخدم للذاكرة
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // استخراج الذاكرة المدمجة
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       🟧 مسار الملفات
       ============================================================ */
    if (hasFile) {
      const fileName = fileResult.fileName.toLowerCase();
      const fileIntent = intentObj.intent;
      let result = null;

      if (fileName.endsWith(".pdf")) {
        if (fileIntent.includes("read")) result = await pdfRead(fileResult.filePath);
        else if (fileIntent.includes("convert")) result = await pdfConvert(fileResult.filePath, "pdf");
        else if (fileIntent.includes("summarize")) {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.endsWith(".docx")) {
        if (fileIntent.includes("convert")) result = await libreConvert(fileResult.filePath, "pdf");
        else if (fileIntent.includes("summarize")) {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        if (fileIntent.includes("read")) result = await excelRead(fileResult.filePath);
        else if (fileIntent.includes("modify")) {
          const fn = (row) => row;
          result = await excelModify(fileResult.filePath, fn);
        } else if (fileIntent.includes("summarize")) {
          const content = await excelRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await excelRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.match(/\.(png|jpg|jpeg|webp|tiff|avif)$/)) {
        if (fileIntent.includes("convert")) {
          result = await imageConvert(fileResult.filePath, "png");
        } else {
          result = {
            ok: true,
            reply: "📷 هذا ملف صورة — حالياً ما في استخراج نص منه.",
            fileBase64: null,
            fileName: null
          };
        }
      }

      if (!result) {
        result = { ok: true, reply: `تم استلام الملف: ${fileResult.fileName}. شو حابب نعمل فيه؟` };
      }

      if (result && result.reply) {
        memory.appendSovereignHistory(sessionId, { role: "assistant", content: result.reply });
        memory.appendChatHistory(sessionId, { role: "assistant", content: result.reply });
      }

      return result;
    }

    /* ============================================================
       🟦 مسار الدردشة (الكرنل)
       ============================================================ */

    // نمرر للكرنل نسخة خفيفة من النية والذاكرة
    const kernelContext = {
      history: fusedMemory.history,          // الكيرنل نفسه يعمل snapshot
      locationContext,
      intent: { type: intentObj.intent },    // مو JSON كامل
      fusedMemory: {
        userProfile: fusedMemory.userProfile || null,
        lastTopics: fusedMemory.lastTopics || [],
        tags: fusedMemory.tags || []
      },
      shieldWarning: shieldResult.note || null
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

  parts.push("\nهذا نقاش محلي. إذا بدك تحليل أعمق، قوللي بوضوح شو بدك بالضبط.");

  return {
    ok: true,
    reply: parts.join("\n")
  };
      }
