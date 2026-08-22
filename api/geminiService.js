/**
 * api/geminiService.js – الاصدار السيادي المعتمد (Gemini 3 Series & Interactions API)
 */

import { EXCEL_TOOLS } from "./core/excel_tools.js";

// عنوان Cloudflare Worker المباشر (متوافق مع المتصفح و GitHub Pages)
const WORKER_URL = "https://al-atheer.abd-alhajzein.workers.dev/chat";

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

// اختيار نموذج Gemini 3 المناسب للمهمة
function selectGeminiModel(message, activeFile) {
    // المهام المعقدة والملفات الثقيلة
    if (activeFile?.match(/\.(pdf|docx|xlsx|xls|csv)$/i)) {
        return "gemini-3.1-pro";
    }

    // البرمجة، التحليل المعقد، والعمليات متعددة الخطوات
    if (message.includes("حلّل") || message.includes("استخرج") || message.includes("فسّر") || message.includes("كود") || message.includes("برمج")) {
        return "gemini-3.7-flash";
    }

    // المحادثات والمهام اليومية
    return "gemini-3.6-flash";
}

// إرسال الطلب بهيكلية Interactions API إلى Cloudflare Worker
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

    return {
        text: result.reply || result.output_text || "",
        modelUsed: selectedModel,
        raw: result
    };
}

export function getNextApiKey() {
    return null;
}

export default {
    chat,
    getNextApiKey,
    callGemini,
    selectGeminiModel
};

