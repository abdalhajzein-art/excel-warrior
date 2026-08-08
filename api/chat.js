/**
 * api/chat.js – Sovereign Chat Layer (Dynamic Execution Edition)
 * ✅ النسخة المصححة: كل شيء يمر عبر Kernel، لا تجاوز
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

        // ✅ تم إزالة التجاوز - كل شيء يمر عبر Kernel

        // --- 🛡️ السيادة على المرجع: الأولوية القصوى للملف المرفوع مسبقاً ---
        
        // 1. محاولة حل المرجع بناءً على fileId أو clientFilePath أولاً
        if (fileId || clientFilePath) {
            const resolved = await resolveFileReference({ fileId, filePath: clientFilePath, fileName });
            if (resolved) {
                sovereignFilePath = resolved.storedPath;
                finalFileName = resolved.fileName || finalFileName;
                try {
                    memory.saveFile(sessionKey, { filePath: sovereignFilePath, fileName: finalFileName });
                } catch (e) {
                    console.warn("⚠️ memory.saveFile failed:", e.message);
                }
            }
        }

        // 2. إذا لم نعثر على مرجع صلب، وفقط إذا كان هناك fileData جديد، نقوم بحفظه
        if (!sovereignFilePath && fileData && fileName) {
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

                try {
                    memory.saveFile(sessionKey, { filePath: sovereignFilePath, fileName: finalFileName });
                } catch (e) {
                    console.warn("⚠️ memory.saveFile failed:", e.message);
                }
            }
        }

        // 3. استخراج البصمة إذا كان الملف موجوداً
        if (sovereignFilePath) {
             try {
                const previewData = await extractPreviewAsync(sovereignFilePath);
                if (previewData && !previewData.error) {
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
                }
            } catch (e) {
                console.warn("⚠️ extractPreviewAsync failed:", e.message);
            }
        }

        // 4. استرجاع آخر ملف من الجلسة إذا لم يتم إرسال ملف جديد
        if (!sovereignFilePath) {
            try {
                const session = memory.getSession(sessionKey);
                if (session && session.sovereign && session.sovereign.lastFile) {
                    const last = session.sovereign.lastFile;
                    if (last.filePath && fs.existsSync(last.filePath)) {
                        sovereignFilePath = last.filePath;
                        finalFileName = finalFileName || last.fileName;
                    } else if (last.fileId) {
                        const resolved = await resolveFileReference({ fileId: last.fileId });
                        if (resolved) {
                            sovereignFilePath = resolved.storedPath;
                            finalFileName = finalFileName || resolved.fileName;
                        }
                    }
                }
            } catch (e) {
                console.warn("⚠️ memory.getSession check failed:", e.message);
            }
        }

        const orchestratorInput = {
            fileData: fileData || null,
            fileName: finalFileName || fileName || null,
            filePath: sovereignFilePath || null,
            history,
            metadata,
            extractedContent
        };

        const output = await conversationOrchestrator(sessionKey, userContent, orchestratorInput);

        let reply = output?.reply || output?.message || "تكرم عينك يا شريكي، أنجزت لك المطلوب.";
        
        // 🛡️ حماية صارمة لعقد البيانات
        if (typeof reply !== 'string') {
            reply = reply?.reply || reply?.text || reply?.message || JSON.stringify(reply, null, 2);
        }

        let fileBase64Out = output?.fileBase64 || null;
        let returnedFileName = output?.fileName || finalFileName || fileName || "modified_file.xlsx";

        if (orchestratorInput.filePath && fs.existsSync(orchestratorInput.filePath) && !fileBase64Out && output?.execution?.success) {
            try {
                const fileBuffer = fs.readFileSync(orchestratorInput.filePath);
                fileBase64Out = fileBuffer.toString('base64');
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

        if (fileBase64Out && returnedFileName) {
            const baseName = path.basename(returnedFileName);
            const realFileUrl = encodeURI(`/persistent_uploads/${baseName}`);
            if (!reply.includes("تحميل")) {
                reply += `\n\n📥 **[اضغط هنا لتحميل ملفك يا هندسة](${realFileUrl})**`;
            }
        }

        return res.status(200).json({
            reply,
            fileBase64: fileBase64Out,
            fileName: returnedFileName,
            metadata: extractedContent?.metadata || null
        });

    } catch (error) {
        console.error("❌ [Chat Layer Error]:", error);
        return res.status(500).json({ reply: `⚠️ معليش يا شريكي، صار خطأ تقني: ${error.message}` });
    }
            }
