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
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  try {
    const { base64, editMap } = req.body;

    if (!base64) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "لا يوجد ملف Excel مرفوع." }));
    }

    const buffer = Buffer.from(base64, "base64");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];

    const headers = sheet.getRow(1).values.slice(1);

    /* ============================
       تنفيذ التعديل
============================ */
    if (editMap.operation === "add_column") {
      const newColumnName = editMap.new_column.name || editMap.new_column;
      const userReference = editMap.position.after;

      const matchedHeader = findClosestHeader(userReference, headers);

      if (!matchedHeader) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: `لم يتم العثور على عمود مطابق لـ "${userReference}".`
        }));
      }

      const insertIndex = headers.indexOf(matchedHeader) + 2;

      // إضافة عمود جديد بالكامل
      sheet.spliceColumns(insertIndex, 0, [newColumnName]);

      // تلوين العمود إذا طلب المستخدم
      if (editMap.new_column.style) {
        const col = sheet.getColumn(insertIndex);

        col.eachCell((cell, rowNumber) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: editMap.new_column.style.backgroundColor.replace("#", "") }
          };

          if (editMap.new_column.style.fontWeight === "bold") {
            cell.font = { bold: true };
          }
        });
      }
    }

    /* ============================
       إعادة بناء الملف
============================ */
    const outputBuffer = await workbook.xlsx.writeBuffer();

    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=modified.xlsx",
      "Content-Length": Buffer.byteLength(outputBuffer)
    });

    return res.end(Buffer.from(outputBuffer));

  } catch (error) {
    console.error("خطأ أثناء تعديل الملف:", error);

    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "خطأ أثناء تعديل الملف." }));
  }
    }
