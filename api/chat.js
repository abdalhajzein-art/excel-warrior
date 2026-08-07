/**
 * api/chat.js – Sovereign Chat Layer (Dynamic Execution Edition)
 * ✅ دعم وضع الاستشارة
 * ✅ تحسين عرض الردود
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";
import { extractPreviewAsync, executeDynamicPython } from "./core/dynamic_executor.js";
import fusionMemory from "./core/fusion_memory.js";
import memory from "./core/memory.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSISTENT_DIR = path.join(__dirname, '../persistent_uploads');
const INDEX_FILE = path.join(PERSISTENT_DIR, 'index.json');
const GENERATED_DIR = path.join(__dirname, '../generated');

async function ensureIndexReady() {
    try {
        await fs.promises.mkdir(PERSISTENT_DIR, { recursive: true });
        try {
            await fs.promises.access(INDEX_FILE, fs.constants.F_OK);
        } catch {
            await fs.promises.writeFile(INDEX_FILE, JSON.stringify({}), 'utf8');
        }
    } catch (e) {
        console.warn("⚠️ ensureIndexReady failed:", e.message);
    }
}

async function readIndex() {
    try {
        await ensureIndexReady();
        const raw = await fs.promises.readFile(INDEX_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.warn("⚠️ readIndex failed:", e.message);
        return {};
    }
}

async function writeIndex(idx) {
    try {
        await fs.promises.writeFile(INDEX_FILE, JSON.stringify(idx, null, 2), 'utf8');
    } catch (e) {
        console.warn("⚠️ writeIndex failed:", e.message);
    }
}

async function resolveFileReference({ fileId, filePath, fileName }) {
    if (filePath && fs.existsSync(filePath)) {
        return { storedPath: filePath, fileName: fileName || path.basename(filePath) };
    }

    if (fileId) {
        const idx = await readIndex();
        if (idx[fileId] && idx[fileId].storedPath && fs.existsSync(idx[fileId].storedPath)) {
            return { storedPath: idx[fileId].storedPath, fileName: idx[fileId].fileName || idx[fileId].storedName };
        }
    }

    if (fileName) {
        const candidate = path.join(PERSISTENT_DIR, fileName);
        if (fs.existsSync(candidate)) {
            return { storedPath: candidate, fileName };
        }
    }

    return null;
}

export default async function handler(req, res) {
    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        const userContent = (body.message || body.prompt || "").trim();
        const sessionKey = body.sessionId || "default_session";
        const { fileData, fileName, fileId, filePath: clientFilePath, history, metadata } = body;

        if (!userContent && !fileData && !fileId && !clientFilePath) {
            return res.status(400).json({ reply: "⚠️ الرجاء إرسال رسالة أو ملف لنتمكن من خدمتك يا شريكي." });
        }

        let sovereignFilePath = null;
        let extractedContent = null;
        let finalFileName = fileName || null;

        const isExcelRequest = userContent.match(/إكسل|Excel|ملف\s*إكسل|جدول|spreadsheet/i);
        const isNewFileRequest = userContent.match(/أنشئ|اعمل|عمل لي|generate|create|new\s*file|من الصفر/i);

        // Handle explicit "create new excel" requests
        if (isExcelRequest && isNewFileRequest && !fileData && !fileId && !clientFilePath) {
            console.log("📊 [الأثير] تم اكتشاف طلب إنشاء ملف Excel جديد");
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

            const pythonCodeMatch = output?.reply?.match(/```python\n([\s\S]*?)```/);
            if (pythonCodeMatch) {
                const pythonCode = pythonCodeMatch[1];

                if (!fs.existsSync(GENERATED_DIR)) {
                    fs.mkdirSync(GENERATED_DIR, { recursive: true });
                }

                const newFileName = `excel_${Date.now()}.xlsx`;
                const newFilePath = path.join(GENERATED_DIR, newFileName);

                console.log(`🔧 [الأثير] تنفيذ كود Python لإنشاء ملف: ${newFilePath}`);

                const result = await executeDynamicPython(pythonCode, newFilePath, true);

                if (result.success && fs.existsSync(newFilePath)) {
                    const fileBuffer = fs.readFileSync(newFilePath);
                    const fileBase64 = fileBuffer.toString('base64');
                    const downloadUrl = `/generated/${newFileName}`;

                    try {
                        const previewData = await extractPreviewAsync(newFilePath);
                        if (previewData && !previewData.error) {
                            fusionMemory.storeFileFingerprint(sessionKey, newFilePath, previewData);
                            memory.saveFile(sessionKey, { filePath: newFilePath, fileName: newFileName });
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

        // Resolve file reference
        if ((fileId || clientFilePath) && !fileData) {
            const resolved = await resolveFileReference({ fileId, filePath: clientFilePath, fileName });
            if (resolved) {
                sovereignFilePath = resolved.storedPath;
                finalFileName = resolved.fileName || finalFileName;
                console.log(`🔄 [chat.js] resolved file reference -> ${sovereignFilePath}`);
                try {
                    memory.saveFile(sessionKey, { filePath: sovereignFilePath, fileName: finalFileName });
                } catch (e) {
                    console.warn("⚠️ memory.saveFile failed:", e.message);
                }
            } else {
                console.warn("⚠️ [chat.js] لم يتم العثور على مرجع الملف عبر fileId/filePath.");
            }
        }

        // Handle fileData upload
        if (fileData && fileName) {
            await ensureIndexReady();
            let buffer = null;
            if (typeof fileData === 'string') {
                let cleanBase64 = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
                cleanBase64 = cleanBase64.replace(/\s/g, '');
                buffer = Buffer.from(cleanBase64, 'base64');
            } else if (Buffer.isBuffer(fileData)) {
                buffer = fileData;
            }

            if (buffer && buffer.length > 0) {
                if (!fs.existsSync(PERSISTENT_DIR)) fs.mkdirSync(PERSISTENT_DIR, { recursive: true });

                const safeStoredName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
                const storedPath = path.join(PERSISTENT_DIR, safeStoredName);

                fs.writeFileSync(storedPath, buffer);
                try { await fs.promises.chmod(storedPath, 0o600); } catch (e) { /* ignore */ }

                const idx = await readIndex();
                const fileIdGenerated = safeStoredName.split("-")[0];
                idx[fileIdGenerated] = {
                    fileId: fileIdGenerated,
                    fileName,
                    storedName: safeStoredName,
                    storedPath,
                    size: buffer.length,
                    uploadedAt: new Date().toISOString()
                };
                await writeIndex(idx);

                sovereignFilePath = storedPath;
                finalFileName = safeStoredName;
                console.log(`🛡️ [الأثير Intake] تم حفظ الملف بنجاح: ${sovereignFilePath}`);

                try {
                    memory.saveFile(sessionKey, { filePath: sovereignFilePath, fileName: finalFileName });
                } catch (e) {
                    console.warn("⚠️ memory.saveFile failed:", e.message);
                }

                try {
                    const previewData = await extractPreviewAsync(sovereignFilePath);
                    if (!previewData.error) {
                        extractedContent = {
                            text: previewData.text,
                            metadata: {
                                fileName: finalFileName,
                                rows: previewData.rows,
                                columns: previewData.columns,
                                sheets: previewData.sheets || 1
                            }
                        };
                        fusionMemory.storeFileFingerprint(sessionKey, sovereignFilePath, previewData);
                        console.log(`📊 [الأثير Preview] تم استخراج معاينة الملف بنجاح.`);
                    } else {
                        console.warn(`⚠️ [الأثير Preview] فشلت المعاينة: ${previewData.error}`);
                    }
                } catch (e) {
                    console.warn("⚠️ extractPreviewAsync failed:", e.message);
                }
            }
        }

        // Try to recover from memory
        if (!sovereignFilePath) {
            try {
                const session = memory.getSession(sessionKey);
                if (session && session.sovereign && session.sovereign.lastFile) {
                    const last = session.sovereign.lastFile;
                    if (last.filePath && fs.existsSync(last.filePath)) {
                        sovereignFilePath = last.filePath;
                        finalFileName = finalFileName || last.fileName;
                        console.log(`🔄 [chat.js] استرجاع الملف من الذاكرة: ${sovereignFilePath}`);
                    } else if (last.fileId) {
                        const resolved = await resolveFileReference({ fileId: last.fileId });
                        if (resolved) {
                            sovereignFilePath = resolved.storedPath;
                            finalFileName = finalFileName || resolved.fileName;
                            console.log(`🔄 [chat.js] استرجاع الملف من الذاكرة عبر fileId: ${sovereignFilePath}`);
                        }
                    }
                }
            } catch (e) {
                console.warn("⚠️ memory.getSession check failed:", e.message);
            }
        }

        // Build orchestrator input
        const orchestratorInput = {
            fileData: fileData || null,
            fileName: finalFileName || fileName || null,
            filePath: sovereignFilePath || null,
            history,
            metadata,
            extractedContent
        };

        console.log(`📤 [chat.js] إرسال إلى orchestrator: fileName=${orchestratorInput.fileName}, filePath=${orchestratorInput.filePath}`);

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تكرم عينك يا شريكي، أنجزت لك المطلوب.";
        let fileBase64 = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || finalFileName || fileName || "modified_file.xlsx";

        // ✅ إذا كان الرد استشارة، أعرضه بدون تنفيذ إضافي
        if (output?.isConsultation) {
            return res.status(200).json({
                reply,
                fileName: returnedFileName,
                metadata: extractedContent?.metadata || null,
                isConsultation: true
            });
        }

        // Handle file modification
        if (orchestratorInput.filePath && fs.existsSync(orchestratorInput.filePath) && !fileBase64 && output?.execution?.success) {
            try {
                const fileBuffer = fs.readFileSync(orchestratorInput.filePath);
                fileBase64 = fileBuffer.toString('base64');
                returnedFileName = `modified_${Date.now()}-${path.basename(orchestratorInput.filePath)}`;

                try {
                    const previewData = await extractPreviewAsync(orchestratorInput.filePath);
                    if (previewData && !previewData.error) {
                        fusionMemory.storeFileFingerprint(sessionKey, orchestratorInput.filePath, previewData);
                        memory.saveFile(sessionKey, { filePath: orchestratorInput.filePath, fileName: returnedFileName });
                    }
                } catch (e) {
                    console.warn("⚠️ [chat.js] فشل تحديث البصمة:", e.message);
                }
            } catch (err) {
                console.warn("⚠️ لم يتم قراءة الملف كـ Base64:", err.message);
            }
        }

        if (fileBase64 && returnedFileName) {
            const baseName = path.basename(returnedFileName);
            const realFileUrl = encodeURI(`/persistent_uploads/${baseName}`);
            if (!reply.includes("تحميل")) {
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك يا هندسة](${realFileUrl})**`;
            }
        }

        return res.status(200).json({
            reply,
            fileBase64,
            fileName: returnedFileName,
            metadata: extractedContent?.metadata || null,
            isConsultation: false
        });

    } catch (error) {
        console.error("❌ [Chat Layer Error]:", error);
        return res.status(500).json({ reply: `⚠️ معليش يا شريكي، صار خطأ تقني: ${error.message}` });
    }
                    }
