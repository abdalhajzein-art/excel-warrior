/**
 * app.js – العقل الرئيسي للسيرفر (Express Server Entry Point - النسخة المصححة)
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

import chatHandler from './api/chat.js';
import uploadHandler from './api/upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// التأكد من وجود مجلد التخزين المؤقت للملفات
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// تخزين الملفات على القرص لضمان توفر مسار حقيقي (filePath) للأدوات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Middlewares مع رفع الحد الأقصى لاستيعاب البيانات الكبيرة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 🔌 مسارات الـ API أولاً قبل الملفات الثابتة لضمان عدم الاعتراض
app.post("/api/chat", async (req, res) => {
  try {
    await chatHandler(req, res);
  } catch (err) {
    console.error("🔥 Error in /api/chat:", err);
    if (!res.headersSent) res.status(500).json({ reply: "⚠️ خطأ داخلي في الخادم." });
  }
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    await uploadHandler(req, res);
  } catch (err) {
    console.error("🔥 Error in /api/upload:", err);
    if (!res.headersSent) res.status(500).json({ reply: "⚠️ خطأ داخلي أثناء رفع الملف." });
  }
});

// Frontend Static Files
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🚀 تشغيل السيرفر السيادي
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Alatheer Server] يعمل بنجاح على المنفذ: ${PORT}`);
});
