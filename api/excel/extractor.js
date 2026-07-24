// api/excel/extractor.js

export function extractMultipleTables(understood) {
  const extracted = [];

  understood.rawSheets.forEach((sheet) => {
    const { name, header, rows } = sheet;

    if (!rows || rows.length === 0) return;

    let currentTable = null;

    rows.forEach((row, idx) => {
      const hasData = row.some(
        cell => cell !== null && cell !== undefined && cell !== ""
      );

      if (!hasData) {
        if (currentTable && currentTable.rows.length > 0) {
          extracted.push({ ...currentTable });
        }
        currentTable = null;
        return;
      }

      if (!currentTable) {
        currentTable = {
          sheet: name,
          startRow: idx + 2,
          header: header,
          rows: []
        };
      }

      currentTable.rows.push(row);
    });

    if (currentTable && currentTable.rows.length > 0) {
      extracted.push(currentTable);
    }
  });

  return extracted;
        }
