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

    // 🛠️ معالجة ذاتية للترويسة إذا كانت فارغة أو مدمجة في الصفوف الأولى
    if ((!header || header.length === 0 || header.every(h => !h || h.toString().trim() === "")) && rows && rows.length > 0) {
      let headerRowIndex = -1;
      
      // البحث في أول 3 صفوف عن صف غني بالبيانات النصية ليعتبر ترويسة
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const potentialHeader = rows[i];
        const validCellsCount = potentialHeader.filter(cell => cell !== null && cell !== undefined && cell.toString().trim() !== "").length;
        
        if (validCellsCount >= 2) { // إذا وجدنا صفاً يحتوي على أكثر من عمودين مكتوبين
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex !== -1) {
        header = rows[headerRowIndex].map(cell => (cell ? cell.toString().trim() : ""));
        // اقتطاع الصفوف لتكون تبدأ بعد صف الترويسة المكتشف
        rows = rows.slice(headerRowIndex + 1);
      }
    }

    const cleanColumns = header ? header.filter(h => h && h.toString().trim() !== "") : [];
    const cleanRows = [];

    // تنظيف الصفوف
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

    // اكتشاف الجداول
    const table = {
      name,
      columns: cleanColumns,
      rows: cleanRows,
    };

    // إضافة الجدول إذا توفرت الأعمدة والصفوف
    if (table.columns.length > 0 && table.rows.length > 0) {
      result.tables.push(table);
    } else {
      result.dashboard.push({
        sheet: name,
        note: "ورقة تحتوي على عناصر غير جدولية أو Dashboard أو تعذر استخراج ترويسة واضحة"
      });
    }

    // صفوف تعليمية
    if (teachingRows && teachingRows.length > 0) {
      result.teaching.push({
        sheet: name,
        rows: teachingRows
      });
    }

    // صفوف ملخص
    if (summaryRows && summaryRows.length > 0) {
      result.summary.push({
        sheet: name,
        rows: summaryRows
      });
    }
  });

  return result;
}
