// api/excel/understanding.js

export function understandExcel(sheets) {
  const result = {
    tables: [],
    teaching: [],
    summary: [],
    dashboard: [],
    rawSheets: sheets
  };

  if (!sheets || !Array.isArray(sheets)) {
    return result;
  }

  sheets.forEach((sheet) => {
    let { name, header, rows, teachingRows, summaryRows } = sheet;

    let headerRowIndex = -1;

    // 🧠 الخوارزمية الشاملة لاكتشاف الرأس الحقيقي في أي إكسل (حتى لو كان متأخراً أو تحته ترويسات)
    if (rows && rows.length > 0) {
      // نبحث في أول 7 صفوف عن الصف الأنسب ليكون ترويسة جدول
      for (let i = 0; i < Math.min(7, rows.length); i++) {
        const potentialRow = rows[i];
        if (!Array.isArray(potentialRow)) continue;

        // عد الخلايا التي تحتوي على نصوص صالحة وليست فارغة
        const validCells = potentialRow.filter(cell => cell !== null && cell !== undefined && cell.toString().trim() !== "");
        
        // شروط اعتبار الصف هو "الرأس الحقيقي":
        // 1. يحتوي على أكثر من عمودين نصيين.
        // 2. أو يحتوي على كلمات مفتاحية شائعة للجداول (مثل: رقم، اسم، ID، Name، تاريخ، Date، قسم، Total، إجمالي...).
        const hasKeywords = validCells.some(cell => {
          const text = cell.toString().trim().toLowerCase();
          return ["رقم", "اسم", "id", "name", "code", "القسم", "التاريخ", "date", "total", "الإجمالي", "الحالة", "status"].some(k => text.includes(k));
        });

        if (hasKeywords || validCells.length >= 3) {
          headerRowIndex = i;
          break;
        }
      }

      // إذا وجدنا صف رأس دقيق، نعتبره هو الـ Header ونقتطع الصفوف التي تليه كبيانات
      if (headerRowIndex !== -1) {
        header = rows[headerRowIndex].map(cell => (cell ? cell.toString().trim() : ""));
        rows = rows.slice(headerRowIndex + 1);
      } else if (!header || header.length === 0 || header.every(h => !h || h.toString().trim() === "")) {
        // كحل أخير إذا لم نجد كلمات مفتاحية، نأخذ أول صف كافتراضي
        header = rows[0].map(cell => (cell ? cell.toString().trim() : ""));
        rows = rows.slice(1);
      }
    }

    const cleanColumns = header ? header.filter(h => h && h.toString().trim() !== "") : [];
    const cleanRows = [];

    // تنظيف الصفوف بدقة متناهية
    if (rows && Array.isArray(rows)) {
      rows.forEach((row) => {
        if (!Array.isArray(row)) return;
        const cleanRow = row.map((cell) => {
          if (cell === null || cell === undefined) return "";
          if (typeof cell === "string") return cell.trim();
          return cell;
        });

        // تجاهل الصفوف الفارغة كلياً
        const isEmpty = cleanRow.every(c => c === "" || c === null);
        if (!isEmpty) cleanRows.push(cleanRow);
      });
    }

    // اكتشاف الجدول
    const table = {
      name,
      columns: cleanColumns,
      rows: cleanRows,
    };

    if (table.columns.length > 0 && table.rows.length > 0) {
      result.tables.push(table);
    } else {
      result.dashboard.push({
        sheet: name,
        note: "ورقة تحتوي على عناصر غير جدولية أو Dashboard أو بيانات مخصصة"
      });
    }

    if (teachingRows && teachingRows.length > 0) {
      result.teaching.push({ sheet: name, rows: teachingRows });
    }

    if (summaryRows && summaryRows.length > 0) {
      result.summary.push({ sheet: name, rows: summaryRows });
    }
  });

  return result;
}
