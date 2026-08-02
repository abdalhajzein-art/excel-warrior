/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic Self-Correction Edition)
 * المحرك السيادي لنظام الأثير – دعم حلقة التصحيح الذاتي واستكشاف الهيكلية الآلي
 */

import groqService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { extractFileMetadata } from "../tools/external/external_file_bridge.js";

/**
 * دالة الإصلاح التلقائي السريع للأخطاء الإملائية الشائعة في الأكواد
 */
function autoFixPythonCode(code) {
  return code
    .replace(/openpyxl\.workslet/gi, "openpyxl.worksheet")
    .replace(/from openpyxl\.worksheet\.datavalidation import DataValidation/gi, "from openpyxl.worksheet.datavalidation import DataValidation");
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟";

  /* ============================================================
     🛡️ حماية مسبقة: فحص سلامة الملف واستخراج الهيكلية (Metadata)
     ============================================================ */
  let fileMetadataPrompt = "";

  if (ctx.filePath) {
    if (!fs.existsSync(ctx.filePath) || fs.statSync(ctx.filePath).size === 0) {
      return { 
        reply: "⚠️ يا هندسة، الملف المرفوع حالياً تالف أو حجمه 0 بايت. أرجو إعادة رفع الملف الأصلي لنشتغل على نسخة نظيفة." 
      };
    }

    // 🔍 استخراج البيانات الهيكلية الشاملة تلقائياً عبر المستكشف الآلي
    try {
      const meta = extractFileMetadata(ctx.filePath);
      if (meta && !meta.error) {
        fileMetadataPrompt = `\n[بيانات الملف الهيكلية المكتشفة تلقائياً - Universal Metadata]:\n${JSON.stringify(meta, null, 2)}\n`;
      }
    } catch (mErr) {
      console.warn("⚠️ لم يتم تعذّر استخراج Metadata كاملة للملف:", mErr.message);
    }
  }

  /* ============================================================
     🟩 حقن التعليمات السيادية الصارمة
     ============================================================ */
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[قوانين سيادية إجبارية لمعالجة الملفات عبر Python]:
1. مسار الملف النشط حالياً: \`${ctx.filePath}\` (هذا الملف للقراءة فقط READ-ONLY).
2. يُمنع منعاً باتاً حفظ التعديلات على نفس المسار الأصلي لتجنب إتلاف البيانات.
3. عند كتابة كود لتعديل أو إنشاء ملف جديد، احفظ الناتج في مسار جديد بصيغة مناسبة (مثلاً: أضف "_modified" لاسم الملف).
4. في نهاية كود البايثون، اطبع إجبارياً المسار النهائي للملف المخرَج:
   \`print("OUTPUT_FILE: " + <path_to_output_file>)\`
5. يُمنع منعاً باتاً اختراع أو كتابة أي روابط تحميل (مثل [تحميل الملف](...)) في ردك النصي. النظام سيتولى إظهار زر التحميل فوراً.
${fileMetadataPrompt}`;
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
  let conversationMessages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  /* ============================================================
     🔄 حلقة التنفيذ والتصحيح الذاتي (Agentic Execution Loop)
     ============================================================ */
  const MAX_ATTEMPTS = 3; // عدد محاولات التصحيح الذاتي التلقائية
  let currentAttempt = 0;
  let finalReplyText = "";
  let returnedFileName = ctx.fileName;
  let fileBase64 = null;
  let executionSuccess = false;

  while (currentAttempt < MAX_ATTEMPTS && !executionSuccess) {
    currentAttempt++;
    console.log(`🤖 [Kernel Agentic Loop] المحاولة رقم (${currentAttempt}/${MAX_ATTEMPTS})...`);

    // 1. استدعاء النموذج اللغوي
    let reply = await groqService.chat(conversationMessages, { fileName: ctx.fileName });

    // تنظيف الرد من روابط التحميل الوهمية
    reply = reply.replace(/\[.*?تحميل.*?\]\(.*?\)/gi, "");

    const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);
    const cleanReplyText = reply.replace(/```python[\s\S]*?```/g, "").trim();

    // إذا لم يكتب نموذج الذكاء الاصطناعي كود بايثون، نكتفي بالرد النصي فوراً
    if (!pythonCodeMatch || !ctx.filePath) {
      finalReplyText = cleanReplyText;
      executionSuccess = true;
      break;
    }

    // 2. التقاط كود بايثون وتجهيزه للتنفيذ
    let pythonCode = pythonCodeMatch[1].trim();
    pythonCode = autoFixPythonCode(pythonCode);

    const scriptName = `agent_task_${Date.now()}_v${currentAttempt}.py`;
    const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);

    try {
      fs.writeFileSync(scriptPath, pythonCode, "utf8");

      // تنفيذ الكود وتجميع الـ stdout
      const stdout = execSync(`python3 "${scriptPath}"`, { 
        encoding: "utf8",
        timeout: 30000 // حد أقصى 30 ثانية لتنفيذ الكود
      });

      console.log(`✅ [Kernel Output Attempt ${currentAttempt}]:\n`, stdout);

      // تنظيف السكربت المؤقت
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

      // استخراج ملف المخرجات
      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        const newFilePath = outMatch[1].trim();
        if (fs.existsSync(newFilePath) && fs.statSync(newFilePath).size > 0) {
          fileBase64 = fs.readFileSync(newFilePath).toString("base64");
          returnedFileName = path.basename(newFilePath);
          finalReplyText = cleanReplyText ? `${cleanReplyText}\n\n✅ تمت هندسة وتعديل الملف بنجاح.` : "✅ تمت المعالجة والهندسة البرمجية بنجاح، والملف جاهز للتحميل.";
        } else {
          finalReplyText = `${cleanReplyText}\n\n⚠️ تم تنفيذ الكود لكن الملف الناتج فارغ أو غير موجود.`;
        }
      } else {
        // حالة استعلام أو تحليل بيانات (طباعة نصوص فقط)
        const outputClean = stdout.replace(/OUTPUT_FILE:.*/g, "").trim();
        finalReplyText = cleanReplyText;
        if (outputClean) {
          finalReplyText += `\n\n📊 **نتائج التحليل البرمجي:**\n\`\`\`text\n${outputClean}\n\`\`\``;
        }
      }

      executionSuccess = true; // تم التنفيذ بنجاح تامة

    } catch (err) {
      console.error(`❌ [Execution Failed - Attempt ${currentAttempt}]:`, err.message);

      // مسح السكربت الفاشل
      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

      // إذا وصلنا للحد الأقصى للمحاولات ولم ينجح
      if (currentAttempt >= MAX_ATTEMPTS) {
        finalReplyText = cleanReplyText + `\n\n⚠️ واجهت المنظومة مشكلة أثناء التنفيذ البرمجي بعد ${MAX_ATTEMPTS} محاولات تصحيح:\n\`\`\`text\n${err.message}\n\`\`\``;
        break;
      }

      // 🧠 إعادة تغذية النموذج بالخطأ (Self-Correction Prompting)
      console.log("🛠️ [Kernel Self-Correction] إرسال الـ Traceback للذكاء الاصطناعي لإعادة التصحيح...");
      
      conversationMessages.push({ role: "assistant", content: reply });
      conversationMessages.push({
        role: "user",
        content: `⚠️ فشل تنفيذ كود بايثون السابق وأنتج الخطأ التالي (Traceback):
\`\`\`text
${err.message}
\`\`\`
يرجى تحليل سبب الخطأ بدقة، وإعادة كتابة كود بايثون مصحح بالكامل يحل هذه المشكلة وينفذ المطلوب دون أخطاء.`
      });
    }
  }

  // تسجيل المحادثة في الذاكرة السيادية
  memory.appendSovereignHistory(sessionId, { role: "assistant", content: finalReplyText });

  return {
    reply: finalReplyText.trim(),
    fileName: returnedFileName,
    fileBase64: fileBase64
  };
}
