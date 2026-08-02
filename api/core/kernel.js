/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic Self-Correction Edition)
 * مع دعم الميتاداتا والملفات المرفقة مع بياناتها الوصفية
 */

import groqService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { extractFileMetadata } from "../tools/external/external_file_bridge.js";

/**
 * إصلاح تلقائي سريع للأخطاء الشائعة في كود البايثون
 */
function autoFixPythonCode(code) {
  return code
    .replace(/openpyxl\.workslet/gi, "openpyxl.worksheet")
    .replace(
      /from openpyxl\.worksheet\.datavalidation import DataValidation/gi,
      "from openpyxl.worksheet.datavalidation import DataValidation"
    )
    .replace(
      /pd\.read_excel\(([^)]+)\)/gi,
      "pd.read_excel($1, engine='openpyxl')"
    );
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟";

  /* 🛡️ فحص أولي للملف */
  let fileMetadataPrompt = "";
  const metadata = ctx.metadata || null; // ✅ استقبال الميتاداتا من orchestrator

  if (ctx.filePath) {
    if (!fs.existsSync(ctx.filePath) || fs.statSync(ctx.filePath).size === 0) {
      return {
        reply:
          "⚠️ يا هندسة، الملف المرفوع حالياً تالف أو حجمه 0 بايت. أرجو إعادة رفع الملف الأصلي لنشتغل على نسخة نظيفة.",
      };
    }

    // ✅ إذا كانت الميتاداتا موجودة، استخدمها مباشرة (بدون استخراج)
    if (metadata && metadata.sheet_name) {
      fileMetadataPrompt =
        "\n[بيانات الملف الهيكلية (ميتاداتا مرفقة من الواجهة)]:\n" +
        JSON.stringify(metadata, null, 2) +
        "\n";
      console.log(`📋 [Kernel] تم استخدام الميتاداتا المرفقة: ${metadata.sheet_name}`);
    } else {
      // ✅ إذا لم تكن الميتاداتا موجودة، حاول استخراجها
      try {
        const meta = extractFileMetadata(ctx.filePath);
        if (meta && !meta.error) {
          fileMetadataPrompt =
            "\n[بيانات الملف الهيكلية المكتشفة تلقائياً - Universal Metadata]:\n" +
            JSON.stringify(meta, null, 2) +
            "\n";
        }
      } catch (mErr) {
        console.warn("⚠️ تعذّر استخراج Metadata كاملة للملف:", mErr.message);
      }
    }
  }

  /* 🟩 تعليمات سيادية للملفات */
  let agenticInstructions = "";
  if (ctx.filePath) {
    agenticInstructions = `
[قوانين سيادية إجبارية لمعالجة الملفات عبر Python]:
1. مسار الملف النشط حالياً: \`${ctx.filePath}\` (قراءة فقط).
2. ممنوع حفظ التعديلات على نفس المسار الأصلي.
3. احفظ الناتج في مسار جديد (مثلاً بإضافة "_modified" لاسم الملف).
4. في نهاية كود البايثون، اطبع:
   print("OUTPUT_FILE: " + <path_to_output_file>)
5. ممنوع كتابة روابط تحميل في الرد النصي.
${fileMetadataPrompt}`;
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
  let conversationMessages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  /* 🔄 حلقة التنفيذ والتصحيح الذاتي */
  const MAX_ATTEMPTS = 3;
  let currentAttempt = 0;
  let finalReplyText = "";
  let returnedFileName = ctx.fileName;
  let fileBase64 = null;
  let executionSuccess = false;

  while (currentAttempt < MAX_ATTEMPTS && !executionSuccess) {
    currentAttempt++;
    console.log(
      `🤖 [Kernel Agentic Loop] المحاولة رقم (${currentAttempt}/${MAX_ATTEMPTS})...`
    );

    let reply = await groqService.chat(conversationMessages, {
      fileName: ctx.fileName,
    });

    // تنظيف أي روابط تحميل وهمية
    reply = reply.replace(/\[.*?تحميل.*?\]\(.*?\)/gi, "");

    const pythonCodeMatch = reply.match(/```python\n([\s\S]*?)```/);
    const cleanReplyText = reply.replace(/```python[\s\S]*?```/g, "").trim();

    // لو ما في كود بايثون أو ما في ملف، نكتفي بالرد النصي
    if (!pythonCodeMatch || !ctx.filePath) {
      finalReplyText = cleanReplyText;
      executionSuccess = true;
      break;
    }

    let pythonCode = pythonCodeMatch[1].trim();
    pythonCode = autoFixPythonCode(pythonCode);

    const scriptName = `agent_task_${Date.now()}_v${currentAttempt}.py`;
    const scriptPath = path.join(path.dirname(ctx.filePath), scriptName);

    try {
      fs.writeFileSync(scriptPath, pythonCode, "utf8");

      const stdout = execSync(`python3 "${scriptPath}"`, {
        encoding: "utf8",
        timeout: 30000,
      });

      console.log(`✅ [Kernel Output Attempt ${currentAttempt}]:\n`, stdout);

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

      const outMatch = stdout.match(/OUTPUT_FILE:\s*(.+)/);
      if (outMatch) {
        const newFilePath = outMatch[1].trim();

        if (
          fs.existsSync(newFilePath) &&
          fs.statSync(newFilePath).size > 1024
        ) {
          fileBase64 = fs.readFileSync(newFilePath).toString("base64");
          returnedFileName = path.basename(newFilePath);
          finalReplyText = cleanReplyText
            ? `${cleanReplyText}\n\n✅ تمت هندسة وتعديل الملف بنجاح.`
            : "✅ تمت المعالجة والهندسة البرمجية بنجاح، والملف جاهز للتحميل.";
        } else {
          finalReplyText =
            cleanReplyText +
            "\n\n⚠️ تم تنفيذ الكود لكن الملف الناتج صغير جداً أو غير صالح (قد يكون تالفاً).";
        }
      } else {
        const outputClean = stdout.replace(/OUTPUT_FILE:.*/g, "").trim();
        finalReplyText = cleanReplyText;
        if (outputClean) {
          finalReplyText += `\n\n📊 **نتائج التحليل البرمجي:**\n\`\`\`text\n${outputClean}\n\`\`\``;
        }
      }

      executionSuccess = true;
    } catch (err) {
      console.error(
        `❌ [Execution Failed - Attempt ${currentAttempt}]:`,
        err.message
      );

      if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);

      if (currentAttempt >= MAX_ATTEMPTS) {
        finalReplyText =
          cleanReplyText +
          `\n\n⚠️ واجهت المنظومة مشكلة أثناء التنفيذ البرمجي بعد ${MAX_ATTEMPTS} محاولات:\n\`\`\`text\n${err.message}\n\`\`\``;
        break;
      }

      conversationMessages.push({ role: "assistant", content: reply });
      conversationMessages.push({
        role: "user",
        content: `⚠️ فشل تنفيذ كود بايثون السابق وأنتج الخطأ التالي (Traceback كامل):
\`\`\`text
${err.stack || err.message}
\`\`\`
حلّل سبب الخطأ بدقة، وأعد كتابة كود بايثون مصحح بالكامل ينفذ المطلوب دون أخطاء.`,
      });
    }
  }

  memory.appendSovereignHistory(sessionId, {
    role: "assistant",
    content: finalReplyText,
  });

  return {
    reply: finalReplyText.trim(),
    fileName: returnedFileName,
    fileBase64,
  };
    }
