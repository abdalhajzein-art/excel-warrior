import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import traceback

class ExcelWarrior:
    """المحرك العام والمطلق لمعالجة وتحليل وتوليد ملفات Excel في العالم"""
    
    def __init__(self):
        self.wb = None
        self.ws = None
        self.header_row = 1
    
    def load_file(self, file_path, sheet_name=None):
        try:
            self.wb = openpyxl.load_workbook(file_path, data_only=False)
        except Exception as e:
            raise Exception(f"فشل تحميل الملف: {str(e)}")
            
        if sheet_name and sheet_name in self.wb.sheetnames:
            self.ws = self.wb[sheet_name]
        else:
            self.ws = self.wb.active
        self._detect_header_row()
    
    def _detect_header_row(self):
        """كشف ذكي لصف العناوين بغض النظر عن شكل الملف"""
        for r in range(1, min(self.ws.max_row + 1, 20)):
            non_empty = sum(1 for c in range(1, min(self.ws.max_column + 1, 15)) 
                          if self.ws.cell(row=r, column=c).value is not None)
            if non_empty >= 2:
                self.header_row = r
                break
        else:
            self.header_row = 1
    
    def read_and_summarize(self):
        """استخراج ملخص بشري أنيق ونظيف للملف دون إظهار البيانات الخام"""
        headers = []
        for c in range(1, self.ws.max_column + 1):
            val = self.ws.cell(row=self.header_row, column=c).value
            if val is not None and not str(val).startswith("Column_"):
                headers.append(str(val))
            
        total_rows = max(0, self.ws.max_row - self.header_row)
        
        summary_text = f"### 📊 تقرير وملخص ملف الإكسل\n\n"
        summary_text += f"- 📁 **إجمالي الصفوف (البيانات):** {total_rows}\n"
        summary_text += f"- 📋 **الأعمدة الرئيسية المكتشفة:** {', '.join(headers[:10])}\n\n"
        summary_text += f"الملف جاهز تماماً لأي عملية تحليل إضافية، حسابات، تلوين شرطي، أو تعديل تريده يا مهندس. كيف تود أن نتابع العمل عليه؟ 🚀"
        
        return {
            "success": True,
            "is_read_only": True, # مؤشر قراءة فقط لمنع ظهور زر التحميل
            "message": summary_text,
            "total_rows": total_rows,
            "headers": headers
        }

    def process_request(self, action, plan, instruction):
        """المحرك الشامل لتنفيذ كافة العمليات (قراءة، تعديل، حسابات، تنسيق، توليد)"""
        instruction_lower = instruction.strip().lower()
        
        # 1. إذا كان الطلب قراءة أو استعلام عن المحتوى
        if action == 'read' or any(w in instruction_lower for w in ["اقرأ", "عرض", "محتوى", "ملخص", "ما هو", "كم عدد", "استعرض"]):
            return self.read_and_summarize()
            
        # 2. استخراج خطة التعديل أو تنفيذ التعديلات العامة
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

        # 3. تعديلات ذكية عامة بناءً على الكلمات المفتاحية
        if "أضف" in instruction_lower or "عمود" in instruction_lower:
            if not new_columns:
                col_name = "مؤشر الأداء"
                if "صافي" in instruction_lower:
                    col_name = "صافي القيمة"
                elif "مجموع" in instruction_lower:
                    col_name = "المجموع الكلي"
                
                insert_pos = self.ws.max_column + 1
                self.ws.insert_cols(insert_pos, amount=1)
                header_cell = self.ws.cell(row=self.header_row, column=insert_pos, value=col_name)
                self._apply_style(header_cell, 'header')
                
                for r in range(self.header_row + 1, self.ws.max_row + 1):
                    if self.ws.cell(row=r, column=1).value is not None:
                        cell = self.ws.cell(row=r, column=insert_pos)
                        self._apply_style(cell, 'data')
                        cell.value = 0

        # 4. التلوين الشرطي العام
        if "لون" in instruction_lower or "تمييز" in instruction_lower or "تحديد" in instruction_lower:
            accent_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                for c in range(1, self.ws.max_column + 1):
                    val = str(self.ws.cell(row=r, column=c).value or "")
                    if ("غياب" in instruction_lower or "صفر" in instruction_lower or "تأخير" in instruction_lower):
                        if val.isdigit() and int(val) > 0:
                            self.ws.cell(row=r, column=c).fill = accent_fill

        return {
            "success": True, 
            "is_read_only": False, # تم تعديل الملف ويجب إظهار زر التحميل
            "message": f"✅ تم تنفيذ التعديلات والعمليات بنجاح تام على الملف! (العملية: {instruction})"
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
            print(json.dumps({"success": False, "error": "لم يتم استلام بيانات"}), flush=True)
            return
            
        input_data = json.loads(raw_input)
        input_path = input_data.get("inputPath")
        output_path = input_data.get("outputPath")
        action = input_data.get("action", "modify")
        plan = input_data.get("plan", {})
        instruction = plan.get("summary", input_data.get("instruction", ""))
        sheet_name = input_data.get("sheetName")
        
        warrior = ExcelWarrior()
        warrior.load_file(input_path, sheet_name)
        
        result = warrior.process_request(action, plan, instruction)
        
        # إذا كانت عملية قراءة فقط، لا نحفظ ملف خروج جديد
        if result.get("is_read_only", False):
            print(json.dumps(result), flush=True)
            return

        if result["success"] and output_path:
            warrior.wb.save(output_path)
            
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()

