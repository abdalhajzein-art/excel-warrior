/**
 * api/core/kernel.js – Trusting Gemini's Intelligence
 * 🧠 بدلاً من التحكم الصارم، نثق بذكاء Gemini ونقدم له السياق الكامل
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
  if (!name) return "file";
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/\.xlsx\.xlsx$/, ".xlsx");
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

  // 1. بناء السياق الكامل للملف
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

  // قراءة الملف إذا كان موجوداً
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

  // 2. بناء وصف البيئة الغني
  let environmentDescription = "";

  if (!fileContext.exists) {
    // حالة عدم وجود ملف
    const isGenerationRequest = message.match(/(أنشئ|اعمل|ولد|قم بإنشاء|توليد|ابنِ|صمم) (ملف|شيت|جدول|تقرير|اكسل|word|pdf)/i);
    
    if (isGenerationRequest) {
      const newFileName = fileName || `${generateFileId()}-${sanitizeName(message.substring(0, 20))}.xlsx`;
      const newFilePath = path.join(GENERATED_DIR, newFileName);
      
      environmentDescription = `
## 📋 سياق الجلسة الحالية

### حالة البيئة:
- **لا يوجد ملف نشط**
- **الطلب**: إنشاء ملف جديد من الصفر
- **الوصف**: "${message}"

### الملف المتوقع:
- **الاسم المقترح**: ${newFileName}
- **المسار**: ${newFilePath}
- **النوع**: سيتم اكتشافه من الطلب

### تاريخ الجلسة:
${fileContext.history.length > 0 ? fileContext.history.map((h, i) => `${i+1}. ${h}`).join('\n') : 'بداية جلسة جديدة'}

### مهمتك:
- فهم المطلوب من الطلب
- تحديد نوع الملف المناسب
- توليد كود Python ذكي لإنشاء الملف
- بناء هيكل احترافي يتناسب مع الغرض
- إضافة تنسيقات مناسبة
- استخدام المتغير \`target_file\` للمسار

### ملاحظات:
- أنت حر في اختيار أفضل هيكل وتنسيق
- استخدم معرفتك بهياكل الملفات
- ابنِ حلاً قابلاً للتطوير مستقبلاً
`;
      
      // تحديث السياق
      ctx.filePath = newFilePath;
      ctx.fileName = newFileName;
      
    } else {
      environmentDescription = `
## 📋 سياق الجلسة الحالية

### حالة البيئة:
- **لا يوجد ملف نشط**
- **الطلب**: "${message}"

### تاريخ الجلسة:
${fileContext.history.length > 0 ? fileContext.history.map((h, i) => `${i+1}. ${h}`).join('\n') : 'بداية جلسة جديدة'}

### مهمتك:
- تحليل الطلب كمحاور ذكي
- تقديم استشارة أو تحليل
- إذا طلب المستخدم إنشاء ملف، أخبره بذلك
- لا تكتب كوداً برمجياً إلا إذا طلب ذلك صراحة
`;
    }
    
  } else {
    // حالة وجود ملف نشط
    const structureSummary = fileContext.structure ? {
      sheets: fileContext.structure.sheets || [],
      rows: fileContext.structure.metadata?.rowCounts || {},
      columns: fileContext.structure.metadata?.columnCounts || {},
      preview: fileContext.structure.preview || []
    } : {};

    environmentDescription = `
## 📋 سياق الجلسة الحالية

### حالة البيئة:
- **ملف نشط**: ${fileContext.name}
- **النوع**: ${fileContext.type}
- **المسار**: ${fileContext.path}
- **الحجم**: ${fs.existsSync(fileContext.path) ? (fs.statSync(fileContext.path).size / 1024).toFixed(1) : 0} KB

### هيكل الملف:
\`\`\`json
${JSON.stringify(structureSummary, null, 2)}
\`\`\`

### تاريخ التعديلات في هذه الجلسة:
${fileContext.history.length > 0 ? fileContext.history.map((h, i) => `${i+1}. ${h}`).join('\n') : 'لا توجد تعديلات سابقة'}

### الطلب الحالي:
"${message}"

### مهمتك:
- فهم سياق الطلب والملف
- تحديد التعديلات المطلوبة
- توليد كود Python ذكي يحقق المطلوب
- حافظ على التنسيقات والصيغ والبيانات الموجودة
- إذا كانت التعديلات متتابعة، ابنِ على السابق
- استخدم المتغير \`target_file\` للمسار

### ملاحظات:
- أنت خبير في التعامل مع هذا النوع من الملفات
- استخدم معرفتك لكتابة أفضل حل
- لا تقيد نفسك بقوالب جامدة
- ثق بفهمك للسياق والبنية
`;
  }

  // 3. بناء الـ System Prompt الكامل
  const systemContent = SYSTEM_PROMPT + `\n\n${environmentDescription}`;

  // 4. تجهيز تاريخ المحادثة
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
    // 5. استدعاء Gemini (نثق بذكائه)
    console.log("🧠 [Kernel] استدعاء عقل الأثير (Gemini)...");
    const rawReply = await geminiService.chat(conversationMessages, {
      fileName: ctx.fileName || fileContext.name,
      filePath: ctx.filePath || fileContext.path,
      fileContext,
      systemInstruction: systemContent
    });

    const replyText = rawReply?.text || "";
    const functionCalls = rawReply?.functionCalls || null;
    finalReplyText = replyText;

    // 6. استخراج الكود (إذا وجد)
    let pythonCode = null;
    
    if (functionCalls && Array.isArray(functionCalls) && functionCalls.length > 0) {
      const pyCall = functionCalls.find(fc => fc.name === "execute_python" || fc.args?.code);
      if (pyCall && pyCall.args?.code) {
        pythonCode = pyCall.args.code;
        finalReplyText = replyText || "جاري تنفيذ العملية يا شريكي...";
        console.log("✅ [Kernel] تم استلام كود من أداة execute_python");
      }
    }

    // إذا لم يكن هناك كود من الأداة، ابحث في النص
    if (!pythonCode) {
      const pythonMatch = finalReplyText.match(/```python\s*([\s\S]*?)\s*```/i)
                       || finalReplyText.match(/```\s*([\s\S]*?)```/);
      if (pythonMatch) {
        pythonCode = pythonMatch[1].trim();
        finalReplyText = finalReplyText.replace(/```python[\s\S]*?```/gi, "").replace(/```[\s\S]*?```/gi, "").trim();
        if (!finalReplyText) finalReplyText = "جاري تنفيذ العملية...";
        console.log("✅ [Kernel] تم استخراج كود من النص");
      }
    }

    // 7. إذا لم يكن هناك كود، اعرض الرد كنص
    if (!pythonCode) {
      console.log("💬 [Kernel] وضع الدردشة (لا يوجد كود للتنفيذ).");
      memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });
      return { reply: finalReplyText, fileName, fileBase64: null, operations: [], execution: null };
    }

    // 8. تحديد مسار الملف
    const targetPath = ctx.filePath || fileContext.path || path.join(GENERATED_DIR, `${generateFileId()}.xlsx`);

    // 9. تنفيذ الكود (مع ثقة في أن Gemini كتبه بشكل صحيح)
    console.log("⚡ [Kernel] تنفيذ الكود...");
    executionResult = await executeDynamicPython(
      pythonCode,
      targetPath,
      !fileContext.exists, // isNewFile
      sessionId,
      fileContext
    );

    // 10. معالجة النتيجة
    if (executionResult && executionResult.success && fs.existsSync(targetPath)) {
      console.log("✅ [Kernel] نجاح التنفيذ!");
      
      // تحديث الذاكرة
      const isNewFile = !fileContext.exists;
      fusionMemory.storeCurrentFile(sessionId, targetPath);
      fusionMemory.storeOperation(sessionId, isNewFile ? "generate_file" : "modify_file");
      fusionMemory.storeSessionMode(sessionId, "file_edit");
      
      // حفظ تاريخ التعديل
      const historyUpdate = fusionMemory.getFileHistory(sessionId) || [];
      const operationDesc = isNewFile ? 
        `أنشأ ملف: ${path.basename(targetPath)}` : 
        `عدل ملف: ${path.basename(targetPath)} - "${message.substring(0, 30)}..."`;
      fusionMemory.storeFileHistory(sessionId, [...historyUpdate, operationDesc]);

      // تحديث الفهرس
      try {
        const idx = await readIndexSafe();
        const newId = generateFileId();
        idx[newId] = {
          fileId: newId,
          fileName: path.basename(targetPath),
          storedName: path.basename(targetPath),
          storedPath: targetPath,
          size: fs.statSync(targetPath).size,
          uploadedAt: new Date().toISOString(),
          type: isNewFile ? "generated" : "modified",
          sessionId
        };
        await writeIndex(idx);
      } catch (e) {
        console.warn("⚠️ [Kernel] فشل تحديث الفهرس:", e.message);
      }

      // قراءة الملف للتحميل
      try {
        const fileBuffer = await fs.promises.readFile(targetPath);
        fileBase64 = fileBuffer.toString("base64");
      } catch (e) {
        console.warn("⚠️ [Kernel] خطأ في تحويل الملف:", e.message);
      }

      // تحديث الرد
      finalReplyText += `\n\n✅ تم ${isNewFile ? 'إنشاء' : 'تعديل'} الملف بنجاح يا هندسة!`;
      finalReplyText += `\n📁 [تحميل الملف](/persistent_uploads/${path.basename(targetPath)})`;
      
      // تحديث السياق
      ctx.filePath = targetPath;
      ctx.fileName = path.basename(targetPath);

    } else {
      // فشل التنفيذ - ثق بقدرة Gemini على التصحيح
      const errorMsg = executionResult?.error || executionResult?.output || "خطأ غير معروف";
      console.log(`❌ [Kernel] فشل التنفيذ:`, errorMsg);
      
      // إذا كانت هنالك محاولة متبقية، دع Gemini يصحح
      const retryCount = ctx.retryCount || 0;
      if (retryCount < 2) {
        console.log("🔄 [Kernel] إعطاء فرصة لـ Gemini للتصحيح...");
        ctx.retryCount = retryCount + 1;
        
        // إرجاع السياق مع الخطأ لـ Gemini
        const errorContext = `\n\n❌ فشل التنفيذ.\nالخطأ:\n\`\`\`\n${errorMsg}\n\`\`\`\n\nالرجاء تحليل الخطأ وتقديم كود مصحح.`;
        
        // استدعاء self-healing
        const corrected = await kernel(sessionId, rawMessage + "\n\n" + errorContext, ctx);
        return corrected;
      }
      
      finalReplyText += `\n\n❌ عذراً يا شريكي، واجهت عقبة:\n\`\`\`\n${String(errorMsg).substring(0, 300)}\n\`\`\``;
    }

  } catch (error) {
    console.error("❌ [Kernel Exception]:", error);
    finalReplyText = `❌ خطأ تقني: ${error.message}`;
  }

  // 11. حفظ السجل
  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText,
    fileName: ctx.fileName || fileContext.name,
    fileBase64,
    operations: [],
    execution: executionResult,
    context: ctx
  };
}
