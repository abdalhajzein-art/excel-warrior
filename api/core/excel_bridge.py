# api/core/excel_bridge.py
import sys
import json
import openpyxl
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.datavalidation import DataValidation

def copy_cell_style(source_cell, target_cell):
    """نسخ التنسيقات والأنماط من خلية لأخرى للحفاظ على مظهر الملف الأصلي"""
    if source_cell.font:
        target_cell.font = Font(
            name=source_cell.font.name,
            size=source_cell.font.size,
            bold=source_cell.font.bold,
            italic=source_cell.font.italic,
            color=source_cell.font.color
        )
    if source_cell.fill and source_cell.fill.fill_type:
        target_cell.fill = PatternFill(
            fill_type=source_cell.fill.fill_type,
            start_color=source_cell.fill.start_color,
            end_color=source_cell.fill.end_color
        )
    if source_cell.alignment:
        target_cell.alignment = Alignment(
            horizontal=source_cell.alignment.horizontal,
            vertical=source_cell.alignment.vertical,
            wrap_text=source_cell.alignment.wrap_text
        )
    if source_cell.border:
        target_cell.border = Border(
            left=source_cell.border.left,
            right=source_cell.border.right,
            top=source_cell.border.top,
            bottom=source_cell.border.bottom
        )

def execute_operations(file_path, operations):
    try:
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        execution_log = []
        
        for idx, op in enumerate(operations):
            op_type = op.get("type")
            
            # 1. التنفيذ البرمجي الديناميكي (إذا أرسل جيميناي كود بايثون)
            if op_type == "execute_code" or "code" in op:
                code_snippet = op.get("code")
                if not code_snippet:
                    raise ValueError("لم يتم توفير كود بايثون لتنفيذه في الجسر.")
                
                local_scope = {
                    "wb": wb, "ws": ws, "openpyxl": openpyxl, "pd": pd,
                    "Font": Font, "PatternFill": PatternFill, "Alignment": Alignment,
                    "Border": Border, "Side": Side, "DataValidation": DataValidation,
                    "get_column_letter": get_column_letter,
                    "column_index_from_string": column_index_from_string
                }
                exec(code_snippet, {"__builtins__": __builtins__}, local_scope)
                execution_log.append(f"تم تنفيذ السكريبت البرمجي الديناميكي رقم {idx + 1} بنجاح.")

            # 2. إضافة عمود جديد مع نسخ التنسيقات والقوائم المنسدلة
            elif op_type == "add_column":
                header = op.get("header", "عمود جديد")
                after_col_name = op.get("after")
                dropdown_options = op.get("dropdown_options")
                default_value = op.get("default_value", "-")
                
                header_row = op.get("header_row", None)
                target_col = ws.max_column + 1
                
                if after_col_name:
                    found = False
                    for r in range(1, 6):
                        for c in range(1, ws.max_column + 1):
                            val = ws.cell(row=r, column=c).value
                            if val and str(val).strip() == str(after_col_name).strip():
                                header_row = r
                                target_col = c + 1
                                found = True
                                break
                        if found:
                            break
                
                if not header_row:
                    header_row = 3
                
                ws.insert_cols(target_col)
                header_cell = ws.cell(row=header_row, column=target_col, value=header)
                ref_col = target_col - 1 if target_col > 1 else target_col + 1
                ref_header = ws.cell(row=header_row, column=ref_col)
                copy_cell_style(ref_header, header_cell)
                
                for r in range(header_row + 1, ws.max_row + 1):
                    cell = ws.cell(row=r, column=target_col, value=default_value)
                    ref_data = ws.cell(row=r, column=ref_col)
                    copy_cell_style(ref_data, cell)
                
                if dropdown_options:
                    dv = DataValidation(type="list", formula1=f'"{dropdown_options}"', allow_blank=True)
                    ws.add_data_validation(dv)
                    col_letter = get_column_letter(target_col)
                    dv.add(f"{col_letter}{header_row + 1}:{col_letter}{ws.max_row}")
                
                execution_log.append(f"تم إضافة العمود '{header}' بنجاح.")

            # 3. تعديل خلية
            elif op_type == "update_cell":
                address = op.get("address")
                value = op.get("value")
                if address:
                    ws[address] = value
                    execution_log.append(f"تم تحديث الخلية {address}.")

            # 4. حذف عمود
            elif op_type == "delete_column":
                col_name = op.get("header")
                if col_name:
                    for r in range(1, 6):
                        for c in range(1, ws.max_column + 1):
                            val = ws.cell(row=r, column=c).value
                            if val and str(val).strip() == str(col_name).strip():
                                ws.delete_cols(c)
                                execution_log.append(f"تم حذف العمود '{col_name}'.")
                                break

            # 5. تطبيق معادلة
            elif op_type == "apply_formula":
                address = op.get("address")
                formula = op.get("formula")
                if address and formula:
                    ws[address] = formula
                    execution_log.append(f"تم تطبيق المعادلة على الخلية {address}.")

            else:
                raise ValueError(f"نوع العملية غير معروف أو غير مدعوم: {op_type}")
        
        wb.save(file_path)
        return {
            "success": True, 
            "message": "تم تنفيذ العمليات بنجاح وتحديث الملف",
            "log": execution_log
        }
        
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "trace_hint": "راجع صياغة العمليات أو كود البايثون المُرسل."
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "المعلمات غير كافية، يرجى تمرير مسار الملف وسلسلة العمليات بصيغة JSON."}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    operations_json = sys.argv[2]
    
    try:
        operations = json.loads(operations_json)
    except json.JSONDecodeError as jde:
        print(json.dumps({"success": False, "error": f"خطأ في تحليل صيغة JSON: {str(jde)}"}))
        sys.exit(1)
        
    result = execute_operations(file_path, operations)
    print(json.dumps(result))
