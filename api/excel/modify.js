import * as XLSX from "xlsx";

/* ============================
   المطابقة الذكية للهيدر
============================ */
function normalizeArabic(text) {
  return text
    .replace(/[أإآا]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^ء-ي0-9 ]/g, "")
    .trim();
}

function findClosestHeader(userWord, headers) {
  const normalizedUser = normalizeArabic(userWord);

  let bestMatch = null;
  let bestScore = 0;

  headers.forEach(h => {
    const normalizedHeader = normalizeArabic(h);

    let score = 0;

    if (normalizedHeader === normalizedUser) score += 5;
    if (normalizedHeader.includes(normalizedUser)) score += 3;
    if (normalizedUser.includes(normalizedHeader)) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = h;
    }
  });

  return bestMatch;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { base64, editMap } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "لا يوجد ملف Excel مرفوع." });
    }

    if (!editMap) {
      return res.status(400).json({ error: "لا يوجد خريطة تعديل (editMap)." });
    }

    // فك ترميز الملف
    const fileBuffer = Buffer.from(base64, "base64");
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = json[0]; // صف الهيدر الحقيقي

    /* ============================
       معالجة نوع التعديل
============================ */
    if (editMap.action === "add_column") {
      const headerName = editMap.headerName || "عمود جديد";
      const userReference = editMap.positionAfter;

      // مطابقة ذكية للعمود
      const matchedHeader = findClosestHeader(userReference, headers);

      if (!matchedHeader) {
        return res.status(400).json({
          error: `لم يتم العثور على عمود مطابق لـ "${userReference}".`
        });
      }

      const insertIndex = headers.indexOf(matchedHeader) + 1;

      // إضافة الهيدر الجديد
      headers.splice(insertIndex, 0, headerName);

      // إضافة القيم الافتراضية لكل صف
      for (let i = 1; i < json.length; i++) {
        json[i].splice(insertIndex, 0, editMap.defaultValue || "");
      }
    }

    /* ============================
       إعادة بناء الملف
============================ */
    const newSheet = XLSX.utils.aoa_to_sheet(json);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

    const excelBuffer = XLSX.write(newWorkbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");

    return res.send(excelBuffer);

  } catch (error) {
    console.error("خطأ أثناء تعديل الملف:", error);
    return res.status(500).json({ error: "خطأ أثناء تعديل الملف." });
  }
      }
