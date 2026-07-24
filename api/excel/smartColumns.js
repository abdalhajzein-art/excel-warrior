// api/excel/smartColumns.js

export function detectSmartColumns(understood) {
  const smart = [];

  understood.tables.forEach((table) => {
    const { name, columns, rows } = table;

    const columnTypes = columns.map((col, index) => {
      const values = rows.map(r => r[index]).filter(v => v !== null && v !== undefined && v !== "");

      let numbers = 0;
      let dates = 0;
      let text = 0;

      values.forEach((v) => {
        if (typeof v === "number") numbers++;
        else if (isDate(v)) dates++;
        else text++;
      });

      const total = values.length;

      const type =
        numbers === total ? "number" :
        dates === total ? "date" :
        text === total ? "text" :
        "mixed";

      return {
        column: col,
        index,
        type,
        totalValues: total,
        numericValues: numbers,
        dateValues: dates,
        textValues: text
      };
    });

    smart.push({
      table: name,
      columns: columnTypes
    });
  });

  return smart;
}

function isDate(value) {
  if (value instanceof Date) return true;
  if (typeof value === "string") {
    const d = new Date(value);
    return !isNaN(d.getTime());
  }
  return false;
        }
