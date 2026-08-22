/**
 * api/geminiService.js – الإصدار السيادي الجديد (Alatheer Gemini Router)
 * 🚀 يعتمد على Cloudflare Worker كبوابة إلى Gemini API
 * ❌ بدون OmniRoute
 * ❌ بدون سيرفر
 * ❌ بدون OpenRouter
 * ✔ اختيار النموذج المناسب تلقائيًا
 * ✔ دعم أدوات Excel و execute_python
 */

import { EXCEL_TOOLS } from "./core/excel_tools.js";

// ============================================================
// 🌐 إعدادات Cloudflare Worker
// ============================================================

// عنوان الـ Worker الخاص بك
const WORKER_URL = process.env.WORKER_URL || "https://al-atheer.abd-alhajzein.workers.dev/";

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
// 🧠 اختيار نموذج Gemini المناسب حسب نوع المهمة
// ============================================================

function selectGeminiModel(message, activeFile) {
    // مهام الملفات الثقيلة
    if (activeFile?.match(/\.(pdf|docx|xlsx|xls|csv)$/i)) {
        return "gemini-3.1-pro"; // أقوى نموذج للملفات
    }

    // مهام التحليل
    if (message.includes("حلّل") || message.includes("استخرج") || message.includes("فسّر")) {
        return "gemini-3.7-flash"; // أقوى نموذج للتحليل
    }

    // مهام البرمجة
    if (message.includes("كود") || message.includes("برمج") || message.includes("function")) {
        return "gemini-3.7-flash"; // أقوى نموذج للبرمجة
    }

    // دردشة عامة
    return "gemini-3.6-flash";
}

// ============================================================
// 🌐 الاتصال بـ Cloudflare Worker → Gemini API
// ============================================================

async function callGemini(modelName, systemInstruction, userMessage, tools) {
    const payload = {
        model: modelName,
        input: userMessage,
        system_instruction: systemInstruction,
        tools: tools,
        tool_choice: "auto"
    };

    const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Worker error (${response.status}): ${errorText}`);
    }

    return await response.json();
}

// ============================================================
// 🚀 الوظيفة الرئيسية للدردشة
// ============================================================

export async function chat(messages, options = {}) {
    let systemInstruction = options.systemInstruction || "You are Alatheer's expert engineer. Think step-by-step for coding tasks.";
    let currentMessage = "";

    if (Array.isArray(messages)) {
        const lastUserMsg = messages.filter(m => m.role === "user").pop();
        currentMessage = lastUserMsg?.content || messages[messages.length - 1]?.content || "";
    } else {
        currentMessage = messages;
    }

    const activeFile = options.activeFileName || options.filePath || "";
    const selectedModel = selectGeminiModel(currentMessage, activeFile);

    console.log(`🚀 [Alatheer Gemini Router] النموذج المختار: ${selectedModel}`);

    const result = await callGemini(
        selectedModel,
        systemInstruction,
        currentMessage,
        alatheerTools
    );

    const reply = result.output_text || result.text || "";

    return {
        text: reply,
        modelUsed: selectedModel,
        raw: result
    };
}

// ============================================================
// 📊 وظائف مساعدة
// ============================================================

export function getNextApiKey() {
    console.warn("⚠️ لم تعد هناك حاجة لمفاتيح Gemini داخل المنصة. المفتاح داخل Cloudflare Worker فقط.");
    return null;
}

// ============================================================
// 🚀 تصدير الخدمة
// ============================================================

export default {
    chat,
    getNextApiKey,
    callGemini,
    selectGeminiModel
};
