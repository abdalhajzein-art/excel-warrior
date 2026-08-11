/**
 * api/geminiService.js – الإصدار المعزز للصلابة والذكاء السياقي (Alatheer AI Suite)
 * - توجيه ذكي للمهام (Smart Routing) بدون الاعتماد على كلمات مفتاحية غبية.
 * - دمج تلقائي لنموذج 7B السريع جداً لتفادي اختناق السيرفرات.
 * - متوافق بالكامل مع معمارية ES Modules و kernel.js.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { HfInference } from "@huggingface/inference";
// افترضنا وجود هذه الملفات في بيئتك كما في الكود الأصلي
// import { auditExecution } from "./core/execution_monitor.js"; 
import { EXCEL_TOOLS } from "./core/excel_tools.js";

// 1️⃣ إعداد مفاتيح ومكونات الـ API لـ Gemini (ممنوع المساس بالإصدارات)
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

const MODEL_PRIORITY = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
];

// 2️⃣ إعداد مفتاح ونماذج Hugging Face (تمت إضافة 7B السريع في المقدمة لضمان الاستقرار)
const hfToken = process.env.HF_ACCESS_TOKEN || "";
const hf = hfToken ? new HfInference(hfToken) : null;

const HF_MODELS_PRIORITY = [
    'Qwen/Qwen2.5-Coder-7B-Instruct',        // 🚀 الأولوية الأولى: خفيف، سريع جداً، مجاني دائماً (يمنع fetch failed)
    'Qwen/Qwen2.5-Coder-32B-Instruct',       // 🧠 الأولوية الثانية: أقوى نموذج برمجي مفتوح المصدر
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B' // 📊 الأولوية الثالثة: التفكير المنطقي العميق لبيانات الإكسل المعقدة
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
 * 🛠️ محرك Hugging Face مع التدوير التلقائي
 */
async function executeWithHfFallback(prompt, systemInstruction = "") {
    if (!hf) throw new Error("❌ لم يتم العثور على مفتاح HF_ACCESS_TOKEN.");

    const errors = [];
    for (const modelName of HF_MODELS_PRIORITY) {
        try {
            console.log(`🤖 [Hugging Face] محاولة المعالجة عبر: ${modelName}`);
            
            const response = await hf.chatCompletion({
                model: modelName,
                messages: [
                    { role: "system", content: systemInstruction || "You are Alatheer's expert software engineer and data analyst. Generate precise code or structured configurations only." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2048,
                temperature: 0.1 // دقة عالية، لا مجال للتأليف
            });

            console.log(`✅ [Hugging Face] نجاح التوليد باستخدام: ${modelName}`);
            
            return {
                text: response.choices[0].message.content || "",
                functionCalls: null // HF في هذا المسار يُستخدم للتوليد المنطقي والبرمجي المباشر
            };

        } catch (err) {
            console.log(`⚠️ [Hugging Face] فشل ${modelName}. الانتقال للنموذج التالي...`);
            errors.push(`[${modelName}]: ${err.message?.slice(0, 50)}`);
            continue; 
        }
    }
    throw new Error(`❌ فشلت جميع نماذج Hugging Face. الأخطاء: ${errors.join(' | ')}`);
}

/**
 * 🛠️ محرك Gemini الذكي مع تدوير المفاتيح والشبكة
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
 * 🧠 دالة المحادثة الرئيسية (العقل المدبر)
 */
export async function chat(messages, options = {}) {
    let systemInstruction = options.systemInstruction || "";
    let history = [];
    let currentMessage = "";

    // ترتيب وتنظيف الرسائل
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

    // 💡 التوجيه السياقي الذكي (Smart Context Routing)
    // بدلاً من الكلمات المفتاحية، النظام يستشعر الحاجة لـ HF بناءً على حالة الجلسة
    const isDataOrCodeTask = 
        options.forceHuggingFace === true || // 1. أوامر صريحة من الـ Kernel
        (options.activeFileName && options.activeFileName.match(/\.(xlsx|xls|csv|py|json|txt)$/i)) || // 2. وجود ملف بيانات قيد المعالجة
        (systemInstruction.includes('execute_python') || systemInstruction.includes('Data Analyst')); // 3. سياق النظام المبرمج مسبقاً

    // إذا كانت المهمة ثقيلة (بيانات/أكواد) ومفتاح HF متوفر، نعطي القيادة لـ Hugging Face
    if (isDataOrCodeTask && hfToken) {
        try {
            return await executeWithHfFallback(currentMessage, systemInstruction);
        } catch (hfError) {
            console.log(`🛡️ [الدرع الواقي] مسار Hugging Face واجه عائقاً. ارتداد تكتيكي سريع لـ Gemini للحفاظ على بقاء الخدمة...`);
            // الفشل هنا لا يكسر التطبيق، بل ينزلق بسلاسة ليكمل عبر مسار Gemini
        }
    }

    // 🧠 المسار الأساسي: الاعتماد على Gemini للمحادثات، التحليل العام، وإدارة الأدوات
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

