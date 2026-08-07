/**
 * api/core/kernel.js – The Sovereign Kernel (Pure Python Edition)
 * نسخة نهائية مُحسّنة لتوحيد المسارات، إدارة الفهارس، وتطبيق التصحيح الذاتي.
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

// مجلدات موحّدة داخل المشروع
const PERSISTENT_DIR = path.join(process.cwd(), "persistent_uploads");
const GENERATED_DIR = path.join(process.cwd(), "generated");
const INDEX_FILE = path.join(PERSISTENT_DIR, "index.json");

// تأكد من وجود المجلدات وملف الفهرس
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

  console.log(`🔍 [Kernel] استقبال: fileName=${fileName}, filePath=${filePath}`);

  let fileContext = ctx.activeFileSummary || "";
  if (!fileContext && extractedContent && !extractedContent.error) {
    const schema = extractedContent.columns_schema || {};
    const headerRow = extractedContent.detected_header_row || 1;
    fileContext = `ملف: ${fileName}\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}\n`;
  }

  const fingerprintText = fusionMemory.getFingerprintText(sessionId);
  const history = Array.isArray(ctx.history) ? ctx.history.slice(-20) : [];

  const excelActionRegex = /(ضيف|أضف|احذف|شيل|امسح|عدل|غيّر|حدث|نسّق|لوّن|دمج|فك دمج|معادلة|صيغة|عمود|أعمدة|صف|صفوف|خلية|خلايا|شيت|ورقة|أنشئ|ولد|صمم|اعمل|سوي|اطبع|جدول|تقرير)/i;
  const isExcelAction = excelActionRegex.test(message);

  const userExplicitlyWantsNew = /(ملف جديد|من الصفر|جديد كلياً|اصنع ملفاً جديد)/i.test(message);
  const isModifyRequest = /طور|عدل|حسن|ضيف|أضف|تطوير|إضافة|add|update|modify|تحسين|توسيع/i.test(message);

  const hasExistingFile = filePath && fs.existsSync(filePath);
  const hasFilePath = filePath !== null && filePath !== undefined;

  let isGenerationRequest = false;

  if (userExplicitlyWantsNew && /(أنشئ|ولد|صمم|اعمل|سوي|جدول|تقرير)/i.test(message)) {
    isGenerationRequest = true;
  } else if (!hasExistingFile && !hasFilePath) {
    isGenerationRequest = true;
  } else if (!hasExistingFile && hasFilePath) {
    isGenerationRequest = true;
  } else if (isModifyRequest && hasExistingFile) {
    isGenerationRequest = false;
  } else if (hasExistingFile) {
    isGenerationRequest = false;
  } else {
    isGenerationRequest = true;
  }

  let systemContent = SYSTEM_PROMPT;
  if (fileContext) {
    systemContent += `\n\n[سياق الملف الحالي]:\n${fileContext}`;
  }
  if (fingerprintText) {
    systemContent += `\n\n[بصمة الملف الحالية]:\n${fingerprintText}`;
  }

  // 🏛️ التعليمات السيادية الصارمة للـ Pure Python
  systemContent += `
[🏛️ بروتوكول الأثير السيادي - Pure Python]:
- أنت تمتلك بيئة Python متكاملة. استخدم مكتبات (pandas, openpyxl, os) فقط.
- ⚠️ ممنوع استدعاء أي أدوات خارجية أو وهمية (xls_*).
- **القاعدة الذهبية الصارمة:** استخدم المتغير \`target_file\` المعرّف مسبقاً في البيئة كمسار وحيد للقراءة والكتابة (مثلاً: \`wb.save(target_file)\` أو \`df.to_excel(target_file, index=False)\`).
- لا تقم بتعريف متغير \`target_file\`، ولا تستخدم \`sys.argv\` أبداً.`;

  // تحديد مسار الملف النهائي وتوجيه النموذج
  if (isGenerationRequest || !hasExistingFile) {
    const id = generateFileId();
    const safeName = `${id}-${sanitizeName(fileName || `Alatheer_Report`)}.xlsx`.replace(/\.xlsx\.xlsx$/, ".xlsx");
    fileName = safeName;
    filePath = path.join(PERSISTENT_DIR, safeName);
    systemContent += `\n\n[تعليمات النظام للتوليد]: أنشئ ملفاً جديداً واحفظه مباشرة باستخدام \`target_file\`.`;
  } else {
    systemContent += `\n\n[تعليمات النظام للتعديل]: قم بقراءة الملف الحالي عبر \`target_file\` (مثلاً \`pd.read_excel(target_file)\` أو \`load_workbook(target_file)\`)، عدل البيانات، ثم احفظ التعديلات في \`target_file\` نفسه.`;
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
    console.log("🧠 [Kernel] استدعاء النموذج للتحليل الأولي...");

    const rawReply = await geminiService.chat(conversationMessages, {
      fileName,
      extractedContent,
      systemInstruction: systemContent
    });

    finalReplyText = rawReply || "تم يا شريكي.";

    if (!isExcelAction || !filePath) {
      memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
      return {
        reply: finalReplyText,
        fileName,
        fileBase64: null,
        operations: [],
        execution: null
      };
    }

    let pythonMatch = finalReplyText.match(/```python\s*\n([\s\S]*?)\n\s*```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```python\n([\s\S]*?)```/);
    if (!pythonMatch) pythonMatch = finalReplyText.match(/```([\s\S]*?)```/);

    if (pythonMatch) {
      let pythonCode = pythonMatch[1].trim();

      finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/g, "").trim();
      if (finalReplyText.includes('```') && !finalReplyText.includes('python')) {
        finalReplyText = finalReplyText.replace(/```[\s\S]*?```/g, "").trim();
      }
      if (!finalReplyText) finalReplyText = "جاري تجهيز الملف يا شريكي...";

      const maxRetries = 2;
      let currentAttempt = 0;
      let isSuccess = false;

      while (currentAttempt < maxRetries && !isSuccess) {
        currentAttempt++;
        console.log(`⚡ [Kernel] تنفيذ سكربت بايثون (محاولة ${currentAttempt})...`);

        executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest, sessionId);

        if (executionResult && executionResult.success && fs.existsSync(filePath)) {
          isSuccess = true;
          finalReplyText += `\n\n✅ تم ${isGenerationRequest ? 'توليد' : 'تعديل'} الملف بنجاح والتحقق من صحته. جاهز للتحميل يا هندسة!`;
          try {
            fileBase64 = fs.readFileSync(filePath).toString("base64");
          } catch (e) {
            console.warn("⚠️ [Kernel] failed to read file for base64:", e.message);
          }

          // تحديث البصمة والفهرس
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
          const actualError = executionResult?.error || executionResult?.output || "خطأ غير معروف في التنفيذ";
          console.warn(`⚠️ فشل التنفيذ في المحاولة ${currentAttempt}:`, actualError);

          if (currentAttempt < maxRetries) {
            const errorFeedbackPrompt =
              `الكود واجه المشكلة التقنية التالية أثناء التنفيذ:\n\`\`\`text\n${actualError}\n\`\`\`\n` +
              `قم بتصحيح كود Python، واستخدم المتجر 'target_file' لحفظ النتيجة بشكل صحيح دون أخطاء.`;

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

            let newMatch = fixReply.match(/```python\s*\n([\s\S]*?)\n\s*```/);
            if (!newMatch) newMatch = fixReply.match(/```python\s*([\s\S]*?)\s*```/);
            if (!newMatch) newMatch = fixReply.match(/```\s*([\s\S]*?)```/);

            if (newMatch) {
              pythonCode = newMatch[1].trim();
            } else {
              break;
            }
          } else {
            finalReplyText += `\n\n❌ عذراً يا شريكي، واجهتني مشكلة تقنية ولم تنجح محاولات التصحيح الذاتي:\n\`\`\`text\n${String(actualError).substring(0, 400)}\n\`\`\``;
          }
        }
      }
    } else {
      console.warn("⚠️ [Kernel] لم يتم العثور على كود Python في رد Gemini");
      finalReplyText += `\n\n⚠️ طلبت عملية إكسل ولكن لم يُرجع النموذج كود بايثون للتنفيذ.`;
    }
  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `صار خطأ تقني داخلي: ${error.message}`;
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

