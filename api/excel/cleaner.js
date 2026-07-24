// api/excel/cleaner.js

export function cleanExcelStructure(understood) {
  const cleanedTables = [];

  understood.tables.forEach((table) => {
    const { name, columns, rows } = table;

    // إزالة الأعمدة الفارغة
    const validColumns = columns.filter(col => col && col.toString().trim() !== "");

    // بناء خريطة الأعمدة
    const columnMap = validColumns.map((col, index) => ({
      name: col,
      index
    }));

    // تنظيف الصفوف
    const cleanedRows = rows
      .map((row) => {
        const cleanRow = row.map((cell) => {
          if (cell === null || cell === undefined) return "";
          if (typeof cell === "string") return cell.trim();
          return cell;
        });
        return cleanRow;
      })
      .filter((row) => {
        return row.some(cell => cell !== "" && cell !== null);
      });

    // اكتشاف الأعمدة الناقصة
    const maxLength = Math.max(...cleanedRows.map(r => r.length));
    while (validColumns.length < maxLength) {
      validColumns.push(`عمود_${validColumns.length + 1}`);
    }

    // إعادة ترتيب الأعمدة حسب منطق البيانات
    const reorderedColumns = [...validColumns];

    // بناء جدول نظيف
    cleanedTables.push({
      name: `${name}_cleaned`,
      columns: reorderedColumns,
      rows: cleanedRows
    });
  });

  return {
    cleanedTables,
    original: understood
  };
  }
