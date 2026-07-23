import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';
import convertHandler from './api/convert/convert.js';
import generateHandler from './api/excel/generate.js';
import modifyHandler from './api/excel/modify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ✅ CORS (للاستخدام من خارج السيرفر)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ============================================================
// 🚀 المسارات الرئيسية
// ============================================================

// ✅ الشات الذكي (المسار الرئيسي)
app.post('/api/chat', chatHandler);

// ✅ تحويل الملفات
app.post('/api/convert', convertHandler);

// ✅ توليد ملف Excel جديد
app.post('/api/generate', generateHandler);

// ✅ تعديل ملف Excel موجود
app.post('/api/modify', modifyHandler);

// ✅ رفع الملفات (للاستخدام العام)
app.post('/api/upload', (req, res) => {
  res.json({ 
    status: "success", 
    message: "✅ تم استقبال الملف بنجاح" 
  });
});

// ✅ اختبار السيرفر
app.get('/test', (req, res) => {
  res.send('✅ السيرفر "الأثير" شغال مع Groq!');
});

// ✅ صفحة رئيسية بسيطة
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 منصة "الأثير" - Alatheer AI Suite</h1>
    <p>✅ السيرفر شغال بشكل طبيعي.</p>
    <p>📌 استخدم <code>/api/chat</code> للدردشة مع المساعد الذكي.</p>
    <p>📊 استخدم <code>/api/convert</code> لتحويل الملفات.</p>
    <p>📄 استخدم <code>/api/generate</code> لتوليد ملفات Excel.</p>
    <p>✏️ استخدم <code>/api/modify</code> لتعديل ملفات Excel.</p>
  `);
});

// ============================================================
// ❌ معالجة الأخطاء العامة
// ============================================================

// ✅ مسار غير موجود (404)
app.use((req, res) => {
  res.status(404).json({ 
    error: "❌ المسار غير موجود", 
    path: req.originalUrl 
  });
});

// ✅ معالجة الأخطاء الداخلية (500)
app.use((err, req, res, next) => {
  console.error("❌ خطأ في السيرفر:", err);
  res.status(500).json({ 
    error: "❌ خطأ داخلي في السيرفر", 
    message: err.message 
  });
});

// ============================================================
// 🚀 تشغيل السيرفر
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 الأثير شغال على المنفذ ${PORT} مع Groq`);
  console.log(`📌 http://localhost:${PORT}/test للاختبار`);
});
