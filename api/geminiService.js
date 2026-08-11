/**
 * api/geminiService.js – الإصدار المعزز للصلابة (Alatheer AI Suite)
 * - يدعم تدوير النماذج والمفاتيح لـ Gemini و Hugging Face.
 * - دمج تلقائي لنماذج التفكير البرمجي الجبارة من Hugging Face لعمليات الإكسل.
 * - متوافق بالكامل مع معمارية ES Modules و kernel.js.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { HfInference } from "@huggingface/inference";
import { auditExecution } from "./core/execution_monitor.js";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

// إعداد مفاتيح ومكونات الـ API لـ Gemini
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

let currentKeyIndex = 0;

const MODEL_PRIORITY = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
];

// إعداد مفتاح ونماذج Hugging Face المخصصة للأكواد والإكسل (توزيع منفصل ومجاني)
const hfToken = process.env.HF_ACCESS_TOKEN || "";
const hf = hfToken ? new HfInference(hfToken) : null;

const HF_MODELS_PRIORITY = [
    'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', // نموذج تفكير منطقي مذهل في معالجة البيانات
    'Qwen/Qwen2.5-Coder-32B-Instruct',       // أقوى نموذج برمجيات مفتوح المصدر للاستجابات الدقيقة
    'meta-llama/Llama-3.3-70B-Instruct'
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

/**
 * محرك تشغيل عمليات Hugging Face مع التدوير التلقائي للنماذج لتجنب اختناق التوكنز
 */
async function executeWithHfFallback(prompt, systemInstruction = "") {
    if (!hf) {
        throw new Error("❌ لم يتم العثور على متغير البيئة HF_ACCESS_TOKEN الخاص بـ Hugging Face.");
    }

    const errors = [];
    for (const modelName of HF_MODELS_PRIORITY) {
        try {
            console.log(`🤖 [Hugging Face] محاولة معالجة طلب برمي عبر النموذج: ${modelName}`);
            
            const response = await hf.chatCompletion({
                model: modelName,
                messages: [
                    { role: "system", content: systemInstruction || "You are an expert software engineer and data analyst. Generate precise code or structured data configurations." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2048,
                temperature: 0.1 // درجة حرارة منخفضة لضمان دقة الهياكل والأكواد بدون تخمين
            });

            console.log(`✅ [Hugging Face] تم التوليد بنجاح باستخدام: ${modelName}`);
            
            // إعادة الاستجابة بنفس التنسيق المتوقع من طبقة الواجهة لتطبيقك
            return {
                text: response.choices[0].message.content || "",
                functionCalls: null
            };

        } catch (err) {
            console.log(`⚠️ [Hugging Face] فشل النموذج ${modelName} أو تم الوصول للحد الأقصى. الانتقال للبديل الحالي...`);
            errors.push(`[${modelName}]: ${err.message?.slice(0, 50)}`);
            continue; // تدوير تلقائي فوري للنموذج التالي مفتوح المصدر
        }
    }
    throw new Error(`❌ فشلت جميع نماذج Hugging Face المجانية. الأخطاء: ${errors.join(' | ')}`);
}

export async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    const errors = [];
    
    if (API_KEYS.length === 0) {
        throw new Error("❌ لم يتم العثور على أي مفاتيح Gemini API صالحة في متغيرات البيئة.");
    }

    for (const modelName of MODEL_PRIORITY) {
        let attempt = 0;
        const maxRetries = 2;

        while (attempt < maxRetries) {
            attempt++;
            const currentKey = API_KEYS[currentKeyIndex];

            try {
                console.log(`🔄 [Gemini] محاولة (${attempt}/${maxRetries}) | مفتاح رقم: ${currentKeyIndex + 1} | نموذج: ${modelName}`);
                const client = new GoogleGenerativeAI(currentKey);
                const result = await fn(modelName, client, alatheerTools);
                return result;

            } catch (err) {
                const errString = err.toString().toLowerCase();
                
                if (err.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('resource_exhausted')) {
                    console.log(`⚠️ [Gemini] استنفد المفتاح/النموذج الحالي، التبديل لمفتاح جديد...`);
                    getNextApiKey(); 
                    continue; 
                } 
                else if (errString.includes('fetch failed') || errString.includes('network') || errString.includes('timeout')) {
                    console.log(`📡 [Gemini] خطأ شبكة مؤقت، إعادة المحاولة بعد 2 ثانية...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue; 
                } 
                else {
                    console.log(`❌ [Gemini] فشل: ${err.message?.slice(0, 50)}`);
                    errors.push(`[${modelName}] ERROR: ${err.message?.slice(0, 50)}`);
                    break;
                }
            }
        }
    }

    throw new Error(`❌ فشل جميع نماذج ومفاتيح جـمـيـنـي. الأخطاء: ${errors.join(' | ')}`);
}

/**
 * دالة المحادثة المتوافقة تماماً مع بنية kernel.js
 */
export async function chat(messages, options = {}) {
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

    // 💡 الفحص الذكي والتحويل الديناميكي الصامت لـ Hugging Face لحماية التوكنز وضمان الجودة
    const promptTrigger = currentMessage.toLowerCase();
    const isExcelOrCodeRequest = promptTrigger.includes('excel') || 
                                 promptTrigger.includes('إكسل') || 
                                 promptTrigger.includes('اكسل') || 
                                 promptTrigger.includes('بايثون') ||
                                 promptTrigger.includes('python');

    if (isExcelOrCodeRequest && hfToken) {
        try {
            return await executeWithHfFallback(currentMessage, systemInstruction);
        } catch (hfError) {
            console.log(`⚠️ مسار Hugging Face واجه عائقاً [${hfError.message}]. تحويل فوري للمسار الاحتياطي في Gemini لتفادي توقف الخدمة...`);
            // في حال حدوث مشكلة نادرة في HF، يتم التمرير فوراً لـ Gemini تلقائياً دون تدمير الجلسة
        }
    }

    // المسار المعتاد والآمن للمحادثات اليومية والنصية عبر Gemini
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

