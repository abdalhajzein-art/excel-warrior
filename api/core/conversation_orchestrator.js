/**
 * api/core/conversation_orchestrator.js – Sovereign Clean Orchestrator (Agentic Tool-Calling Edition)
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
    
    // إبقاء أمر "مسح الملف" للإدارة اليدوية
    const isResetFile = /(انسى|اغلق|احذف|سكر|تجاهل) (الملف|البيانات)|ملف (جديد|اخر)/.test(lowerMsg);
    if (isResetFile && session.activeFile) {
      console.log(`🗑️ [Orchestrator] تم مسح الملف النشط بطلب المستخدم.`);
      session.activeFile = null;
      fusionMemory.storeCurrentFile(sessionId, null);
    }

    let resolved = null;
    
    // 🛡️ الثقة المطلقة في المسار المُمرر من chat.js
    if (extraCtx.filePath && fs.existsSync(extraCtx.filePath)) {
        resolved = { storedPath: extraCtx.filePath, fileName: extraCtx.fileName };
    } 
    else if (extraCtx.fileId || extraCtx.fileName) {
        resolved = await resolveFileReference({
            fileId: extraCtx.fileId,
            filePath: extraCtx.filePath,
            fileName: extraCtx.fileName
        });
    }

    if (resolved) {
      console.log(`📂 [Orchestrator] تأكيد المرجع النشط: storedPath=${resolved.storedPath}`);
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
    } else {
      // الاعتماد على الذاكرة كخيار أخير
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
        }
      }
    }

    memory.appendChatHistory(sessionId, { role: "user", content: message });

    const fusedMemory = fusionMemory.apply(sessionId);

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

    console.log(`🧠 [Orchestrator] تسليم القيادة للـ Kernel...`);

    let kernelOutput = await kernel(sessionId, message, kernelContext);

    // حلقة تصحيح واحدة تلقائية
    if (kernelOutput.execution && !kernelOutput.execution.success && session.activeFile) {
        console.log(`⚠️ [Self-Correction] خطأ برمجي. إعادة المحاولة...`);
        const correctionMessage = `حدث خطأ برمجي أثناء التنفيذ:\n${kernelOutput.execution.error}\nالرجاء تصحيح الكود بالكامل وإعادة المحاولة لتنفيذ ما طلبه المستخدم.`;
        kernelOutput = await kernel(sessionId, correctionMessage, kernelContext);
    }

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
