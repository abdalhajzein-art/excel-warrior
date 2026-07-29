/**
 * api/tools/office.js
 * Sovereign Lite Office Tools – النسخة النهائية المصحّحة
 */

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import kernel from "../groqService.js";   // ← الذكاء الأساسي الجديد

// مسار مؤقت
function tempPath(name) {
  return path.join("/tmp", `${Date.now()}_${name}`);
}

// ===============================
// 1) قراءة الملف – readFile()
// ===============================
export async function readFile(filePath) {
  return new Promise((resolve, reject) => {
    const outPath = tempPath("read.txt");

    exec(`libreoffice --headless --convert-to txt:Text "${filePath}" --outdir /tmp`, (err) => {
      if (err) return reject(err);

      fs.readFile(outPath, "utf8", (err, data) => {
        if (err) return reject(err);
        resolve(data || "⚠️ الملف فارغ أو غير قابل للقراءة.");
      });
    });
  });
}

// ===============================
// 2) تعديل الملف – modifyFile()
// ===============================
export async function modifyFile(filePath, userInstruction) {
  const content = await readFile(filePath);

  // ⭐ استخدام kernel الجديد بدل global.kernel
  const modifiedText = await kernel(
    `عدّل هذا المحتوى حسب طلب المستخدم:\n\nطلب المستخدم: ${userInstruction}\n\nالمحتوى:\n${content}`
  );

  // كتابة النص المعدّل إلى ملف TXT مؤقت
  const txtPath = tempPath("modified.txt");
  const docxPath = tempPath("modified.docx");

  return new Promise((resolve, reject) => {
    fs.writeFile(txtPath, modifiedText, (err) => {
      if (err) return reject(err);

      // تحويل TXT → DOCX
      exec(`libreoffice --headless --convert-to docx "${txtPath}" --outdir /tmp`, (err) => {
        if (err) return reject(err);

        // LibreOffice سيكتب الملف باسم modified.docx داخل /tmp
        const finalPath = docxPath;

        const fileBuffer = fs.readFileSync(finalPath);
        resolve({
          fileBase64: fileBuffer.toString("base64"),
          fileName: "modified.docx",
        });
      });
    });
  });
}

// ===============================
// 3) تحويل الملف – convertFile()
// ===============================
export async function convertFile(filePath) {
  const outPath = tempPath("converted.pdf");

  return new Promise((resolve, reject) => {
    exec(`libreoffice --headless --convert-to pdf "${filePath}" --outdir /tmp`, (err) => {
      if (err) return reject(err);

      const fileBuffer = fs.readFileSync(outPath);
      resolve({
        fileBase64: fileBuffer.toString("base64"),
        fileName: "converted.pdf",
      });
    });
  });
}

// ===============================
// 4) إنشاء ملف جديد – createFile()
// ===============================
export async function createFile(textContent) {
  const txtPath = tempPath("new.txt");
  const docxPath = tempPath("new.docx");

  return new Promise((resolve, reject) => {
    fs.writeFile(txtPath, textContent, (err) => {
      if (err) return reject(err);

      exec(`libreoffice --headless --convert-to docx "${txtPath}" --outdir /tmp`, (err) => {
        if (err) return reject(err);

        const fileBuffer = fs.readFileSync(docxPath);
        resolve({
          fileBase64: fileBuffer.toString("base64"),
          fileName: "new.docx",
        });
      });
    });
  });
}