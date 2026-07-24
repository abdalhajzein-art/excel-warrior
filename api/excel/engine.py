import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import traceback

class AlatheerMasterEngine:
    """محرك الكواليس الخارق والسيادي لمعالجة وتحليل ملفات Excel - الأثير"""
    
    def __init__(self):
        self.wb = None
        self.ws = None
        self.header_row = 1
    
    def load_file(self, file_path, sheet_name=None):
        try:
            # قراءة الملف مع الحفاظ على المعادلات الأصلية
            self.wb = openpyxl.load_workbook(file_path, data_only=False)
        except Exception as e:
            raise Exception(f"فشل تحميل الملف برمجياً: {str(e)}")
            
        if sheet_name and sheet_name in self.wb.sheetnames:
            self.ws = self.wb[sheet_name]
        else:
            self.ws = self.wb.active
        self._detect_header_row()
    
    def _detect_header_row(self):
        """كشف ذكي لصف العناوين بغض النظر عن هيكل الملف"""
        for r in range(1, min(self.ws.max_row + 1, 20)):
            non_empty = sum(1 for c in range(1, min(self.ws.max_column + 1, 15)) 
                          if self.ws.cell(row=r, column=c).value is not None)
            if non_empty >= 2:
                self.header_row = r
                break
        else:
            self.header_row = 1
    
    def inspect_and_extract_data(self):
        """وحدة الاستشعار: قراءة الهيكل والبيانات الحقيقية بذكاء لتوفير التوكنز"""
        headers = []
        for c in range(1, self.ws.max_column + 1):
            val = self.ws.cell(row=self.header_row, column=c).value
            if val is not None and not str(val).startswith("Column_"):
                headers.append(str(val))
            else:
                headers.append(f"Col_{c}")
            
        rows_data = []
        # جلب عينة دقيقة ووافية من الصفوف (حتى 40 صفاً لضمان الشمولية)
        for r in range(self.header_row + 1, min(self.ws.max_row + 1, 45)):
            row_dict = {}
            has_val = False
            for c, h in enumerate(headers, start=1):
                cell_val = self.ws.cell(row=r, column=c).value
                if cell_val is not None:
                    has_val = True
                    row_dict[h] = cell_val
            if has_val:
                rows_data.append(row_dict)

        return {
            "success": True,
            "is_read_only": True,
            "action_type": "read",
            "metadata": {
                "total_rows": max(0, self.ws.max_row - self.header_row),
                "total_columns": self.ws.max_column,
                "header_row": self.header_row,
                "headers": headers,
                "sample_data": rows_data
            },
            "message": "✅ تم استخراج بيانات الملف وهيكله بنجاح عبر محرك الكواليس."
        }

    def extract_formulas(self):
        """وحدة استخبارات المعادلات والدوال المستخدمة في الملف"""
        formulas_found = []
        for r in range(1, self.ws.max_row + 1):
            for c in range(1, self.ws.max_column + 1):
                cell_val = str(self.ws.cell(row=r, column=c).value or "")
                if cell_val.startswith("="):
                    col_letter = get_column_letter(c)
                    formulas_found.append(f"الخلية {col_letter}{r}: {cell_val}")
                    
        return {
            "success": True,
            "is_read_only": True,
            "action_type": "formulas",
            "formulas_list": formulas_found,
            "message": f"تم رصد {len(formulas_found)} معادلة."
        }

    def modify_or_process(self, plan, instruction):
        """وحدة التعديل الهندسي والحسابات والتنسيق المتقدم"""
        instruction_lower = instruction.strip().lower()
        
        # تنفيذ خطة الأعمدة الجديدة إن وجدت
        new_columns = plan.get("newColumns", [])
        for col in new_columns:
            col_name = col.get("name", "عمود جديد")
            formula = col.get("formula", None)
            
            insert_pos = self.ws.max_column + 1
            self.ws.insert_cols(insert_pos, amount=1)
            
            header_cell = self.ws.cell(row=self.header_row, column=insert_pos, value=col_name)
            self._apply_style(header_cell, 'header')
            
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                if self.ws.cell(row=r, column=1).value is not None:
                    cell = self.ws.cell(row=r, column=insert_pos)
                    self._apply_style(cell, 'data')
                    if formula:
                        cell.value = formula.replace("{row}", str(r))
                    else:
                        cell.value = 0

        # التلوين الشرطي والتمييز الذكي
        if "لون" in instruction_lower or "تمييز" in instruction_lower:
            accent_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                for c in range(1, self.ws.max_column + 1):
                    val = str(self.ws.cell(row=r, column=c).value or "")
                    if "غياب" in instruction_lower or "تأخير" in instruction_lower:
                        if val.isdigit() and int(val) > 0:
                            self.ws.cell(row=r, column=c).fill = accent_fill

        return {
            "success": True,
            "is_read_only": False,
            "action_type": "modify",
            "message": f"✅ تم تنفيذ التعديلات الهندسية المطلوبة بنجاح تام."
        }

    def _apply_style(self, cell, style_type='data'):
        if style_type == 'header':
            cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
            cell.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        else:
            cell.font = Font(name="Arial", size=10, color="000000")
            cell.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
        
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = Border(
            left=Side(style='thin', color='BFBFBF'), right=Side(style='thin', color='BFBFBF'),
            top=Side(style='thin', color='BFBFBF'), bottom=Side(style='thin', color='BFBFBF')
        )

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "لم يتم استلام بيانات في المحرك"}), flush=True)
            return
            
        input_data = json.loads(raw_input)
        input_path = input_data.get("inputPath")
        output_path = input_data.get("outputPath")
        action = input_data.get("action", "read")
        plan = input_data.get("plan", {})
        instruction = plan.get("summary", input_data.get("instruction", ""))
        sheet_name = input_data.get("sheetName")
        
        engine = AlatheerMasterEngine()
        engine.load_file(input_path, sheet_name)
        
        # توجيه الطلب حسب نية المستخدم بدقة
        instruction_lower = instruction.strip().lower()
        if "دوال" in instruction_lower or "معادلات" in instruction_lower:
            result = engine.extract_formulas()
        elif action == 'read' or any(w in instruction_lower for w in ["اقرأ", "عرض", "محتوى", "ملخص", "استعرض", "حلل"]):
            result = engine.inspect_and_extract_data()
        else:
            result = engine.modify_or_process(plan, instruction)
        
        # حفظ الملف الناتج إذا كان هناك عملية تعديل تتطلب مخرجات
        if not result.get("is_read_only", False) and output_path:
            engine.wb.save(output_path)
            
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()

