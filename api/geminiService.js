/**
 * api/geminiService.js – الإصدار المعزز للصلابة (Alatheer AI Suite)
 * - يدعم تدوير المفاتيح (Key Rotation) والتنفيذ الذكي.
 * - يدعم الاستيراد الافتراضي (Default) والمسجّل (Named).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

const MODEL_PRIORITY = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3-flash-preview'
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

export async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    const errors = [];
    
    if (API_KEYS.length === 0) {
        throw new Error("❌ لم يتم العثور على أي مفاتيح Gemini API صالحة في متغيرات البيئة.");
    }

    for (const modelName of MODEL_PRIORITY) {
        let attempt = 0;
        const maxRetries = 3;

        while (attempt < maxRetries) {
            attempt++;
            const currentKey = API_KEYS[currentKeyIndex];

            try {
                console.log(`🔄 [${modelName}] محاولة (${attempt}/${maxRetries}) | مفتاح رقم: ${currentKeyIndex + 1}`);
                
                const client = new GoogleGenerativeAI(currentKey);
                const result = await fn(modelName, client, alatheerTools);
                
                console.log(`✅ [${modelName}] نجاح التنفيذ.`);
                return result;

            } catch (err) {
                const errString = err.toString().toLowerCase();
                
                if (err.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('resource_exhausted')) {
                    console.log(`⚠️ [${modelName}] استنفد المفتاح الحالي، التبديل لمفتاح جديد...`);
                    getNextApiKey(); 
                    continue; 
                } 
                else if (errString.includes('fetch failed') || errString.includes('network') || errString.includes('timeout')) {
                    console.log(`📡 [${modelName}] خطأ شبكة مؤقت، إعادة المحاولة بعد 3 ثواني...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue; 
                } 
                else {
                    console.log(`❌ [${modelName}] فشل: ${err.message?.slice(0, 50)}`);
                    errors.push(`[${modelName}] ERROR: ${err.message?.slice(0, 50)}`);
                    break;
                }
            }
        }
    }

    throw new Error(`❌ فشل جميع النماذج والمفاتيح. الأخطاء: ${errors.join(' | ')}`);
}

/**
 * دالة المحادثة المتوافقة تماماً مع بنية kernel.js
 */
export async function chat(messages, options = {}) {
    return await executeWithSmartFallback(async (modelName, client, tools) => {
        let systemInstruction = options.systemInstruction || "";
        let history = [];
        let currentMessage = "";

        if (Array.isArray(messages)) {
            const nonSystem = messages.filter(m => m.role !== 'system');
            const sysMsg = messages.find(m => m.role === 'system');
            if (sysMsg) systemInstruction = sysMsg.content;

            if (nonSystem.length > 0) {
                currentMessage = nonSystem[nonSystem.length - 1].content;
                history = nonSystem.slice(0, -1).map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));
            }
        } else {
            currentMessage = messages;
        }

        const model = client.getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            tools: options.tools || tools
        });

        const chatSession = model.startChat({ history: history });
        const result = await chatSession.sendMessage(currentMessage);
        const response = await result.response;
        
        return {
            text: response.text(),
            functionCalls: typeof response.functionCalls === 'function' ? response.functionCalls() : (response.functionCalls || null)
        };
    }, messages);
}

// تصدير افتراضي يجمع الكل لضمان عدم حدوث أي خطأ في الـ Import
export default {
    chat,
    executeWithSmartFallback,
    getNextApiKey
};
