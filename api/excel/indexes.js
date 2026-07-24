// api/excel/indexes.js

export function detectIndexes(understood, smartColumns, keys) {
  const indexes = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;

    const tableColumns = smartColumns.find(t => t.table === tableName)?.columns || [];
    const tableKeys = keys.find(k => k.table === tableName);

    const tableIndexes = [];

    // 1) فهرسة الـ Primary Key
    if (tableKeys?.primaryKey) {
      tableIndexes.push({
        column: tableKeys.primaryKey,
        reason: "Primary Key",
        type: "unique"
      });
    }

    // 2) فهرسة الـ Foreign Keys
    tableKeys?.foreignKeys?.forEach((fk) => {
      tableIndexes.push({
        column: fk.column,
        reason: "Foreign Key",
        type: "reference"
      });
    });

    // 3) فهرسة الأعمدة الرقمية الكبيرة
    tableColumns.forEach((col) => {
      if (col.type === "number" && col.totalValues > 50) {
        tableIndexes.push({
          column: col.column,
          reason: "High-volume numeric column",
          type: "performance"
        });
      }
    });

    // 4) فهرسة الأعمدة النصية اللي تُستخدم كـ Lookup
    tableColumns.forEach((col) => {
      const name = col.column.toLowerCase();
      if (
        name.includes("name") ||
        name.includes("code") ||
        name.includes("type") ||
        name.includes("category")
      ) {
        tableIndexes.push({
          column: col.column,
          reason: "Lookup text column",
          type: "lookup"
        });
      }
    });

    indexes.push({
      table: tableName,
      indexes: tableIndexes
    });
  });

  return indexes;
}
