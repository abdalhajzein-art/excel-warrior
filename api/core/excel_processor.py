"""
api/core/excel_processor.py - واجهة شاملة لمعالجة Excel باستخدام Aspose.Cells FOSS
"""

import sys
import json
import os
from asposecells import Workbook, ValidationType, SaveFormat, FileFormatType, CellsHelper

# ============================================================
# 🔍 دوال مساعدة عامة
# ============================================================

def find_header_row(worksheet):
    """اكتشاف صف الترويسة تلقائياً"""
    cells = worksheet.get_cells()
    max_row = cells.get_max_row()
    max_col = cells.get_max_column()
    
    for row in range(0, min(20, max_row + 1)):
        for col in range(0, min(max_col + 1, 10)):
            cell = cells.get(row, col)
            if cell.get_value():
                val = str(cell.get_value())
                if any(keyword in val for keyword in ['رقم', 'اسم', 'القسم', 'التاريخ', 'ID', 'Name', 'Date']):
                    return row
    return 0

def find_column_index(worksheet, header_row, column_name):
    """البحث عن عمود باسم معين"""
    cells = worksheet.get_cells()
    max_col = cells.get_max_column()
    
    for col in range(0, max_col + 1):
        cell = cells.get(header_row, col)
        if cell.get_value() and column_name.lower() in str(cell.get_value()).lower():
            return col
    return -1

def safe_get(cell):
    """استخراج قيمة الخلية بأمان"""
    return cell.get_value() if cell else None

def copy_style(source, target):
    """نسخ التنسيق من خلية لأخرى"""
    if source and target:
        target.set_style(source.get_style())

# ============================================================
# 📁 إدارة المصنفات
# ============================================================

def create_workbook(file_path, sheet_name="ورقة1"):
    """إنشاء ملف Excel جديد"""
    try:
        workbook = Workbook()
        worksheet = workbook.get_worksheets().get(0)
        worksheet.set_name(sheet_name)
        workbook.save(file_path)
        return {"success": True, "message": f"تم إنشاء الملف: {file_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def open_workbook(file_path):
    """فتح ملف Excel موجود"""
    try:
        workbook = Workbook(file_path)
        return {"success": True, "workbook": workbook}
    except Exception as e:
        return {"success": False, "error": str(e)}

def save_workbook(workbook, file_path):
    """حفظ المصنف"""
    try:
        workbook.save(file_path)
        return {"success": True, "message": "تم الحفظ"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_workbook_info(file_path):
    """الحصول على معلومات كاملة عن المصنف"""
    try:
        workbook = Workbook(file_path)
        info = {
            "file_name": os.path.basename(file_path),
            "file_size": os.path.getsize(file_path),
            "sheet_count": workbook.get_worksheets().get_count(),
            "sheets": []
        }
        
        for i in range(workbook.get_worksheets().get_count()):
            ws = workbook.get_worksheets().get(i)
            cells = ws.get_cells()
            info["sheets"].append({
                "name": ws.get_name(),
                "index": i,
                "rows": cells.get_max_row() + 1,
                "columns": cells.get_max_column() + 1
            })
        
        return {"success": True, "info": info}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 📋 إدارة الأوراق
# ============================================================

def add_sheet(file_path, sheet_name):
    """إضافة ورقة جديدة"""
    try:
        workbook = Workbook(file_path)
        workbook.get_worksheets().add(sheet_name)
        workbook.save(file_path)
        return {"success": True, "message": f"تم إضافة ورقة: {sheet_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_sheet(file_path, sheet_name):
    """حذف ورقة"""
    try:
        workbook = Workbook(file_path)
        workbook.get_worksheets().remove_at(workbook.get_worksheets().get_index(sheet_name))
        workbook.save(file_path)
        return {"success": True, "message": f"تم حذف الورقة: {sheet_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def rename_sheet(file_path, old_name, new_name):
    """إعادة تسمية ورقة"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(workbook.get_worksheets().get_index(old_name))
        ws.set_name(new_name)
        workbook.save(file_path)
        return {"success": True, "message": f"تمت إعادة التسمية: {old_name} → {new_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 📊 إدارة الأعمدة
# ============================================================

def add_column(file_path, target_column, new_column, sheet_name=None):
    """إضافة عمود جديد"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cells = ws.get_cells()
        
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, target_column)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{target_column}' غير موجود"}
        
        new_col_index = target_col + 1
        ws.get_cells().insert_column(new_col_index)
        cells.get(header_row, new_col_index).put_value(new_column)
        
        workbook.save(file_path)
        return {"success": True, "message": f"تم إضافة عمود: {new_column}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def delete_column(file_path, column_name, sheet_name=None):
    """حذف عمود"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, column_name)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{column_name}' غير موجود"}
        
        ws.get_cells().delete_column(target_col)
        workbook.save(file_path)
        return {"success": True, "message": f"تم حذف العمود: {column_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def rename_column(file_path, old_name, new_name, sheet_name=None):
    """إعادة تسمية عمود"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cells = ws.get_cells()
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, old_name)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{old_name}' غير موجود"}
        
        cells.get(header_row, target_col).put_value(new_name)
        workbook.save(file_path)
        return {"success": True, "message": f"تمت إعادة التسمية: {old_name} → {new_name}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def add_column_with_dropdown(file_path, target_column, new_column, dropdown_values, sheet_name=None):
    """إضافة عمود مع قائمة منسدلة"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cells = ws.get_cells()
        
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, target_column)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{target_column}' غير موجود"}
        
        new_col_index = target_col + 1
        ws.get_cells().insert_column(new_col_index)
        cells.get(header_row, new_col_index).put_value(new_column)
        
        # إضافة القائمة المنسدلة
        if dropdown_values:
            validation = cells.get(new_col_index, 0).get_validation()
            validation.set_type(ValidationType.LIST)
            validation.set_formula1(",".join(dropdown_values))
            validation.set_ignore_blank(True)
            
            for row in range(header_row + 1, cells.get_max_row() + 1):
                cell = cells.get(row, new_col_index)
                cell.set_validation(validation)
                # نسخ التنسيق من العمود المجاور
                ref_cell = cells.get(row, target_col)
                copy_style(ref_cell, cell)
        
        workbook.save(file_path)
        return {"success": True, "message": f"تم إضافة عمود '{new_column}' مع قائمة منسدلة"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 🔢 إدارة البيانات والخلايا
# ============================================================

def set_cell_value(file_path, sheet_name, row, col, value):
    """تعيين قيمة خلية"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        ws.get_cells().get(row - 1, col - 1).put_value(value)
        workbook.save(file_path)
        return {"success": True, "message": f"تم تعيين القيمة في ({row}, {col})"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_cell_value(file_path, sheet_name, row, col):
    """قراءة قيمة خلية"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        value = ws.get_cells().get(row - 1, col - 1).get_value()
        return {"success": True, "value": value}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_all_data(file_path, sheet_name=None):
    """قراءة جميع البيانات من ورقة"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cells = ws.get_cells()
        
        max_row = cells.get_max_row()
        max_col = cells.get_max_column()
        
        data = []
        for row in range(max_row + 1):
            row_data = []
            for col in range(max_col + 1):
                cell = cells.get(row, col)
                row_data.append(cell.get_value() if cell else None)
            data.append(row_data)
        
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 🎨 التنسيقات
# ============================================================

def format_cell(file_path, sheet_name, row, col, style_options):
    """تنسيق خلية"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cell = ws.get_cells().get(row - 1, col - 1)
        style = cell.get_style()
        
        if "font_name" in style_options:
            style.get_font().set_name(style_options["font_name"])
        if "font_size" in style_options:
            style.get_font().set_size(style_options["font_size"])
        if "bold" in style_options:
            style.get_font().set_bold(style_options["bold"])
        if "italic" in style_options:
            style.get_font().set_italic(style_options["italic"])
        if "color" in style_options:
            # تعيين لون النص
            pass  # يحتاج لتحويل الألوان
        
        cell.set_style(style)
        workbook.save(file_path)
        return {"success": True, "message": "تم تنسيق الخلية"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 📊 الرسوم البيانية
# ============================================================

def add_chart(file_path, chart_type, data_range, position, sheet_name=None):
    """إضافة رسم بياني"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        
        # تحديد نوع الرسم البياني
        chart_types = {
            "column": 0, "bar": 1, "line": 2, "pie": 5,
            "area": 3, "scatter": 4, "doughnut": 6
        }
        
        chart = ws.get_charts().add(chart_types.get(chart_type, 0), 
                                    position.get("row", 0), position.get("col", 0),
                                    position.get("width", 400), position.get("height", 300))
        
        # تعيين نطاق البيانات
        chart.set_chart_data_range(data_range, True)
        
        workbook.save(file_path)
        return {"success": True, "message": f"تم إضافة رسم بياني من نوع {chart_type}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 🔍 التصفية والفرز
# ============================================================

def apply_filter(file_path, column_name, filter_values, sheet_name=None):
    """تطبيق تصفية على عمود"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, column_name)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{column_name}' غير موجود"}
        
        # تطبيق التصفية التلقائية
        ws.get_auto_filter().set_range(ws.get_cells().get(header_row, 0), 
                                       ws.get_cells().get(header_row, ws.get_cells().get_max_column()))
        
        workbook.save(file_path)
        return {"success": True, "message": "تم تطبيق التصفية"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def sort_data(file_path, sort_column, ascending=True, sheet_name=None):
    """ترتيب البيانات حسب عمود"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        cells = ws.get_cells()
        
        # تحديد نطاق البيانات
        header_row = find_header_row(ws)
        target_col = find_column_index(ws, header_row, sort_column)
        
        if target_col == -1:
            return {"success": False, "error": f"عمود '{sort_column}' غير موجود"}
        
        # ترتيب الخلايا
        cells.sort(target_col, ascending)
        workbook.save(file_path)
        return {"success": True, "message": f"تم الترتيب حسب عمود {sort_column}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 📤 التصدير
# ============================================================

def export_to_csv(file_path, output_path, sheet_name=None):
    """تصدير إلى CSV"""
    try:
        workbook = Workbook(file_path)
        ws = workbook.get_worksheets().get(sheet_name) if sheet_name else workbook.get_worksheets().get(0)
        workbook.save(output_path, SaveFormat.CSV)
        return {"success": True, "message": f"تم التصدير إلى: {output_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def export_to_json(file_path, output_path, sheet_name=None):
    """تصدير إلى JSON"""
    try:
        data = get_all_data(file_path, sheet_name)
        if not data["success"]:
            return data
        
        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data["data"], f, ensure_ascii=False, indent=2)
        
        return {"success": True, "message": f"تم التصدير إلى: {output_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def export_to_markdown(file_path, output_path, sheet_name=None):
    """تصدير إلى Markdown Table"""
    try:
        data = get_all_data(file_path, sheet_name)
        if not data["success"]:
            return data
        
        rows = data["data"]
        if not rows:
            return {"success": False, "error": "لا توجد بيانات"}
        
        md = "| " + " | ".join([str(c) if c else "" for c in rows[0]]) + " |\n"
        md += "| " + " | ".join(["---"] * len(rows[0])) + " |\n"
        
        for row in rows[1:]:
            md += "| " + " | ".join([str(c) if c else "" for c in row]) + " |\n"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md)
        
        return {"success": True, "message": f"تم التصدير إلى: {output_path}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============================================================
# 🚀 المدخل الرئيسي
# ============================================================

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "لم يتم تمرير معاملات"}))
        return

    try:
        data = json.loads(sys.argv[1])
        operation = data.get("operation")
        file_path = data.get("file_path")

        # العمليات التي لا تحتاج ملف
        if operation == "create_workbook":
            result = create_workbook(
                data.get("output_path", "new_file.xlsx"),
                data.get("sheet_name", "ورقة1")
            )
            print(json.dumps(result))
            return

        # باقي العمليات تحتاج ملف
        if not file_path or not os.path.exists(file_path):
            print(json.dumps({"success": False, "error": "الملف غير موجود"}))
            return

        # تعيين العملية
        operations = {
            "get_info": get_workbook_info,
            "add_sheet": add_sheet,
            "delete_sheet": delete_sheet,
            "rename_sheet": rename_sheet,
            "add_column": add_column,
            "delete_column": delete_column,
            "rename_column": rename_column,
            "add_column_with_dropdown": add_column_with_dropdown,
            "get_cell": get_cell_value,
            "set_cell": set_cell_value,
            "get_all_data": get_all_data,
            "format_cell": format_cell,
            "add_chart": add_chart,
            "apply_filter": apply_filter,
            "sort_data": sort_data,
            "export_csv": export_to_csv,
            "export_json": export_to_json,
            "export_markdown": export_to_markdown
        }

        if operation in operations:
            result = operations[operation](file_path, **data.get("params", {}))
        else:
            result = {"success": False, "error": f"عملية غير معروفة: {operation}"}

        print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
