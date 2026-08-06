/**
 * api/core/conversation_orchestrator.js – Sovereign Clean Orchestrator (Excel Dual-Mode Ready)
 *
 * تحسينات سيادية:
 * - حل fileId/filePath من index.json إذا لزم
 * - عدم إنشاء activeFile من قيمة null صريحة
 * - فحوصات وجود الملف قبل تمريره للـ Kernel
 * - ربط السياق مع fusionMemory (currentFile / currentOperation / sessionMode / intent / contextDrift)
 */

import fs from "fs";
import path from "path";
import memory from "./memory.js";
import fusionMemory from "./fusion_memory.js";
import kernel from "./kernel.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERSISTENT_DIR = path.join(__dirname, "../../persistent_uploads");
const INDEX_FILE = path.join(PERSISTENT_DIR, "index.json");

function formatFileContextForKernel(activeFile) {
  if (!activeFile) return null;

  const { fileName, metadata, extractedContent } = activeFile;
  let summary = `📄 **الملف النشط:** ${fileName}\n`;

  if (metadata)
    summary += `📊 **الأبعاد:** ${metadata.sheets || 1} شيت | ${metadata.rows || 0} صف | ${metadata.columns || 0} عمود\n`;

  if (extractedContent?.text)
    summary += `📝 **عينة بيانات:**\n${extractedContent.text.slice(0, 3000)}\n`;

  return summary;
}

// اقرأ index.json بأمان
async function readIndexSafe() {
  try {
    if (!fs.existsSync(PERSISTENT_DIR)) return {};
    if (!fs.existsSync(INDEX_FILE)) return {};
    const raw = await fs.promises.readFile(INDEX_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.warn("⚠️ [Orchestrator] readIndexSafe failed:", e.message);
    return {};
  }
}

// حاول حل fileId أو storedName إلى مسار فعلي
async function resolveFileReference({ fileId, filePath, fileName }) {
  // إذا أعطانا caller مساراً مطلقاً وملف موجود، نستخدمه فوراً
  if (filePath && fs.existsSync(filePath)) {
    return { storedPath: filePath, fileName: fileName || path.basename(filePath) };
  }

  // حاول حل fileId عبر index.json
  if (fileId) {
    const idx = await readIndexSafe();
    if (idx[fileId] && idx[fileId].storedPath && fs.existsSync(idx[fileId].storedPath)) {
      return { storedPath: idx[fileId].storedPath, fileName: idx[fileId].fileName || idx[fileId].storedName };
    }
  }

  // حاول البحث عن اسم ملف داخل persistent dir
  if (fileName) {
    const candidate = path.join(PERSISTENT_DIR, fileName);
    if (fs.existsSync(candidate)) {
      return { storedPath: candidate, fileName };
    }
  }

  return null;
}

export default async function conversationOrchestrator(sessionId, message, extraCtx = {}) {
  try {
    console.log(`📥 [Orchestrator] جلسة ${sessionId} | "${(message || "").substring(0, 50)}..."`);
    console.log(
      `📥 [Orchestrator] extraCtx.filePath=${extraCtx.filePath}, extraCtx.fileName=${extraCtx.fileName}, extraCtx.fileId=${extraCtx.fileId}`
    );

    const session = memory.getSession(sessionId) || memory.createSession(sessionId);

    const lowerMsg = (message || "").toLowerCase();

    // تنظيف صريح لطلب المستخدم لمسح الملف
    const isResetFile = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/.test(lowerMsg);

    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
      session.activeFile = null;
      delete session.intentCache;
      fusionMemory.storeCurrentFile(sessionId, null);
      fusionMemory.storeOperation(sessionId, null);
      fusionMemory.storeSessionMode(sessionId, "idle");
    }

    // محاولة حل مرجع الملف من extraCtx (fileData/filePath/fileId)
    let resolved = null;

    // حالة: تم إرسال ملف خام في extraCtx.fileData مع اسم
    if (extraCtx.fileData && extraCtx.fileName) {
      if (extraCtx.filePath && fs.existsSync(extraCtx.filePath)) {
        resolved = { storedPath: extraCtx.filePath, fileName: extraCtx.fileName };
      } else if (extraCtx.fileId) {
        resolved = await resolveFileReference({ fileId: extraCtx.fileId, fileName: extraCtx.fileName });
      }
    }

    // حالة: العميل مرّر fileId أو client-side filePath فقط
    if (!resolved && (extraCtx.fileId || extraCtx.filePath || extraCtx.fileName)) {
      resolved = await resolveFileReference({
        fileId: extraCtx.fileId,
        filePath: extraCtx.filePath,
        fileName: extraCtx.fileName
      });
    }

    // إذا تم حل المرجع بنجاح، أنشئ activeFile أو حدّثه
    if (resolved) {
      console.log(
        `📂 [Orchestrator] استقبال/حل مرجع ملف: storedPath=${resolved.storedPath}, fileName=${resolved.fileName}`
      );
      session.activeFile = {
        fileName: resolved.fileName || "file.xlsx",
        filePath: resolved.storedPath,
        metadata: extraCtx.metadata || session.sovereign?.lastFile?.metadata || {},
        extractedContent: extraCtx.extractedContent || session.sovereign?.lastFile?.extractedContent || null,
        timestamp: Date.now()
      };

      // تأكد من أن الذاكرة تعرف هذا الملف
      try {
        memory.saveFile(sessionId, {
          filePath: session.activeFile.filePath,
          fileName: session.activeFile.fileName
        });
      } catch (e) {
        console.warn("⚠️ [Orchestrator] memory.saveFile failed:", e.message);
      }

      // ربط الملف الحالي بالذاكرة السيادية
      fusionMemory.storeCurrentFile(sessionId, session.activeFile.filePath);
      fusionMemory.storeSessionMode(sessionId, "file_active");
    } else {
      // لم نحل المرجع من extraCtx → حاول استرجاع آخر ملف محفوظ في sovereign
      if (!session.activeFile && session.sovereign && session.sovereign.lastFile) {
        const last = session.sovereign.lastFile;
        if (last.filePath && fs.existsSync(last.filePath)) {
          console.log(`📂 [Orchestrator] استرجاع الملف من sovereign.lastFile: ${last.filePath}`);
          session.activeFile = {
            fileName: last.fileName || "file.xlsx",
            filePath: last.filePath,
            metadata: last.metadata || {},
            extractedContent: last.extractedContent || null,
            timestamp: Date.now()
          };
          fusionMemory.storeCurrentFile(sessionId, session.activeFile.filePath);
          fusionMemory.storeSessionMode(sessionId, "file_active");
        } else if (last.fileId) {
          const resolvedLast = await resolveFileReference({ fileId: last.fileId });
          if (resolvedLast) {
            console.log(
              `📂 [Orchestrator] استرجاع الملف من sovereign.lastFile عبر fileId: ${resolvedLast.storedPath}`
            );
            session.activeFile = {
              fileName: resolvedLast.fileName || "file.xlsx",
              filePath: resolvedLast.storedPath,
              metadata: last.metadata || {},
              extractedContent: last.extractedContent || null,
              timestamp: Date.now()
            };
            fusionMemory.storeCurrentFile(sessionId, session.activeFile.filePath);
            fusionMemory.storeSessionMode(sessionId, "file_active");
          }
        }
      }
    }

    console.log(
      `📂 [Orchestrator] activeFile بعد المعالجة: ${session.activeFile?.filePath || "لا يوجد"}`
    );

    // حفظ الرسالة في التاريخ
    memory.appendChatHistory(sessionId, { role: "user", content: message });

    // دمج الذاكرة العميقة السيادية
    const fusedMemory = fusionMemory.apply(sessionId);

    // تحديث وضع الجلسة والعملية بناءً على الرسالة والملف
    if (session.activeFile) {
      if (lowerMsg.includes("طوّر") || lowerMsg.includes("طور") || lowerMsg.includes("حسّن")) {
        fusionMemory.storeOperation(sessionId, "improve_file");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("طبق") || lowerMsg.includes("نفّذ")) {
        fusionMemory.storeOperation(sessionId, "apply_changes");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("أضف ورقة") || lowerMsg.includes("ورقة جديدة") || lowerMsg.includes("sheet")) {
        fusionMemory.storeOperation(sessionId, "add_sheet");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("تعديل") || lowerMsg.includes("عدّل")) {
        fusionMemory.storeOperation(sessionId, "modify_file");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("توليد") || lowerMsg.includes("أنشئ ملف") || lowerMsg.includes("ملف جديد")) {
        fusionMemory.storeOperation(sessionId, "generate_file");
        fusionMemory.storeSessionMode(sessionId, "file_generate");
      } else if (lowerMsg.includes("اعرض") || lowerMsg.includes("معاينة") || lowerMsg.includes("preview")) {
        fusionMemory.storeOperation(sessionId, "preview_file");
        fusionMemory.storeSessionMode(sessionId, "file_preview");
      } else {
        // رسالة عامة لكن مع ملف نشط
        fusionMemory.storeSessionMode(sessionId, "file_context");
      }
    } else {
      fusionMemory.storeSessionMode(sessionId, "idle");
      fusionMemory.storeOperation(sessionId, null);
    }

    if (fusedMemory.contextDrift) {
      console.log("⚠️ [Orchestrator] contextDrift detected من fusionMemory – سيتم الحفاظ على الملف الحالي وعدم البدء من الصفر.");
    }

    let history = memory.getChatHistory(sessionId, 50).map(msg => ({
      ...msg,
      content: (msg.content || "").slice(0, 15000)
    }));

    // بناء سياق الكيرنل مع فحوصات وجود الملف
    const kernelContext = {
      history,
      fusedMemory,
      activeFileSummary: formatFileContextForKernel(session.activeFile),
      activeFile: session.activeFile,

      fileName: session.activeFile?.fileName || null,
      filePath: session.activeFile?.filePath || null,
      extractedContent: session.activeFile?.extractedContent || null,
      metadata: session.activeFile?.metadata || null
    };

    console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel...`);
    console.log(
      `🧠 [Orchestrator] kernelContext.filePath=${kernelContext.filePath}, kernelContext.fileName=${kernelContext.fileName}`
    );

    const kernelOutput = await kernel(sessionId, message, kernelContext);

    // حفظ رد المساعد
    memory.appendChatHistory(sessionId, {
      role: "assistant",
      content: kernelOutput.reply || "تم."
    });

    return {
      ok: true,
      reply: kernelOutput.reply,
      fileBase64: kernelOutput.fileBase64,
      fileName: kernelOutput.fileName || session.activeFile?.fileName,
      operations: kernelOutput.operations || [],
      execution: kernelOutput.execution || null
    };
  } catch (err) {
    console.error("🔥 [Orchestrator Critical Error]:", err);
    return {
      ok: false,
      reply: `⚠️ صار خطأ: ${err.message}`,
      error: err.message,
      fileBase64: null,
      fileName: null,
      operations: []
    };
  }
  }
