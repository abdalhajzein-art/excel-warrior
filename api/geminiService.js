/**
 * api/geminiService.js – الإصدار المتوافق مع التوثيق الرسمي
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auditExecution } from "./core/execution_monitor.js";
import { EXCEL_TOOLS } from "./core/excel_tools.js";

// ============================================================
// 📊 تعريف النماذج حسب التوثيق الرسمي
// ============================================================

const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
    .split(",").map(k => k.trim()).filter(Boolean);

// 🎯 النماذج المدعومة مع حصصها الفعلية
const MODEL_CONFIG = {
    // 🥇 أفضل الخيارات المجانية
    'gemini-3.5-flash-lite': {
        daily: 60,
        minute: 15,
        priority: 1,
        description: 'أعلى حصة مجانية - للمهام الخفيفة'
    },
    'gemini-2.5-flash-lite': {
        daily: 60,
        minute: 15,
        priority: 1,
        description: 'نسخة محدثة من Flash Lite'
    },
    
    // 🥈 خيارات متوسطة
    'gemini-3.6-flash': {
        daily: 20,
        minute: 5,
        priority: 2,
        description: 'أفضل توازن بين القوة والحصة'
    },
    'gemini-3-flash-preview': {
        daily: 20,
        minute: 5,
        priority: 2,
        description: 'نسخة تجريبية سريعة'
    },
    
    // 🥉 النماذج القديمة (ما زالت تعمل)
    'gemini-1.5-flash': {
        daily: 60,
        minute: 15,
        priority: 1,
        description: 'النموذج القديم - حصة جيدة'
    },
    'gemini-1.5-pro': {
        daily: 30,
        minute: 10,
        priority: 2,
        description: 'النموذج القديم - أقوى لكن حصة أقل'
    },
    
    // ❌ نماذج مدفوعة (لا تستخدمها إلا كحل أخير)
    'gemini-3.1-pro-preview': {
        daily: 0,
        minute: 0,
        priority: 99,
        paid: true,
        description: 'نموذج مدفوع - لا حصة مجانية'
    },
};

// ترتيب النماذج حسب الأولوية (الأعلى حصة أولاً)
const MODEL_PRIORITY = Object.keys(MODEL_CONFIG)
    .filter(name => !MODEL_CONFIG[name].paid)
    .sort((a, b) => MODEL_CONFIG[a].priority - MODEL_CONFIG[b].priority);

console.log('🚀 [GeminiService] ترتيب النماذج حسب الحصة:');
MODEL_PRIORITY.forEach((model, i) => {
    const config = MODEL_CONFIG[model];
    console.log(`  ${i+1}. ${model} (${config.daily} طلب/يوم) - ${config.description}`);
});

// ============================================================
// 🛡️ نظام إدارة الحصص
// ============================================================

class QuotaManager {
    constructor() {
        this.usage = new Map();
        this.dailyReset = new Date().toDateString();
    }

    resetDailyIfNeeded() {
        const today = new Date().toDateString();
        if (today !== this.dailyReset) {
            this.usage.clear();
            this.dailyReset = today;
            console.log(`🔄 [QuotaManager] إعادة ضبط الحصص - ${today}`);
        }
    }

    getAvailableKey(modelName) {
        this.resetDailyIfNeeded();
        
        const config = MODEL_CONFIG[modelName];
        if (!config || config.paid) {
            return null; // نموذج مدفوع أو غير معروف
        }

        // ترتيب المفاتيح حسب الاستخدام
        const sortedKeys = API_KEYS
            .map((key, index) => {
                const usageKey = `${key}_${modelName}`;
                const usage = this.usage.get(usageKey) || 0;
                return { key, index, usage };
            })
            .sort((a, b) => a.usage - b.usage);

        // ابحث عن مفتاح لم يستنفذ حصته
        for (const keyInfo of sortedKeys) {
            if (keyInfo.usage < config.daily) {
                const usageKey = `${keyInfo.key}_${modelName}`;
                this.usage.set(usageKey, (this.usage.get(usageKey) || 0) + 1);
                
                return {
                    key: keyInfo.key,
                    index: keyInfo.index,
                    remaining: config.daily - keyInfo.usage - 1,
                    total: config.daily
                };
            }
        }

        return null; // جميع المفاتيح استنفذت
    }

    getReport() {
        this.resetDailyIfNeeded();
        const report = {
            date: this.dailyReset,
            models: {}
        };

        for (const modelName of MODEL_PRIORITY) {
            const config = MODEL_CONFIG[modelName];
            const modelUsage = {};
            let totalUsage = 0;

            for (let i = 0; i < API_KEYS.length; i++) {
                const key = API_KEYS[i];
                const usageKey = `${key}_${modelName}`;
                const usage = this.usage.get(usageKey) || 0;
                modelUsage[`key_${i+1}`] = usage;
                totalUsage += usage;
            }

            report.models[modelName] = {
                dailyLimit: config.daily,
                totalUsed: totalUsage,
                remaining: config.daily - totalUsage,
                keys: modelUsage
            };
        }

        return report;
    }
}

const quotaManager = new QuotaManager();

// ============================================================
// 🔧 تعريف الأدوات (دمج أدوات Excel مع الأدوات الحالية)
// ============================================================

const alatheerTools = [
    {
        functionDeclarations: [
            // الأدوات الحالية
            {
                name: "execute_python",
                description: "تنفيذ كود بايثون لمعالجة البيانات أو إنشاء/تعديل الملفات",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        code: { 
                            type: "STRING", 
                            description: "كود البايثون الكامل" 
                        }
                    },
                    required: ["code"]
                }
            },
            {
                name: "read_file_fingerprint",
                description: "قراءة معلومات الملف النشط (الأعمدة، البيانات)",
                parameters: {
                    type: "OBJECT",
                    properties: {}
                }
            },
            // 🆕 أدوات Excel المدمجة
            ...EXCEL_TOOLS[0].functionDeclarations
        ]
    }
];

// ============================================================
// 🚀 التنفيذ الديناميكي
// ============================================================

async function executeWithSmartFallback(fn, userMessage = '', fileName = '') {
    let lastError = null;
    const errors = [];

    // 🔥 جرب النماذج حسب الأولوية
    for (const modelName of MODEL_PRIORITY) {
        const config = MODEL_CONFIG[modelName];
        
        // الحصول على مفتاح متاح
        const keyInfo = quotaManager.getAvailableKey(modelName);
        if (!keyInfo) {
            console.log(`⏭️ [${modelName}] لا يوجد مفتاح متاح (الحصة: ${config.daily} طلب/يوم)`);
            continue;
        }

        try {
            console.log(`🔄 [${modelName}] محاولة | المفتاح #${keyInfo.index+1} | متبقي: ${keyInfo.remaining}/${keyInfo.total}`);
            
            const client = new GoogleGenerativeAI(keyInfo.key);
            const result = await fn(modelName, client);
            
            console.log(`✅ [${modelName}] نجاح!`);
            return result;

        } catch (err) {
            lastError = err;
            const isQuota = err.message?.includes('quota') || err.status === 429;
            
            if (isQuota) {
                // استنفذ الحصة - سجلها وانتقل للنموذج التالي
                const usageKey = `${keyInfo.key}_${modelName}`;
                quotaManager.usage.set(usageKey, config.daily);
                console.log(`⚠️ [${modelName}] استنفذ الحصة، الانتقال للنموذج التالي`);
                errors.push(`[${modelName}] QUOTA: ${err.message.slice(0, 80)}`);
            } else {
                // خطأ آخر - قد يكون مؤقتاً
                console.log(`⚠️ [${modelName}] خطأ: ${err.message.slice(0, 80)}`);
                errors.push(`[${modelName}] ERROR: ${err.message.slice(0, 80)}`);
                
                // إذا كان خطأ شبكة، جرب مرة أخرى مع نفس النموذج
                if (err.message?.includes('network') || err.message?.includes('timeout')) {
                    console.log(`🔄 [${modelName}] إعادة المحاولة بعد 2 ثانية...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // إعادة المحاولة (بسيطة)
                    try {
                        const client = new GoogleGenerativeAI(keyInfo.key);
                        const result = await fn(modelName, client);
                        console.log(`✅ [${modelName}] نجاح بعد إعادة المحاولة!`);
                        return result;
                    } catch (retryErr) {
                        console.log(`❌ [${modelName}] فشلت إعادة المحاولة`);
                        errors.push(`[${modelName}] RETRY FAILED: ${retryErr.message.slice(0, 80)}`);
                    }
                }
            }
        }
    }

    // ❌ فشلت جميع المحاولات
    console.error(`\n❌ [GeminiService] فشلت جميع النماذج (${MODEL_PRIORITY.length})`);
    
    // عرض تقرير الحصص
    const report = quotaManager.getReport();
    console.log('📊 [QuotaReport]:', JSON.stringify(report, null, 2));
    
    throw new Error(`❌ فشل جميع النماذج. آخر خطأ: ${lastError?.message || 'غير معروف'}`);
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
                if (isLast) {
                    lastUserMessage = msg.content;
                } else {
                    history.push({ role: "user", parts: [{ text: msg.content }] });
                }
            }

            if (msg.role === "assistant") {
                if (!isLast) {
                    history.push({ role: "model", parts: [{ text: msg.content }] });
                }
            }
        }

        // ✅ استخدام الأدوات المدمجة
        const toolsToUse = extra.tools || alatheerTools;

        const model = client.getGenerativeModel({
            model: modelName,
            systemInstruction,
            tools: toolsToUse,
            generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 32768,
            }
        });

        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastUserMessage || "مرحبا");
        const response = await result.response;

        let functionCalls = null;
        try {
            if (typeof response.functionCalls === 'function') {
                functionCalls = response.functionCalls();
            }
        } catch (e) {}

        let textReply = "";
        try {
            if (response.text && typeof response.text === 'function') {
                textReply = response.text();
            }
        } catch (e) {}

        auditExecution({
            action: functionCalls && functionCalls.length > 0 ? "llm_tool_call" : "llm_chat",
            target: fileName,
            usage: response.usageMetadata || null,
            model: modelName
        });

        return {
            text: textReply,
            functionCalls: functionCalls || null,
            modelUsed: modelName
        };
    }, userMessage, fileName);
};

// 📊 وظائف مساعدة
geminiService.getQuotaReport = function() {
    return quotaManager.getReport();
};

geminiService.diagnose = function() {
    console.log('\n🔍 [Diagnostic] تقرير النظام:');
    const report = quotaManager.getReport();
    
    console.log(`📅 التاريخ: ${report.date}`);
    console.log('📊 النماذج المتاحة:');
    
    let available = 0;
    for (const [model, data] of Object.entries(report.models)) {
        const status = data.remaining > 0 ? '✅' : '❌';
        console.log(`  ${status} ${model}: ${data.remaining}/${data.dailyLimit} طلب متبقي`);
        if (data.remaining > 0) available++;
    }
    
    console.log(`\n📈 الإجمالي: ${available} نموذج متاح`);
    return report;
};

export default geminiService;
