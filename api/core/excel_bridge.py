# api/core/excel_bridge.py
import sys
import json
import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def copy_cell_style(source_cell, target_cell):
    """نسخ التنسيقات والأنماط بدقة متناهية للحفاظ على الهوية البصرية للملف"""
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
            
            # 1. إضافة عمود جديد مع دعم القوائم المنسدلة والتنسيق التلقائي
            if op_type == "add_column":
                header = op.get("header")
                after_col_name = op.get("after")
                dropdown_options = op.get("dropdown_options") 
                default_value = op.get("default_value", "-")
                header_row = op.get("header_row", 3) 
                
                target_col = ws.max_column + 1
                
                if after_col_name:
                    for col in range(1, ws.max_column + 1):
                        cell_val = ws.cell(row=header_row, column=col).value
                        if cell_val and str(cell_val).strip() == str(after_col_name).strip():
                            target_col = col + 1
                            break
                
                # إدراج العمود
                ws.insert_cols(target_col)
                
                # تعيين العنوان والتنسيق
                header_cell = ws.cell(row=header_row, column=target_col, value=header)
                ref_col_idx = target_col - 1 if target_col > 1 else target_col + 1
                reference_cell = ws.cell(row=header_row, column=ref_col_idx)
                copy_cell_style(reference_cell, header_cell)
                
                # تعيين القيم والأنماط لباقي خلايا العمود
                for r in range(header_row + 1, ws.max_row + 1):
                    cell = ws.cell(row=r, column=target_col, value=default_value)
                    ref_data_cell = ws.cell(row=r, column=ref_col_idx)
                    copy_cell_style(ref_data_cell, cell)
                
                # إضافة القائمة المنسدلة بشكل آمن ومحصن
                if dropdown_options:
                    # تنظيف الخيارات وفصلها بفاصلة مقبولة
                    formatted_options = dropdown_options.replace('"', '')
                    dv = DataValidation(type="list", formula1=f'"{formatted_options}"', allow_blank=True)
                    ws.add_data_validation(dv)
                    col_letter = get_column_letter(target_col)
                    dv.add(f"{col_letter}{header_row + 1}:{col_letter}{ws.max_row}")
                
                execution_log.append(f"تم إضافة العمود '{header}' بنجاح في الموقع {target_col}")

            # 2. تعديل خلية محددة
            elif op_type == "update_cell":
                address = op.get("address")
                value = op.get("value")
                ws[address] = value
                execution_log.append(f"تم تحديث الخلية {address} إلى القيمة '{value}'")

            # 3. حذف عمود
            elif op_type == "delete_column":
                col_name = op.get("header")
                header_row = op.get("header_row", 3)
                if col_name:
                    for col in range(1, ws.max_column + 1):
                        if str(ws.cell(row=header_row, column=col).value).strip() == str(col_name).strip():
                            ws.delete_cols(col)
                            execution_log.append(f"تم حذف العمود '{col_name}' بنجاح")
                            break

            # 4. تنفيذ صيغة مخصصة أو حسابية على مدى معين
            elif op_type == "apply_formula":
                address = op.get("address")
                formula = op.get("formula")
                ws[address] = formula
                execution_log.append(f"تم تطبيق المعادلة {formula} على الخلية {address}")

        wb.save(file_path)
        return {
            "success": True, 
            "message": "تم تنفيذ كافة العمليات بنجاح تام",
            "log": execution_log
        }
        
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "trace_hint": "تأكد من صحة إحداثيات الخلايا أو أسماء الأعمدة المطابقة لترويسة الجدول."
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
