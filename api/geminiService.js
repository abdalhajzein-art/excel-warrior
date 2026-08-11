/**
 * api/geminiService.js – الإصدار السيادي الفائق (Alatheer AI Suite)
 * - توجيه سياقي ذكي ومطلق بدون كلمات مفتاحية ساذجة.
 * - دعم كامل لتوليد ومعالجة ملفات الإكسل والأكواد عبر نماذج Hugging Face المتقدمة.
 * - حماية قصوى وارتداد تكتيكي (Fallback) فوري لـ Gemini حصناً ضد توقف السيرفر.
 * - متوافق بالكامل مع معمارية ES Modules و kernel.js (مع الحفاظ على إصدارات Gemini).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { HfInference } from "@huggingface/inference";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

// 1️⃣ إعداد مفاتيح ومكونات الـ API لـ Gemini (ممنوع المساس بالإصدارات)
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

const MODEL_PRIORITY = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
];

// 2️⃣ إعداد مفتاح ونماذج Hugging Face (النموذج الخفيف 7B أولاً لمنع اختناق السيرفر)
const hfToken = process.env.HF_ACCESS_TOKEN || "";
const hf = hfToken ? new HfInference(hfToken) : null;

const HF_MODELS_PRIORITY = [
    'Qwen/Qwen2.5-Coder-7B-Instruct',        // 🚀 الأول: خفيف، فائق السرعة، مجاني دائماً (يمنع fetch failed)
    'Qwen/Qwen2.5-Coder-32B-Instruct',       // 🧠 الثاني: أقوى نموذج برمجي مفتوح المصدر
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' // 📊 الثالث: التفكير المنطقي العميق لبيانات الإكسل المعقدة
];

// 3️⃣ أدوات الأثير السيادية
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

/**
 * 🛠️ محرك Hugging Face مع التدوير التلقائي للنماذج
 */
async function executeWithHfFallback(prompt, systemInstruction = "") {
    if (!hf) throw new Error("❌ لم يتم العثور على مفتاح HF_ACCESS_TOKEN.");

    const errors = [];
    for (const modelName of HF_MODELS_PRIORITY) {
        try {
            console.log(`🤖 [Hugging Face] محاولة المعالجة عبر النموذج: ${modelName}`);
            
            const response = await hf.chatCompletion({
                model: modelName,
                messages: [
                    { role: "system", content: systemInstruction || "You are Alatheer's expert software engineer and data analyst. Generate precise code or structured configurations only." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2048,
                temperature: 0.1 // دقة مطلقة بلا تخمين
            });

            console.log(`✅ [Hugging Face] نجاح التوليد باستخدام: ${modelName}`);
            
            return {
                text: response.choices[0].message.content || "",
                functionCalls: null
            };

        } catch (err) {
            console.log(`⚠️ [Hugging Face] فشل النموذج ${modelName}. الانتقال للبديل التالي...`);
            errors.push(`[${modelName}]: ${err.message?.slice(0, 50)}`);
            continue; 
        }
    }
    throw new Error(`❌ فشلت جميع نماذج Hugging Face. الأخطاء: ${errors.join(' | ')}`);
}

/**
 * 🛠️ محرك Gemini الذكي مع تدوير المفاتيح ومعالجة الشبكة
 */
export async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    const errors = [];
    
    if (API_KEYS.length === 0) {
        throw new Error("❌ لم يتم العثور على مفاتيح Gemini API.");
    }

    for (const modelName of MODEL_PRIORITY) {
        let attempt = 0;
        const maxRetries = 2;

        while (attempt < maxRetries) {
            attempt++;
            const currentKey = API_KEYS[currentKeyIndex];

            try {
                console.log(`🔄 [Gemini] محاولة (${attempt}/${maxRetries}) | نموذج: ${modelName}`);
                const client = new GoogleGenerativeAI(currentKey);
                return await fn(modelName, client, alatheerTools);

            } catch (err) {
                const errString = err.toString().toLowerCase();
                
                if (err.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('exhausted')) {
                    console.log(`⚠️ [Gemini] استنفد المفتاح الحالي، تدوير صامت لمفتاح جديد...`);
                    getNextApiKey(); 
                    continue; 
                } 
                else if (errString.includes('fetch failed') || errString.includes('network') || errString.includes('timeout')) {
                    console.log(`📡 [Gemini] تعثر في الشبكة، إعادة المحاولة...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue; 
                } 
                else {
                    console.log(`❌ [Gemini] فشل غير متوقع: ${err.message?.slice(0, 50)}`);
                    errors.push(`[${modelName}] ERROR: ${err.message?.slice(0, 50)}`);
                    break;
                }
            }
        }
    }
    throw new Error(`❌ انهيار كامل لمسار جـمـيـنـي. الأخطاء: ${errors.join(' | ')}`);
}

/**
 * 🧠 دالة المحادثة الرئيسية (العقل المدبر والموجه السياقي)
 */
export async function chat(messages, options = {}) {
    let systemInstruction = options.systemInstruction || "";
    let history = [];
    let currentMessage = "";

    // تنظيم وترتيب هيكل الرسائل
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

    // 💡 التوجيه السياقي الذكي والشامل (يلتقط الملفات والبيانات من أي مكان في الخيارات أو السياق)
    const activeFile = options.activeFileName || options.filePath || options.file || "";
    
    const isDataOrCodeTask = 
        options.forceHuggingFace === true || 
        (typeof activeFile === 'string' && activeFile.match(/\.(xlsx|xls|csv|py|json|txt)$/i)) || 
        currentMessage.includes('الملف') || 
        currentMessage.includes('الملفات') ||
        systemInstruction.includes('execute_python') || 
        systemInstruction.includes('Data Analyst');

    // إذا كانت المهمة متعلقة بالبيانات أو الملفات، نوجهها فوراً لمسار Hugging Face السيادي
    if (isDataOrCodeTask && hfToken) {
        try {
            return await executeWithHfFallback(currentMessage, systemInstruction);
        } catch (hfError) {
            console.log(`🛡️ [الدرع الواقي] مسار Hugging Face واجه عائقاً [${hfError.message}]. ارتداد تكتيكي فوري لـ Gemini لضمان استمرار الخدمة...`);
        }
    }

    // 🧠 المسار الأساسي: الاعتماد على Gemini للمحادثات العامة وإدارة الأدوات
    return await executeWithSmartFallback(async (modelName, client, tools) => {
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

export default {
    chat,
    executeWithSmartFallback,
    getNextApiKey
};
