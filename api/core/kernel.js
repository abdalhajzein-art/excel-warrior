/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Safe File Edition)
 */

import groqService from "../groqService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function autoFixPythonCode(code) {
  return code
    .replace(/openpyxl\.workslet/gi, "openpyxl.worksheet")
    .replace(/from openpyxl\.worksheet\.datavalidation import DataValidation/gi, "from openpyxl.worksheet.datavalidation import DataValidation");
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك… احكيلي أكتر.";

  /* ============================================================
     🛡️ حماية مسبقة: فحص سلامة الملف قبل المعالجة
     ============================================================ */
  if (ctx.filePath) {
    if (!fs.existsSync(ctx.filePath) || fs.statSync(ctx.filePath).size === 0) {
      return { 
        reply: "⚠️ يا هندسة، الملف المرفوع حالياً تالف أو حجمه 0 بايت (يبدو أنه تدمر من معالجة سابقة). أرجو إعادة رفع الملف الأصلي لنشتغل على نسخة نظيفة." 
      };
    }
  }

  /* ============================================================
     🟩 حقن قوانين سيادية صارمة لحماية الملفات
     ============================================================ */
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[قوانين سيادية للتعامل مع الملفات - تنفيذ إجباري]:
1. مسار الملف النشط: \`${ctx.filePath}\` (هذا الملف للقراءة فقط READ-ONLY).
2. يُمنع منعاً باتاً حفظ أي تعديلات على نفس المسار الأصلي لتجنب إتلافه.
3. عند تعديل الملف، أنشئ مساراً جديداً (مثلاً: أضف "_output" لاسم الملف) واحفظ التعديلات فيه.
4. في نهاية كود البايثون الخاص بالتعديل، اطبع حصراً: \`print("OUTPUT_FILE: " + <المسار_الجديد>)\`
5. يُمنع منعاً باتاً اختراع أو كتابة أي روابط تحميل (مثل [تحميل الملف](...)) في ردك النصي. النظام البرمجي سيتولى إظهار زر التحميل للمستخدم.
`;
    if (ctx.fileData && ctx.fileData.headers) {
      agenticInstructions += `\n- للتذكير، أعمدة الملف الحالي هي: [${ctx.fileData.headers.join(" , ")}]\n`;
    }
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-40) : [];
  const messages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  /* ============================================================
     🟩 استدعاء النموذج اللغوي وتجريده من الروابط والأكواد
     ============================================================ */
  let reply = await groqService.chat(messages, { fileName: ctx.fileName });

  // تنظيف الرد من روابط التحميل الوهمية (Hallucinated Links)
  reply = reply.replace(/\[.*?تحميل.*?\]\(.*?\)/gi, "");

  const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);
  // إخفاء الكود عن عين المستخدم
  reply = reply.replace(/```python[\s\S]*?```/g, "").trim();

  let returnedFileName = ctx.fileName;
  let fileBase64 = null;

  /* ============================================================
     🟩 التقاط كود البايثون وتنفيذه محلياً
     ============================================================ */
  if (pythonCodeMatch && ctx.filePath) {
    let pythonCode = pythonCodeMatch[1].trim();
    pythonCode = autoFixPythonCode(pythonCode);

    console.log("🐍 [Kernel] جاري تنفيذ كود الأثير على المسار الآمن...");

    try {
      const scriptName = `agent_task_${Date.now()}.py`;
      const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);
      
      fs.writeFileSync(scriptPath, pythonCode);

      const stdout = execSync(`python3 "${scriptPath}"`, { encoding: "utf8" });
      console.log("✅ [Kernel Output]:\n", stdout);

      // استخراج المسار الجديد
      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        const newFilePath = outMatch[1].trim();
        // التأكد من أن الملف الجديد حقيقي وفيه بيانات
        if (fs.existsSync(newFilePath) && fs.statSync(newFilePath).size > 0) {
           fileBase64 = fs.readFileSync(newFilePath).toString("base64");
           returnedFileName = path.basename(newFilePath);
           reply += `\n\n✅ تفضل يا هندسة، تمت المعالجة بنجاح والملف الجديد جاهز عبر النظام.`;
           // اختياري: fs.unlinkSync(newFilePath); 
        } else {
           reply += `\n\n⚠️ حاولت أعدل الملف، لكن يبدو أن المعالجة أنتجت ملفاً فارغاً.`;
        }
      } else if (stdout.trim()) {
        // حالة التحليل (طباعة النصوص فقط)
        reply += `\n\n📊 **نتيجة المعالجة:**\n\`\`\`text\n${stdout.trim()}\n\`\`\``;
      }

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    } catch (err) {
      console.error("❌ [Kernel Error]:", err.message);
      reply += `\n\n⚠️ واجهت مشكلة أثناء التنفيذ البرمجي:\n${err.message}`;
    }
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  return {
    reply: reply.trim(),
    fileName: returnedFileName,
    fileBase64: fileBase64
  };
}
