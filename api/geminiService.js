/**
 * api/geminiService.js – الإصدار السيادي المُعزز (Alatheer AI Suite)
 * ✅ تم التعديل لدعم OmniRoute كبوابة بدلاً من Gemini المباشر
 * - الحفاظ على وظيفة execute_python وأدوات Excel
 * - التوجيه الذكي للطلبات عبر OmniRoute
 */

import { EXCEL_TOOLS } from "./core/excel_tools.js";

// ============================================================
// 🌐 إعدادات OmniRoute
// ============================================================

// 🔥 عنوان OmniRoute - غيّره إلى عنوان السيرفر الخاص بك
const OMNIROUTE_URL = process.env.OMNIROUTE_URL || "https://omniroute-server.onrender.com/v1";
// مفتاح API الخاص بـ OmniRoute
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || "your-omniroute-api-key";

// ============================================================
// 🎯 تعريف النماذج عبر OmniRoute
// ============================================================

// نماذج OmniRoute المتاحة (يمكنك إضافة المزيد)
const MODEL_PRIORITY = [
    'gemini-3.6-flash',      // الأسرع والأذكى في المهام الوكيلية
    'claude-3-sonnet',       // من خلال OmniRoute
    'deepseek-coder',        // للبرمجة
    'qwen-coder',            // بديل جيد للبرمجة
    'gemini-1.5-pro'         // العقل المدبر الأعلى دقة
];

// ============================================================
// 🔧 أدوات Alatheer (نفس الأدوات السابقة)
// ============================================================

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

// ============================================================
// 🧠 الاتصال بـ OmniRoute (بدلاً من Gemini مباشرة)
// ============================================================

async function callOmniRoute(modelName, systemInstruction, userMessage, tools) {
    const response = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OMNIROUTE_API_KEY}`
        },
        body: JSON.stringify({
            model: modelName,
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: userMessage }
            ],
            tools: tools,
            tool_choice: 'auto',
            temperature: 0.25,
            max_tokens: 32768
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OmniRoute API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data;
}

// ============================================================
// 🚀 التنفيذ مع التجاوز التلقائي (Smart Fallback)
// ============================================================

export async function executeWithSmartFallback(fn, userMessage = '', systemInstruction = '', isDataTask = false) {
    const errors = [];
    const lastError = null;

    // تحضير التعليمات للمهام البرمجية
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

    // تجربة النماذج حسب الأولوية
    for (const modelName of MODEL_PRIORITY) {
        try {
            console.log(`🔄 [OmniRoute] محاولة عبر النموذج: ${modelName}`);

            const result = await callOmniRoute(
                modelName,
                finalSystemInstruction,
                userMessage,
                alatheerTools
            );

            // استخراج الرد والأدوات من استجابة OmniRoute
            const reply = result.choices?.[0]?.message;
            if (!reply) {
                throw new Error('استجابة فارغة من OmniRoute');
            }

            return {
                text: reply.content || '',
                functionCalls: reply.tool_calls || null,
                modelUsed: modelName,
                raw: result
            };

        } catch (err) {
            console.error(`❌ [OmniRoute] فشل النموذج ${modelName}:`, err.message);
            errors.push(`[${modelName}] ${err.message}`);
            // الاستمرار إلى النموذج التالي
        }
    }

    throw new Error(`❌ فشل جميع النماذج عبر OmniRoute. الأخطاء: ${errors.join('; ')}`);
}

// ============================================================
// 🌐 الوظيفة الرئيسية للدردشة
// ============================================================

export async function chat(messages, options = {}) {
    let systemInstruction = options.systemInstruction || "You are Alatheer's expert engineer. Think step-by-step for coding tasks.";
    let currentMessage = "";

    if (Array.isArray(messages)) {
        // استخراج آخر رسالة مستخدم
        const lastUserMsg = messages.filter(m => m.role === 'user').pop();
        currentMessage = lastUserMsg?.content || messages[messages.length - 1]?.content || '';
    } else {
        currentMessage = messages;
    }

    const activeFile = options.activeFileName || options.filePath || "";
    const isDataTask = !!(activeFile.match(/\.(xlsx|xls|csv|py|json)$/i) || currentMessage.includes('ملف'));

    return await executeWithSmartFallback(async (modelName) => {
        // هذه الدالة لن تُستخدم مباشرة، بل سنستخدم callOmniRoute
        // لكننا نحتفظ بها للتوافق مع الكود القديم
        return await callOmniRoute(modelName, systemInstruction, currentMessage, alatheerTools);
    }, currentMessage, systemInstruction, isDataTask);
}

// ============================================================
// 📊 وظائف مساعدة
// ============================================================

export function getNextApiKey() {
    // لم تعد هناك حاجة لمفاتيح Gemini، ولكن نحتفظ بالدالة للتوافق
    console.warn('⚠️ getNextApiKey() تم استبدالها بـ OmniRoute');
    return null;
}

// ============================================================
// 🚀 تصدير الخدمة
// ============================================================

export default { 
    chat, 
    getNextApiKey,
    executeWithSmartFallback,
    callOmniRoute,
    MODEL_PRIORITY
};
