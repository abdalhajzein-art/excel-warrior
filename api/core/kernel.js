/**
 * api/core/kernel.js – Trusting Gemini's Intelligence & Structured Tools
 * 🧠 العقل السيادي للأثير: الاعتماد الحصري على الأدوات المهيكلة (Structured Tools)
 * - مدمج مع حارس المسارات (Path Guardian) لمنع أخطاء ENOENT وضمان تدفق العمل.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { extractPreviewAsync, executeDynamicPython } from "./dynamic_executor.js";
import fusionMemory from "./fusion_memory.js";
import { fileURLToPath } from "url";

// ✅ استيراد شامل مضاد لأخطاء (Export/Import) في Node.js
import * as excelToolsModule from "./excel_tools.js";
const EXCEL_TOOLS = excelToolsModule.EXCEL_TOOLS || excelToolsModule.default?.EXCEL_TOOLS;
const handleExcelToolCall = excelToolsModule.handleExcelToolCall || excelToolsModule.default?.handleExcelToolCall;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSISTENT_DIR = path.join(process.cwd(), "persistent_uploads");
const GENERATED_DIR = path.join(process.cwd(), "generated");
const INDEX_FILE = path.join(PERSISTENT_DIR, "index.json");

// ================= Helpers =================
function ensureDirs() {
  try {
    if (!fs.existsSync(PERSISTENT_DIR)) fs.mkdirSync(PERSISTENT_DIR, { recursive: true });
    if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
    if (!fs.existsSync(INDEX_FILE)) fs.writeFileSync(INDEX_FILE, JSON.stringify({}), "utf8");
  } catch (e) {
    console.warn("⚠️ [Kernel] ensureDirs failed:", e.message);
  }
}

async function readIndexSafe() {
  try {
    ensureDirs();
    const raw = await fs.promises.readFile(INDEX_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    return {};
  }
}

async function writeIndex(idx) {
  try {
    await fs.promises.writeFile(INDEX_FILE, JSON.stringify(idx, null, 2), "utf8");
  } catch (e) {
    console.warn("⚠️ [Kernel] writeIndex failed:", e.message);
  }
}

function generateFileId() {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * 🛡️ حارس المسارات (Path Guardian): يلتقط أي ملف تم إنشاؤه حديثاً وينقله للمسار المطلوب
 */
function rescueGeneratedFile(expectedPath) {
  if (fs.existsSync(expectedPath)) return expectedPath;

  try {
    const dirsToSearch = [GENERATED_DIR, process.cwd()];
    let allFiles = [];

    for (const dir of dirsToSearch) {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (item.endsWith('.xlsx') || item.endsWith('.docx')) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            allFiles.push({ path: fullPath, mtime: stat.mtime.getTime() });
          }
        }
      }
    }

    allFiles.sort((a, b) => b.mtime - a.mtime);

    if (allFiles.length > 0) {
      const rescuedFile = allFiles[0].path;
      console.log(`🛡️ [Kernel Guard] تم إنقاذ الملف ونقله من ${rescuedFile} إلى ${expectedPath}`);
      fs.renameSync(rescuedFile, expectedPath);
      return expectedPath;
    }
  } catch (e) {
    console.warn("⚠️ [Kernel Guard] فشل الإنقاذ:", e.message);
  }
  return null;
}

// ================= Kernel Principal =================
export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) {
    return {
      reply: "هلا يا شريكي... آمرني.",
      fileBase64: null, fileName: null, operations: [], execution: null
    };
  }

  ensureDirs();
  console.log(`\n🚀 [Kernel] بدء معالجة جلسة: ${sessionId} | الرسالة: "${message.substring(0, 30)}..."`);

  const activeFile = ctx.activeFile || null;
  const filePath = activeFile?.filePath || ctx.filePath || null;
  const fileName = activeFile?.fileName || ctx.fileName || null;

  let fileContext = {
    exists: false,
    path: filePath,
    name: fileName,
    type: 'unknown',
    structure: null,
    history: fusionMemory.getFileHistory(sessionId) || [],
    fingerprint: null
  };

  if (filePath && fs.existsSync(filePath)) {
    try {
      const preview = await extractPreviewAsync(filePath);
      fileContext = {
        exists: true,
        path: filePath,
        name: path.basename(filePath),
        type: path.extname(filePath).toLowerCase().replace('.', ''),
        structure: preview,
        history: fusionMemory.getFileHistory(sessionId) || [],
        fingerprint: fusionMemory.getFingerprint(sessionId)
      };
      console.log(`📊 [Kernel] تم تحميل الملف: ${fileContext.name} (${fileContext.type})`);
    } catch (e) {
      console.warn('⚠️ [Kernel] فشل قراءة الملف:', e.message);
    }
  }

  const structureSummary = fileContext.structure ? {
    sheets: fileContext.structure.sheets || [],
    rows: fileContext.structure.metadata?.rowCounts || {},
    columns: fileContext.structure.metadata?.columnCounts || {},
    preview: fileContext.structure.preview || []
  } : {};

  const environmentDescription = `
## 📋 سياق الجلسة الحالية
- **الملف النشط**: ${fileContext.exists ? fileContext.name : 'لا يوجد (إنشاء من الصفر)'}
- **النوع**: ${fileContext.type}
- **هيكل الملف**: \`\`\`json\n${JSON.stringify(structureSummary, null, 2)}\n\`\`\`
- **الطلب الحالي**: "${message}"
`;

  const systemContent = SYSTEM_PROMPT + `\n\n${environmentDescription}`;

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];
  const conversationMessages = [
    { role: "system", content: systemContent },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  let finalReplyText = "";
  let fileBase64 = null;
  let executionResult = null;

  try {
    console.log("🧠 [Kernel] استدعاء عقل الأثير (Gemini) مع الأدوات الهيكلية...");
    const rawReply = await geminiService.chat(conversationMessages, {
      fileName: ctx.fileName || fileContext.name,
      filePath: ctx.filePath || fileContext.path,
      fileContext,
      systemInstruction: systemContent,
      tools: EXCEL_TOOLS
    });

    finalReplyText = rawReply?.text || "";
    const functionCalls = rawReply?.functionCalls || null;

    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      console.log(`🔧 [Kernel] تم استلام ${functionCalls.length} أداة للتنفيذ...`);
      
      let anySuccess = false;
      let toolMessages = [];
      const targetFilePath = ctx.filePath || fileContext.path || path.join(GENERATED_DIR, `${generateFileId()}.xlsx`);

      for (const call of functionCalls) {
        console.log(`🔍 [Kernel] اسم الأداة المستلمة: "${call.name}" | الوسائط:`, JSON.stringify(call.args));
        
        let toolResult = null;

        if (call.name === "execute_python") {
          console.log(`⚙️ [Kernel] توجيه الأداة لمشغل البايثون الديناميكي...`);
          const pythonCode = call.args.code;
          toolResult = await executeDynamicPython(pythonCode, targetFilePath, !fileContext.exists, sessionId);
          
        } else if (call.name && typeof handleExcelToolCall === "function") {
          console.log(`⚙️ [Kernel] جاري تنفيذ أداة الإكسل: ${call.name}`);
          toolResult = await handleExcelToolCall(call, targetFilePath);
          
        } else {
          console.warn(`⚠️ [Kernel] الدالة ${call.name} غير مدعومة أو لم يتم استيرادها بشكل صحيح.`);
          toolMessages.push(`❌ فشل: الأداة ${call.name} غير مدعومة بالنظام.`);
          continue;
        }

        if (toolResult && toolResult.success) {
          anySuccess = true;
          
          // 🧠 التحليل المهني مع تمرير tools: null لمنع تداخل الأدوات في مرحلة قراءة النتائج
          const analysis = await geminiService.chat([
            { role: "system", content: "أنت الأثير. صغ المخرجات البرمجية التالية كتقرير مهني معماري للمهندس عبدالغني (لا تعرض أكواد، ركز على النتائج بأسلوب مهني):" },
            { role: "user", content: toolResult.output }
          ], {
            tools: null
          });
          
          toolMessages.push(analysis.text || `✅ ${toolResult.output}`);
          
          fusionMemory.storeOperation(sessionId, call.name);
          const historyUpdate = fusionMemory.getFileHistory(sessionId) || [];
          fusionMemory.storeFileHistory(sessionId, [...historyUpdate, `تطبيق أداة: ${call.name}`]);
        } else {
          toolMessages.push(`❌ فشل أداة ${call.name}: ${toolResult?.error || 'خطأ غير معروف'}`);
        }
      }

      if (anySuccess) {
        fusionMemory.storeCurrentFile(sessionId, targetFilePath);
        fusionMemory.storeSessionMode(sessionId, "file_edit");

        try {
          const idx = await readIndexSafe();
          const newId = path.basename(targetFilePath).split('-')[0] || generateFileId(); 
          idx[newId] = {
            fileId: newId,
            fileName: path.basename(targetFilePath),
            storedPath: targetFilePath,
            size: fs.existsSync(targetFilePath) ? fs.statSync(targetFilePath).size : 0,
            uploadedAt: new Date().toISOString(),
            type: fileContext.exists ? "modified" : "generated",
            sessionId
          };
          await writeIndex(idx);
        } catch (e) {
          console.warn("⚠️ [Kernel] فشل تحديث الفهرس:", e.message);
        }

        try {
          const finalPath = rescueGeneratedFile(targetFilePath);
          if (finalPath && fs.existsSync(finalPath)) {
            const fileBuffer = await fs.promises.readFile(finalPath);
            fileBase64 = fileBuffer.toString("base64");
            ctx.filePath = finalPath;
          } else {
            throw new Error("لم يتم العثور على ملف الإخراج النهائي.");
          }
        } catch (e) {
          console.warn("⚠️ [Kernel] خطأ في قراءة الملف النهائي:", e.message);
          toolMessages.push(`❌ خطأ في العثور على الملف: ${e.message}`);
        }

        const fileDirName = targetFilePath.includes("persistent_uploads") ? "persistent_uploads" : "generated";
        finalReplyText = toolMessages.join("\n\n") + `\n\n📁 [تحميل الملف المحدث](/${fileDirName}/${path.basename(targetFilePath)})`;
        
        ctx.filePath = targetFilePath;
        ctx.fileName = path.basename(targetFilePath);

        memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
        return {
          reply: finalReplyText,
          fileName: ctx.fileName,
          fileBase64,
          operations: [],
          execution: { success: true, messages: toolMessages },
          context: ctx
        };
      } else {
        finalReplyText = toolMessages.join("\n") || "⚠️ عذراً، لم تتمكن الأدوات من إتمام العملية بنجاح.";
      }
    } else {
      console.log("💬 [Kernel] وضع الدردشة العادية.");
    }

  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `❌ خطأ تقني في معالجة الطلب: ${error.message}`;
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText,
    fileName: ctx.fileName || fileContext.name,
    fileBase64: null,
    operations: [],
    execution: executionResult,
    context: ctx
  };
}

