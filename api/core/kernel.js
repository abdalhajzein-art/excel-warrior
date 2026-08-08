/**
 * api/core/kernel.js – The Sovereign Kernel (Pure Dynamic Edition)
 * التصميم: حلقة وكيل مستقل (Agentic Loop) بدون مسارات ثابتة (No Hardcoded Intents).
 * الميزات: حقن سياق البيئة ديناميكياً، استخراج ذكي للكود، وتصحيح ذاتي (Self-Healing).
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

function sanitizeName(name) {
  return (name || "file").replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/\.xlsx\.xlsx$/, ".xlsx");
}

// ================= The Sovereign Kernel =================
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

  // 1. قراءة وإعداد حالة البيئة (Environment State)
  const activeFile = ctx.activeFile || null;
  const extractedContent = ctx.extractedContent || activeFile?.extractedContent || null;

  let fileName = ctx.fileName || activeFile?.fileName || null;
  let filePath = ctx.filePath || activeFile?.filePath || null;

  if (filePath === null || filePath === undefined) filePath = activeFile?.filePath || null;
  if (fileName === null || fileName === undefined) fileName = activeFile?.fileName || null;

  const hasExistingFile = !!(filePath && fs.existsSync(filePath));
  // كشف ذكي لنية الإنشاء من الصفر
  const isGenerationRequest = !hasExistingFile && message.match(/(أنشئ|اعمل|ولد|قم بإنشاء|توليد|ابنِ) (ملف|شيت|جدول|تقرير|اكسل)/i);

  let envState = "";
  if (isGenerationRequest) {
    const id = generateFileId();
    fileName = `${id}-${sanitizeName(fileName || `Alatheer_Generated`)}.xlsx`;
    // استخدام مجلد المولدات للملفات الجديدة بدلاً من مجلد المرفوعات
    filePath = path.join(GENERATED_DIR, fileName);
    envState = `[حالة البيئة]: لا يوجد ملف نشط حالياً. المستخدم يطلب إنشاء ملف جديد من الصفر.
- يجب عليك توليد كود Python يقوم بإنشاء الملف.
- مسار الملف المطلق محفوظ مسبقاً في المتغير \`target_file\`. استخدمه مباشرة ولا تقم بتعريفه.`;
  } else if (hasExistingFile) {
    envState = `[حالة البيئة]: يوجد ملف نشط حالياً (الاسم: ${fileName}).
- الطلب قد يكون لتحليل أو تعديل هذا الملف.
- مسار الملف المطلق محفوظ مسبقاً في المتغير \`target_file\`. استخدمه مباشرة للقراءة (مثل pandas.read_excel) وللحفظ (مثل df.to_excel).`;
  } else {
    envState = `[حالة البيئة]: وضع الحوار العام والاستشارة (Chat Mode). لا يوجد ملف نشط.
- تعامل كمهندس معماري ومحاور ذكي.
- لا تكتب كود برمجي Python إلا إذا طلب المستخدم صراحة إجراء عملية برمجية أو تحليل بيانات.`;
  }

  // 2. بناء الـ System Prompt الديناميكي
  let systemContent = SYSTEM_PROMPT + `\n\n${envState}`;

  let fileContext = ctx.activeFileSummary || "";
  if (!fileContext && extractedContent && !extractedContent.error) {
    const schema = extractedContent.columns_schema || {};
    const headerRow = extractedContent.detected_header_row || 1;
    fileContext = `[الهيكل البياني للملف النشط]:\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}`;
    systemContent += `\n\n${fileContext}`;
  }

  const fingerprintText = fusionMemory.getFingerprintText(sessionId);
  if (fingerprintText) {
    systemContent += `\n\n[بصمة محتوى الملف الفعلي (أحدث نسخة)]: \n${fingerprintText}`;
  }

  // 3. تجهيز تاريخ المحادثة مع تقليص السياق للحفاظ على الـ Tokens
  const history = Array.isArray(ctx.history) ? ctx.history.slice(-15) : [];
  const conversationMessages = [
    { role: "system", content: systemContent },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  let finalReplyText = "";
  let fileBase64 = null;
  let executionResult = null;

  try {
    // 4. استدعاء العقل المدبر (Gemini)
    console.log("🧠 [Kernel] استدعاء عقل الأثير (Gemini)...");
    const rawReply = await geminiService.chat(conversationMessages, {
      fileName,
      extractedContent,
      systemInstruction: systemContent
    });

    const replyText = rawReply?.text || "";
    const functionCalls = rawReply?.functionCalls || null;
    finalReplyText = replyText;

    // استخراج الكود البرمجي بمرونة عالية
    let pythonCode = null;
    
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      const pyCall = functionCalls.find(fc => fc.name === "execute_python" || fc.args?.code);
      if (pyCall && pyCall.args?.code) {
        pythonCode = pyCall.args.code;
        finalReplyText = replyText || "تكرم عينك يا هندسة، ثواني وبنفذ العملية...";
      }
    }

    if (!pythonCode) {
      // البحث المعمق في الـ Markdown لحماية الكود من أخطاء التنسيق
      const pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/i)
                       || finalReplyText.match(/```\s*([\s\S]*?)```/);
      if (pythonMatch) {
        pythonCode = pythonMatch[1].trim();
        finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/gi, "").trim();
        if (!finalReplyText) finalReplyText = "جاري هندسة العملية المطلوبة برمجياً يا شريكي...";
      }
    }

    // 5. مسار المحادثة فقط (بدون كود)
    if (!pythonCode || !filePath) {
      console.log("💬 [Kernel] وضع الدردشة/الاستشارة (لا يوجد كود للتنفيذ).");
      memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
      return { reply: finalReplyText, fileName, fileBase64: null, operations: [], execution: null };
    }

    // 6. حلقة التنفيذ والتصحيح الذاتي المستقلة (Self-Healing Agentic Loop)
    const maxRetries = 2;
    let currentAttempt = 0;
    let isSuccess = false;

    while (currentAttempt < maxRetries && !isSuccess) {
      currentAttempt++;
      console.log(`⚡ [Kernel] تنفيذ الكود (محاولة ${currentAttempt}/${maxRetries})...`);

      // تنفيذ برمجيات البايثون في بيئة معزولة
      executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest, sessionId);

      if (executionResult && executionResult.success && fs.existsSync(filePath)) {
        isSuccess = true;
        console.log("✅ [Kernel] نجاح التنفيذ والملف جاهز!");
        
        // التوجيه الصحيح بناءً على مكان حفظ الملف (مرفوع vs مولّد)
        const downloadDir = isGenerationRequest ? 'generated' : 'persistent_uploads';
        const downloadUrl = `/${downloadDir}/${path.basename(filePath)}`;
        const fileNameForUser = path.basename(filePath);

        finalReplyText += `\n\n✅ تم ${isGenerationRequest ? "الإنشاء" : "التعديل"} بنجاح يا هندسة!`;
        finalReplyText += `\n📥 **[اضغط هنا لتحميل الملف](${downloadUrl})**`;

        // العمليات غير المتزامنة (Non-blocking) لقراءة الملف والفهرسة
        try { 
          const fileBuffer = await fs.promises.readFile(filePath);
          fileBase64 = fileBuffer.toString("base64"); 
        } catch (e) {
          console.warn("⚠️ [Kernel] خطأ في تحويل الملف إلى Base64:", e.message);
        }

        try {
          const previewData = await extractPreviewAsync(filePath);
          if (previewData && !previewData.error) fusionMemory.storeFileFingerprint(sessionId, filePath, previewData);
        } catch (e) {}

        try {
          const idx = await readIndexSafe();
          const foundId = Object.keys(idx).find(k => idx[k].storedPath === filePath);
          
          if (!foundId) {
            const newId = generateFileId();
            idx[newId] = {
              fileId: newId, fileName: fileNameForUser, storedName: fileNameForUser,
              storedPath: filePath, size: fs.statSync(filePath).size, uploadedAt: new Date().toISOString(),
              type: isGenerationRequest ? "generated" : "uploaded"
            };
          } else {
            idx[foundId].size = fs.statSync(filePath).size;
            idx[foundId].uploadedAt = new Date().toISOString();
          }
          await writeIndex(idx);
          memory.saveFile(sessionId, { filePath, fileName: fileNameForUser, metadata: ctx.metadata || {} });
        } catch (e) {
          console.warn("⚠️ [Kernel] فشل تحديث الفهرس:", e.message);
        }
      } else {
        // آلية التصحيح الذاتي (Self-Healing)
        const actualError = executionResult?.error || executionResult?.output || "Unknown Error";
        console.log(`❌ [Kernel] فشل التنفيذ (محاولة ${currentAttempt}):`, actualError);

        if (currentAttempt < maxRetries) {
          console.log("🔄 [Kernel] إرسال الخطأ لـ Gemini لمحاولة التصحيح التلقائي...");
          const errorFeedbackPrompt = `فشل التنفيذ في بيئة Python. الخطأ:\n\`\`\`text\n${actualError}\n\`\`\`\nقم بتحليل الخطأ وتوليد كود Python المصحح بالكامل بدون شرح. تذكر: المتغير \`target_file\` يحتوي على مسار الملف المطلق جاهزاً للاستخدام، لا تقم بتعريفه.`;
          
          const correctionMessages = [
            ...conversationMessages,
            { role: "assistant", content: `\`\`\`python\n${pythonCode}\n\`\`\`` },
            { role: "user", content: errorFeedbackPrompt }
          ];

          const fixReply = await geminiService.chat(correctionMessages, { systemInstruction: systemContent });
          let fixText = fixReply?.text || "";
          
          const newMatch = fixText.match(/```python\s*([\s\S]*?)\s*```/i) || fixText.match(/```\s*([\s\S]*?)```/);
          if (newMatch) {
            pythonCode = newMatch[1].trim();
          } else {
            break; // كسر الحلقة إذا لم يتم إرجاع كود مصحح
          }
        } else {
          finalReplyText += `\n\n❌ عذراً يا شريكي، واجهتني عقبة تقنية في بيئة التنفيذ ولم أتمكن من تخطيها. تفاصيل الخطأ:\n\`\`\`text\n${String(actualError).substring(0, 300)}\n\`\`\``;
        }
      }
    }
  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `صار خطأ تقني غير متوقع يا شريكي: ${error.message}`;
  }

  // 7. حفظ السجل النهائي للمحادثة
  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText,
    fileName,
    fileBase64,
    operations: [],
    execution: executionResult
  };
}
