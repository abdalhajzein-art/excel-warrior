import ExcelJS from "exceljs";

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

    if (!base64) return res.status(400).json({ error: "لا يوجد ملف Excel مرفوع." });
    if (!editMap) return res.status(400).json({ error: "لا يوجد خريطة تعديل (editMap)." });

    // فك ترميز الملف
    const buffer = Buffer.from(base64, "base64");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];

    // قراءة الهيدر الحقيقي
    const headers = sheet.getRow(1).values.slice(1); // إزالة أول عنصر فارغ

    /* ============================
       تنفيذ التعديل
============================ */
    if (editMap.action === "add_column") {
      const headerName = editMap.headerName || "عمود جديد";
      const userReference = editMap.positionAfter;

      const matchedHeader = findClosestHeader(userReference, headers);

      if (!matchedHeader) {
        return res.status(400).json({
          error: `لم يتم العثور على عمود مطابق لـ "${userReference}".`
        });
      }

      const insertIndex = headers.indexOf(matchedHeader) + 2; // +2 لأن ExcelJS يبدأ من 1

      // إضافة الهيدر الجديد
      sheet.getRow(1).splice(insertIndex, 0, headerName);

      // إضافة القيم الافتراضية
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.splice(insertIndex, 0, editMap.defaultValue || "—");
      });
    }

    /* ============================
       إعادة بناء الملف
============================ */
    const outputBuffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=modified.xlsx");

    return res.send(Buffer.from(outputBuffer));

  } catch (error) {
    console.error("خطأ أثناء تعديل الملف:", error);
    return res.status(500).json({ error: "خطأ أثناء تعديل الملف." });
  }
         }
