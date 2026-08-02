/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic & Code Interpreter Edition)
 * العقل المدبر: يوجه جيميني لكتابة الكود، ويلتقط الكود لينفذه محلياً على سيرفرك بصفر استنزاف.
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
  
  // توجيهات النظام الحيوية لتوجيه جيميني لكتابة الكود إذا وُجد ملف
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[توجيهات النظام الحيوية للتنفيذ]:
- المستخدم يتحدث عن ملف موجود فعلياً على السيرفر في هذا المسار: ${ctx.filePath}
- إذا كان طلب المستخدم يتضمن "تعديل، إضافة عمود، إنشاء قائمة منسدلة، تصفية، أو أي معالجة للبيانات"، **يُمنع منعاً باتاً شرح الخطوات يدوياً للمستخدم**.
- بدلاً من ذلك، يجب عليك كتابة كود Python كامل باستخدام (pandas أو openpyxl) ليقوم بالمهمة المطلوبة.
- يجب أن يقرأ الكود الملف من المسار أعلاه، ويحفظ الملف المعدل في نفس المجلد باسم جديد، ويطبع في النهاية: print("OUTPUT_FILE: " + new_file_name)
- ضع الكود حصرياً داخل كتلة \`\`\`python ... \`\`\`
`;
    if (ctx.fileData && ctx.fileData.headers) {
      agenticInstructions += `\n- أعمدة الملف الحالي هي: ${ctx.fileData.headers.join(" , ")}\n`;
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

  // 2. ⚡ التقاط كود البايثون وتنفيذه محلياً (The Agentic Loop)
  const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);
  
  if (pythonCodeMatch && ctx.filePath) {
    const pythonCode = pythonCodeMatch[1].trim();
    console.log("🐍 [Kernel] تم اصطياد كود بايثون من جيميني. جاري التنفيذ المحلي...");
    
    try {
      const scriptName = `agent_task_${Date.now()}.py`;
      const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);
      
      fs.writeFileSync(scriptPath, pythonCode);

      // تنفيذ الكود محلياً على السيرفر مجاناً
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

      if(fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

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
