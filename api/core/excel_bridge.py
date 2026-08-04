# api/core/excel_bridge.py
import sys
import json
import difflib
import openpyxl
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

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

def find_sheet_flexible(wb, target_name):
    """بحث مرن عن اسم الشيت يتجاهل الفروقات البسيطة مثل المسافات والشرطات"""
    if not target_name:
        return None
        
    available = wb.sheetnames
    if target_name in available:
        return target_name
    
    # توحيد شكل النصوص (استبدال الشرطات بمسافات)
    clean_target = str(target_name).replace("_", " ").replace("-", " ").strip().lower()
    clean_available = [s.replace("_", " ").replace("-", " ").strip().lower() for s in available]
    
    if clean_target in clean_available:
        idx = clean_available.index(clean_target)
        return available[idx]
    
    # البحث عن أقرب تطابق بنسبة 65%
    matches = difflib.get_close_matches(clean_target, clean_available, n=1, cutoff=0.65)
    if matches:
        idx = clean_available.index(matches[0])
        return available[idx]
    
    return None

def get_sheet(wb, op):
    """تحديد الشيت المستهدف من العملية، أو الشيت النشط كافتراضي"""
    sheet_name = op.get("sheet") or op.get("sheet_name")
    if sheet_name:
        matched = find_sheet_flexible(wb, sheet_name)
        if matched:
            return wb[matched]
        else:
            raise ValueError(f"الشيت المطلوب غير موجود ولا يوجد اسم مقارب له: {sheet_name}")
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
# عمليات الشيتات (مرنة وحصينة)
# =========================

def op_sheet_select(wb, ws, op, log):
    sheet_name = op.get("sheet") or op.get("sheet_name")
    if not sheet_name:
        raise ValueError("يجب توفير اسم الشيت لاختياره.")
    
    matched = find_sheet_flexible(wb, sheet_name)
    if not matched:
        raise ValueError(f"الشيت المطلوب غير موجود ولا يوجد اسم مقارب له: {sheet_name}")
    
    if matched != sheet_name:
        log.append(f"تم المطابقة المرنة وتحديد الشيت '{matched}' بدلاً من '{sheet_name}'.")
    else:
        log.append(f"تم اختيار الشيت '{matched}'.")
        
    return wb[matched]

def op_sheet_create(wb, ws, op, log):
    sheet_name = op.get("sheet_name") or op.get("sheet") or "Sheet_New"
    matched = find_sheet_flexible(wb, sheet_name)
    if matched:
        log.append(f"الشيت '{matched}' موجود مسبقاً، سيتُم اختياره بدلاً من إعادة الإنشاء.")
        return wb[matched]
    new_ws = wb.create_sheet(title=sheet_name)
    log.append(f"تم إنشاء الشيت الجديد '{sheet_name}'.")
    return new_ws

def op_sheet_delete(wb, ws, op, log):
    sheet_name = op.get("sheet_name") or op.get("sheet")
    if not sheet_name:
        raise ValueError("يجب توفير sheet_name لحذف الشيت.")
    
    matched = find_sheet_flexible(wb, sheet_name)
    if not matched:
        log.append(f"الشيت '{sheet_name}' غير موجود، لن يتم حذفه.")
        return ws
        
    target_ws = wb[matched]
    wb.remove(target_ws)
    log.append(f"تم حذف الشيت '{matched}'.")
    return wb.active

# =========================
# عمليات النطاقات والتنسيق الشرطي
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

def op_conditional_formatting(wb, ws, op, log):
    """تنسيق شرطي حركي بناءً على قيم أو نصوص الخلايا"""
    range_ref = op.get("range")
    operator = op.get("operator", "equal")  # equal, greaterThan, lessThan, containsText
    formula_val = op.get("value", "")
    bg_color = op.get("bg_color", "FFC7CE")  # أحمر خفيف افتراضي
    text_color = op.get("text_color", "9C0006")  # أحمر غامق للنص
    
    if not range_ref:
        raise ValueError("يجب توفير range للتنسيق الشرطي.")
        
    red_fill = PatternFill(start_color=bg_color, end_color=bg_color, fill_type="solid")
    font_color = Font(color=text_color, bold=True)
    
    rule = CellIsRule(operator=operator, formula=[f'"{formula_val}"' if isinstance(formula_val, str) else str(formula_val)],
                      stopIfTrue=True, fill=red_fill, font=font_color)
    
    ws.conditional_formatting.add(range_ref, rule)
    log.append(f"تم تطبيق التنسيق الشرطي على النطاق {range_ref} بحسب الشرط: {operator} {formula_val}.")

# =========================
# إضافة مخططات بيانية (Charts)
# =========================

def op_add_chart(wb, ws, op, log):
    chart_type = op.get("chart_type", "bar").lower()  # bar, line, pie
    title = op.get("title", "تقرير بياني")
    min_col = op.get("min_col", 1)
    min_row = op.get("min_row", 1)
    max_col = op.get("max_col", ws.max_column)
    max_row = op.get("max_row", ws.max_row)
    cell_position = op.get("cell_position", "E2")
    
    if chart_type == "line":
        chart = LineChart()
    elif chart_type == "pie":
        chart = PieChart()
    else:
        chart = BarChart()
        
    chart.title = title
    data = Reference(ws, min_col=min_col, min_row=min_row, max_col=max_col, max_row=max_row)
    chart.add_data(data, titles_from_data=True)
    
    ws.add_chart(chart, cell_position)
    log.append(f"تم إنشاء مخطط بياني من نوع ({chart_type}) في الخلية {cell_position}.")

# =========================
# تحليل عبر pandas
# =========================

def op_pandas_pivot_to_sheet(wb, ws, op, log):
    sheet_name = op.get("sheet") or op.get("sheet_name") or ws.title
    matched_sheet = find_sheet_flexible(wb, sheet_name) or ws.title
    source_ws = wb[matched_sheet]
    
    index_cols = op.get("index") or []
    value_cols = op.get("values") or []
    aggfunc = op.get("aggfunc", "sum")
    new_sheet_name = op.get("target_sheet", "Pivot_Result")

    data = source_ws.values
    cols = next(data)
    df = pd.DataFrame(data, columns=cols)

    if not index_cols or not value_cols:
        raise ValueError("يجب توفير index و values لتنفيذ Pivot عبر pandas.")

    pivot_df = pd.pivot_table(df, index=index_cols, values=value_cols, aggfunc=aggfunc)

    target_sheet_name = find_sheet_flexible(wb, new_sheet_name) or new_sheet_name
    if target_sheet_name in wb.sheetnames:
        target_ws = wb[target_sheet_name]
        for row in target_ws[target_ws.dimensions]:
            for cell in row:
                cell.value = None
    else:
        target_ws = wb.create_sheet(title=target_sheet_name)

    for r_idx, row in enumerate(pivot_df.reset_index().itertuples(index=False), start=1):
        for c_idx, value in enumerate(row, start=1):
            target_ws.cell(row=r_idx, column=c_idx, value=value)

    log.append(f"تم تنفيذ Pivot عبر pandas من الشيت '{matched_sheet}' إلى الشيت '{target_sheet_name}'.")

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
        "column_index_from_string": column_index_from_string,
        "BarChart": BarChart, "LineChart": LineChart, "PieChart": PieChart, "Reference": Reference
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

    # نطاقات وتنسيق شرطي ومخططات
    "clear_range": op_clear_range,
    "color_range": op_color_range,
    "border_range": op_border_range,
    "conditional_formatting": op_conditional_formatting,
    "add_chart": op_add_chart,

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

            # استهداف الشيت المناسب لكل عملية قبل التنفيذ
            target_ws = get_sheet(wb, op) if op_type != "sheet_select" else ws

            # إذا أرسل جيميني كود بايثون مباشر
            if op_type == "execute_code" or ("code" in op and op_type is None):
                op_execute_code(wb, target_ws, op, execution_log)
                continue

            handler = OPERATION_MAP.get(op_type)
            if not handler:
                raise ValueError(f"نوع العملية غير معروف أو غير مدعوم: {op_type}")

            result = handler(wb, target_ws, op, execution_log)
            if isinstance(result, openpyxl.worksheet.worksheet.Worksheet):
                ws = result  # تحديث الشيت النشط إذا غيرته دالة اختيار الشيتات

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
        }, ensure_ascii=False))
        sys.exit(1)

    file_path = sys.argv[1]
    operations_json = sys.argv[2]

    try:
        operations = json.loads(operations_json)
    except json.JSONDecodeError as jde:
        print(json.dumps({
            "success": False,
            "error": f"خطأ في تحليل صيغة JSON: {str(jde)}"
        }, ensure_ascii=False))
        sys.exit(1)

    result = execute_operations(file_path, operations)
    print(json.dumps(result, ensure_ascii=False))

