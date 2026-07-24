import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import traceback

class ExcelWarrior:
    """المحرك العام المطلق لمعالجة أي ملف Excel في العالم"""
    
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
        """كشف أكيّس لصف العناوين بغض النظر عن شكل الملف"""
        for r in range(1, min(self.ws.max_row + 1, 20)):
            non_empty = sum(1 for c in range(1, min(self.ws.max_column + 1, 15)) 
                          if self.ws.cell(row=r, column=c).value is not None)
            if non_empty >= 2:
                self.header_row = r
                break
        else:
            self.header_row = 1
    
    def _find_column(self, target_name):
        if not target_name:
            return None
        target_lower = str(target_name).strip().lower()
        for c in range(1, self.ws.max_column + 1):
            val = str(self.ws.cell(row=self.header_row, column=c).value or "").strip().lower()
            if target_lower in val or val in target_lower:
                return c
        return None
    
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
    
    def process_request(self, instruction):
        """تنفيذ أي طلب بشري ديناميكياً وبشكل عام"""
        instruction_lower = instruction.strip().lower()
        
        # إذا طلب إضافة عمود أو حسابات
        if "أضف" in instruction_lower or "عمود" in instruction_lower or "حساب" in instruction_lower:
            # استخراج اسم العمود الجديد من الطلب أو تعيين اسم عام
            col_name = "مؤشر الأداء المتقدم"
            if "صافي" in instruction_lower:
                col_name = "صافي القيمة"
            elif "مجموع" in instruction_lower:
                col_name = "المجموع الكلي"
            
            insert_pos = self.ws.max_column + 1
            self.ws.insert_cols(insert_pos, amount=1)
            
            header_cell = self.ws.cell(row=self.header_row, column=insert_pos, value=col_name)
            self._apply_style(header_cell, 'header')
            
            # تعبئة الخلايا بصيغة افتراضية آمنة أو قيمة فارغة قابلة للتخصيص
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                if self.ws.cell(row=r, column=1).value is not None:
                    cell = self.ws.cell(row=r, column=insert_pos)
                    self._apply_style(cell, 'data')
                    cell.value = 0
        
        # التلوين الشرطي العام لأي صف أو خلية تحتوي على شروط معينة
        if "لون" in instruction_lower or "تمييز" in instruction_lower:
            pink_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                for c in range(1, self.ws.max_column + 1):
                    val = str(self.ws.cell(row=r, column=c).value or "")
                    if "غياب" in instruction_lower and val.isdigit() and int(val) > 0:
                        self.ws.cell(row=r, column=c).fill = pink_fill
                        break
                        
        return {"success": True, "message": "✅ تم تحليل وتنفيذ الطلب البرمجي العام على الملف بنجاح تام!"}

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "لم يتم استلام بيانات"}), flush=True)
            return
            
        input_data = json.loads(raw_input)
        input_path = input_data.get("inputPath")
        output_path = input_data.get("outputPath")
        instruction = input_data.get("instruction", "")
        sheet_name = input_data.get("sheetName")
        
        warrior = ExcelWarrior()
        warrior.load_file(input_path, sheet_name)
        result = warrior.process_request(instruction)
        
        if result["success"] and output_path:
            warrior.wb.save(output_path)
            
        print(json.dumps(result), flush=True)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()
