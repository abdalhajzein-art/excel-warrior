/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic & Code Interpreter Edition)
 */

import groqService from "../groqService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/* ============================================================
   🟩 طبقة التصحيح التلقائي للكود قبل التنفيذ (Auto‑Fix Layer)
   ============================================================ */
function autoFixPythonCode(code, filePath) {
  return code
    // إصلاح خطأ openpyxl الشائع
    .replace(/openpyxl\.workslet/gi, "openpyxl.worksheet")

    // إصلاح استيراد DataValidation
    .replace(
      /from openpyxl\.worksheet\.datavalidation import DataValidation/gi,
      "from openpyxl.worksheet.datavalidation import DataValidation"
    )

    // إصلاح أي مسار اخترعه النموذج
    .replace(/\/app\/uploads\/[^\s'"]+/gi, filePath)

    // إصلاح قراءة pandas
    .replace(/pd\.read_excel\((.*?)\)/gi, `pd.read_excel("${filePath}")`);
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك… احكيلي أكتر.";

  let userMessage = message;

  /* ============================================================
     🟩 تمرير المسار الحقيقي للملف داخل الرسالة
     ============================================================ */
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[توجيهات النظام الحيوية للتنفيذ]:
- الملف موجود فعلياً على السيرفر في هذا المسار الحقيقي: ${ctx.filePath}
- يجب استخدام هذا المسار حصرياً داخل كود البايثون.
- يُمنع منعاً باتاً اختراع مسار جديد أو استخدام /app/uploads.
- إذا كان طلب المستخدم يتضمن تعديل أو إضافة أو معالجة، يجب كتابة كود Python فقط.
- يجب أن يقرأ الكود الملف من المسار أعلاه ويحفظ ملفاً جديداً ويطبع:
  print("OUTPUT_FILE: " + new_file_name)
`;
    if (ctx.fileData && ctx.fileData.headers) {
      agenticInstructions += `\n- أعمدة الملف الحالية هي: ${ctx.fileData.headers.join(" , ")}\n`;
    }
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-40) : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage }
  ];

  /* ============================================================
     🟩 استدعاء النموذج وإخفاء الكود من الواجهة
     ============================================================ */
  let reply = await groqService.chat(messages, {
    fileName: ctx.fileName || null
  });

  // إزالة أي كود بايثون من الرسالة قبل عرضها للمستخدم
  reply = reply.replace(/```python[\s\S]*?```/g, "");

  let returnedFileName = ctx.fileName;

  /* ============================================================
     🟩 التقاط كود البايثون وتنفيذه محلياً
     ============================================================ */
  const pythonCodeMatch = rawMessage.match(/```python\n([\s\S]*?)```/);

  if (pythonCodeMatch && ctx.filePath) {
    let pythonCode = pythonCodeMatch[1].trim();

    // تطبيق طبقة التصحيح التلقائي
    pythonCode = autoFixPythonCode(pythonCode, ctx.filePath);

    console.log("🐍 [Kernel] تم اصطياد كود بايثون من جيميني. جاري التنفيذ المحلي...");

    try {
      const scriptName = `agent_task_${Date.now()}.py`;
      const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);

      fs.writeFileSync(scriptPath, pythonCode);

      const stdout = execSync(`python3 "${scriptPath}"`, { encoding: "utf8" });
      console.log("✅ [Kernel Local Execution Output]:", stdout);

      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        returnedFileName = outMatch[1].trim();
        reply += `\n\n✅ تم تنفيذ طلبك وتعديل الملف بنجاح.`;
      } else {
        reply += `\n\n✅ تمت المعالجة البرمجية بنجاح.`;
      }

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    } catch (err) {
      console.error("❌ [Kernel Local Execution Error]:", err.message);
      reply += `\n\n⚠️ حدث خطأ أثناء التنفيذ المحلي:\n${err.message}`;
    }
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  return {
    reply: reply.trim(),
    fileName: returnedFileName
  };
      }
