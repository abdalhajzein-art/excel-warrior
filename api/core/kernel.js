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
  return (name || "file").replace(/[^a-zA-Z0-9_.-]/g, "_");
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
  // كشف بسيط إذا كان المستخدم يطلب الإنشاء من الصفر
  const isGenerationRequest = !hasExistingFile && message.match(/(أنشئ|اعمل|ولد|قم بإنشاء|توليد) (ملف|شيت|جدول|تقرير)/i);

  let envState = "";
  if (isGenerationRequest) {
    const id = generateFileId();
    const safeName = `${id}-${sanitizeName(fileName || `Alatheer_Generated`)}.xlsx`.replace(/\.xlsx\.xlsx$/, ".xlsx");
    fileName = safeName;
    filePath = path.join(PERSISTENT_DIR, safeName);
    envState = `[حالة البيئة]: لا يوجد ملف نشط. المستخدم يطلب إنشاء ملف جديد. سيتم إنشاء الملف وحفظه في المتغير المرجعي \`target_file\`.`;
  } else if (hasExistingFile) {
    envState = `[حالة البيئة]: يوجد ملف نشط حالياً (الاسم: ${fileName}). طلب المستخدم قد يكون متعلقاً بهذا الملف للتحليل أو التعديل، أو قد يكون مجرد حوار. المتغير \`target_file\` يشير إلى هذا الملف.`;
  } else {
    envState = `[حالة البيئة]: وضع الحوار العام (Chat Mode). لا يوجد ملف نشط حالياً. تعامل كمحاور ومهندس مستشار، ولا تكتب كود برمجي إلا إذا طُلب منك صراحة إنشاء شيء.`;
  }

  // 2. بناء الـ System Prompt الديناميكي
  let systemContent = SYSTEM_PROMPT + `\n\n${envState}`;

  let fileContext = ctx.activeFileSummary || "";
  if (!fileContext && extractedContent && !extractedContent.error) {
    const schema = extractedContent.columns_schema || {};
    const headerRow = extractedContent.detected_header_row || 1;
    fileContext = `[تفاصيل الملف النشط]:\nمؤشر صف العناوين: ${headerRow}\nالأعمدة المتوفرة: ${JSON.stringify(schema)}`;
    systemContent += `\n\n${fileContext}`;
  }

  const fingerprintText = fusionMemory.getFingerprintText(sessionId);
  if (fingerprintText) {
    systemContent += `\n\n[بصمة الملف الحالية لمعرفة محتواه الفعلي]:\n${fingerprintText}`;
  }

  // 3. تجهيز تاريخ المحادثة
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
    // 4. إرسال الطلب لـ Gemini
    console.log("🧠 [Kernel] استدعاء عقل الأثير (Gemini)...");
    const rawReply = await geminiService.chat(conversationMessages, {
      fileName,
      extractedContent,
      systemInstruction: systemContent
    });

    const replyText = rawReply?.text || "";
    const functionCalls = rawReply?.functionCalls || null;
    finalReplyText = replyText;

    // استخراج الكود البرمجي (إن وجد إما كـ Function Call أو Text Markdown)
    let pythonCode = null;
    
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      const pyCall = functionCalls.find(fc => fc.name === "execute_python" || fc.args?.code);
      if (pyCall && pyCall.args?.code) {
        pythonCode = pyCall.args.code;
        finalReplyText = replyText || "جاري تنفيذ العملية المطلوبة يا شريكي...";
      }
    }

    if (!pythonCode) {
      let pythonMatch = finalReplyText.match(/```python\s*\n([\s\S]*?)\n\s*```/i) 
                     || finalReplyText.match(/```python\s*([\s\S]*?)\s*```/i)
                     || finalReplyText.match(/```\s*([\s\S]*?)```/); // Fallback عام
      if (pythonMatch) {
        pythonCode = pythonMatch[1].trim();
        // إزالة الكود من النص الذي سيعرض للمستخدم
        finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/gi, "").trim();
        if (!finalReplyText) finalReplyText = "تكرم عينك، ثواني بنفذ العملية...";
      }
    }

    // 5. اتخاذ القرار: هل هناك تنفيذ أم مجرد دردشة؟
    if (!pythonCode || !filePath) {
      console.log("💬 [Kernel] وضع الدردشة/الاستشارة (لا يوجد كود للتنفيذ).");
      memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
      return { reply: finalReplyText, fileName, fileBase64: null, operations: [], execution: null };
    }

    // 6. حلقة التنفيذ والتصحيح الذاتي (Self-Healing Execution Loop)
    const maxRetries = 2;
    let currentAttempt = 0;
    let isSuccess = false;

    while (currentAttempt < maxRetries && !isSuccess) {
      currentAttempt++;
      console.log(`⚡ [Kernel] تنفيذ الكود (محاولة ${currentAttempt}/${maxRetries})...`);

      executionResult = await executeDynamicPython(pythonCode, filePath, isGenerationRequest, sessionId);

      if (executionResult && executionResult.success && fs.existsSync(filePath)) {
        isSuccess = true;
        console.log("✅ [Kernel] نجاح التنفيذ!");
        
        const downloadUrl = `/persistent_uploads/${path.basename(filePath)}`;
        const fileNameForUser = path.basename(filePath);

        finalReplyText += `\n\n✅ تم ${isGenerationRequest ? "الإنشاء" : "التعديل"} بنجاح يا هندسة!`;
        finalReplyText += `\n📥 **[اضغط هنا لتحميل الملف](${downloadUrl})**`;

        // قراءة الملف وتحديث الفهارس
        try { fileBase64 = fs.readFileSync(filePath).toString("base64"); } catch (e) {}
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
              storedPath: filePath, size: fs.statSync(filePath).size, uploadedAt: new Date().toISOString()
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
          console.log("🔄 [Kernel] إرسال الخطأ للنموذج لمحاولة تصحيحه تلقائياً...");
          const errorFeedbackPrompt = `حدث خطأ أثناء تنفيذ كود البايثون السابق:\n\`\`\`text\n${actualError}\n\`\`\`\nالرجاء تحليل الخطأ وكتابة كود Python المصحح بالكامل. تذكر استخدام \`target_file\`.`;
          
          const correctionMessages = [
            ...conversationMessages,
            { role: "assistant", content: `\`\`\`python\n${pythonCode}\n\`\`\`` },
            { role: "user", content: errorFeedbackPrompt }
          ];

          const fixReply = await geminiService.chat(correctionMessages, { systemInstruction: systemContent });
          let fixText = fixReply?.text || "";
          let newMatch = fixText.match(/```python\s*\n([\s\S]*?)\n\s*```/i) || fixText.match(/```\s*([\s\S]*?)```/);
          
          if (newMatch) {
            pythonCode = newMatch[1].trim();
          } else {
            break; // لا يوجد كود مصحح، نكسر الحلقة
          }
        } else {
          finalReplyText += `\n\n❌ عذراً يا شريكي، واجهتني مشكلة تقنية بالتنفيذ. الخطأ:\n\`\`\`text\n${String(actualError).substring(0, 300)}\n\`\`\``;
        }
      }
    }
  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `صار خطأ تقني يا شريكي: ${error.message}`;
  }

  // 7. حفظ السجل النهائي
  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText,
    fileName,
    fileBase64,
    operations: [],
    execution: executionResult
  };
}

