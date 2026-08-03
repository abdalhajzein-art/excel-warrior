/**
 * api/chat.js – Sovereign Chat Layer (Advanced Engine Edition)
 * ✅ يدعم محركات Excel المدمجة وبايثون.
 * ✅ بروتوكول "التنظيف الذاتي" لمنع امتلاء مساحة السيرفر السحابي.
 * ✅ معالجة الـ Base64 بكفاءة عالية وبدون تسريب للذاكرة.
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { excelRead, excelModify } from './tools/external/engines/excel/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🧹 دالة سيادية لتنظيف الملفات المؤقتة وتجنب اختناق السيرفر
function cleanupTempFiles(filePaths) {
    filePaths.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🧹 [Garbage Collection] تم مسح الملف المؤقت بنجاح: ${path.basename(filePath)}`);
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
    let localFilePath = null;
    let newModifiedFilePath = null; // لتتبع مسار الملف المعدل ومسحه لاحقاً

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

        // 1. التعامل مع الملفات المرفوعة
        if (fileData && fileName) {
            const uploadDir = path.join(__dirname, '../uploads');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const uniqueFileName = `${Date.now()}-ALATHEER-${fileName}`;
            localFilePath = path.join(uploadDir, uniqueFileName);

            // معالجة الـ Base64 بأمان
            let buffer = null;
            if (typeof fileData === 'string') {
                let cleanBase64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
                cleanBase64 = cleanBase64.replace(/\s/g, '');
                buffer = Buffer.from(cleanBase64, 'base64');
            } else if (Buffer.isBuffer(fileData)) {
                buffer = fileData;
            }

            if (!buffer || buffer.length === 0) throw new Error("البيانات المستلمة فارغة أو غير صالحة.");
            fs.writeFileSync(localFilePath, buffer);

            const fileExt = path.extname(fileName).toLowerCase();

            if (['.xlsx', '.xls', '.csv'].includes(fileExt)) {
                // استخراج فوري للمحتوى
                extractedContent = await extractExcelContent(localFilePath, { analyze: true });
            } else {
                extractedContent = { text: `[نوع الملف غير مدعوم للتحليل العميق: ${fileName}]`, metadata: {} };
            }

            if (extractedContent?.error) {
                cleanupTempFiles([localFilePath]); // مسح فوري إذا كان الملف تالفاً
                return res.status(400).json({ reply: `⚠️ عذراً، واجهنا مشكلة: ${extractedContent.error}` });
            }
        }

        // 2. إعداد السياق للموجه السيادي
        const orchestratorInput = {
            fileData, fileName, filePath: localFilePath, history, metadata, extractedContent, operations
        };

        // 3. تسليم القيادة للعقل المدبر
        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تم إنجاز طلبك بنجاح يا شريكي!";
        let fileBase64 = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || null;
        let operationsFromOrchestrator = output?.operations || [];

        // 4. تنفيذ العمليات (إن وُجدت) على الملف
        if (operationsFromOrchestrator.length > 0 && localFilePath) {
            console.log(`⚙️ [Chat Layer] جاري تنفيذ عمليات التعديل من العقل المدبر...`);
            modifiedResult = await modifyExcelContent(localFilePath, operationsFromOrchestrator);
            
            if (modifiedResult.error) {
                throw new Error(modifiedResult.error);
            }

            fileBase64 = modifiedResult.fileBase64;
            returnedFileName = modifiedResult.fileName;
            newModifiedFilePath = modifiedResult.filePath;
        }

        // 5. هندسة رابط التحميل الذكي
        if (fileBase64 && returnedFileName) {
            // نتحقق أولاً إذا كان الرابط قد أُضيف مسبقاً في النص
            if (!reply.includes(returnedFileName) && !reply.includes("تحميل")) {
                // ننشئ مسار وهمي آمن للواجهة الأمامية
                const realFileUrl = encodeURI(`/uploads/${returnedFileName}`);
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك المعدل يا هندسة](${realFileUrl})**`;
            }
        }

        // 6. التنظيف السيادي للملفات المؤقتة من الخادم 
        // (إذا تم تحويل الملف لـ Base64 فلا حاجة لبقائه على الـ Disk)
        cleanupTempFiles([localFilePath, newModifiedFilePath]);

        return res.status(200).json({
            reply,
            fileBase64,
            fileName: returnedFileName,
            metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ [Chat Layer Fatal Error]:", error);
        return res.status(500).json({
            reply: `⚠️ معليش يا شريكي، صار خطأ داخلي أثناء المعالجة: ${error.message}`
        });
    }
}

