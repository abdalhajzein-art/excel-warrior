/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (AI Intent Edition)
 * ✅ يعتمد على Gemini لفهم نية المستخدم بدلاً من الكلمات المفتاحية
 * ✅ يدعم الميتاداتا والمحتوى المستخرج محلياً
 * ✅ يحدد تلقائياً متى يجب إرجاع ملف معدل
 * ✅ يمنع كتابة الكود بشكل صريح
 */

import geminiService from "../geminiService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";
import fs from "fs";
import path from "path";

/**
 * 🧠 كشف النية باستخدام النموذج اللغوي
 */
async function detectIntentWithAI(message, context = {}) {
    const intentPrompt = `
أنت مساعد ذكي مهمتك تحليل نية المستخدم من رسالته.

الرسالة: "${message}"

السياق: المستخدم يتحدث عن ملف ${context.fileName || 'غير محدد'}.

صنف النية إلى أحد التصنيفات التالية:
1. "info" - إذا كان يطلب معلومات، عرض بيانات، أسماء، أرقام، ملخص، تحليل، إحصاء، استعلام عن محتوى.
2. "modify" - إذا كان يطلب تعديل، إضافة، حذف، تغيير، تنسيق، تلوين، إنشاء، ترتيب، تصنيف.
3. "general" - إذا كان حديثاً عاماً أو ترحيباً أو لا علاقة له بالملف.

أيضاً حدد:
- requiresFile: هل الطلب يتطلب إرجاع ملف معدل للمستخدم؟ (true/false)
- description: وصف مختصر للطلب (جملة واحدة بالعربية)

أجب بصيغة JSON فقط، بدون أي نص إضافي:
{
    "intent": "info|modify|general",
    "requiresFile": true|false,
    "description": "وصف الطلب"
}

⚠️ مهم: أنت ممنوع من كتابة أي كود برمجي. أجب فقط بتحليل النية.
`;

    try {
        const response = await geminiService.chat([
            { role: "system", content: intentPrompt },
            { role: "user", content: message }
        ], { temperature: 0.1 });

        // استخراج JSON من الرد
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
                intent: result.intent || 'general',
                requiresFile: result.requiresFile || false,
                description: result.description || 'غير محدد'
            };
        }
        return { intent: 'general', requiresFile: false, description: 'غير محدد' };
    } catch (error) {
        console.warn('⚠️ فشل تحليل النية، استخدام الوضع الافتراضي:', error.message);
        return { intent: 'general', requiresFile: false, description: 'غير محدد' };
    }
}

export default async function kernel(sessionId, rawMessage, ctx = {}) {
    const message = (rawMessage || "").trim();
    if (!message) {
        return {
            reply: "أهلاً بك يا هندسة… كيف يمكنني مساعدتك اليوم؟",
            fileBase64: null,
            fileName: null
        };
    }

    const extractedContent = ctx.extractedContent || null;
    const metadata = ctx.metadata || null;
    const fileName = ctx.fileName || "الملف";
    const modifiedResult = ctx.modifiedResult || null;

    /* 🛡️ بناء السياق للمعالج الذكي */
    let fileContextPrompt = "";

    if (extractedContent && !extractedContent.error) {
        console.log(`📋 [Kernel] استخدام المحتوى المستخرج محلياً للملف: ${fileName}`);

        let contentText = extractedContent.text || extractedContent.markdown || '';

        let metadataInfo = "";
        if (metadata && metadata.sheet_name) {
            metadataInfo = `\n[الميتاداتا المرفقة]:\n- اسم الورقة: ${metadata.sheet_name}\n- عدد الصفوف: ${metadata.total_rows || 'غير معروف'}\n- الأعمدة: ${metadata.headers ? metadata.headers.join(', ') : 'غير معروف'}\n`;
        }

        if (extractedContent.metadata) {
            metadataInfo += `\n[البيانات المستخرجة]:\n`;
            metadataInfo += `- عدد الأوراق: ${extractedContent.metadata.sheets || 0}\n`;
            metadataInfo += `- عدد الصفوف: ${extractedContent.metadata.rows || 0}\n`;
            metadataInfo += `- عدد الأعمدة: ${extractedContent.metadata.columns || 0}\n`;
            if (extractedContent.metadata.hasFormulas) {
                metadataInfo += `- يحتوي على صيغ: نعم (${extractedContent.metadata.formulas?.length || 0} صيغة)\n`;
            }
        }

        // ✅ تقطيع النص لتقليل استهلاك التوكنز (تخفيض إلى 2000 حرف)
        const maxChars = 2000;
        const truncatedText = contentText.length > maxChars
            ? contentText.slice(0, maxChars) + '\n... (تم اختصار المحتوى لتوفير التوكنز)'
            : contentText;

        fileContextPrompt = `
📄 **[محتوى الملف "${fileName}" المستخرج محلياً]:**

${truncatedText}

${metadataInfo}
`;
    }

    // ✅ استخدام النموذج لفهم النية
    const intentResult = await detectIntentWithAI(message, { fileName });
    console.log(`🎯 [Kernel] النية المكتشفة:`, intentResult);

    // ✅ بناء التعليمات السيادية (مع منع كتابة الكود)
    let agenticInstructions = `
🚫 **[قوانين سيادية صارمة]:**
1. أنت ممنوع من كتابة أي كود برمجي (Python، JavaScript، أو أي لغة).
2. مهمتك هي التحليل والوصف فقط باللغة العربية.
3. التعديلات الفعلية يتم تنفيذها بواسطة المحرك الداخلي (ExcelJS/XLSX).
4. لا تخرج أي كود في ردك، فقط نص وصفي.
5. إذا طلب المستخدم تعديلاً، صف التعديل المطلوب فقط.

[تحليل النية]:
- نوع الطلب: ${intentResult.intent}
- يتطلب ملفاً: ${intentResult.requiresFile ? 'نعم' : 'لا'}
- وصف الطلب: ${intentResult.description}
`;

    if (fileContextPrompt) {
        agenticInstructions += `
[محتوى الملف]:
${fileContextPrompt}
`;
    }

    const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];
    let conversationMessages = [
        { role: "system", content: SYSTEM_PROMPT + "\n" + agenticInstructions },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
    ];

    /* 🤖 التنفيذ المباشر */
    let finalReplyText = "";
    let returnedFileName = null;
    let fileBase64 = null;

    // ✅ تحديد ما إذا كنا سنعيد ملفاً بناءً على تحليل النية
    if (intentResult.requiresFile && ctx.filePath && extractedContent && !extractedContent.error) {
        returnedFileName = fileName;
        console.log(`📝 [Kernel] سيتم إرجاع ملف معدل بناءً على طلب: ${intentResult.description}`);
    }

    // ✅ إذا كان الطلب هو "رابط تحميل" أو "تحميل الملف"
    if (message.includes('رابط تحميل') || message.includes('تحميل الملف') || message.includes('download')) {
        if (ctx.filePath && fs.existsSync(ctx.filePath)) {
            try {
                const fileBuffer = fs.readFileSync(ctx.filePath);
                fileBase64 = fileBuffer.toString('base64');
                returnedFileName = fileName;
                console.log(`📥 [Kernel] تجهيز رابط تحميل للملف: ${fileName}`);
            } catch (err) {
                console.warn(`⚠️ [Kernel] فشل قراءة الملف للتحميل: ${err.message}`);
            }
        }
    }

    try {
        console.log(`🧠 [Kernel] إرسال الطلب إلى النموذج...`);

        const reply = await geminiService.chat(conversationMessages, {
            fileName: ctx.fileName,
            extractedContent: ctx.extractedContent
        });

        finalReplyText = reply;

        // تسجيل معلومات الملف للتصحيح
        if (ctx.filePath && extractedContent && !extractedContent.error) {
            console.log(`📝 [Kernel] تمت معالجة الملف: ${fileName}`);
            console.log(`📊 [Kernel] عدد الصفوف: ${extractedContent.metadata?.rows || 0}`);
            console.log(`📊 [Kernel] عدد الأعمدة: ${extractedContent.metadata?.columns || 0}`);
            if (extractedContent.metadata?.hasFormulas) {
                console.log(`📊 [Kernel] يحتوي على صيغ: نعم (${extractedContent.metadata.formulas?.length || 0} صيغة)`);
            }
        }

    } catch (error) {
        console.error("❌ [Kernel] خطأ في المعالجة:", error);
        finalReplyText = `⚠️ حدث خطأ أثناء معالجة طلبك: ${error.message}`;
    }

    memory.appendSovereignHistory(sessionId, {
        role: "assistant",
        content: finalReplyText,
    });

    return {
        reply: finalReplyText.trim(),
        fileName: returnedFileName,
        fileBase64,
    };
        }
