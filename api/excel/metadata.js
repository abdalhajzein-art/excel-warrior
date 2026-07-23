import ExcelJS from 'exceljs';

export async function extractExcelMetadata(buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return { success: false, error: "لا توجد ورقة عمل في الملف." };
    }

    let headers = [];
    let sampleRows = [];
    let rowCount = worksheet.rowCount;

    // استخلاص الأعمدة وعينة خفيفة من أول 3 صفوف لتوفير التوكنز
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => {
          headers.push(cell.value ? cell.value.toString().trim() : '');
        });
      } else if (rowNumber > 1 && rowNumber <= 4) {
        let rowData = {};
        row.eachCell((cell, colNum) => {
          const headerName = headers[colNum - 1] || `Col_${colNum}`;
          rowData[headerName] = cell.value;
        });
        sampleRows.push(rowData);
      }
    });

    return {
      success: true,
      metadata: {
        totalRows: rowCount,
        columns: headers,
        sampleData: sampleRows
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
