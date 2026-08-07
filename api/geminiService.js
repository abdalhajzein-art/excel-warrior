/**
 * api/geminiService.js – Sovereign Gemini Service (Agentic Tool-Calling Edition)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

function getClient() {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++;
  return new GoogleGenerativeAI(key);
}

const MODEL_FALLBACK_LIST = [
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview'
];

function isQuotaError(error) {
    return error?.message?.includes('quota') || 
           error?.status === 429 || 
           error?.message?.includes('rate limit') ||
           error?.message?.includes('exhausted');
}

async function executeWithFallback(fn, modelList = MODEL_FALLBACK_LIST) {
    let lastError = null;
    for (let i = 0; i < modelList.length; i++) {
        const modelName = modelList[i];
        try {
            console.log(`🔄 [GeminiService] محاولة النموذج: ${modelName}`);
            return await fn(modelName);
        } catch (err) {
            lastError = err;
            if (isQuotaError(err)) continue;
            throw err;
        }
    }
    throw new Error(`❌ جميع النماذج فشلت: ${lastError?.message || 'خطأ غير معروف'}`);
}

/* ============================================================
   🛠️ تعريف الأدوات (Tools) - هنا يكمن سر الذكاء الحقيقي
   ============================================================ */
const alatheerTools = [{
  functionDeclarations: [
    {
      name: "execute_python",
      description: "قم بتنفيذ كود بايثون لمعالجة البيانات، إنشاء أو تعديل ملفات الإكسل والوورد والـ PDF.",
      parameters: {
        type: "OBJECT",
        properties: {
          code: { 
            type: "STRING", 
            description: "كود البايثون الكامل المراد تنفيذه. يجب أن يكون جاهزاً للعمل مباشرة." 
          }
        },
        required: ["code"]
      }
    },
    {
      name: "read_file_fingerprint",
      description: "احصل على معلومات الملف النشط حالياً (الأعمدة، الشيتات، البيانات) لتعرف محتواه قبل تعديله.",
      parameters: {
        type: "OBJECT",
        properties: {}
      }
    }
  ]
}];

/* ============================================================
   💬 وضع المحادثة المتعدد الأدوار (Ultra Chat - Tool Enabled)
   ============================================================ */
const geminiService = {};

geminiService.chat = async function(messages, extra = {}) {
  return executeWithFallback(async (modelName) => {

    const systemMessages = messages.filter(m => m.role === "system");
    const systemInstruction = systemMessages.map(m => m.content).join("\n\n");

    const history = [];
    let lastUserMessage = "";
    const conv = messages.filter(m => m.role !== "system");

    for (let i = 0; i < conv.length; i++) {
      const msg = conv[i];
      const isLast = i === conv.length - 1;

      if (msg.role === "user") {
        if (isLast) {
          lastUserMessage = msg.content;
        } else {
          history.push({ role: "user", parts: [{ text: msg.content }] });
        }
      }

      if (msg.role === "assistant") {
        if (!isLast) {
          // التعامل مع ردود النموذج السابقة سواء كانت نصاً أو استدعاء أداة
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction,
      tools: alatheerTools, // 👈 تمكين الأدوات هنا
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 32768,
      }
    });

    const chat = model.startChat({ history });
    
    // إرسال رسالة المستخدم للنموذج وهو سيقرر بحرية: نص عادي أم استدعاء أداة؟
    const result = await chat.sendMessage(lastUserMessage || "مرحبا");
    const response = await result.response;

    // استخراج النتيجة (قد تكون نص للدردشة، أو طلب تنفيذ كود)
    const functionCalls = response.functionCalls();
    const textReply = response.text ? response.text() : "";

    auditExecution({
      action: functionCalls ? "llm_tool_call" : "llm_chat",
      target: extra.fileName || "Active Chat",
      usage: response.usageMetadata || null
    });

    // إرجاع النتيجة للأوركيستريتور ليتصرف
    return {
      text: textReply,
      functionCalls: functionCalls || null
    };
  });
};

export default geminiService;

