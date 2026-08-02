/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic & Code Interpreter Edition)
 */

import groqService from "../groqService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك… احكيلي أكتر.";

  let userMessage = message;

  /* ============================================================
     ⭐ أهم تعديل: تمرير المسار الحقيقي داخل الرسالة نفسها
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

  // 1. استدعاء العقل اللغوي
  let reply = await groqService.chat(messages, {
    fileName: ctx.fileName || null
  });

  let returnedFileName = ctx.fileName;

  // 2. التقاط كود البايثون وتنفيذه محلياً
  const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);

  if (pythonCodeMatch && ctx.filePath) {
    const pythonCode = pythonCodeMatch[1].trim();
    console.log("🐍 [Kernel] تم اصطياد كود بايثون من جيميني. جاري التنفيذ المحلي...");

    try {
      const scriptName = `agent_task_${Date.now()}.py`;
      const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);

      fs.writeFileSync(scriptPath, pythonCode);

      const stdout = execSync(`python3 "${scriptPath}"`, { encoding: 'utf8' });
      console.log("✅ [Kernel Local Execution Output]:", stdout);

      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        returnedFileName = outMatch[1].trim();
        reply = reply.replace(/```python[\s\S]*?```/, "");
        reply += `\n\n✅ **تم تنفيذ طلبك برمجياً وتعديل الملف بنجاح!**`;
      } else {
        reply = reply.replace(/```python[\s\S]*?```/, "");
        reply += `\n\n✅ **تمت المعالجة بنجاح!**`;
      }

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

    } catch (err) {
      console.error("❌ [Kernel Local Execution Error]:", err.message);
      reply += `\n\n⚠️ **حاولت تنفيذ التعديل برمجياً ولكن حدث خطأ في النظام المحلي:**\n${err.message}`;
    }
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  return {
    reply: reply.trim(),
    fileName: returnedFileName
  };
  }
