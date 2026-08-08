/**
 * api/geminiService.js – الإصدار المعزز للصلابة (Alatheer AI Suite)
 * - تمت إزالة إدارة الحصص الوهمية.
 * - التركيز على إعادة المحاولة الذكية عند فشل الاتصال.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

// استخراج المفاتيح
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

// ترتيب النماذج للاستخدام (بدون حسابات حصص)
const MODEL_PRIORITY = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3-flash-preview'
];

// ============================================================
// 🔧 تعريف الأدوات (التي يحتاجها الأثير للعمل)
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
// 🚀 التنفيذ الذكي مع المرونة الشبكية
// ============================================================

async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    const errors = [];
    
    // استخدام مفتاح واحد بشكل دوري أو ثابت (حسب الرغبة) - هنا نأخذ المفتاح الأول المتاح
    const apiKey = API_KEYS[0]; 

    for (const modelName of MODEL_PRIORITY) {
        let attempt = 0;
        const maxRetries = 2; // إعادة محاولة للشبكة فقط

        while (attempt < maxRetries) {
            attempt++;
            try {
                console.log(`🔄 [${modelName}] محاولة (${attempt}/${maxRetries})...`);
                
                const client = new GoogleGenerativeAI(apiKey);
                const result = await fn(modelName, client);
                
                console.log(`✅ [${modelName}] نجاح.`);
                return result;

            } catch (err) {
                const errString = err.toString().toLowerCase();
                
                // التمييز بين أخطاء الـ API (Quota/Rate Limit) وأخطاء الشبكة
                const isRateLimit = errString.includes('quota') || err.status === 429 || errString.includes('resource_exhausted');
                const isNetworkError = errString.includes('fetch failed') || errString.includes('network') || errString.includes('timeout') || errString.includes('error fetching');

                if (isRateLimit) {
                    console.log(`⚠️ [${modelName}] تجاوز حد الاستخدام (Rate Limited)، الانتقال للنموذج التالي.`);
                    errors.push(`[${modelName}] RATE_LIMIT`);
                    break; // الانتقال للنموذج التالي
                } 
                else if (isNetworkError && attempt < maxRetries) {
                    console.log(`📡 [${modelName}] خطأ شبكة مؤقت، إعادة المحاولة بعد 2 ثانية...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue; 
                } 
                else {
                    console.log(`❌ [${modelName}] فشل غير متوقع: ${err.message?.slice(0, 50)}`);
                    errors.push(`[${modelName}] ERROR: ${err.message?.slice(0, 50)}`);
                    break; // الانتقال للنموذج التالي
                }
            }
        }
    }

    throw new Error(`❌ فشل جميع النماذج. الأخطاء: ${errors.join(' | ')}`);
}

// ============================================================
// 🌐 الخدمة الرئيسية
// ============================================================

const geminiService = {};

geminiService.chat = async function(messages, extra = {}) {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    const fileName = extra.fileName || 'Active Chat';

    return executeWithSmartFallback(async (modelName, client) => {
        const systemMessages = messages.filter(m => m.role === "system");
        const systemInstruction = systemMessages.map(m => m.content).join("\n\n");

        const history = [];
        let lastUserMessage = "";
        const conv = messages.filter(m => m.role !== "system");

        for (let i = 0; i < conv.length; i++) {
            const msg = conv[i];
            const isLast = i === conv.length - 1;

            if (msg.role === "user") {
                if (isLast) lastUserMessage = msg.content;
                else history.push({ role: "user", parts: [{ text: msg.content }] });
            } else if (msg.role === "assistant") {
                if (!isLast) history.push({ role: "model", parts: [{ text: msg.content }] });
            }
        }

        const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction || undefined,
            tools: alatheerTools,
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 8192,
            }
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastUserMessage || "مرحبا");
        const response = await result.response;

        // معالجة استخراج الدوال
        let functionCalls = null;
        if (response.functionCalls) functionCalls = response.functionCalls;
        else if (response.candidates?.[0]?.content?.parts) {
            const fcPart = response.candidates[0].content.parts.find(p => p.functionCall);
            if (fcPart) functionCalls = [fcPart.functionCall];
        }

        auditExecution({
            action: functionCalls ? "llm_tool_call" : "llm_chat",
            target: fileName,
            model: modelName
        });

        return {
            text: response.text(),
            functionCalls: functionCalls,
            modelUsed: modelName
        };
    }, userMessage, fileName);
};

export default geminiService;

