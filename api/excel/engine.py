import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import Rule
from openpyxl.styles.differential import DifferentialStyle
from openpyxl.comments import Comment
import re

class ExcelWarrior:
    """المحرك السيادي الشامل لمعالجة Excel"""
    
    def __init__(self):
        self.wb = None
        self.ws = None
        self.header_row = 1
        self.temp_files = []
    
    def load_file(self, file_path, sheet_name=None):
        """تحميل ملف Excel مع دعم اختيار الورقة"""
        self.wb = openpyxl.load_workbook(file_path)
        if sheet_name and sheet_name in self.wb.sheetnames:
            self.ws = self.wb[sheet_name]
        else:
            self.ws = self.wb.active
        self._detect_header_row()
    
    def _detect_header_row(self):
        """كشف صف العناوين تلقائياً"""
        for r in range(1, min(self.ws.max_row + 1, 10)):
            non_empty = sum(1 for c in range(1, self.ws.max_column + 1) 
                          if self.ws.cell(row=r, column=c).value is not None)
            if non_empty >= 2:
                self.header_row = r
                break
    
    def _find_column(self, target_name):
        """البحث عن عمود بالاسم"""
        if not target_name:
            return None
        target_lower = str(target_name).strip().lower()
        for c in range(1, self.ws.max_column + 1):
            val = str(self.ws.cell(row=self.header_row, column=c).value or "").strip().lower()
            if target_lower in val or val in target_lower:
                return c
        return None
    
    def _apply_style(self, cell, style_type='header'):
        """تطبيق تنسيقات احترافية"""
        if style_type == 'header':
            cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        else:
            cell.font = Font(name="Arial", size=10, color="000000")
            cell.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
        
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = Border(
            left=Side(style='thin', color='BFBFBF'),
            right=Side(style='thin', color='BFBFBF'),
            top=Side(style='thin', color='BFBFBF'),
            bottom=Side(style='thin', color='BFBFBF')
        )
    
    def generate(self, plan):
        """توليد ملف Excel جديد من الصفر"""
        self.wb = openpyxl.Workbook()
        self.ws = self.wb.active
        self.ws.title = plan.get("sheetName", "تقرير_رئيسي")
        
        columns = plan.get("columns", ["رقم", "البيان", "التاريخ", "القيمة"])
        rows_data = plan.get("rows", [
            [1, "بيان تجريبي 1", "2026-07-01", 1000],
            [2, "بيان تجريبي 2", "2026-07-02", 1500],
            [3, "بيان تجريبي 3", "2026-07-03", 2000]
        ])
        
        # كتابة العناوين
        for c_idx, col_name in enumerate(columns, 1):
            cell = self.ws.cell(row=1, column=c_idx, value=col_name)
            self._apply_style(cell, 'header')
        
        # كتابة البيانات
        for r_idx, row_values in enumerate(rows_data, 2):
            for c_idx, val in enumerate(row_values, 1):
                cell = self.ws.cell(row=r_idx, column=c_idx, value=val)
                self._apply_style(cell, 'data')
        
        return {"success": True, "message": "✅ تم توليد الملف بنجاح"}
    
    def add_columns(self, plan):
        """إضافة أعمدة جديدة مع صيغ ديناميكية"""
        new_columns = plan.get("newColumns", [])
        target_column = plan.get("targetColumn", "")
        formula_template = plan.get("formulaTemplate", "")
        dropdown_options = plan.get("dropdownOptions", [])
        
        if not new_columns:
            return {"success": False, "error": "لا توجد أعمدة جديدة للإضافة"}
        
        # البحث عن العمود المستهدف
        target_col_idx = self._find_column(target_column)
        insert_pos = (target_col_idx + 1) if target_col_idx else (self.ws.max_column + 1)
        
        # إدراج الأعمدة
        self.ws.insert_cols(insert_pos, amount=len(new_columns))
        
        # تنسيق الأعمدة الجديدة
        for idx, col_name in enumerate(new_columns):
            current_col = insert_pos + idx
            # عنوان العمود
            header_cell = self.ws.cell(row=self.header_row, column=current_col, value=col_name)
            self._apply_style(header_cell, 'header')
            
            # تعبئة البيانات
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                if self.ws.cell(row=r, column=1).value is not None:
                    cell = self.ws.cell(row=r, column=current_col)
                    self._apply_style(cell, 'data')
                    
                    # تطبيق الصيغة إذا وجدت
                    if formula_template:
                        formula = formula_template
                        if "{row}" in formula:
                            formula = formula.replace("{row}", str(r))
                        if target_col_idx:
                            target_letter = get_column_letter(target_col_idx)
                            formula = formula.replace("{target_col}", target_letter)
                        cell.value = formula
                    elif dropdown_options:
                        # تطبيق قائمة منسدلة (Data Validation)
                        from openpyxl.worksheet.datavalidation import DataValidation
                        dv = DataValidation(type="list", formula1=f'"{",".join(dropdown_options)}"', allow_blank=True)
                        self.ws.add_data_validation(dv)
                        dv.add(cell)
                    else:
                        # صيغة افتراضية
                        if target_col_idx:
                            target_letter = get_column_letter(target_col_idx)
                            cell.value = f'=IF({target_letter}{r}="مطلوب صيانة","عاجل","عادي")'
                        else:
                            cell.value = "-"
        
        return {"success": True, "message": f"✅ تم إضافة {len(new_columns)} عمود جديد"}
    
    def delete_columns(self, plan):
        """حذف أعمدة محددة"""
        columns_to_delete = plan.get("columnsToDelete", [])
        if not columns_to_delete:
            return {"success": False, "error": "لا توجد أعمدة للحذف"}
        
        # البحث عن أرقام الأعمدة
        col_indices = []
        for col_name in columns_to_delete:
            idx = self._find_column(col_name)
            if idx:
                col_indices.append(idx)
        
        if not col_indices:
            return {"success": False, "error": "لم يتم العثور على الأعمدة المطلوبة للحذف"}
        
        # الحذف من الأعلى إلى الأسفل
        for idx in sorted(col_indices, reverse=True):
            self.ws.delete_cols(idx)
        
        return {"success": True, "message": f"✅ تم حذف {len(col_indices)} عمود"}
    
    def update_cells(self, plan):
        """تحديث خلايا محددة"""
        updates = plan.get("updates", [])
        if not updates:
            return {"success": False, "error": "لا توجد تحديثات محددة"}
        
        updated_count = 0
        for update in updates:
            row = update.get("row")
            column = update.get("column")
            new_value = update.get("value")
            
            if row and column:
                cell = self.ws.cell(row=row, column=column)
                cell.value = new_value
                updated_count += 1
            elif update.get("condition") and update.get("newValue"):
                # تحديث شرطي (مثال: الكل = 0)
                condition = update.get("condition")
                new_value = update.get("newValue")
                # تنفيذ تحديث شرطي مبسط
                for r in range(self.header_row + 1, self.ws.max_row + 1):
                    for c in range(1, self.ws.max_column + 1):
                        if str(self.ws.cell(row=r, column=c).value) == condition:
                            self.ws.cell(row=r, column=c).value = new_value
                            updated_count += 1
        
        return {"success": True, "message": f"✅ تم تحديث {updated_count} خلية"}
    
    def analyze(self, plan):
        """تحليل البيانات وإحصائيات"""
        analysis = {
            "total_rows": self.ws.max_row - self.header_row,
            "total_columns": self.ws.max_column,
            "headers": [],
            "column_stats": {}
        }
        
        # استخراج العناوين
        for c in range(1, self.ws.max_column + 1):
            val = self.ws.cell(row=self.header_row, column=c).value
            if val:
                analysis["headers"].append(str(val))
        
        # إحصائيات بسيطة لكل عمود
        for c in range(1, self.ws.max_column + 1):
            col_name = analysis["headers"][c-1] if c <= len(analysis["headers"]) else f"عمود{c}"
            values = []
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                val = self.ws.cell(row=r, column=c).value
                if val is not None and val != "":
                    values.append(val)
            
            if values:
                analysis["column_stats"][col_name] = {
                    "count": len(values),
                    "unique": len(set(str(v) for v in values)),
                    "sample": values[:5]
                }
        
        return {"success": True, "message": "✅ تم التحليل", "analysis": analysis}
    
    def remove_duplicates(self, plan):
        """إزالة الصفوف المكررة"""
        columns = plan.get("columns", [])
        if not columns:
            return {"success": False, "error": "حدد الأعمدة للتحقق من التكرار"}
        
        col_indices = []
        for col in columns:
            idx = self._find_column(col)
            if idx:
                col_indices.append(idx)
        
        if not col_indices:
            return {"success": False, "error": "لم يتم العثور على الأعمدة"}
        
        # جمع الصفوف الفريدة
        seen = set()
        rows_to_delete = []
        for r in range(self.header_row + 1, self.ws.max_row + 1):
            key = tuple(str(self.ws.cell(row=r, column=c).value) for c in col_indices)
            if key in seen:
                rows_to_delete.append(r)
            else:
                seen.add(key)
        
        # حذف الصفوف المكررة
        for r in sorted(rows_to_delete, reverse=True):
            self.ws.delete_rows(r)
        
        return {"success": True, "message": f"✅ تم إزالة {len(rows_to_delete)} صف مكرر"}
    
    def apply_conditional_formatting(self, plan):
        """تطبيق تنسيق شرطي"""
        rules = plan.get("rules", [])
        if not rules:
            return {"success": False, "error": "لا توجد قواعد للتنسيق"}
        
        for rule in rules:
            column = rule.get("column")
            condition = rule.get("condition")
            color = rule.get("color", "FF0000")
            
            col_idx = self._find_column(column)
            if not col_idx:
                continue
            
            # تطبيق التنسيق الشرطي
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                cell = self.ws.cell(row=r, column=col_idx)
                if condition == "contains" and rule.get("value") in str(cell.value):
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                elif condition == "equals" and str(cell.value) == rule.get("value"):
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
                elif condition == "greater_than" and isinstance(cell.value, (int, float)) and cell.value > rule.get("value"):
                    cell.fill = PatternFill(start_color=color, end_color=color, fill_type="solid")
        
        return {"success": True, "message": "✅ تم تطبيق التنسيق الشرطي"}
    
    def save(self, output_path):
        """حفظ الملف"""
        self.wb.save(output_path)
        return {"success": True, "message": "✅ تم حفظ الملف"}
    
    def execute(self, action, plan, file_path=None, output_path=None):
        """تنفيذ أي أمر بناءً على الإجراء المطلوب"""
        try:
            if action == "generate":
                return self.generate(plan)
            
            if not file_path:
                return {"success": False, "error": "مسار الملف غير متوفر"}
            
            self.load_file(file_path, plan.get("sheetName"))
            
            if action == "modify":
                if plan.get("newColumns"):
                    return self.add_columns(plan)
                elif plan.get("columnsToDelete"):
                    return self.delete_columns(plan)
                elif plan.get("updates"):
                    return self.update_cells(plan)
            elif action == "analyze":
                return self.analyze(plan)
            elif action == "remove_duplicates":
                return self.remove_duplicates(plan)
            elif action == "conditional_formatting":
                return self.apply_conditional_formatting(plan)
            else:
                return {"success": False, "error": f"إجراء غير معروف: {action}"}
            
        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    """الدالة الرئيسية لاستقبال الأوامر من Node.js"""
    try:
        input_data = json.loads(sys.stdin.read())
        action = input_data.get("action", "modify")
        input_path = input_data.get("inputPath")
        output_path = input_data.get("outputPath")
        plan = input_data.get("plan", {})
        
        warrior = ExcelWarrior()
        result = warrior.execute(action, plan, input_path, output_path)
        
        # حفظ الملف بعد التنفيذ
        if result["success"] and output_path and action != "analyze":
            warrior.save(output_path)
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
