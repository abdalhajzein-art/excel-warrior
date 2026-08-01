/**
 * api/core/conversation_orchestrator.js
 * Sovereign Orchestrator (Architect Edition) – المايسترو المحمي والمدمج
 * ملفات + دردشة + نوايا + ذاكرة + سياق + جدار حماية
 */

import memory from "./memory.js";
import contextProtection from "./context_protection.js";
import detectFileIntent from "./intent/intent_file.js";
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

    // 1. تحديد النية العامة
    const intent = routeIntent(message);

    // 2. 🛡️ تفعيل جدار الحماية (Context Shield) قبل أي عملية
    const shieldResult = contextProtection.check(sessionId, intent, message);
    
    if (!shieldResult.ok && shieldResult.state === "noise_detected") {
      console.warn(`🛡️ [Shield] تم صد هجوم تشويش أو إدخال غير منطقي في الجلسة ${sessionId}`);
      return {
        ok: false,
        reply: "عذراً يا زميلي، المدخلات غير واضحة أو تحتوي على تشويش. هل يمكنك إعادة صياغة طلبك؟ 🛑",
        fileBase64: null,
        fileName: null
      };
    }

    const session = memory.getSession(sessionId);
    const fileResult = extraCtx.fileResult || null;
    const locationContext = extraCtx.locationContext || "";

    // 3. إضافة رسالة المستخدم للذاكرة *قبل* استخراج الذاكرة المدمجة ليراها الكرنل
    memory.appendChatHistory(sessionId, { role: "user", content: message });
    
    // 4. استخراج الذاكرة المدمجة (Fusion Memory) المعالجة بذكاء وتثبيت مرجعي
    const fusedMemory = fusionMemory.apply(sessionId);

    /* ============================================================
       🟧 مسار معالجة الملفات (إذا كان هناك ملف مرفق)
       ============================================================ */
    if (fileResult && fileResult.fileName) {
      const fileName = fileResult.fileName.toLowerCase();
      const fileIntent = detectFileIntent(message);

      let result = null;

      if (fileName.endsWith(".pdf")) {
        if (fileIntent === "read_file") result = await pdfRead(fileResult.filePath);
        else if (fileIntent === "convert_file") result = await pdfConvert(fileResult.filePath, "pdf");
        else if (fileIntent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.endsWith(".docx")) {
        if (fileIntent === "convert_file") result = await libreConvert(fileResult.filePath, "pdf");
        else if (fileIntent === "summarize_file") {
          const content = await pdfRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await pdfRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        if (fileIntent === "read_file") result = await excelRead(fileResult.filePath);
        else if (fileIntent === "modify_file") {
          const fn = (row) => row;
          result = await excelModify(fileResult.filePath, fn);
        } else if (fileIntent === "summarize_file") {
          const content = await excelRead(fileResult.filePath);
          result = buildLocalSummaryResult(content);
        } else {
          const analysis = await excelRead(fileResult.filePath);
          result = buildLocalDiscussionResult(fileResult, analysis);
        }
      }
      else if (fileName.match(/\.(png|jpg|jpeg|webp|tiff|avif)$/)) {
        if (fileIntent === "convert_file") {
          result = await imageConvert(fileResult.filePath, "png");
        } else {
          result = {
            ok: true,
            reply: "📷 هذا ملف صورة — لا يمكن استخراج نص منه حالياً.",
            fileBase64: null,
            fileName: null
          };
        }
      }

      // تسجيل الرد في ذاكرة الملفات والدردشة معاً ليظل السياق مترابطاً
      if (result && result.reply) {
        memory.appendSovereignHistory(sessionId, { role: "assistant", content: result.reply });
        memory.appendChatHistory(sessionId, { role: "assistant", content: result.reply });
      }

      return result;
    }

    /* ============================================================
       🟦 مسار الدردشة الصافية (عبر الكيرنل السيادي - الذكاء الاصطناعي)
       ============================================================ */
    
    // تمرير تحذيرات الدرع (Shield) إلى الكرنل ليعرف كيف يتصرف في حال التشتيت
    const kernelContext = {
      history: fusedMemory.history,
      locationContext,
      intent,
      fusedMemory,
      shieldWarning: shieldResult.note || null
    };

    const reply = await kernel(sessionId, message, kernelContext);

    // إضافة رد الأثير للذاكرة
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
      reply: `⚠️ حدث خطأ في النظام أثناء المعالجة: ${err.message}`,
      error: err.message
    };
  }
}

/* ============================================================
   🧠 دوال التلخيص والنقاش المحلي (Local Fallbacks)
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
    reply: reply || "لا يوجد محتوى قابل للتلخيص."
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

  parts.push("\nهذا نقاش محلي بدون تدخل الذكاء اللغوي بعد.");

  return {
    ok: true,
    reply: parts.join("\n")
  };
}
