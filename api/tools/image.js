/**
 * api/tools/image.js – Sovereign Image Engine (Final Edition)
 * محرك معالجة الصور سيادي بالكامل بدون أي ذكاء لغوي
 */

import fs from "fs";
import sharp from "sharp";
import { safeTempFile, safeUnlink } from "./helpers.js";

const allowedFormats = ["png", "jpg", "jpeg", "webp", "tiff", "avif"];

/**
 * تحويل صيغة الصور عبر Sharp
 */
export async function imageConvert(filePath, target = "png") {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("⚠️ صورة المصدر غير موجودة.");
  }

  const cleanTarget = target.toLowerCase().replace(/^\./, "");

  if (!allowedFormats.includes(cleanTarget)) {
    throw new Error(`⚠️ صيغة ${cleanTarget} غير مدعومة.`);
  }

  const outPath = safeTempFile(cleanTarget);

  try {
    await sharp(filePath).toFormat(cleanTarget).toFile(outPath);

    const buffer = fs.readFileSync(outPath);

    return {
      fileBase64: buffer.toString("base64"),
      fileName: `image_${Date.now()}.${cleanTarget}`
    };
  } catch (err) {
    console.error("🔥 ImageConvert Error:", err);
    throw new Error(`⚠️ فشل تحويل الصورة: ${err.message}`);
  } finally {
    safeUnlink(outPath);
  }
}