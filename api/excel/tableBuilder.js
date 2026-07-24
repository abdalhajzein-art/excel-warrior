// api/excel/tableBuilder.js

export function buildSmartTables(
  understood,
  cleaned,
  smartColumns,
  relations,
  keys,
  indexes,
  constraints,
  defaultValues,
  autoFilled
) {
  const built = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;

    const cleanTable = cleaned.cleanedTables.find(t => t.name.includes(tableName));
    const autoTable = autoFilled.find(t => t.table === tableName);

    const cols = smartColumns.find(t => t.table === tableName)?.columns || [];
    const defs = defaultValues.find(t => t.table === tableName)?.defaults || [];
    const rels = relations.filter(r => r.fromTable === tableName);
    const pk = keys.find(k => k.table === tableName)?.primaryKey;
    const fks = keys.find(k => k.table === tableName)?.foreignKeys || [];
    const idx = indexes.find(i => i.table === tableName)?.indexes || [];
    const cons = constraints.find(c => c.table === tableName)?.constraints || [];

    const finalColumns = cols.map((col) => {
      const def = defs.find(d => d.column === col.column);
      const fk = fks.find(f => f.column === col.column);
      const con = cons.filter(c => c.column === col.column);
      const index = idx.find(i => i.column === col.column);

      return {
        name: col.column,
        type: col.type,
        default: def?.defaultValue || null,
        primaryKey: pk === col.column,
        foreignKey: fk ? fk.references : null,
        constraints: con || [],
        index: index || null
      };
    });

    const finalRows = autoTable?.rows || cleanTable?.rows || table.rows;

    built.push({
      table: tableName + "_rebuilt",
      columns: finalColumns,
      rows: finalRows
    });
  });

  return built;
}
