/**
 * api/core/kernel.js – The Sovereign Kernel (Pure Dynamic Intent Edition)
 * ✅ سيادة كاملة، بدون كلمات مفتاحية مسبقة، الاعتماد على وعي نموذج Gemini ونية المستخدم الديناميكية.
 * ✅ دعم functionCalls من Gemini (Tool Calling)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import { executeDynamicPython, extractPreviewAsync } from "./dynamic_executor.js";
import fusionMemory from "./fusion_memory.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSISTENT_DIR = path.join(process.cwd(), "persistent_uploads");
const GENERATED_DIR = path.join(process.cwd(), "generated");
const INDEX_FILE = path.join(PERSISTENT_DIR, "index.json");

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
    console.warn("⚠️ [Kernel] readIndexSafe failed:", e.message);
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

function sanitizeName(name) {
  return (name || "file").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) {
    return {
      reply: "هلا يا شريكي... آمرني.",
      fileBase64: null,
      fileName: null,
      operations: [],
      execution: null
    };
  }

  ensureDirs();

  const activeFile = ctx.activeFile || null;
  const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;

  let fileName = ctx.fileName || activeFile?.fileName || null;
  let filePath = ctx.filePath || activeFile?.filePath || null;

  if (filePath === null || filePath === undefined) filePath = activeFile?.filePath || null;
  if (fileName === null || fileName === undefined) fileName = activeFile?.fileName || null;

  let fileContext = ctx.activeFileSummary || "";
  if (!fileContext && extractedContent && !extractedContent.error) {
    const schema = extractedContent.columns_schema || {};
    const headerRow = extractedContent.detected_header_row || 1;
    fileContext = `ملف: ${fileName}\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}\n`;
  }

  const fingerprintText = fusionMemory.getFingerprintText(sessionId);
  const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];

  const hasExistingFile = filePath && fs.existsSync(filePath);
  
  // تحديد ما إذا كان الطلب إنشاء ملف جديد من الصفر أو تعديل ملف قائم بناءً على وجوده الفعلي
  const isGenerationRequest = !hasExistingFile;

  let systemContent = SYSTEM_PROMPT;
  if (fileContext) {
    systemContent += `\n\n[سياق الملف الحالي]:\n${fileContext}`;
  }
  if (fingerprintText) {
    systemContent += `\n\n[بصمة الملف الحالية]:\n${fingerprintText}`;
  }

  systemContent += `
\n\n[⚙️ تعليمات تقنية للنموذج]:
- استخدم \`target_file\` كمسار حصري للملف (معرّف مسبقاً).
- لا تستخدم \`sys.argv\`.
- استخدم المكتبات المناسبة وتولى كتابة الكود البرمجي التنفيذي فقط إذا تطلب الأمر تعديل أو إنشاء ملفات بيانات، وإلا أجب نصياً مباشرة.`;

  if (isGenerationRequest) {
    const id = generateFileId();
    const safeName = `${id}-${sanitizeName(fileName || `Alatheer_Report`)}.xlsx`.replace(/\.xlsx\.xlsx$/, ".xlsx");
    fileName = safeName;
    filePath = path.join(PERSISTENT_DIR, safeName);
    systemContent += `\n\n[تعليمات الحالة]: أنشئ ملفاً جديداً واحفظه في \`target_file\`.`;
  } else {
    systemContent += `\n\n[تعليمات الحالة]: اقرأ الملف من \`target_file\`، عدّل عليه بناءً على طلب المستخدم، ثم احفظ في \`target_file\` نفسه.`;
  }

  const conversationMessages = [
    { role: "system", content: systemContent },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  let finalReplyText = "";
  let fileBase64 = null;
  let executionResult = null;

  try {
    const rawReply = await geminiService.chat(conversationMessages, {
      fileName,
      extractedContent,
      systemInstruction: systemContent
    });

    // ✅ استخراج النص والأدوات من الرد
    const replyText = rawReply?.text || "";
    const functionCalls = rawReply?.functionCalls || null;

    // ✅ تحديد الرد النهائي
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      const pyCall = functionCalls.find(fc => fc.name === 'execute_python' || fc.args?.code);
      if (pyCall && pyCall.args && pyCall.args.code) {
        finalReplyText = "```python\n" + pyCall.args.code + "\n```";
      } else {
        finalReplyText = replyText || "تم تنفيذ الأداة بنجاح.";
      }
    } else {
      finalReplyText = replyText || String(rawReply || "تم يا شريكي.");
    }

    // الكشف الديناميكي عن وجود نية تنفيذ برمجية
    let pythonMatch = finalReplyText.match(/```python\s*\n([\s\S]*?)\n\s*```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```python\n([\s\S]*?)```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```([\s\S]*?)```/);

    // إذا لم يكتب النموذج كود بايثون، فهو مجرد رد دردشة - نعيده فوراً
    if (!pythonMatch || !filePath) {
      memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
      return {
        reply: finalReplyText,
        fileName,
        fileBase64: null,
        operations: [],
        execution: null
      };
    }

    // إذا وُجد كود بايثون، ننفذه
    let pythonCode = pythonMatch[1].trim();

    finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();
    if (finalReplyText.includes('```') && !finalReplyText.includes('python')) {
      finalReplyText = finalReplyText.replace(/```[\s\S]*?```/g, "").trim();
    }
    if (!finalReplyText) finalReplyText = "جاري تنفيذ المعالجة يا شريكي...";

    const maxRetries = 2;
    let currentAttempt = 0;
    let isSuccess = false;

    while (currentAttempt < maxRetries && !isSuccess) {
      currentAttempt++;
      console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (محاولة ${currentAttempt})...`);

      executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest, sessionId);

      if (executionResult && executionResult.success && fs.existsSync(filePath)) {
        isSuccess = true;

        const downloadUrl = `/persistent_uploads/${path.basename(filePath)}`;
        const fileNameForUser = path.basename(filePath);

        finalReplyText += `\n\n✅ تم ${isGenerationRequest ? 'توليد' : 'تعديل'} الملف بنجاح يا هندسة!`;
        finalReplyText += `\n\n📥 **[اضغط هنا لتحميل الملف](${downloadUrl})**`;
        finalReplyText += `\n📁 اسم الملف: ${fileNameForUser}`;

        try {
          fileBase64 = fs.readFileSync(filePath).toString("base64");
        } catch (e) {
          console.warn("⚠️ [Kernel] failed to read file for base64:", e.message);
        }

        try {
          const previewData = await extractPreviewAsync(filePath);
          if (previewData && !previewData.error) {
            fusionMemory.storeFileFingerprint(sessionId, filePath, previewData);
          }
        } catch (e) {
          console.warn("⚠️ [Kernel] فشل تخزين البصمة:", e.message);
        }

        try {
          const idx = await readIndexSafe();
          let foundId = null;
          for (const k of Object.keys(idx)) {
            if (idx[k].storedPath === filePath) {
              foundId = k;
              break;
            }
          }
          if (!foundId) {
            const newId = generateFileId();
            const storedName = path.basename(filePath);
            idx[newId] = {
              fileId: newId,
              fileName: storedName,
              storedName,
              storedPath: filePath,
              size: fs.existsSync(filePath) ? fs.statSync(filePath).size : null,
              uploadedAt: new Date().toISOString()
            };
            await writeIndex(idx);
          } else {
            idx[foundId].fileName = path.basename(filePath);
            idx[foundId].storedPath = filePath;
            idx[foundId].size = fs.existsSync(filePath) ? fs.statSync(filePath).size : idx[foundId].size;
            idx[foundId].uploadedAt = new Date().toISOString();
            await writeIndex(idx);
          }

          try {
            memory.saveFile(sessionId, {
              filePath,
              fileName: path.basename(filePath),
              metadata: ctx.metadata || {}
            });
          } catch (e) {}

          try {
            await fs.promises.chmod(filePath, 0o600);
          } catch (e) {}
        } catch (e) {
          console.warn("⚠️ [Kernel] index update failed:", e.message);
        }
      } else {
        const actualError = executionResult?.error || executionResult?.output || "خطأ في التنفيذ";

        if (currentAttempt < maxRetries) {
          const errorFeedbackPrompt =
            `الكود واجه مشكلة:\n\`\`\`text\n${actualError}\n\`\`\`\n` +
            `صحح الكود واستخدم \`target_file\` لحفظ الملف.`;

          const correctionMessages = [
            ...conversationMessages,
            { role: "assistant", content: pythonMatch[0] },
            { role: "user", content: errorFeedbackPrompt }
          ];

          const fixReply = await geminiService.chat(correctionMessages, {
            fileName,
            extractedContent,
            systemInstruction: systemContent
          });

          // ✅ استخراج النص المصحح من الرد
          const fixText = fixReply?.text || "";
          const fixFunctionCalls = fixReply?.functionCalls || null;

          let fixedText = "";
          if (fixFunctionCalls && Array.isArray(fixFunctionCalls) && fixFunctionCalls.length > 0) {
            const pyCall = fixFunctionCalls.find(fc => fc.name === 'execute_python' || fc.args?.code);
            fixedText = (pyCall && pyCall.args?.code) ? "```python\n" + pyCall.args.code + "\n```" : fixText;
          } else {
            fixedText = fixText || String(fixReply || "");
          }

          let newMatch = fixedText.match(/```python\s*\n([\s\S]*?)\n\s*```/);
          if (!newMatch) newMatch = fixedText.match(/```python\s*([\s\S]*?)\s*```/);
          if (!newMatch) newMatch = fixedText.match(/```\s*([\s\S]*?)```/);

          if (newMatch) {
            pythonCode = newMatch[1].trim();
          } else {
            break;
          }
        } else {
          finalReplyText += `\n\n❌ عذراً، واجهت مشكلة في التنفيذ:\n\`\`\`text\n${String(actualError).substring(0, 400)}\n\`\`\``;
        }
      }
    }
  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `صار خطأ تقني: ${error.message}`;
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText,
    fileName,
    fileBase64,
    operations: [],
    execution: executionResult
  };
      }
