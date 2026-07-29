import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { exec } from "child_process";
import fs from "fs";
import os from "os";

// Handlers
import chatHandler from './api/chat.js';
import convertHandler from './api/convert/convert.js';
import generateHandler from './api/excel/generate.js';
import modifyHandler from './api/excel/modify.js';
import memory from './api/core/memory.js';

// Boot Sequence
import boot from './api/core/boot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ⭐ Middlewares + Static + index.html
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// تقديم ملفات الواجهة الأمامية (index.html + js + css)
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ============================================================
// 🆕 LibreOffice Conversion Engine
// ============================================================

app.post("/api/office/convert", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const target = req.body.target || "pdf"; 
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, req.file.originalname);

    fs.writeFileSync(inputPath, req.file.buffer);

    const cmd = `soffice --headless --convert-to ${target} --outdir ${tmpDir} ${inputPath}`;

    exec(cmd, (err) => {
      if (err) {
        console.error("❌ LibreOffice Error:", err);
        return res.status(500).json({ error: "فشل التحويل عبر LibreOffice" });
      }

      const outputName = req.file.originalname.replace(path.extname(req.file.originalname), `.${target}`);
      const outputPath = path.join(tmpDir, outputName);

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: "❌ لم يتم العثور على الملف الناتج." });
      }

      res.download(outputPath, outputName);
    });

  } catch (err) {
    console.error("❌ خطأ في محرك LibreOffice:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📖 LibreOffice Read (Extract Text)
// ============================================================

app.post("/api/office/read", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, req.file.originalname);

    fs.writeFileSync(inputPath, req.file.buffer);

    const cmd = `soffice --headless --convert-to txt:Text --outdir ${tmpDir} ${inputPath}`;

    exec(cmd, (err) => {
      if (err) {
        console.error("❌ LibreOffice Read Error:", err);
        return res.status(500).json({ error: "فشل استخراج النص عبر LibreOffice" });
      }

      const outputName = req.file.originalname.replace(path.extname(req.file.originalname), `.txt`);
      const outputPath = path.join(tmpDir, outputName);

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: "❌ لم يتم العثور على ملف النص الناتج." });
      }

      const content = fs.readFileSync(outputPath, "utf8");
      res.json({ text: content });
    });

  } catch (err) {
    console.error("❌ خطأ في قراءة الملف:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 📝 LibreOffice Create (Generate DOCX)
// ============================================================

import { Document, Packer, Paragraph } from "docx";

app.post("/api/office/create", async (req, res) => {
  try {
    const { text, filename } = req.body;

    if (!text) {
      return res.status(400).json({ error: "⚠️ النص مطلوب لإنشاء ملف." });
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: text.split("\n").map(line => new Paragraph(line)),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const name = filename || "document.docx";

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.send(buffer);

  } catch (err) {
    console.error("❌ خطأ في إنشاء الملف:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ✏️ LibreOffice Modify (Read → AI Modify → Create DOCX)
// ============================================================

app.post("/api/office/modify", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "⚠️ لم يتم رفع أي ملف." });
    }

    const instruction = req.body.instruction;
    if (!instruction) {
      return res.status(400).json({ error: "⚠️ يرجى إرسال تعليمات التعديل." });
    }

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, req.file.originalname);

    fs.writeFileSync(inputPath, req.file.buffer);

    const cmd = `soffice --headless --convert-to txt:Text --outdir ${tmpDir} ${inputPath}`;

    exec(cmd, async (err) => {
      if (err) {
        console.error("❌ LibreOffice Modify Error:", err);
        return res.status(500).json({ error: "فشل استخراج النص عبر LibreOffice" });
      }

      const txtName = req.file.originalname.replace(path.extname(req.file.originalname), `.txt`);
      const txtPath = path.join(tmpDir, txtName);

      if (!fs.existsSync(txtPath)) {
        return res.status(500).json({ error: "❌ لم يتم العثور على ملف النص الناتج." });
      }

      const originalText = fs.readFileSync(txtPath, "utf8");

      const modifiedText = await chatHandler({
        body: {
          message: `عدّل النص التالي حسب التعليمات:\n\nالتعليمات:\n${instruction}\n\nالنص:\n${originalText}`
        }
      }, {
        json: (data) => data.response
      });

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: modifiedText.split("\n").map(line => new Paragraph(line)),
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      const outputName = `modified-${Date.now()}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${outputName}"`);
      res.send(buffer);
    });

  } catch (err) {
    console.error("❌ خطأ في تعديل الملف:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 🧠 Chat + Excel + Boot
// ============================================================

app.post("/api/chat", express.json(), (req, res) => {
  chatHandler(req, res);
});

app.post("/api/excel/convert", express.json(), (req, res) => {
  convertHandler(req, res);
});

app.post("/api/excel/generate", express.json(), (req, res) => {
  generateHandler(req, res);
});

app.post("/api/excel/modify", express.json(), (req, res) => {
  modifyHandler(req, res);
});

// ⭐ Boot Sequence — الطريقة الصحيحة
// نشغّله بعد إقلاع السيرفر، بدون ما يطيّر الكونتينر
// وبدون ما يوقف التشغيل
// وبدون ما يعمل Crash

// ============================================================
// 🚀 تشغيل السيرفر
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // ⭐ Boot بعد الإقلاع
  boot.start("default")
    .then(() => console.log("🔥 Sovereign AI Booted"))
    .catch(err => console.error("❌ Boot Error:", err));
});
