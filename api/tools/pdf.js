/**
 * api/tools/pdf.js – Sovereign PDF Engine (Final Edition)
 * محرك قراءة وتحويل PDF سيادي بالكامل بدون أي ذكاء لغوي
 */

import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { safeTempFile, safeUnlink, execAsync } from "./helpers.js";

/* ============================================================
   🟥 قراءة PDF أو أي مستند قابل للتحويل إلى نص
   ============================================================ */
export async function pdfRead(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return "⚠️ الملف غير موجود.";
  }

  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const safeInput = safeTempFile(ext);
  const safeBaseName = path.basename(safeInput, `.${ext}`);
  const expectedOut = path.join("/tmp", `${safeBaseName}.txt`);

  try {
    fs.copyFileSync(filePath, safeInput);

    await execAsync(`libreoffice --headless --convert-to txt:Text "${safeInput}" --outdir /tmp`);

    if (!fs.existsSync(expectedOut)) {
      return "⚠️ تعذر استخراج النص من المستند.";
    }

    const data = fs.readFileSync(expectedOut, "utf8");
    return data.trim() || "⚠️ الملف فارغ.";
  } catch (err) {
    return `⚠️ خطأ في استخراج النص: ${err.message}`;
  } finally {
    safeUnlink(safeInput);
    safeUnlink(expectedOut);
  }
}

/* ============================================================
   🟦 تحويل PDF عبر LibreOffice
   ============================================================ */
export async function pdfConvert(filePath, targetFormat = "pdf") {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("⚠️ الملف غير موجود.");
  }

  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const safeInput = safeTempFile(ext);
  const safeBaseName = path.basename(safeInput, `.${ext}`);
  const expectedOut = path.join("/tmp", `${safeBaseName}.${targetFormat}`);

  try {
    fs.copyFileSync(filePath, safeInput);

    await execAsync(`libreoffice --headless --convert-to ${targetFormat} "${safeInput}" --outdir /tmp`);

    if (!fs.existsSync(expectedOut)) {
      throw new Error(`⚠️ فشل تحويل الملف إلى ${targetFormat}`);
    }

    const buffer = fs.readFileSync(expectedOut);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `converted_${Date.now()}.${targetFormat}`
    };
  } catch (err) {
    throw new Error(`⚠️ خطأ أثناء التحويل: ${err.message}`);
  } finally {
    safeUnlink(safeInput);
    safeUnlink(expectedOut);
  }
}

/* ============================================================
   🟧 إنشاء PDF بسيط بدون أي ذكاء لغوي
   ============================================================ */
export async function pdfCreate(textContent) {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    const safeText = textContent.toString().slice(0, 2000);

    page.drawText(safeText, {
      x: 50,
      y: 700,
      size: 12
    });

    const pdfBytes = await pdfDoc.save();

    return {
      fileBase64: Buffer.from(pdfBytes).toString("base64"),
      fileName: `document_${Date.now()}.pdf`
    };
  } catch (err) {
    return { error: `⚠️ فشل إنشاء PDF: ${err.message}` };
  }
}