"""
api/core/excel_preview.py – Sovereign Excel Engine (Preview & Dynamic Modifier)
⚡ استخراج المعاينة، تحليل المخطط ديناميكياً، وتنفيذ التعديلات البرمجية مع الحفاظ على التنسيقات.
"""

import sys
import json
import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Font, PatternFill, Alignment, Border

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

def execute_excel_operation(file_path, output_path, operation_type, target_keyword=None, options=None):
    """
    محرك عام لتنفيذ التعديلات (مثل إضافة أعمدة، قوائم منسدلة، وتحديث البيانات) 
    مع الاعتماد على الاكتشاف الذكي لصف الترويسة واستنساخ التنسيقات بدقة.
    """
    options = options or {}
    wb = openpyxl.load_workbook(file_path)
    ws = wb.active  # أو يمكن تطويرها لتحديد الورقة عبر options["sheet_name"]

    # 1. الاستفادة من الاكتشاف الذكي للترويسة والمخطط
    header_row_idx, schema = find_header_row_and_schema(ws)

    if operation_type == "add_column_with_dropdown":
        # البحث الديناميكي عن العمود المستهدف بناءً على الكلمة المفتاحية في المخطط المكتشف
        col_idx = None
        for c_idx, h_val in schema.items():
            if target_keyword and target_keyword in h_val:
                col_idx = c_idx
                break

        if not col_idx:
            raise ValueError(f"لم يتم العثور على عمود مطابق لـ '{target_keyword}' في الترويسة المكتشفة.")

        target_col_idx = col_idx + 1
        ws.insert_cols(target_col_idx)

        # 2. إعداد ترويسة العمود الجديد ونسخ التنسيق تماماً من العمود المرجعي
        new_header_val = options.get("new_header", "ملاحظات")
        header_cell = ws.cell(row=header_row_idx, column=target_col_idx, value=new_header_val)
        ref_header = ws.cell(row=header_row_idx, column=col_idx)
        
        header_cell.font = Font(name=ref_header.font.name, size=ref_header.font.size, bold=True, color=ref_header.font.color)
        if ref_header.fill:
            header_cell.fill = PatternFill(start_color=ref_header.fill.start_color, end_color=ref_header.fill.end_color, fill_type=ref_header.fill.fill_type)
        header_cell.alignment = Alignment(horizontal='center', vertical='center')
        header_cell.border = Border(
            left=ref_header.border.left, right=ref_header.border.right,
            top=ref_header.border.top, bottom=ref_header.border.bottom
        )

        # 3. إعداد القائمة المنسدلة إذا توفرت الخيارات
        dropdown_values = options.get("dropdown_values", [])
        dv = None
        if dropdown_values:
            reasons_str = '"' + ','.join(dropdown_values) + '"'
            dv = DataValidation(type="list", formula1=reasons_str, allow_blank=True)
            ws.add_data_validation(dv)

        # 4. تطبيق التنسيقات والقوائم المنسدلة على صفوف البيانات ابتداءً من أسفل الترويسة
        for row in range(header_row_idx + 1, ws.max_row + 1):
            cell = ws.cell(row=row, column=target_col_idx)
            ref_data = ws.cell(row=row, column=col_idx)
            
            cell.font = Font(name=ref_data.font.name, size=ref_data.font.size, color=ref_data.font.color)
            cell.alignment = Alignment(horizontal='center', vertical='center')
            cell.border = Border(
                left=ref_data.border.left, right=ref_data.border.right,
                top=ref_data.border.top, bottom=ref_data.border.bottom
            )
            if dv:
                dv.add(cell)

    wb.save(output_path)
    wb.close()
    return {"status": "success", "output": output_path, "message": "تم تنفيذ العملية بنجاح."}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "لم يتم تمرير مسار ملف إكسل."}, ensure_ascii=False))
        return

    file_path = sys.argv[1]
    
    # 🎯 الحالة الأولى: إذا تم تمرير معامل ثاني (بيانات العملية بصيغة JSON) -> تنفيذ تعديل
    if len(sys.argv) >= 3:
        try:
            op_data = json.loads(sys.argv[2])
            output_path = op_data.get("output_path", file_path.replace(".xlsx", "_modified.xlsx"))
            operation_type = op_data.get("operation_type")
            target_keyword = op_data.get("target_keyword")
            options = op_data.get("options", {})
            
            result = execute_excel_operation(file_path, output_path, operation_type, target_keyword, options)
            print(json.dumps(result, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"error": str(e)}, ensure_ascii=False))
        return

    # 🔍 الحالة الثانية: المعاينة الافتراضية واستخراج المخطط (عند تمرير الملف وحده)
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
            try:
                wb.close()
            except:
                pass

if __name__ == "__main__":
    main()
