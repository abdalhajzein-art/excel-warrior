# api/core/excel_bridge.py
import sys
import json
import openpyxl
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.datavalidation import DataValidation

# =========================
# أدوات مساعدة عامة
# =========================

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

def find_header_column(ws, header_name, search_rows=6):
    """البحث عن عمود حسب اسم الهيدر ضمن أول عدد من الصفوف"""
    for r in range(1, search_rows + 1):
        for c in range(1, ws.max_column + 1):
            val = ws.cell(row=r, column=c).value
            if val and str(val).strip() == str(header_name).strip():
                return r, c
    return None, None

def get_sheet(wb, op):
    """تحديد الشيت المستهدف من العملية، أو الشيت النشط كافتراضي"""
    sheet_name = op.get("sheet")
    if sheet_name:
        if sheet_name in wb.sheetnames:
            return wb[sheet_name]
        else:
            raise ValueError(f"الشيت المطلوب غير موجود: {sheet_name}")
    return wb.active

# =========================
# عمليات الأعمدة
# =========================

def op_add_column(wb, ws, op, log):
    header = op.get("header", "عمود جديد")
    after_col_name = op.get("after")
    dropdown_options = op.get("dropdown_options")
    default_value = op.get("default_value", "-")
    header_row = op.get("header_row", None)

    target_col = ws.max_column + 1

    if after_col_name:
        hr, hc = find_header_column(ws, after_col_name)
        if hc:
            header_row = hr
            target_col = hc + 1

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

    log.append(f"تم إضافة العمود '{header}' بنجاح.")

def op_delete_column(wb, ws, op, log):
    col_name = op.get("header")
    if not col_name:
        raise ValueError("لم يتم توفير اسم الهيدر لحذف العمود.")
    hr, hc = find_header_column(ws, col_name)
    if hc:
        ws.delete_cols(hc)
        log.append(f"تم حذف العمود '{col_name}'.")
    else:
        log.append(f"لم يتم العثور على العمود '{col_name}' لحذفه.")

def op_rename_column(wb, ws, op, log):
    old_name = op.get("old_header")
    new_name = op.get("new_header")
    if not old_name or not new_name:
        raise ValueError("يجب توفير old_header و new_header لإعادة تسمية العمود.")
    hr, hc = find_header_column(ws, old_name)
    if hc:
        ws.cell(row=hr, column=hc, value=new_name)
        log.append(f"تم تغيير اسم العمود من '{old_name}' إلى '{new_name}'.")
    else:
        log.append(f"لم يتم العثور على العمود '{old_name}' لإعادة تسميته.")

def op_set_column_width(wb, ws, op, log):
    header = op.get("header")
    width = op.get("width")
    if not header or width is None:
        raise ValueError("يجب توفير header و width لضبط عرض العمود.")
    hr, hc = find_header_column(ws, header)
    if hc:
        col_letter = get_column_letter(hc)
        ws.column_dimensions[col_letter].width = width
        log.append(f"تم ضبط عرض العمود '{header}' إلى {width}.")
    else:
        log.append(f"لم يتم العثور على العمود '{header}' لضبط عرضه.")

# =========================
# عمليات الصفوف
# =========================

def op_add_row(wb, ws, op, log):
    row_index = op.get("row_index", ws.max_row + 1)
    ws.insert_rows(row_index)
    log.append(f"تم إضافة صف جديد في الموقع {row_index}.")

def op_delete_row(wb, ws, op, log):
    row_index = op.get("row_index")
    if not row_index:
        raise ValueError("يجب توفير row_index لحذف صف.")
    ws.delete_rows(row_index)
    log.append(f"تم حذف الصف رقم {row_index}.")

# =========================
# عمليات الخلايا
# =========================

def op_update_cell(wb, ws, op, log):
    address = op.get("address")
    value = op.get("value")
    if not address:
        raise ValueError("لم يتم توفير عنوان الخلية لتحديثها.")
    ws[address] = value
    log.append(f"تم تحديث الخلية {address}.")

def op_apply_formula(wb, ws, op, log):
    address = op.get("address")
    formula = op.get("formula")
    if not address or not formula:
        raise ValueError("يجب توفير address و formula لتطبيق المعادلة.")
    ws[address] = formula
    log.append(f"تم تطبيق المعادلة على الخلية {address}.")

def op_merge_cells(wb, ws, op, log):
    range_ref = op.get("range")
    if not range_ref:
        raise ValueError("يجب توفير range لدمج الخلايا.")
    ws.merge_cells(range_ref)
    log.append(f"تم دمج النطاق {range_ref}.")

def op_unmerge_cells(wb, ws, op, log):
    range_ref = op.get("range")
    if not range_ref:
        raise ValueError("يجب توفير range لفك دمج الخلايا.")
    ws.unmerge_cells(range_ref)
    log.append(f"تم فك دمج النطاق {range_ref}.")

# =========================
# عمليات الشيتات
# =========================

def op_sheet_select(wb, ws, op, log):
    sheet_name = op.get("sheet")
    if not sheet_name:
        raise ValueError("يجب توفير اسم الشيت لاختياره.")
    if sheet_name not in wb.sheetnames:
        raise ValueError(f"الشيت المطلوب غير موجود: {sheet_name}")
    log.append(f"تم اختيار الشيت '{sheet_name}'.")
    return wb[sheet_name]

def op_sheet_create(wb, ws, op, log):
    sheet_name = op.get("sheet_name", "Sheet_New")
    if sheet_name in wb.sheetnames:
        log.append(f"الشيت '{sheet_name}' موجود مسبقاً، لن يتم إنشاؤه مرة أخرى.")
        return wb[sheet_name]
    new_ws = wb.create_sheet(title=sheet_name)
    log.append(f"تم إنشاء الشيت الجديد '{sheet_name}'.")
    return new_ws

def op_sheet_delete(wb, ws, op, log):
    sheet_name = op.get("sheet_name")
    if not sheet_name:
        raise ValueError("يجب توفير sheet_name لحذف الشيت.")
    if sheet_name not in wb.sheetnames:
        log.append(f"الشيت '{sheet_name}' غير موجود، لن يتم حذفه.")
        return ws
    target_ws = wb[sheet_name]
    wb.remove(target_ws)
    log.append(f"تم حذف الشيت '{sheet_name}'.")
    return wb.active

# =========================
# عمليات النطاقات الأساسية والمتقدمة
# =========================

def op_clear_range(wb, ws, op, log):
    range_ref = op.get("range")
    if not range_ref:
        raise ValueError("يجب توفير range لمسح النطاق.")
    for row in ws[range_ref]:
        for cell in row:
            cell.value = None
    log.append(f"تم مسح محتوى النطاق {range_ref}.")

def op_color_range(wb, ws, op, log):
    range_ref = op.get("range")
    fill_color = op.get("fill_color", "FFFF00")  # أصفر افتراضي
    if not range_ref:
        raise ValueError("يجب توفير range لتلوين النطاق.")
    fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
    for row in ws[range_ref]:
        for cell in row:
            cell.fill = fill
    log.append(f"تم تلوين النطاق {range_ref} باللون {fill_color}.")

def op_border_range(wb, ws, op, log):
    range_ref = op.get("range")
    border_style = op.get("border_style", "thin")
    border_color = op.get("border_color", "000000")
    if not range_ref:
        raise ValueError("يجب توفير range لإضافة حدود للنطاق.")
    border = Border(
        left=Side(style=border_style, color=border_color),
        right=Side(style=border_style, color=border_color),
        top=Side(style=border_style, color=border_color),
        bottom=Side(style=border_style, color=border_color),
    )
    for row in ws[range_ref]:
        for cell in row:
            cell.border = border
    log.append(f"تم إضافة حدود للنطاق {range_ref}.")

def op_fill_range(wb, ws, op, log):
    range_ref = op.get("range")
    value = op.get("value", "")
    if not range_ref:
        raise ValueError("يجب توفير range لتعبئة النطاق.")
    for row in ws[range_ref]:
        for cell in row:
            cell.value = value
    log.append(f"تم تعبئة النطاق {range_ref} بالقيمة '{value}'.")

# =========================
# تنسيق جداول بسيطة
# =========================

def op_format_table_simple(wb, ws, op, log):
    range_ref = op.get("range")
    header_row = op.get("header_row", None)
    if not range_ref:
        raise ValueError("يجب توفير range لتنسيق الجدول.")
    rows = list(ws[range_ref])
    if not rows:
        return
    if header_row is None:
        header_row = rows[0][0].row

    # رؤوس غامقة وخلفية خفيفة
    header_fill = PatternFill(start_color="DDDDDD", end_color="DDDDDD", fill_type="solid")
    header_font = Font(bold=True)
    for cell in ws[header_row]:
        cell.fill = header_fill
        cell.font = header_font

    # صفوف متناوبة
    alt_fill = PatternFill(start_color="F7F7F7", end_color="F7F7F7", fill_type="solid")
    for row in rows[1:]:
        if row[0].row % 2 == 0:
            for cell in row:
                cell.fill = alt_fill

    log.append(f"تم تنسيق الجدول في النطاق {range_ref} بشكل بسيط.")

# =========================
# عمليات تحليلية عبر pandas (Pivot / GroupBy / Summary)
# =========================

def op_pandas_pivot_to_sheet(wb, ws, op, log):
    """
    قراءة الشيت الحالي إلى pandas، تنفيذ Pivot أو GroupBy،
    ثم كتابة النتيجة في شيت جديد.
    """
    sheet_name = op.get("sheet") or ws.title
    index_cols = op.get("index") or []
    value_cols = op.get("values") or []
    aggfunc = op.get("aggfunc", "sum")
    new_sheet_name = op.get("target_sheet", "Pivot_Result")

    # قراءة الشيت إلى DataFrame
    data = ws.values
    cols = next(data)
    df = pd.DataFrame(data, columns=cols)

    if not index_cols or not value_cols:
        raise ValueError("يجب توفير index و values لتنفيذ Pivot عبر pandas.")

    pivot_df = pd.pivot_table(df, index=index_cols, values=value_cols, aggfunc=aggfunc)

    # إنشاء شيت جديد وكتابة النتيجة
    if new_sheet_name in wb.sheetnames:
        target_ws = wb[new_sheet_name]
        # مسح محتواه
        for row in target_ws[target_ws.dimensions]:
            for cell in row:
                cell.value = None
    else:
        target_ws = wb.create_sheet(title=new_sheet_name)

    for r_idx, row in enumerate(pivot_df.reset_index().itertuples(index=False), start=1):
        for c_idx, value in enumerate(row, start=1):
            target_ws.cell(row=r_idx, column=c_idx, value=value)

    log.append(f"تم تنفيذ Pivot عبر pandas من الشيت '{sheet_name}' إلى الشيت '{new_sheet_name}'.")

# =========================
# تنفيذ كود ديناميكي
# =========================

def op_execute_code(wb, ws, op, log):
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
    log.append("تم تنفيذ السكريبت البرمجي الديناميكي بنجاح.")

# =========================
# خريطة العمليات (Router)
# =========================

OPERATION_MAP = {
    # كود ديناميكي
    "execute_code": op_execute_code,

    # أعمدة
    "add_column": op_add_column,
    "delete_column": op_delete_column,
    "rename_column": op_rename_column,
    "set_column_width": op_set_column_width,

    # صفوف
    "add_row": op_add_row,
    "delete_row": op_delete_row,

    # خلايا
    "update_cell": op_update_cell,
    "apply_formula": op_apply_formula,
    "merge_cells": op_merge_cells,
    "unmerge_cells": op_unmerge_cells,

    # شيتات
    "sheet_select": op_sheet_select,
    "sheet_create": op_sheet_create,
    "sheet_delete": op_sheet_delete,

    # نطاقات
    "clear_range": op_clear_range,
    "color_range": op_color_range,
    "border_range": op_border_range,
    "fill_range": op_fill_range,

    # تنسيق جدول بسيط
    "format_table_simple": op_format_table_simple,

    # تحليل عبر pandas
    "pandas_pivot_to_sheet": op_pandas_pivot_to_sheet,
}

# =========================
# الدالة الرئيسية لتنفيذ العمليات
# =========================

def execute_operations(file_path, operations):
    try:
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        execution_log = []

        for idx, op in enumerate(operations):
            op_type = op.get("type")

            # إذا أرسل جيميني كود بايثون مباشر
            if op_type == "execute_code" or ("code" in op and op_type is None):
                op_execute_code(wb, ws, op, execution_log)
                continue

            handler = OPERATION_MAP.get(op_type)
            if not handler:
                raise ValueError(f"نوع العملية غير معروف أو غير مدعوم: {op_type}")

            result = handler(wb, ws, op, execution_log)
            if isinstance(result, openpyxl.worksheet.worksheet.Worksheet):
                ws = result  # تحديث الشيت النشط إذا رجعت العملية شيت جديد

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

# =========================
# نقطة الدخول من الـ CLI
# =========================

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "المعلمات غير كافية، يرجى تمرير مسار الملف وسلسلة العمليات بصيغة JSON."
        }))
        sys.exit(1)

    file_path = sys.argv[1]
    operations_json = sys.argv[2]

    try:
        operations = json.loads(operations_json)
    except json.JSONDecodeError as jde:
        print(json.dumps({
            "success": False,
            "error": f"خطأ في تحليل صيغة JSON: {str(jde)}"
        }))
        sys.exit(1)

    result = execute_operations(file_path, operations)
    print(json.dumps(result, ensure_ascii=False))
