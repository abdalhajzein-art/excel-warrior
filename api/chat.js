/**
 * api/chat.js – Sovereign Chat Layer (النسخة المعمارية المحصنة)
 * ✅ تم تحديثها لاستخدام المحرك الشامل (Excel Ultimate Engine)
 * ✅ يدعم ExcelJS + XLSX معاً
 * ✅ تم إصلاح مشكلة تضاعف حجم الملف
 * ✅ تم إصلاح مشكلة رابط التحميل (يعمل مع التعديل وطلب التحميل)
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import excelEngine from './tools/external/engines/excel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ✅ دالة معالجة الملفات باستخدام المحرك الشامل
 */
async function extractExcelContent(filePath, options = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            return { error: "⚠️ الملف غير موجود على السيرفر." };
        }

        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
            return { error: "⚠️ الملف فارغ (0 بايت)." };
        }

        console.log(`📊 [extractExcelContent] حجم الملف: ${stats.size} bytes`);
        console.log(`📊 [extractExcelContent] نوع الملف: ${path.extname(filePath)}`);

        const result = await excelEngine.execute(filePath, 'read', {
            analyze: options.analyze || false,
            includeFormulas: true,
            includeStyles: true
        });

        if (!result.ok) {
            return { error: result.error || "فشل قراءة الملف" };
        }

        const data = result.data;

        return {
            text: data.text || '',
            markdown: data.markdown || '',
            metadata: {
                sheets: data.metadata?.sheets || 0,
                rows: data.metadata?.totalRows || 0,
                columns: data.metadata?.totalColumns || 0,
                hasFormulas: data.metadata?.hasFormulas || false,
                formulas: data.formulas?.flat() || [],
                engines: data.metadata?.engines || ['exceljs'],
                analysis: data.analysis || null
            },
            rawData: data
        };

    } catch (error) {
        console.error("❌ خطأ في استخراج محتوى الملف:", error);
        return { error: `فشل قراءة الملف: ${error.message}` };
    }
}

/**
 * ✅ دالة معالجة طلبات التعديل على الملف
 */
async function modifyExcelContent(filePath, operations) {
    try {
        const result = await excelEngine.execute(filePath, 'modify', {
            operations: operations
        });

        if (!result.ok) {
            return { error: result.error || "فشل تعديل الملف" };
        }

        return {
            success: true,
            filePath: result.filePath,
            fileBase64: result.fileBase64,
            fileName: result.fileName,
            reply: result.reply
        };
    } catch (error) {
        console.error("❌ خطأ في تعديل الملف:", error);
        return { error: `فشل تعديل الملف: ${error.message}` };
    }
}

export default async function handler(req, res) {
    try {
        const body = typeof req.body === "string"
            ? JSON.parse(req.body)
            : (req.body || {});

        const userContent = (body.message || body.prompt || "").trim();
        const sessionKey = body.sessionId || "default";

        const fileData = body.fileData || null;
        const fileName = body.fileName || null;
        const history = body.history || [];
        const metadata = body.metadata || null;
        const operations = body.operations || null;

        if (!userContent && !fileData) {
            return res.status(400).json({
                reply: "⚠️ الرجاء إرسال رسالة أو ملف."
            });
        }

        let localFilePath = null;
        let extractedContent = null;
        let modifiedResult = null;

        if (fileData && fileName) {
            try {
                const uploadDir = path.join(__dirname, '../uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${fileName}`;
                localFilePath = path.join(uploadDir, uniqueFileName);

                let buffer = null;

                if (typeof fileData === 'string') {
                    let cleanBase64 = fileData;

                    if (cleanBase64.includes('base64,')) {
                        cleanBase64 = cleanBase64.split('base64,')[1];
                    }

                    cleanBase64 = cleanBase64.replace(/\s/g, '');

                    const base64Regex = /^[A-Za-z0-9+/=]+$/;
                    if (!base64Regex.test(cleanBase64)) {
                        const match = cleanBase64.match(/[A-Za-z0-9+/=]+/);
                        if (match) {
                            cleanBase64 = match[0];
                        } else {
                            throw new Error("البيانات المرسلة ليست بصيغة Base64 صالحة");
                        }
                    }

                    buffer = Buffer.from(cleanBase64, 'base64');

                } else if (Buffer.isBuffer(fileData)) {
                    buffer = fileData;
                } else if (typeof fileData === 'object' && fileData !== null) {
                    if (fileData.data && Buffer.isBuffer(fileData.data)) {
                        buffer = fileData.data;
                    } else {
                        const jsonStr = JSON.stringify(fileData);
                        buffer = Buffer.from(jsonStr);
                    }
                } else if (Array.isArray(fileData)) {
                    buffer = Buffer.from(fileData);
                }

                if (!buffer || buffer.length === 0) {
                    throw new Error("البيانات المستلمة فارغة أو غير صالحة");
                }

                console.log(`📊 [chat.js] حفظ ملف: ${fileName}, الحجم: ${buffer.length} bytes`);

                fs.writeFileSync(localFilePath, buffer);

                const savedStats = fs.statSync(localFilePath);
                if (savedStats.size === 0) {
                    throw new Error("الملف المحفوظ فارغ (0 بايت)");
                }

                if (savedStats.size !== buffer.length) {
                    console.warn(`⚠️ تحذير: حجم الملف المحفوظ (${savedStats.size}) يختلف عن الحجم الأصلي (${buffer.length})`);
                }

                const fileExt = path.extname(fileName).toLowerCase();

                if (['.xlsx', '.xls', '.xlsm', '.csv'].includes(fileExt)) {
                    if (operations && operations.length > 0) {
                        modifiedResult = await modifyExcelContent(localFilePath, operations);
                        if (modifiedResult.error) {
                            throw new Error(modifiedResult.error);
                        }
                        extractedContent = await extractExcelContent(modifiedResult.filePath, { analyze: true });
                    } else {
                        extractedContent = await extractExcelContent(localFilePath, { analyze: true });
                    }

                    if (extractedContent.error) {
                        console.error(`❌ [chat.js] فشل استخراج محتوى Excel: ${extractedContent.error}`);
                    } else {
                        console.log(`📄 [chat.js] تم استخراج محتوى Excel باستخدام المحرك الشامل: ${fileName}`);
                    }
                } else if (['.docx', '.doc'].includes(fileExt)) {
                    extractedContent = { text: `[ملف Word: ${fileName}]`, markdown: '', metadata: {} };
                } else if (['.pdf'].includes(fileExt)) {
                    extractedContent = { text: `[ملف PDF: ${fileName}]`, markdown: '', metadata: {} };
                } else if (['.pptx', '.ppt'].includes(fileExt)) {
                    extractedContent = { text: `[ملف PowerPoint: ${fileName}]`, markdown: '', metadata: {} };
                } else {
                    const content = fs.readFileSync(localFilePath, 'utf-8');
                    extractedContent = { text: content.slice(0, 10000), markdown: '', metadata: {} };
                }

            } catch (err) {
                console.error("❌ خطأ في حفظ أو معالجة الملف:", err);
                extractedContent = { error: `فشل معالجة الملف: ${err.message}` };

                if (localFilePath && fs.existsSync(localFilePath)) {
                    try {
                        fs.unlinkSync(localFilePath);
                        console.log(`🗑️ تم حذف الملف التالف: ${localFilePath}`);
                    } catch (cleanupErr) {
                        console.error(`⚠️ فشل حذف الملف التالف: ${cleanupErr.message}`);
                    }
                }
            }
        }

        if (extractedContent && extractedContent.error) {
            return res.status(400).json({
                reply: `⚠️ ${extractedContent.error}`
            });
        }

        const orchestratorInput = {
            fileData,
            fileName,
            filePath: modifiedResult?.filePath || localFilePath,
            history,
            metadata,
            extractedContent,
            operations
        };

        if (modifiedResult) {
            orchestratorInput.modifiedResult = modifiedResult;
        }

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = "تم إنجاز طلبك بنجاح!";
        let fileBase64 = null;
        let returnedFileName = null;

        if (typeof output === "string") {
            reply = output;
        } else if (output && typeof output === "object") {
            reply = output.reply || output.message || "تم إنجاز طلبك بنجاح!";
            fileBase64 = output.fileBase64 || modifiedResult?.fileBase64 || null;
            returnedFileName = output.fileName || modifiedResult?.fileName || null;
        }

        // ✅ إضافة رابط التحميل في حالتين:
        // 1. تعديل فعلي (modifiedResult)
        // 2. طلب تحميل من kernel (fileBase64 من output)
        const hasFileToDownload = (modifiedResult && modifiedResult.fileName && modifiedResult.fileBase64) ||
                                  (fileBase64 && returnedFileName);

        if (hasFileToDownload && returnedFileName) {
            const realFileUrl = encodeURI(`/uploads/${returnedFileName}`);
            if (!reply.includes(returnedFileName)) {
                reply += `\n\n📥 **[تحميل الملف مباشرة](${realFileUrl})**`;
            }
        }

        return res.status(200).json({
            reply,
            fileBase64,
            fileName: returnedFileName,
            metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ خطأ في api/chat.js:", error);
        return res.status(500).json({
            reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
        });
    }
}
