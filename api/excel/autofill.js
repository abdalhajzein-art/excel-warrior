// api/excel/autofill.js

export function autoFillData(understood, smartColumns, relations, keys, defaultValues) {
  const autoFilled = [];

  understood.tables.forEach((table) => {
    const tableName = table.name;
    const columns = smartColumns.find(t => t.table === tableName)?.columns || [];
    const tableDefaults = defaultValues.find(d => d.table === tableName)?.defaults || [];
    const tableRelations = relations.filter(r => r.fromTable === tableName);
    const tableKeys = keys.find(k => k.table === tableName);

    const newRows = table.rows.map((row) => {
      const filledRow = [...row];

      columns.forEach((col) => {
        const index = col.index;
        const value = filledRow[index];

        // إذا القيمة موجودة → لا نلمسها
        if (value !== "" && value !== null && value !== undefined) return;

        let newValue = null;

        // 1) إذا في قيمة افتراضية
        const def = tableDefaults.find(d => d.column === col.column);
        if (def?.defaultValue) {
          newValue = def.defaultValue;
        }

        // 2) إذا العمود Foreign Key → نجيب قيمة من جدول مرتبط
        if (!newValue) {
          const rel = tableRelations.find(r => r.fromColumn === col.column);
          if (rel) {
            const targetTable = understood.tables.find(t => t.name === rel.toTables[0]);
            if (targetTable) {
              const targetCol = targetTable.columns[0];
              const firstValue = targetTable.rows[0]?.[0];
              if (firstValue) newValue = firstValue;
            }
          }
        }

        // 3) إذا العمود Primary Key → نولّد رقم جديد
        if (!newValue && tableKeys?.primaryKey === col.column) {
          const nums = table.rows
            .map(r => r[index])
            .filter(v => typeof v === "number")
            .sort((a, b) => b - a);

          newValue = nums.length > 0 ? nums[0] + 1 : 1;
        }

        // 4) إذا العمود نصي → نولّد نص ذكي
        if (!newValue && col.type === "text") {
          newValue = `${col.column}_value`;
        }

        // 5) إذا العمود رقمي → نولّد رقم بسيط
        if (!newValue && col.type === "number") {
          newValue = 1;
        }

        // 6) إذا العمود تاريخ → تاريخ اليوم
        if (!newValue && col.type === "date") {
          newValue = new Date().toISOString().split("T")[0];
        }

        filledRow[index] = newValue;
      });

      return filledRow;
    });

    autoFilled.push({
      table: tableName,
      rows: newRows
    });
  });

  return autoFilled;
        }
