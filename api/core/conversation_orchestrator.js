/**
 * api/core/conversation_orchestrator.js – Sovereign Clean Orchestrator (Agentic Loop Edition)
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

async function resolveFileReference({ fileId, filePath, fileName }) {
  if (filePath && fs.existsSync(filePath)) {
    return { storedPath: filePath, fileName: fileName || path.basename(filePath) };
  }
  if (fileId) {
    const idx = await readIndexSafe();
    if (idx[fileId] && idx[fileId].storedPath && fs.existsSync(idx[fileId].storedPath)) {
      return { storedPath: idx[fileId].storedPath, fileName: idx[fileId].fileName || idx[fileId].storedName };
    }
  }
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
    const session = memory.getSession(sessionId) || memory.createSession(sessionId);
    const lowerMsg = (message || "").toLowerCase();
    
    const isResetFile = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/.test(lowerMsg);
    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
      session.activeFile = null;
      delete session.intentCache;
      fusionMemory.storeCurrentFile(sessionId, null);
      fusionMemory.storeOperation(sessionId, null);
      fusionMemory.storeSessionMode(sessionId, "idle");
    }

    let resolved = null;
    if (extraCtx.fileData && extraCtx.fileName) {
      if (extraCtx.filePath && fs.existsSync(extraCtx.filePath)) {
        resolved = { storedPath: extraCtx.filePath, fileName: extraCtx.fileName };
      } else if (extraCtx.fileId) {
        resolved = await resolveFileReference({ fileId: extraCtx.fileId, fileName: extraCtx.fileName });
      }
    }
    if (!resolved && (extraCtx.fileId || extraCtx.filePath || extraCtx.fileName)) {
      resolved = await resolveFileReference({
        fileId: extraCtx.fileId,
        filePath: extraCtx.filePath,
        fileName: extraCtx.fileName
      });
    }

    if (resolved) {
      console.log(`📂 [Orchestrator] استقبال/حل مرجع ملف: storedPath=${resolved.storedPath}`);
      session.activeFile = {
        fileName: resolved.fileName || "file.xlsx",
        filePath: resolved.storedPath,
        metadata: extraCtx.metadata || session.sovereign?.lastFile?.metadata || {},
        extractedContent: extraCtx.extractedContent || session.sovereign?.lastFile?.extractedContent || null,
        timestamp: Date.now()
      };
      try {
        memory.saveFile(sessionId, { filePath: session.activeFile.filePath, fileName: session.activeFile.fileName });
      } catch (e) {
        console.warn("⚠️ [Orchestrator] memory.saveFile failed:", e.message);
      }
      fusionMemory.storeCurrentFile(sessionId, session.activeFile.filePath);
      fusionMemory.storeSessionMode(sessionId, "file_active");
    } else {
      if (!session.activeFile && session.sovereign && session.sovereign.lastFile) {
        const last = session.sovereign.lastFile;
        if (last.filePath && fs.existsSync(last.filePath)) {
          session.activeFile = {
            fileName: last.fileName || "file.xlsx",
            filePath: last.filePath,
            metadata: last.metadata || {},
            extractedContent: last.extractedContent || null,
            timestamp: Date.now()
          };
          fusionMemory.storeCurrentFile(sessionId, session.activeFile.filePath);
          fusionMemory.storeSessionMode(sessionId, "file_active");
        }
      }
    }

    memory.appendChatHistory(sessionId, { role: "user", content: message });
    const fusedMemory = fusionMemory.apply(sessionId);

    if (session.activeFile) {
      const msg = (message || "").trim();
      const editKeywords = /(عدل|غير|أضف|احذف|حط|ضبط|لون|رتب|تحديث|تعديل|إضافة|حذف|سوي|اعمل)/i;
      const questionKeywords = /(كيف|ليش|لماذا|ما هو|ما هي|كم|هل|رأيك|اشرح|وضح|وين|مين|\?|؟)/i;
      if (editKeywords.test(msg) && !questionKeywords.test(msg)) {
        fusionMemory.storeOperation(sessionId, "modify_file");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
        console.log("🧠 [Orchestrator] Intent: نية تعديل مستندي صريحة.");
      }
    }

    if (session.activeFile) {
      if (lowerMsg.includes("طوّر") || lowerMsg.includes("طور") || lowerMsg.includes("حسّن")) {
        fusionMemory.storeOperation(sessionId, "improve_file");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("أضف ورقة") || lowerMsg.includes("ورقة جديدة") || lowerMsg.includes("sheet")) {
        fusionMemory.storeOperation(sessionId, "add_sheet");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("تعديل") || lowerMsg.includes("عدّل")) {
        fusionMemory.storeOperation(sessionId, "modify_file");
        fusionMemory.storeSessionMode(sessionId, "file_edit");
      } else if (lowerMsg.includes("توليد") || lowerMsg.includes("أنشئ ملف")) {
        fusionMemory.storeOperation(sessionId, "generate_file");
        fusionMemory.storeSessionMode(sessionId, "file_generate");
      } else {
        fusionMemory.storeSessionMode(sessionId, "file_context");
      }
    } else {
      fusionMemory.storeSessionMode(sessionId, "idle");
      fusionMemory.storeOperation(sessionId, null);
    }

    let history = memory.getChatHistory(sessionId, 50).map(msg => ({
      ...msg,
      content: (msg.content || "").slice(0, 15000)
    }));

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

    console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel مع تفعيل حلقة التصحيح الذاتي...`);

    // 🔄 حلقة التصحيح الذاتي (Self-Correction Loop)
    let maxRetries = 2; 
    let attempt = 0;
    let kernelOutput = null;
    let internalMessage = message; 

    while (attempt <= maxRetries) {
      kernelOutput = await kernel(sessionId, internalMessage, kernelContext);

      if (kernelOutput.execution && session.activeFile) {
        const execResult = kernelOutput.execution;
        
        // 1. فحص أخطاء البايثون الفادحة
        if (!execResult.success) {
          console.log(`⚠️ [Self-Correction] خطأ برمجي. محاولة (${attempt + 1}/${maxRetries})...`);
          internalMessage = `حدث خطأ برمجي أثناء التنفيذ:\n${execResult.error}\nالرجاء تصحيح الكود بالكامل وإعادة المحاولة. لا تعتذر ولا تشرح، فقط صحح الكود وأعد بناء الملف.`;
          attempt++;
          continue;
        }

        // 2. فحص الجودة (الاستسهال)
        const outputStr = execResult.output || "";
        if (outputStr.includes("[Quality Report]")) {
           const askedForAdvanced = /(متقدم|احترافي|قوائم|منسدلة|validation|تنسيق|شرطي|ألوان|formatting)/i.test(message);
           const noValidations = outputStr.includes("Data Validations: 0");
           const noCF = outputStr.includes("Conditional Formatting Rules: 0");

           if (askedForAdvanced && (noValidations || noCF)) {
              console.log(`⚠️ [Self-Correction] اكتشاف ملف استسهالي (بدون قوائم/تنسيق). محاولة (${attempt + 1}/${maxRetries})...`);
              internalMessage = `الكود تنفذ، لكن الفحص التلقائي أثبت أنك لم تضف القوائم المنسدلة أو التنسيق الشرطي. أنت تتجاهل التعليمات وتستسهل العمل! أعد كتابة الكود كاملاً واستخدم openpyxl.worksheet.datavalidation و openpyxl.formatting.rule بصرامة. لا تعتذر، فقط نفذ بشكل صحيح.`;
              attempt++;
              continue;
           }
        }
      }
      break; 
    }

    memory.appendChatHistory(sessionId, {
      role: "assistant",
      content: kernelOutput.reply || "تم إنجاز المطلوب يا هندسة."
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

