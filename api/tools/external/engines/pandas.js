/**
 * engines/pandas.js – Sovereign Unified Data Engine (Heavy Edition)
 * نسخة موحّدة بالكامل مع باقي المحركات
 */

import fs from "fs";
import path from "path";

export default async function pandasEngine(filePath, action, params = {}) {
  try {
    switch (action) {
      case "read":
        return await readData(filePath);

      case "extract":
        return await extractData(filePath);

      case "convert":
        return await convertData(filePath, params);

      case "modify":
        return await modifyData(filePath, params);

      case "analyze":
        return await analyzeData(filePath);

      default:
        return normalizedError("عملية غير معروفة.");
    }
  } catch (err) {
    return normalizedError("خطأ أثناء معالجة البيانات.", err);
  }
}

/* ============================================================
   🟩 READ – قراءة البيانات
   ============================================================ */
async function readData(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const raw = fs.readFileSync(filePath, "utf8");

    let parsed;

    if (ext === ".json") {
      parsed = JSON.parse(raw);
    } else if (ext === ".csv") {
      parsed = parseCSV(raw);
    } else if (ext === ".tsv") {
      parsed = parseTSV(raw);
    } else {
      parsed = raw.split("\n");
    }

    return normalizedReply("تم قراءة البيانات بنجاح.", parsed);
  } catch (err) {
    return normalizedError("فشل قراءة البيانات.", err);
  }
}

/* ============================================================
   🟦 EXTRACT – استخراج الأعمدة والصفوف
   ============================================================ */
async function extractData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(raw);

    return normalizedReply("تم استخراج الأعمدة والصفوف.", {
      columns: Object.keys(rows[0] || {}),
      rows: rows.slice(0, 20)
    });
  } catch (err) {
    return normalizedError("فشل استخراج البيانات.", err);
  }
}

/* ============================================================
   🟥 CONVERT – تحويل البيانات
   ============================================================ */
async function convertData(filePath, params) {
  try {
    const ext = params.format || "json";
    const raw = fs.readFileSync(filePath, "utf8");

    let data;

    if (filePath.endsWith(".csv")) {
      data = parseCSV(raw);
    } else if (filePath.endsWith(".tsv")) {
      data = parseTSV(raw);
    } else {
      data = raw.split("\n");
    }

    const out = path.join(path.dirname(filePath), `converted_${Date.now()}.${ext}`);

    if (ext === "json") {
      fs.writeFileSync(out, JSON.stringify(data, null, 2));
    } else if (ext === "csv") {
      fs.writeFileSync(out, toCSV(data));
    }

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile(`تم تحويل البيانات إلى ${ext}.`, out, `converted.${ext}`, base64);
  } catch (err) {
    return normalizedError("فشل تحويل البيانات.", err);
  }
}

/* ============================================================
   🟧 MODIFY – تعديل البيانات
   ============================================================ */
async function modifyData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(raw);

    rows.push({ added: "تمت الإضافة", timestamp: new Date().toISOString() });

    const out = path.join(path.dirname(filePath), `modified_${Date.now()}.csv`);
    fs.writeFileSync(out, toCSV(rows));

    const base64 = fs.readFileSync(out).toString("base64");

    return normalizedFile("تم تعديل البيانات (إضافة صف جديد).", out, "modified.csv", base64);
  } catch (err) {
    return normalizedError("فشل تعديل البيانات.", err);
  }
}

/* ============================================================
   🟪 ANALYZE – تحليل البيانات
   ============================================================ */
async function analyzeData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(raw);

    return normalizedReply("تحليل البيانات مكتمل.", {
      rows: rows.length,
      columns: Object.keys(rows[0] || {}),
      sample: rows[0] || {}
    });
  } catch (err) {
    return normalizedError("فشل تحليل البيانات.", err);
  }
}

/* ============================================================
   🟫 أدوات مساعدة
   ============================================================ */
function parseCSV(text) {
  const lines = text.split("\n").filter(Boolean);
  const headers = lines[0].split(",");

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

function parseTSV(text) {
  const lines = text.split("\n").filter(Boolean);
  const headers = lines[0].split("\t");

  return lines.slice(1).map(line => {
    const values = line.split("\t");
    const obj = {};
    headers.forEach((h, i) => (obj[h] = values[i] || ""));
    return obj;
  });
}

function toCSV(rows) {
  const headers = Object.keys(rows[0] || {});
  const lines = [headers.join(",")];

  rows.forEach(row => {
    lines.push(headers.map(h => row[h]).join(","));
  });

  return lines.join("\n");
}

/* ============================================================
   🟪 طبقة توحيد الردود
   ============================================================ */
function normalizedReply(reply, data = {}) {
  return {
    ok: true,
    reply,
    data,
    fileBase64: null,
    fileName: null,
    filePath: null
  };
}

function normalizedFile(reply, filePath, fileName, base64) {
  return {
    ok: true,
    reply,
    data: null,
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
    data: null,
    fileBase64: null,
    fileName: null,
    filePath: null
  };
}