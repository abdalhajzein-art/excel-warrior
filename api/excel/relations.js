// api/excel/relations.js

export function detectRelations(understood, smartColumns) {
  const relations = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;

    const tableColumns = smartColumns.find(t => t.table === tableName)?.columns || [];

    tableColumns.forEach((col) => {
      const colName = col.column;

      if (!colName) return;

      const normalized = colName.toLowerCase().replace(/[^a-z0-9]/gi, "");

      const possibleTargets = understood.tables
        .map(t => t.name)
        .filter(name => normalized.includes(name.toLowerCase()));

      if (possibleTargets.length > 0) {
        relations.push({
          fromTable: tableName,
          fromColumn: colName,
          toTables: possibleTargets
        });
      }

      if (normalized.includes("id")) {
        const target = understood.tables.find(t =>
          t.columns.some(c => c.toLowerCase().includes("id"))
        );

        if (target) {
          relations.push({
            fromTable: tableName,
            fromColumn: colName,
            toTables: [target.name]
          });
        }
      }
    });
  });

  return relations;
}
