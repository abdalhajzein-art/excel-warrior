/**
 * api/geminiService.js – الإصدار السيادي المُعزز (Alatheer AI Suite)
 * - الاعتماد الكلي على Gemini مع هندسة التفكير العميق الافتراضي (Virtual Thinking).
 * - حل جذري لتعارض thinkingConfig مع الـ Function Calling.
 * - لا حاجة لـ Hugging Face (تجنب مشاكل الـ fetch failed).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

// ترتيب النماذج حسب القدرة البرمجية
const MODEL_PRIORITY = [
    'gemini-3.6-flash',      // الأسرع والأذكى في المهام الوكيلية مع التفكير الافتراضي
    'gemini-1.5-pro',        // العقل المدبر الأعلى دقة
    'gemini-3.5-flash-lite'
];

const alatheerTools = [
    {
        functionDeclarations: [
            {
                name: "execute_python",
                description: "تنفيذ كود بايثون لمعالجة البيانات أو إنشاء/تعديل الملفات",
                parameters: {
                    type: "OBJECT",
                    properties: { code: { type: "STRING" } },
                    required: ["code"]
                }
            },
            {
                name: "read_file_fingerprint",
                description: "قراءة معلومات الملف النشط",
                parameters: { type: "OBJECT", properties: {} }
            },
            ...(EXCEL_TOOLS && EXCEL_TOOLS[0] ? EXCEL_TOOLS[0].functionDeclarations : [])
        ]
    }
];

export function getNextApiKey() {
    if (API_KEYS.length === 0) return null;
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return API_KEYS[currentKeyIndex];
}

export async function executeWithSmartFallback(fn, userMessage = '', systemInstruction = '', isDataTask = false) {
    const errors = [];
    
    // 1. هندسة التفكير العميق الافتراضي (Virtual Chain-of-Thought)
    let finalSystemInstruction = systemInstruction;
    if (isDataTask) {
        finalSystemInstruction += `
        
[CRITICAL PROTOCOL FOR DATA TASKS]
You are Alatheer's Data Architect. To write flawless Python (pandas/openpyxl), you MUST follow this protocol:
1. THINK FIRST: You must deeply analyze the file structure, variables, and logic inside <think>...</think> tags.
2. DRAFT CODE: Write your draft Python code inside the <think> block to review it for errors and ensure strict syntax.
3. EXECUTE: ONLY AFTER closing the </think> tag, call the 'execute_python' tool with your finalized code.
Never call a tool without thinking first.`;
    }

    for (const modelName of MODEL_PRIORITY) {
        try {
            const currentKey = API_KEYS[currentKeyIndex];
            console.log(`🔄 [Gemini] محاولة عبر: ${modelName} | Virtual Thinking: ${isDataTask ? 'ON' : 'OFF'}`);
            
            const client = new GoogleGenerativeAI(currentKey);
            
            // 2. استخدام حرارة صفرية للمهام البرمجية لضمان المنطق الصارم بدون كسر الـ API
            const generationConfig = { 
                temperature: isDataTask ? 0.0 : 0.4 
            };

            const model = client.getGenerativeModel({ 
                model: modelName,
                systemInstruction: finalSystemInstruction ? { parts: [{ text: finalSystemInstruction }] } : undefined,
                tools: alatheerTools,
                generationConfig
            });

            return await fn(model, client);

        } catch (err) {
            // توسيع نطاق قراءة الخطأ لتشخيص أدق في سجلات الخادم
            console.log(`❌ [Gemini] فشل ${modelName}: ${err.message?.slice(0, 150)}`);
            if (err.status === 429) getNextApiKey();
            continue;
        }
    }
    throw new Error("❌ فشل جميع نماذج Gemini. راجع سجلات الخادم للتفاصيل.");
}

export async function chat(messages, options = {}) {
    let systemInstruction = options.systemInstruction || "You are Alatheer's expert engineer. Think step-by-step for coding tasks.";
    let currentMessage = "";
    
    if (Array.isArray(messages)) {
        currentMessage = messages[messages.length - 1].content;
    } else {
        currentMessage = messages;
    }

    const activeFile = options.activeFileName || options.filePath || "";
    // تحديد ما إذا كانت المهمة تتطلب تعاملاً مع البيانات والملفات
    const isDataTask = !!(activeFile.match(/\.(xlsx|xls|csv|py|json)$/i) || currentMessage.includes('ملف'));

    return await executeWithSmartFallback(async (model) => {
        const chatSession = model.startChat({ history: [] });
        const result = await chatSession.sendMessage(currentMessage);
        const response = await result.response;
        
        return {
            text: response.text(),
            functionCalls: typeof response.functionCalls === 'function' ? response.functionCalls() : null
        };
    }, currentMessage, systemInstruction, isDataTask);
}

export default { chat, getNextApiKey };
