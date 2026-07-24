// api/excel/keys.js

export function detectKeys(understood, smartColumns, relations) {
  const keys = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;
    const columns = smartColumns.find(t => t.table === tableName)?.columns || [];

    let primaryKey = null;
    const foreignKeys = [];

    columns.forEach((col) => {
      const colName = col.column.toLowerCase();

      // اكتشاف Primary Key
      if (
        colName === "id" ||
        colName.endsWith("id") ||
        colName.includes("key") ||
        colName.includes("pk")
      ) {
        primaryKey = col.column;
      }

      // اكتشاف Foreign Keys
      relations.forEach((rel) => {
        if (rel.fromTable === tableName && rel.fromColumn === col.column) {
          foreignKeys.push({
            column: col.column,
            references: rel.toTables
          });
        }
      });
    });

    keys.push({
      table: tableName,
      primaryKey,
      foreignKeys
    });
  });

  return keys;
      }
