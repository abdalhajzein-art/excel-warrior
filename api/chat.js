/**
 * api/chat.js – Sovereign Chat Layer (Advanced Engine Edition)
 * ✅ يدعم محركات Excel المدمجة وبايثون.
 * ✅ تخزين مستدام وثابت للملفات طوال الجلسة (بدون حذف فوري).
 * ✅ معالجة الـ Base64 بكفاءة عالية وبدون تسريب للذاكرة.
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { excelRead, excelModify } from './tools/external/engines/excel/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧹 دالة سيادية لتنظيف الملفات فقط عند الحاجة القصوى (مثل انتهاء الجلسة أو طلب الإغلاق)
function cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🧹 [Garbage Collection] تم مسح الملف بنجاح: ${path.basename(filePath)}`);
            } catch (err) {
                console.error(`⚠️ [Garbage Collection] فشل مسح الملف: ${filePath}`, err.message);
            }
        }
    });
}

/**
 * ✅ دالة قراءة واستخراج المحتوى
 */
async function extractExcelContent(filePath, options = {}) {
    try {
        if (!fs.existsSync(filePath)) return { error: "⚠️ الملف غير موجود على الخادم." };

        const stats = fs.statSync(filePath);
        if (stats.size === 0) return { error: "⚠️ الملف فارغ (0 بايت)." };

        console.log(`📊 [Chat Layer] بدء قراءة ملف بحجم: ${stats.size} bytes`);

        let result;
        try {
            result = await excelRead(filePath, {
                analyze: options.analyze || false,
                includeFormulas: true,
                includeStyles: true
            });
        } catch (readErr) {
            return { error: `فشل قراءة الملف داخلياً: ${readErr.message}` };
        }

        if (!result || !result.ok) {
            return { error: result?.error || "حدث فشل مجهول أثناء قراءة الملف." };
        }

        return {
            text: result.data.text || '',
            metadata: {
                sheets: result.data.metadata?.sheets || 0,
                rows: result.data.metadata?.totalRows || 0,
                columns: result.data.metadata?.totalColumns || 0,
                hasFormulas: result.data.metadata?.hasFormulas || false
            },
            rawData: result.data
        };

    } catch (error) {
        return { error: `فشل شامل في استخراج البيانات: ${error.message}` };
    }
}

/**
 * ✅ دالة تنفيذ العمليات (التعديل)
 */
async function modifyExcelContent(filePath, operations) {
    try {
        console.log(`🔧 [Chat Layer] تمرير ${operations.length} عملية إلى محرك التعديل (Excel Engine)...`);
        const result = await excelModify(filePath, { operations });

        if (!result.ok) return { error: result.error || "المحرك فشل في تعديل الملف." };

        return {
            success: true,
            filePath: result.filePath,
            fileBase64: result.fileBase64,
            fileName: result.fileName,
            reply: result.reply
        };
    } catch (error) {
        return { error: `فشل المحرك في التعديل: ${error.message}` };
    }
}

export default async function handler(req, res) {
    let sovereignFilePath = null;
    let newModifiedFilePath = null;

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const userContent = (body.message || body.prompt || "").trim();
        const sessionKey = body.sessionId || "default_session";
        const { fileData, fileName, history, metadata, operations } = body;

        if (!userContent && !fileData) {
            return res.status(400).json({ reply: "⚠️ الرجاء إرسال رسالة أو ملف لنتمكن من خدمتك." });
        }

        let extractedContent = null;
        let modifiedResult = null;

        // 1. التعامل مع الملفات المرفوعة (تخزين مستدام وآمن طوال الجلسة)
        if (fileData && fileName) {
            const persistentDir = path.join(__dirname, '../persistent_uploads');
            if (!fs.existsSync(persistentDir)) fs.mkdirSync(persistentDir, { recursive: true });

            const uniqueFileName = `${Date.now()}-${fileName}`;
            sovereignFilePath = path.join(persistentDir, uniqueFileName);

            let buffer = null;
            if (typeof fileData === 'string') {
                let cleanBase64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
                cleanBase64 = cleanBase64.replace(/\s/g, '');
                buffer = Buffer.from(cleanBase64, 'base64');
            } else if (Buffer.isBuffer(fileData)) {
                buffer = fileData;
            }

            if (!buffer || buffer.length === 0) throw new Error("البيانات المستلمة فارغة أو غير صالحة.");
            fs.writeFileSync(sovereignFilePath, buffer);
            console.log(`🛡️ [الأثير Intake] تم حفظ الملف في التخزين المستدام بنجاح: ${sovereignFilePath}`);

            const fileExt = path.extname(fileName).toLowerCase();

            if (['.xlsx', '.xls', '.csv'].includes(fileExt)) {
                extractedContent = await extractExcelContent(sovereignFilePath, { analyze: true });
            } else {
                extractedContent = { text: `[نوع الملف غير مدعوم للتحليل العميق: ${fileName}]`, metadata: {} };
            }

            if (extractedContent?.error) {
                return res.status(400).json({ reply: `⚠️ عذراً، واجهنا مشكلة: ${extractedContent.error}` });
            }
        }

        // 2. إعداد السياق للموجه السيادي
        const orchestratorInput = {
            fileData, fileName, filePath: sovereignFilePath, history, metadata, extractedContent, operations
        };

        // 3. تسليم القيادة للعقل المدبر
        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تم إنجاز طلبك بنجاح يا شريكي!";
        let fileBase64 = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || null;
        let operationsFromOrchestrator = output?.operations || [];

        // 4. تنفيذ العمليات (إن وُجدت) على الملف المستدام
        if (operationsFromOrchestrator.length > 0 && sovereignFilePath) {
            console.log(`⚙️ [Chat Layer] جاري تنفيذ عمليات التعديل من العقل المدبر على الملف المستدام...`);
            modifiedResult = await modifyExcelContent(sovereignFilePath, operationsFromOrchestrator);
            
            if (modifiedResult.error) {
                throw new Error(modifiedResult.error);
            }

            fileBase64 = modifiedResult.fileBase64;
            returnedFileName = modifiedResult.fileName || fileName;
            newModifiedFilePath = modifiedResult.filePath;
        }

        // ⚡ إذا لم يرجع المحرك Base64 لكنه حفظ الملف في المسار الجديد، نقرأه يدوياً
        if (!fileBase64 && newModifiedFilePath && fs.existsSync(newModifiedFilePath)) {
            try {
                const fileBuffer = fs.readFileSync(newModifiedFilePath);
                fileBase64 = fileBuffer.toString('base64');
                console.log(`📦 [Chat Layer] تمت قراءة الملف المعدل من القرص بنجاح وتحويله لـ Base64.`);
            } catch (readErr) {
                console.error(`⚠️ فشل قراءة الملف المعدل من القرص:`, readErr.message);
            }
        }

        // 5. هندسة رابط التحميل الذكي
        if (fileBase64 && returnedFileName) {
            if (!reply.includes(returnedFileName) && !reply.includes("تحميل")) {
                const realFileUrl = encodeURI(`/persistent_uploads/${returnedFileName}`);
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك المعدل يا هندسة](${realFileUrl})**`;
            }
        }

        // 🛑 تم إيقاف الحذف الفوري (Garbage Collection) للملفات لضمان بقاء "الشريك" حياً ومتاحاً لأي تعديلات لاحقة في الجلسة.

        return res.status(200).json({
            reply,
            fileBase64,
            fileName: returnedFileName || "modified_file.xlsx",
            metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ [Chat Layer Fatal Error]:", error);
        return res.status(500).json({
            reply: `⚠️ معليش يا شريكي، صار خطأ داخلي أثناء المعالجة: ${error.message}`
        });
    }
}

