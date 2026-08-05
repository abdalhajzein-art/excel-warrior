/**
 * api/core/excel_preview.py – Sovereign Preview & Schema Extractor
 * ⚡ استخراج معاينة الهيكل ومخطط الأعمدة ديناميكياً مع حماية ضد المعادلات.
 */

import sys
import json
import openpyxl

MAX_PREVIEW_ROWS = 15
MAX_FORMULAS = 20

def safe_str(value):
    return "" if value is None else str(value).strip()

def find_header_row_and_schema(ws, max_rows=10):
    best_row_idx = 1
    max_score = -1
    schema = {}

    if ws.max_row == 0 or ws.max_column == 0:
        return best_row_idx, schema

    for r_idx, row in enumerate(ws.iter_rows(min_row=1, max_row=max_rows, values_only=True), start=1):
        score = 0
        current_schema = {}
        for col_idx, val in enumerate(row, start=1):
            if val is not None:
                sval = str(val).strip()
                if sval:
                    # 🛡️ استبعاد خلايا المعادلات لضمان عدم الخلط بين العناوين وبيانات الجدول
                    if sval.startswith('='):
                        score -= 5
                    else:
                        score += 1
                        current_schema[col_idx] = sval
        
        if score > max_score:
            max_score = score
            best_row_idx = r_idx
            schema = current_schema
            
    return best_row_idx, schema

def extract_sheet_preview(wb, sheet_name, max_rows=MAX_PREVIEW_ROWS):
    ws = wb[sheet_name]
    header_row_idx, schema = find_header_row_and_schema(ws)

    preview_rows = []
    for row in ws.iter_rows(min_row=1, max_row=max_rows, values_only=True):
        preview_rows.append([safe_str(c) for c in row])

    merged_cells = [str(rng) for rng in list(ws.merged_cells.ranges)[:20]]

    return {
        "sheet": sheet_name,
        "rows_count": ws.max_row,
        "columns_count": ws.max_column,
        "detected_header_row": header_row_idx,
        "columns_schema": schema, 
        "preview_rows": preview_rows,
        "merged": merged_cells
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "لم يتم تمرير مسار ملف إكسل."}, ensure_ascii=False))
        return

    file_path = sys.argv[1]
    wb = None
    
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
    finally:
        if wb:
            wb.close()

if __name__ == "__main__":
    main()
