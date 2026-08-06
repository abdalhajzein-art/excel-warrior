/**
 * api/upload.js – Sovereign Clean File Intake (مصحح)
 *
 * متطلبات: يفترض أن middleware مثل multer يضع الملف في req.file
 * ويجب أن يكون لدى العملية صلاحية الكتابة في مجلد المشروع.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// مجلد التخزين الدائم داخل المشروع
const PERSISTENT_DIR = path.join(__dirname, "../persistent_uploads");
const INDEX_FILE = path.join(PERSISTENT_DIR, "index.json");

// مساعد: تأكد من وجود المجلد وملف الفهرس
async function ensureStorageReady() {
  try {
    await fs.promises.mkdir(PERSISTENT_DIR, { recursive: true });
    // إذا لم يكن هناك index.json، أنشئ واحداً فارغاً
    try {
      await fs.promises.access(INDEX_FILE, fs.constants.F_OK);
    } catch {
      await fs.promises.writeFile(INDEX_FILE, JSON.stringify({}), "utf8");
    }
  } catch (err) {
    throw new Error(`Failed to prepare storage: ${err.message}`);
  }
}

// مساعد: اقرأ فهرس الملفات
async function readIndex() {
  try {
    const raw = await fs.promises.readFile(INDEX_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (err) {
    return {};
  }
}

// مساعد: اكتب فهرس الملفات
async function writeIndex(idx) {
  await fs.promises.writeFile(INDEX_FILE, JSON.stringify(idx, null, 2), "utf8");
}

// مساعد: توليد معرف فريد قصير
function generateFileId() {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

// مساعد: تنظيف اسم الملف ليكون آمنًا
function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export default async function uploadHandler(req, res) {
  try {
    await ensureStorageReady();

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "⚠️ لم يصل أي ملف. أرفق الملف مع الطلب."
      });
    }

    // معلومات الملف من multer أو أي middleware مشابه
    const originalName = req.file.originalname || "uploaded_file";
    const tempPath = req.file.path || req.file.buffer && null; // multer diskStorage يعطي path
    const size = req.file.size || (req.file.buffer ? req.file.buffer.length : 0);

    console.log(`📥 [upload] originalName=${originalName} size=${size} tempPath=${tempPath || "buffer"}`);

    if (!tempPath && !req.file.buffer) {
      return res.status(400).json({ success: false, error: "⚠️ لم يتم العثور على بيانات الملف المؤقتة." });
    }

    if (size < 10) {
      return res.status(400).json({ success: false, error: "⚠️ الملف صغير جداً أو تالف." });
    }

    // اسم آمن ومسار دائم
    const safeName = `${generateFileId()}-${sanitizeFilename(originalName)}`;
    const persistentPath = path.join(PERSISTENT_DIR, safeName);

    // انقل الملف من المسار المؤقت إلى المسار الدائم
    if (tempPath) {
      // إذا كان multer حفظ الملف على القرص
      await fs.promises.rename(tempPath, persistentPath);
    } else if (req.file.buffer) {
      // إذا كان multer في الذاكرة (memoryStorage)
      await fs.promises.writeFile(persistentPath, req.file.buffer);
    }

    // ضبط صلاحيات الملف (قراءة/كتابة للمالك)
    try {
      await fs.promises.chmod(persistentPath, 0o600);
    } catch (e) {
      // ليس خطأ قاتل، فقط سجل
      console.warn("⚠️ chmod failed:", e.message);
    }

    // سجل الميتاداتا في index.json
    const idx = await readIndex();
    const fileId = safeName.split("-")[0]; // استخدم الجزء الأول كـ id (توليدنا)
    idx[fileId] = {
      fileId,
      fileName: originalName,
      storedName: safeName,
      storedPath: persistentPath,
      size,
      uploadedAt: new Date().toISOString()
    };
    await writeIndex(idx);

    // publicPath: مسار نسبي يمكن استخدامه كـ URL إذا خدمت المجلد عبر static route
    const publicPath = `/persistent_uploads/${safeName}`;

    console.log(`✅ [upload] saved: fileId=${fileId} storedPath=${persistentPath}`);

    return res.status(200).json({
      success: true,
      reply: `تم استلام الملف وتأمينه بنجاح: ${originalName}`,
      fileId,
      fileName: originalName,
      filePath: persistentPath,   // مسار داخلي على السيرفر (يُستخدم من قبل orchestrator/kernel)
      publicPath,
      size
    });

  } catch (error) {
    console.error("❌ api/upload.js error:", error);
    return res.status(500).json({
      success: false,
      error: `⚠️ حدث خطأ أثناء معالجة الملف: ${error.message}`
    });
  }
}
