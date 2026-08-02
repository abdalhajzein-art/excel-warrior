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
function autoFixPythonCode(code) {
  return code
    .replace(/openpyxl\.workslet/gi, "openpyxl.worksheet")
    .replace(
      /from openpyxl\.worksheet\.datavalidation import DataValidation/gi,
      "from openpyxl.worksheet.datavalidation import DataValidation"
    );
    // تم إزالة الاستبدال العشوائي للمسار، لأن النموذج سيكتبه بدقة بناءً على التعليمات
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك… احكيلي أكتر.";

  let userMessage = message;

  /* ============================================================
     🟩 حقن التعليمات الحيوية والديناميكية (حسب حالة الملف)
     ============================================================ */
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[توجيهات النظام الحيوية للتنفيذ اللحظي]:
- الملف النشط موجود فعلياً وجاهز للمعالجة في هذا المسار: \`${ctx.filePath}\`
- استخدم هذا المسار الحرفي كقيمة للمتغير في كود البايثون، مثال: \`file_path = r"${ctx.filePath}"\`
- إذا كان الطلب استعلاماً أو تحليلاً، استخدم \`print()\` لطباعة النتائج.
- إذا كان الطلب تعديلاً أو إنشاءً، احفظ الملف الجديد في نفس المسار تقريباً واطبع: \`print("OUTPUT_FILE: " + <مسار_الملف_الجديد>)\`
`;
    if (ctx.fileData && ctx.fileData.headers) {
      agenticInstructions += `\n- للتذكير السريع، أعمدة الملف هي: [${ctx.fileData.headers.join(" , ")}]\n`;
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

  const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);
  
  // إزالة الكود من الرد حتى لا يظهر للمستخدم ككتلة كود صلبة
  reply = reply.replace(/```python[\s\S]*?```/g, "").trim();

  let returnedFileName = ctx.fileName;
  let fileBase64 = null; // 🔥 هنا السر الذي كان مفقوداً!

  /* ============================================================
     🟩 التقاط كود البايثون وتنفيذه محلياً بذكاء
     ============================================================ */
  if (pythonCodeMatch && ctx.filePath) {
    let pythonCode = pythonCodeMatch[1].trim();
    pythonCode = autoFixPythonCode(pythonCode);

    console.log("🐍 [Kernel] تم اصطياد نية برمجية من الأثير. جاري التنفيذ المحلي...");

    try {
      const scriptName = `agent_task_${Date.now()}.py`;
      const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);

      fs.writeFileSync(scriptPath, pythonCode);

      // تنفيذ الكود
      const stdout = execSync(`python3 "${scriptPath}"`, { encoding: "utf8" });
      console.log("✅ [Kernel Local Execution Output]:", stdout);

      // فحص النتيجة: هل هي تعديل ملف أم استعلام؟
      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        // حالة التعديل وتصدير الملف
        const newFilePath = outMatch[1].trim();
        if (fs.existsSync(newFilePath)) {
           fileBase64 = fs.readFileSync(newFilePath).toString("base64");
           returnedFileName = path.basename(newFilePath);
           reply += `\n\n✅ تفضل يا هندسة، تم تنفيذ التعديلات وتجهيز الملف الجديد بنجاح.`;
           // اختياري: يمكنك حذف الملف الجديد بعد قراءته لتنظيف السيرفر
           // fs.unlinkSync(newFilePath);
        } else {
           reply += `\n\n⚠️ حاولت أعدل الملف، بس صار خطأ في مسار الحفظ النهائي.`;
        }
      } else {
        // حالة الاستعلام والتحليل (رد نصي)
        if (stdout.trim()) {
           reply += `\n\n📊 **نتيجة التحليل البرمجي المباشر:**\n\`\`\`text\n${stdout.trim()}\n\`\`\``;
        }
      }

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
    } catch (err) {
      console.error("❌ [Kernel Local Execution Error]:", err.message);
      reply += `\n\n⚠️ واجهت مشكلة أثناء التنفيذ البرمجي:\n${err.message}`;
    }
  }

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  // 🔥 الآن الكرنل يُرجع الملف كـ Base64 الحقيقي للـ Orchestrator
  return {
    reply: reply,
    fileName: returnedFileName,
    fileBase64: fileBase64 
  };
}

