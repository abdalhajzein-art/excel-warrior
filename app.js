import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// ✅ مسار الشات (يستخدم الملف api/chat.js)
app.post('/api/chat', chatHandler);

// ✅ مسار رفع الملفات
app.post('/api/upload', (req, res) => {
  res.json({ status: "success", message: "تم استقبال الملف" });
});

// ✅ مسار اختبار بسيط
app.get('/test', (req, res) => {
  res.send('✅ السيرفر شغال مع Groq!');
});

app.listen(PORT, () => {
  console.log(`🚀 الأثير شغال على المنفذ ${PORT} مع Groq`);
});
