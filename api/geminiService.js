/**
 * api/geminiService.js – الإصدار السيادي المُعزز (Alatheer AI Suite)
 * - الاعتماد الكلي على Gemini مع تفعيل ميزة التفكير البرمجي (Thinking Mode).
 * - لا حاجة لـ Hugging Face (تجنب مشاكل الـ fetch failed).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

// ترتيب النماذج حسب القدرة البرمجية
const MODEL_PRIORITY = [
    'gemini-3.6-flash',      // الأسرع والأذكى في المهام الوكيلية
    'gemini-1.5-pro',        // العقل المدبر الأعلى دقة في كتابة البايثون
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
    
    for (const modelName of MODEL_PRIORITY) {
        try {
            const currentKey = API_KEYS[currentKeyIndex];
            console.log(`🔄 [Gemini] محاولة عبر: ${modelName} | Thinking: ${isDataTask ? 'ON' : 'OFF'}`);
            
            const client = new GoogleGenerativeAI(currentKey);
            
            // إعدادات التفكير البرمجي (فقط للملفات والبيانات)
            const generationConfig = isDataTask ? {
                thinkingConfig: { includeThoughts: true, budgetTokens: 2048 },
                temperature: 0.1 
            } : { temperature: 0.4 };

            const model = client.getGenerativeModel({ 
                model: modelName,
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
                tools: alatheerTools,
                generationConfig
            });

            return await fn(model, client);

        } catch (err) {
            console.log(`❌ [Gemini] فشل ${modelName}: ${err.message?.slice(0, 40)}`);
            if (err.status === 429) getNextApiKey();
            continue;
        }
    }
    throw new Error("❌ فشل جميع نماذج Gemini.");
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

