/**
 * api/geminiService.js – Sovereign Gemini Service
 * ✅ تم تحديثها لمنع كتابة الكود وتقليل استهلاك التوكنز
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL_NAME = "gemini-3.5-flash-lite";

const SYSTEM_INSTRUCTION = `أنت الأثير — المساعد السيادي الذكي.

🚫 أنت ممنوع من كتابة أي كود برمجي (Python، JavaScript، أو أي لغة برمجة).
✅ مهمتك هي التحليل والوصف فقط.
📝 استخدم المحتوى المستخرج من الملف للإجابة.
❌ لا تخرج أي كود في ردك، فقط نص وصفي بالعربية.
📊 إذا طلب المستخدم تعديلاً، صف التعديل المطلوب فقط.
🔧 التعديلات الفعلية يتم تنفيذها بواسطة المحرك الداخلي.
🎯 ركز على تقديم تحليل دقيق ومفيد للمستخدم.`;

export default async function geminiService(prompt, context = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      }
    });

    // ✅ بناء السياق مع معلومات الملف إذا كانت موجودة
    let fullPrompt = prompt;
    if (context.fileName && context.extractedContent?.metadata) {
      const meta = context.extractedContent.metadata;
      fullPrompt += `
📎 **[ملف مرفق]**: ${context.fileName}
- الصفوف: ${meta.rows || 'غير معروف'}
- الأعمدة: ${meta.columns || 'غير معروف'}
- الصيغ: ${meta.hasFormulas ? 'نعم' : 'لا'}
- الأوراق: ${meta.sheets || 1}
`;
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }]
    });

    const response = await result.response;

    auditExecution({
      action: "llm_inference",
      target: context.fileName || "General Query",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Service Error:", error);
    return "⚠️ حدث خطأ أثناء توليد الرد من محرك Gemini.";
  }
}

// ✅ دالة chat للتوافق مع الاستخدام القديم
geminiService.chat = async function(messages, extra = {}) {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      }
    });

    // تحويل الرسائل إلى صيغة Gemini
    const history = [];
    let lastUserMessage = "";

    for (const msg of messages) {
      if (msg.role === "system") {
        // تجاهل رسائل النظام لأننا نستخدم systemInstruction
        continue;
      }
      if (msg.role === "user") {
        lastUserMessage = msg.content;
        history.push({
          role: "user",
          parts: [{ text: msg.content }]
        });
      } else if (msg.role === "assistant" || msg.role === "model") {
        history.push({
          role: "model",
          parts: [{ text: msg.content }]
        });
      }
    }

    // ✅ إضافة معلومات الملف إذا كانت موجودة
    if (extra.fileName && extra.extractedContent?.metadata) {
      const meta = extra.extractedContent.metadata;
      const fileInfo = `
📎 **[ملف مرفق]**: ${extra.fileName}
- الصفوف: ${meta.rows || 'غير معروف'}
- الأعمدة: ${meta.columns || 'غير معروف'}
- الصيغ: ${meta.hasFormulas ? 'نعم' : 'لا'}
- الأوراق: ${meta.sheets || 1}
`;
      if (lastUserMessage) {
        lastUserMessage += "\n\n" + fileInfo;
      }
    }

    const chat = model.startChat({
      history: history.slice(0, -1), // آخر رسالة نرسلها كـ sendMessage
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      }
    });

    const result = await chat.sendMessage(lastUserMessage);
    const response = await result.response;

    auditExecution({
      action: "llm_chat",
      target: extra.fileName || "Active Chat Session",
      isLocal: false,
      usage: response.usageMetadata || null
    });

    return response.text().trim();

  } catch (error) {
    console.error("❌ Gemini Chat Error:", error);
    throw error;
  }
};
