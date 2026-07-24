import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import traceback

class ExcelWarrior:
    """المحرك السيادي الشامل لمعالجة Excel محلياً وبكفاءة مطلقة"""
    
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
        print(f"✅ تم تحميل الملف بنجاح. صف العناوين: {self.header_row}", file=sys.stderr)
    
    def _detect_header_row(self):
        for r in range(1, min(self.ws.max_row + 1, 20)):
            non_empty = sum(1 for c in range(1, min(self.ws.max_column + 1, 10)) 
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
        """تنفيذ الأوامر برمجياً بناءً على نص الطلب وبدون الاعتماد على الذكاء الاصطناعي في التنفيذ"""
        instruction_lower = instruction.strip().lower()
        
        # استنتاج وإضافة الأعمدة بناءً على الكلمات المفتاحية
        new_columns = []
        if "صافي" in instruction_lower or "فعالية" in instruction_lower:
            new_columns = ["أيام الفعالية الصافية"]
        
        if new_columns:
            target_col_idx = self._find_column("نسبة الحضور") or self._find_column("النسبة")
            insert_pos = (target_col_idx + 1) if target_col_idx else (self.ws.max_column + 1)
            self.ws.insert_cols(insert_pos, amount=len(new_columns))
            
            att_col = self._find_column("حضور")
            abs_col = self._find_column("غياب")
            
            for idx, col_name in enumerate(new_columns):
                current_col = insert_pos + idx
                header_cell = self.ws.cell(row=self.header_row, column=current_col, value=col_name)
                self._apply_style(header_cell, 'header')
                
                for r in range(self.header_row + 1, self.ws.max_row + 1):
                    if self.ws.cell(row=r, column=1).value is not None:
                        cell = self.ws.cell(row=r, column=current_col)
                        self._apply_style(cell, 'data')
                        if att_col and abs_col:
                            att_letter = get_column_letter(att_col)
                            abs_letter = get_column_letter(abs_col)
                            cell.value = f"=IF(ISNUMBER({att_letter}{r}), {att_letter}{r} - {abs_letter}{r}, 0)"
        
        # التلوين الشرطي لصفوف الغياب إذا طلب المستخدم ذلك
        if "غياب" in instruction_lower or "لون" in instruction_lower:
            abs_col = self._find_column("غياب")
            if abs_col:
                pink_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")
                for r in range(self.header_row + 1, self.ws.max_row + 1):
                    val = self.ws.cell(row=r, column=abs_col).value
                    if val is not None and str(val).isdigit() and int(val) > 0:
                        for c in range(1, self.ws.max_column + 1):
                            self.ws.cell(row=r, column=c).fill = pink_fill
                            
        return {"success": True, "message": "✅ تم تنفيذ التعديلات البرمجية وتنسيق الملف بنجاح تام!"}

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

