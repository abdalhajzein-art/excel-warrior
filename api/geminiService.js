/**
 * api/geminiService.js – Sovereign Gemini Service (Agentic Tool-Calling Edition)
 * ✅ ترتيب النماذج حسب القوة مع تدوير المفاتيح (Key Rotation)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

if (API_KEYS.length === 0) {
    console.error("❌ [GeminiService] لم يتم العثور على أي مفاتيح API في المتغيرات البيئية.");
}

let currentKeyIndex = 0;

function getClient() {
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++; // Increment for the next call to cycle through keys
  return new GoogleGenerativeAI(key);
}

// ✅ ترتيب النماذج حسب القوة (الأقوى أولاً)
const MODEL_FALLBACK_LIST = [
    'gemini-3.1-pro-preview',  // الأقوى - للاستدلال المعقد وتعديل الملفات
    'gemini-3.6-flash',        // توازن بين القوة والسرعة
    'gemini-3-flash-preview',  // سريع، مناسب للمهام البسيطة
    'gemini-3.5-flash-lite'    // خفيف جداً، استخدامه فقط كحل أخير
];

function isQuotaError(error) {
    return error?.message?.includes('quota') || 
           error?.status === 429 || 
           error?.message?.includes('rate limit') ||
           error?.message?.includes('exhausted');
}

async function executeWithFallback(fn, modelList = MODEL_FALLBACK_LIST) {
    let lastError = null;
    
    for (let modelIndex = 0; modelIndex < modelList.length; modelIndex++) {
        const modelName = modelList[modelIndex];
        
        // المحاولة بكل المفاتيح المتاحة لهذا النموذج
        for (let keyAttempt = 0; keyAttempt < API_KEYS.length; keyAttempt++) {
             try {
                 console.log(`🔄 [GeminiService] محاولة النموذج: ${modelName} | المفتاح النشط: #${(currentKeyIndex % API_KEYS.length) + 1}`);
                 return await fn(modelName); 
             } catch (err) {
                 lastError = err;
                 console.warn(`⚠️ [GeminiService] فشل (النموذج ${modelName}):`, err.message);
                 
                 if (isQuotaError(err)) {
                     console.warn(`⚠️ [GeminiService] تم استنفاد حِصّة المفتاح الحالي (429). الانتقال للمفتاح التالي...`);
                     continue; // جرب المفتاح التالي مع نفس النموذج
                 }
                 
                 // إذا كان خطأ غير متعلق بالقيود، اخرج من حلقة المفاتيح وانتقل للنموذج التالي
                 console.warn(`⚠️ خطأ غير متعلق بالقيود، الانتقال للنموذج البديل.`);
                 break;
             }
        }
    }
    throw new Error(`❌ فشلت جميع المحاولات (النماذج والمفاتيح): ${lastError?.message || 'خطأ غير معروف'}`);
}

/* ============================================================
   🛠️ تعريف الأدوات (Tools)
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
          history.push({ role: "model", parts: [{ text: msg.content }] });
        }
      }
    }

    const client = getClient();
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction,
      tools: alatheerTools, 
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 32768,
      }
    });

    const chat = model.startChat({ history });
    
    const result = await chat.sendMessage(lastUserMessage || "مرحبا");
    const response = await result.response;

    // 🛡️ استخراج آمن للأدوات
    let functionCalls = null;
    try {
        if (typeof response.functionCalls === 'function') {
            functionCalls = response.functionCalls();
        }
    } catch (e) {
        functionCalls = null;
    }

    // 🛡️ استخراج آمن للنص
    let textReply = "";
    try {
        if (response.text && typeof response.text === 'function') {
            textReply = response.text();
        }
    } catch (e) {
        textReply = functionCalls ? "" : "";
    }

    auditExecution({
      action: functionCalls && functionCalls.length > 0 ? "llm_tool_call" : "llm_chat",
      target: extra.fileName || "Active Chat",
      usage: response.usageMetadata || null
    });

    return {
      text: textReply,
      functionCalls: functionCalls || null
    };
  });
};

export default geminiService;
