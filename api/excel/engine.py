import sys
import json
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import re
import traceback

class ExcelWarrior:
    """المحرك السيادي الشامل لمعالجة Excel"""
    
    def __init__(self):
        self.wb = None
        self.ws = None
        self.header_row = 1
        self.temp_files = []
    
    def load_file(self, file_path, sheet_name=None):
        """تحميل ملف Excel مع دعم اختيار الورقة"""
        try:
            self.wb = openpyxl.load_workbook(file_path, data_only=False)
        except Exception as e:
            raise Exception(f"فشل تحميل الملف: {str(e)}")
            
        if sheet_name and sheet_name in self.wb.sheetnames:
            self.ws = self.wb[sheet_name]
        else:
            self.ws = self.wb.active
        self._detect_header_row()
        print(f"✅ تم تحميل الملف: {file_path}", file=sys.stderr)
        print(f"📊 عدد الصفوف: {self.ws.max_row}, عدد الأعمدة: {self.ws.max_column}", file=sys.stderr)
    
    def _detect_header_row(self):
        """كشف صف العناوين تلقائياً"""
        for r in range(1, min(self.ws.max_row + 1, 20)):
            non_empty = sum(1 for c in range(1, min(self.ws.max_column + 1, 10)) 
                          if self.ws.cell(row=r, column=c).value is not None)
            if non_empty >= 2:
                self.header_row = r
                print(f"📍 تم كشف صف العناوين في الصف: {r}", file=sys.stderr)
                break
        else:
            self.header_row = 1
    
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
    
    def add_columns(self, plan):
        """إضافة أعمدة جديدة مع صيغ ديناميكية"""
        new_columns = plan.get("newColumns", [])
        instruction = plan.get("instruction", "")
        
        # 🧠 الاستنتاج الذكي: إذا لم تكن الأعمدة محددة، نستخرجها من نص التعليمات
        if not new_columns and instruction:
            if "صافي" in instruction or "فعالية" in instruction:
                new_columns = ["أيام الفعالية الصافية"]
            else:
                new_columns = ["عمود جديد"]
        
        if not new_columns:
            return {"success": False, "error": "لا توجد أعمدة جديدة للإضافة"}
        
        print(f"🔄 إضافة أعمدة ذكية: {new_columns}", file=sys.stderr)
        
        # إدراج الأعمدة في نهاية الجدول أو بجانب نسبة الحضور
        target_col_idx = self._find_column("نسبة الحضور") or self._find_column("النسبة")
        insert_pos = (target_col_idx + 1) if target_col_idx else (self.ws.max_column + 1)
        
        self.ws.insert_cols(insert_pos, amount=len(new_columns))
        
        for idx, col_name in enumerate(new_columns):
            current_col = insert_pos + idx
            header_cell = self.ws.cell(row=self.header_row, column=current_col, value=col_name)
            self._apply_style(header_cell, 'header')
            
            # العثور على أعمدة الحضور والغياب لحساب المعادلة تلقائياً
            att_col = self._find_column("حضور")
            abs_col = self._find_column("غياب")
            
            for r in range(self.header_row + 1, self.ws.max_row + 1):
                if self.ws.cell(row=r, column=1).value is not None:
                    cell = self.ws.cell(row=r, column=current_col)
                    self._apply_style(cell, 'data')
                    
                    if att_col and abs_col:
                        att_letter = get_column_letter(att_col)
                        abs_letter = get_column_letter(abs_col)
                        cell.value = f"=IF(ISNUMBER({att_letter}{r}), {att_letter}{r} - {abs_letter}{r}, 0)"
                    else:
                        cell.value = ""
        
        # 🎨 معالجة طلب التلوين والتمييز للغياب فوراً إذا وجد في التعليمات
        if "غياب" in instruction or "لون" in instruction:
            abs_col = self._find_column("غياب")
            if abs_col:
                abs_letter = get_column_letter(abs_col)
                pink_fill = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid") # خلفية برتقالي/زهري فاتح رايق
                for r in range(self.header_row + 1, self.ws.max_row + 1):
                    val = self.ws.cell(row=r, column=abs_col).value
                    # إذا كان عدد الغياب أكبر من 0
                    if val is not None and str(val).isdigit() and int(val) > 0:
                        for c in range(1, self.ws.max_column + 1):
                            self.ws.cell(row=r, column=c).fill = pink_fill
        
        return {"success": True, "message": "✅ تم تعديل الملف وإضافة الأعمدة وتلوين صفوف الغياب بنجاح!"}
    
    def execute(self, action, plan, file_path=None, output_path=None):
        """تنفيذ أي أمر بناءً على الإجراء المطلوب"""
        try:
            print(f"🔄 تنفيذ الإجراء: {action}", file=sys.stderr)
            
            if action == "generate":
                # منطق التوليد
                pass
            
            if not file_path:
                return {"success": False, "error": "مسار الملف غير متوفر"}
            
            self.load_file(file_path, plan.get("sheetName"))
            
            if action == "modify":
                # 🚀 تمرير مرن دائماً حتى لو كانت الخطة خالية، لأن المحرك يستنتج من التعليمات
                return self.add_columns(plan)
            else:
                return {"success": False, "error": f"إجراء غير معروف: {action}"}
            
        except Exception as e:
            print(f"❌ خطأ في التنفيذ: {str(e)}", file=sys.stderr)
            print(traceback.format_exc(), file=sys.stderr)
            return {"success": False, "error": str(e)}

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "لم يتم استلام بيانات"}), flush=True)
            return
            
        input_data = json.loads(raw_input)
        action = input_data.get("action", "modify")
        input_path = input_data.get("inputPath")
        output_path = input_data.get("outputPath")
        plan = input_data.get("plan", {})
        
        warrior = ExcelWarrior()
        result = warrior.execute(action, plan, input_path, output_path)
        
        if result["success"] and output_path:
            warrior.wb.save(output_path)
        
        print(json.dumps(result), flush=True)
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e), "traceback": traceback.format_exc()}), flush=True)

if __name__ == "__main__":
    main()

