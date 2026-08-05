/**
 * app.js – العقل الرئيسي للسيرفر (Express Server Entry Point - النسخة السيادية المصححة)
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

// ✅ CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 1️⃣ التأكد من وجود مجلد التخزين المؤقت للملفات
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ إضافة مجلد للملفات المُنشأة (generated)
const generatedDir = path.join(__dirname, 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
  console.log(`📁 [Server] تم إنشاء مجلد: ${generatedDir}`);
}

// ✅ إضافة مجلد للملفات المرفوعة بشكل دائم (persistent_uploads)
const persistentUploadsDir = path.join(__dirname, 'persistent_uploads');
if (!fs.existsSync(persistentUploadsDir)) {
  fs.mkdirSync(persistentUploadsDir, { recursive: true });
  console.log(`📁 [Server] تم إنشاء مجلد: ${persistentUploadsDir}`);
}

// 2️⃣ 🧹 منظف القرص التلقائي (حذف الملفات المؤقتة القديمة التي تجاوزت ساعة واحدة)
function cleanupUploadsFolder() {
  try {
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        console.log(`🧹 [Disk Sweeper] تم تنظيف الملف القديم: ${file}`);
      }
    });
  } catch (err) {
    console.warn("⚠️ [Disk Sweeper Warning]:", err.message);
  }
}

// ✅ تنظيف ملفات generated القديمة (أكثر من ساعة)
function cleanupGeneratedFolder() {
  try {
    const files = fs.readdirSync(generatedDir);
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(generatedDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > ONE_HOUR) {
        fs.unlinkSync(filePath);
        console.log(`🧹 [Generated Sweeper] تم تنظيف الملف القديم: ${file}`);
      }
    });
  } catch (err) {
    console.warn("⚠️ [Generated Sweeper Warning]:", err.message);
  }
}

// تشغيل المنظفات كل ساعة
setInterval(() => {
  cleanupUploadsFolder();
  cleanupGeneratedFolder();
}, 60 * 60 * 1000);

// 3️⃣ تخزين الملفات على القرص لضمان توفر مسار حقيقي (filePath) للأدوات
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

// 📂 التصريح الرسمي لمسار التحميلات لضمان تنزيل الملفات بسلاسة
app.use('/uploads', express.static(uploadDir));

// ✅ التصريح الرسمي لمسار الملفات المُنشأة
app.use('/generated', express.static(generatedDir));

// ✅ التصريح الرسمي لمسار الملفات المرفوعة بشكل دائم
app.use('/persistent_uploads', express.static(persistentUploadsDir));

// ✅ مسار لتنزيل الملفات المُنشأة مع اسم مخصص
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // البحث في المجلدات المختلفة
  const possiblePaths = [
    path.join(generatedDir, filename),
    path.join(persistentUploadsDir, filename),
    path.join(uploadDir, filename)
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log(`📥 [Download] جاري تحميل: ${filePath}`);
      return res.download(filePath, filename, (err) => {
        if (err) {
          console.error(`❌ [Download Error]: ${err.message}`);
        }
      });
    }
  }
  
  console.warn(`⚠️ [Download] الملف غير موجود: ${filename}`);
  res.status(404).send('⚠️ الملف غير موجود أو قد تم حذفه.');
});

// Frontend Static Files
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🚀 تشغيل السيرفر السيادي
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 [Alatheer Server] يعمل بنجاح على المنفذ: ${PORT}`);
  cleanupUploadsFolder(); // تنظيف فوري عند الإقلاع الأول
  cleanupGeneratedFolder(); // تنظيف الملفات المُنشأة القديمة
});
