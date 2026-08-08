/**
 * api/geminiService.js – الإصدار المعزز للصلابة (Alatheer AI Suite)
 * - يدعم تدوير المفاتيح (Key Rotation) عند حدوث Rate Limit.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

// مؤشر المفتاح الحالي للتدوير
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

// دالة للحصول على المفتاح التالي في الدور
function getNextApiKey() {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return API_KEYS[currentKeyIndex];
}

async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    const errors = [];
    
    // محاولة التنفيذ عبر النماذج والمفاتيح
    for (const modelName of MODEL_PRIORITY) {
        let attempt = 0;
        const maxRetries = 3; // زدنا عدد المحاولات لضمان الاستقرار

        while (attempt < maxRetries) {
            attempt++;
            const currentKey = API_KEYS[currentKeyIndex];

            try {
                console.log(`🔄 [${modelName}] محاولة (${attempt}/${maxRetries}) | مفتاح رقم: ${currentKeyIndex + 1}`);
                
                const client = new GoogleGenerativeAI(currentKey);
                const result = await fn(modelName, client);
                
                console.log(`✅ [${modelName}] نجاح.`);
                return result;

            } catch (err) {
                const errString = err.toString().toLowerCase();
                
                // 429 Rate Limit: التبديل الفوري للمفتاح
                if (err.status === 429 || errString.includes('429') || errString.includes('quota') || errString.includes('resource_exhausted')) {
                    console.log(`⚠️ [${modelName}] استنفد المفتاح الحالي، التبديل لمفتاح جديد...`);
                    getNextApiKey(); // تدوير المفتاح
                    continue; // إعادة المحاولة بنفس النموذج ولكن بمفتاح جديد
                } 
                
                // خطأ شبكة: انتظار بسيط ثم إعادة محاولة
                else if (errString.includes('fetch failed') || errString.includes('network') || errString.includes('timeout')) {
                    console.log(`📡 [${modelName}] خطأ شبكة مؤقت، إعادة المحاولة بعد 3 ثواني...`);
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    continue; 
                } 
                
                else {
                    console.log(`❌ [${modelName}] فشل: ${err.message?.slice(0, 50)}`);
                    errors.push(`[${modelName}] ERROR: ${err.message?.slice(0, 50)}`);
                    break; // نموذج معطل، انتقل للنموذج التالي
                }
            }
        }
    }

    throw new Error(`❌ فشل جميع النماذج والمفاتيح. الأخطاء: ${errors.join(' | ')}`);
}

// ... (بقية دالة geminiService.chat تبقى كما هي في ملفك)
