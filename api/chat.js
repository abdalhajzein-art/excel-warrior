/**
 * api/chat.js – Sovereign Chat Layer (Dynamic Execution Edition)
 * ✅ نظيف تماماً ومتوافق مع معمارية Zero-Middleman
 * ✅ دعم بصمة الملف (Fingerprint) لتوفير التوكنز
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import { extractPreviewAsync, executeDynamicPython } from "./core/dynamic_executor.js";
import fusionMemory from "./core/fusion_memory.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const userContent = (body.message || body.prompt || "").trim();
        const sessionKey = body.sessionId || "default_session";
        const { fileData, fileName, history, metadata } = body;

        if (!userContent && !fileData) {
            return res.status(400).json({ reply: "⚠️ الرجاء إرسال رسالة أو ملف لنتمكن من خدمتك يا شريكي." });
        }

        let sovereignFilePath = null;
        let extractedContent = null;
        let finalFileName = fileName;

        // ✅ التحقق: هل المستخدم طلب إنشاء ملف Excel؟
        const isExcelRequest = userContent.match(/إكسل|Excel|ملف\s*إكسل|جدول|spreadsheet/i);
        const isNewFileRequest = userContent.match(/أنشئ|اعمل|عمل لي|generate|create|new\s*file/i);

        if (isExcelRequest && isNewFileRequest && !fileData) {
            console.log("📊 [الأثير] تم اكتشاف طلب إنشاء ملف Excel جديد");
            
            // ✅ نرسل الطلب إلى الـ orchestrator للحصول على كود Python
            const orchestratorInput = {
                fileData: null,
                fileName: null,
                filePath: null,
                history,
                metadata,
                extractedContent: null,
                isNewExcelRequest: true
            };

            const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);
            
            // ✅ نستخرج كود Python من الرد
            const pythonCodeMatch = output?.reply?.match(/```python\n([\s\S]*?)```/);
            
            if (pythonCodeMatch) {
                const pythonCode = pythonCodeMatch[1];
                
                // ✅ إنشاء مسار للملف الجديد
                const generatedDir = path.join(__dirname, '../generated');
                if (!fs.existsSync(generatedDir)) {
                    fs.mkdirSync(generatedDir, { recursive: true });
                }
                
                const newFileName = `excel_${Date.now()}.xlsx`;
                const newFilePath = path.join(generatedDir, newFileName);
                
                console.log(`🔧 [الأثير] تنفيذ كود Python لإنشاء ملف: ${newFilePath}`);
                
                // ✅ تنفيذ الكود
                const result = await executeDynamicPython(pythonCode, newFilePath, true);
                
                if (result.success && fs.existsSync(newFilePath)) {
                    // ✅ قراءة الملف وتحويله لـ Base64
                    const fileBuffer = fs.readFileSync(newFilePath);
                    const fileBase64 = fileBuffer.toString('base64');
                    
                    // ✅ رابط التحميل
                    const downloadUrl = `/generated/${newFileName}`;
                    
                    // ✅ تخزين البصمة للملف المُنشأ
                    try {
                        const previewData = await extractPreviewAsync(newFilePath);
                        if (previewData && !previewData.error) {
                            fusionMemory.storeFileFingerprint(sessionKey, newFilePath, previewData);
                        }
                    } catch (e) {
                        console.warn("⚠️ [chat.js] فشل تخزين البصمة للملف المُنشأ:", e.message);
                    }
                    
                    return res.status(200).json({
                        reply: `✅ **تم إنشاء ملف Excel بنجاح يا هندسة!**\n\n📥 [اضغط هنا لتحميل الملف](${downloadUrl})\n\n📁 اسم الملف: ${newFileName}`,
                        fileBase64: fileBase64,
                        fileName: newFileName,
                        downloadUrl: downloadUrl,
                        isFileGenerated: true
                    });
                } else {
                    return res.status(200).json({
                        reply: `❌ **فشل إنشاء الملف**: ${result.error || "خطأ غير معروف"}\n\n${output?.reply || ""}`,
                        isFileGenerated: false
                    });
                }
            }
        }

        // ✅ معالجة الملفات المرفوعة (كالمعتاد)
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

            if (buffer && buffer.length > 0) {
                fs.writeFileSync(sovereignFilePath, buffer);
                console.log(`🛡️ [الأثير Intake] تم حفظ الملف بنجاح: ${sovereignFilePath}`);
            }

            // ✅ استدعاء المعاينة من الجسر الجديد
            const previewData = await extractPreviewAsync(sovereignFilePath);
            if (!previewData.error) {
                extractedContent = {
                    text: previewData.text,
                    metadata: { 
                        fileName, 
                        rows: previewData.rows, 
                        columns: previewData.columns,
                        sheets: previewData.sheets || 1 
                    }
                };
                console.log(`📊 [الأثير Preview] تم استخراج معاينة الملف بنجاح.`);
                
                // ✅ تخزين بصمة الملف في الذاكرة
                fusionMemory.storeFileFingerprint(sessionKey, sovereignFilePath, previewData);
            } else {
                console.warn(`⚠️ [الأثير Preview] فشلت المعاينة: ${previewData.error}`);
            }
        }

        // ✅ المعالجة العادية عبر الـ orchestrator
        const orchestratorInput = {
            fileData, fileName, filePath: sovereignFilePath, history, metadata, extractedContent
        };

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تكرم عينك يا شريكي، أنجزت لك المطلوب.";
        let fileBase64 = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || fileName || "modified_file.xlsx";

        // ✅ التحقق مما إذا كان Kernel قد عدل الملف ولم يرسل Base64 بعد
        if (sovereignFilePath && fs.existsSync(sovereignFilePath) && !fileBase64 && output?.execution?.success) {
            try {
                const fileBuffer = fs.readFileSync(sovereignFilePath);
                fileBase64 = fileBuffer.toString('base64');
                returnedFileName = `modified_${Date.now()}-${fileName}`;
                
                // ✅ تحديث البصمة بعد التعديل
                try {
                    const previewData = await extractPreviewAsync(sovereignFilePath);
                    if (previewData && !previewData.error) {
                        fusionMemory.storeFileFingerprint(sessionKey, sovereignFilePath, previewData);
                    }
                } catch (e) {
                    console.warn("⚠️ [chat.js] فشل تحديث البصمة:", e.message);
                }
            } catch (err) {
                console.warn("⚠️ لم يتم قراءة الملف كـ Base64:", err.message);
            }
        }

        if (fileBase64 && returnedFileName) {
            const realFileUrl = encodeURI(`/persistent_uploads/${path.basename(returnedFileName)}`);
            if (!reply.includes("تحميل")) {
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك يا هندسة](${realFileUrl})**`;
            }
        }

        return res.status(200).json({
            reply, fileBase64, fileName: returnedFileName, metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ [Chat Layer Error]:", error);
        return res.status(500).json({ reply: `⚠️ معليش يا شريكي، صار خطأ تقني: ${error.message}` });
    }
                                                                            }
