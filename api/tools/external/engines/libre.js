/**
 * engines/libre.js – Sovereign LibreOffice Engine (Final Edition)
 * محرك التحويلات الثقيلة عبر LibreOffice – سيادي بالكامل
 */

import path from "path";
import fs from "fs";
import { execSync } from "child_process";

/**
 * تحويل الملفات عبر LibreOffice
 * يدعم: pdf, docx, doc, xlsx, pptx, txt, وغيرها
 */
export default async function libreEngine(filePath, target = "pdf") {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return normalizedError("⚠️ الملف غير موجود.");
    }

    const outDir = path.dirname(filePath);
    const outName = `libre_${Date.now()}.${target}`;
    const outPath = path.join(outDir, outName);

    /* ============================================================
       🟥 تنفيذ التحويل عبر LibreOffice
       ============================================================ */
    try {
      execSync(
        `libreoffice --headless --convert-to ${target} "${filePath}" --outdir "${outDir}"`,
        { stdio: "ignore" }
      );
    } catch (err) {
      return normalizedError("⚠️ فشل تنفيذ LibreOffice.", err);
    }

    /* ============================================================
       🟦 تأكيد وجود الملف الناتج
       ============================================================ */
    if (!fs.existsSync(outPath)) {
      return normalizedError("⚠️ لم يتم العثور على الملف الناتج.");
    }

    /* ============================================================
       🟩 تحويل الناتج إلى Base64
       ============================================================ */
    let base64 = null;
    try {
      base64 = fs.readFileSync(outPath).toString("base64");
    } catch (err) {
      return normalizedError("⚠️ فشل قراءة الملف الناتج.", err);
    }

    /* ============================================================
       🟧 رد موحّد
       ============================================================ */
    return normalizedFile(
      `تم تحويل الملف عبر LibreOffice إلى ${target}.`,
      outPath,
      outName,
      base64
    );

  } catch (err) {
    return normalizedError("⚠️ خطأ أثناء التحويل عبر LibreOffice.", err);
  }
}

/* ============================================================
   🟫 طبقة توحيد الردود السيادية
   ============================================================ */
function normalizedFile(reply, filePath, fileName, base64) {
  return {
    ok: true,
    reply,
    error: null,
    fileBase64: base64,
    fileName,
    filePath
  };
}

function normalizedError(reply, err = null) {
  return {
    ok: false,
    reply,
    error: err ? err.message : reply,
    fileBase64: null,
    fileName: null,
    filePath: null
  };
}