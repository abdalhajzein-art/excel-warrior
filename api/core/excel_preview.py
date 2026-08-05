import sys
import json
import openpyxl

MAX_PREVIEW_ROWS = 15
MAX_FORMULAS = 20

def safe_str(value):
    return "" if value is None else str(value).strip()

def find_header_row_and_schema(ws, max_rows=10):
    # خوارزمية ذكية للعثور على صف العناوين (الصف الذي يحتوي أكبر عدد من النصوص)
    best_row_idx = 1
    max_text_cells = 0
    schema = {}

    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
        text_cells = sum(1 for c in row if c and str(c).strip())
        if text_cells > max_text_cells:
            max_text_cells = text_cells
            best_row_idx = r_idx
            schema = {col_idx: safe_str(val) for col_idx, val in enumerate(row, start=1) if val}
            
    return best_row_idx, schema

def extract_sheet_preview(wb, sheet_name, max_rows=MAX_PREVIEW_ROWS):
    ws = wb[sheet_name]
    header_row_idx, schema = find_header_row_and_schema(ws)

    preview_rows = []
    for row in ws.iter_rows(min_row=1, max_row=max_rows, values_only=True):
        preview_rows.append([safe_str(c) for c in row])

    # تقليل حجم البيانات المدمجة لتخفيف الضغط على التوكنز
    merged_cells = [str(rng) for rng in ws.merged_cells.ranges][:20]

    return {
        "sheet": sheet_name,
        "rows_count": ws.max_row,
        "columns_count": ws.max_column,
        "detected_header_row": header_row_idx,
        "columns_schema": schema, # هذا ما سيقرأه النموذج ليعرف أسماء الأعمدة بدقة
        "preview_rows": preview_rows,
        "merged": merged_cells
    }

def main():
    try:
        file_path = sys.argv[1]
    except IndexError:
        print(json.dumps({"error": "لم يتم تمرير مسار ملف إكسل."}, ensure_ascii=False))
        return

    try:
        wb = openpyxl.load_workbook(file_path, data_only=False)
        output = {
            "file": file_path,
            "sheets_count": len(wb.sheetnames),
            "sheets": wb.sheetnames,
            "previews": [extract_sheet_preview(wb, sheet) for sheet in wb.sheetnames]
        }
        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
