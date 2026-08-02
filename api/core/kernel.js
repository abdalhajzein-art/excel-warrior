/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Agentic Self-Correction Edition)
 * مع دعم الميتاداتا والملفات المرفقة مع بياناتها الوصفية
 * ✅ تم تحديثها لاستخدام المحتوى المستخرج محلياً (extractedContent) بدلاً من openpyxl
 */

import groqService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from "fs";
import path from "path";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟";

  // ✅ الحصول على المحتوى المستخرج محلياً من office-oxide
  const extractedContent = ctx.extractedContent || null;
  const metadata = ctx.metadata || null;
  const fileName = ctx.fileName || "الملف";

  /* 🛡️ بناء السياق للمعالج الذكي */
  let fileContextPrompt = "";

  // ✅ إذا كان هناك محتوى مستخرج، استخدمه مباشرة (بدون استدعاء Python)
  if (extractedContent && !extractedContent.error) {
    console.log(`📋 [Kernel] استخدام المحتوى المستخرج محلياً للملف: ${fileName}`);
    
    let contentText = "";
    if (extractedContent.text) {
      contentText = extractedContent.text;
    } else if (extractedContent.markdown) {
      contentText = extractedContent.markdown;
    }
    
    // ✅ إضافة معلومات الميتاداتا إن وجدت
    let metadataInfo = "";
    if (metadata && metadata.sheet_name) {
      metadataInfo = `\n[الميتاداتا المرفقة]:\n- اسم الورقة: ${metadata.sheet_name}\n- عدد الصفوف: ${metadata.total_rows || 'غير معروف'}\n- الأعمدة: ${metadata.headers ? metadata.headers.join(', ') : 'غير معروف'}\n`;
    }
    
    if (extractedContent.metadata) {
      metadataInfo += `\n[البيانات المستخرجة]:\n${Object.entries(extractedContent.metadata).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
    }
    
    fileContextPrompt = `
📄 **[محتوى الملف "${fileName}" المستخرج محلياً (بدون استهلاك توكنز)]:**
${contentText.slice(0, 8000)}${contentText.length > 8000 ? '\n... (تم اختصار المحتوى)' : ''}
${metadataInfo}
`;
  } else if (ctx.filePath && fs.existsSync(ctx.filePath)) {
    // ✅ إذا لم يكن هناك محتوى مستخرج، حاول قراءة الملف كنص عادي
    try {
      const content = fs.readFileSync(ctx.filePath, 'utf-8');
      fileContextPrompt = `
📄 **[محتوى الملف "${fileName}" (قراءة كنص عادي)]:**
${content.slice(0, 8000)}${content.length > 8000 ? '\n... (تم اختصار المحتوى)' : ''}
`;
    } catch (err) {
      console.warn(`⚠️ [Kernel] تعذر قراءة الملف كنص: ${err.message}`);
      fileContextPrompt = `📄 [ملف: ${fileName}] - لا يمكن قراءة المحتوى كنص.`;
    }
  }

  /* 🟩 تعليمات سيادية للمعالج */
  let agenticInstructions = "";
  if (fileContextPrompt) {
    agenticInstructions = `
[قوانين سيادية للمعالجة]:
1. أنت تعمل مع محتوى ملف تم استخراجه محلياً.
2. لا حاجة لكتابة كود Python لقراءة الملف (المحتوى موجود بالفعل).
3. أجب عن طلب المستخدم بناءً على المحتوى المقدم أعلاه.
4. إذا طلب المستخدم تعديلاً، قم بوصف التعديل المطلوب.
5. لا تختلق معلومات غير موجودة في المحتوى.
${fileContextPrompt}`;
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
  let conversationMessages = [
    { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  /* 🤖 التنفيذ المباشر (بدون حلقة Python إلا إذا لزم الأمر) */
  let finalReplyText = "";
  let returnedFileName = ctx.fileName;
  let fileBase64 = null;

  // ✅ إذا كان هناك محتوى مستخرج، نعطي تعليمات إضافية للنموذج
  if (extractedContent && !extractedContent.error) {
    const systemInstruction = `
⚠️ **تعليمات إضافية:**
- المحتوى أعلاه مستخرج من ملف "${fileName}" باستخدام معالج محلي.
- المحتوى دقيق ويعكس محتوى الملف الفعلي.
- استخدم هذا المحتوى للإجابة على استفسارات المستخدم.
- إذا طلب المستخدم تعديلاً، صف التعديل المطلوب بناءً على المحتوى.
`;
    conversationMessages[0].content += "\n" + systemInstruction;
  }

  try {
    console.log(`🧠 [Kernel] إرسال الطلب إلى النموذج (بدون استدعاء Python)...`);
    
    const reply = await groqService.chat(conversationMessages, {
      fileName: ctx.fileName,
    });

    finalReplyText = reply;
    
    // ✅ إذا كان هناك ملف وتعديل، يمكننا محاكاة التعديل (اختياري)
    // في الإصدارات القادمة، يمكن استخدام office-oxide للتعديل المباشر
    if (ctx.filePath && extractedContent && !extractedContent.error) {
      // محاكاة التعديل (للمرحلة القادمة)
      console.log(`📝 [Kernel] تمت معالجة الملف: ${fileName}`);
    }

  } catch (error) {
    console.error("❌ [Kernel] خطأ في المعالجة:", error);
    finalReplyText = `⚠️ حدث خطأ أثناء معالجة طلبك: ${error.message}`;
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
