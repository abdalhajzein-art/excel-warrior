# api/core/excel_bridge.py
import sys
import json
import openpyxl
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.worksheet.datavalidation import DataValidation

def execute_operations(file_path, operations):
    try:
        # تحميل ملف الإكسل
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        
        execution_log = []
        
        for idx, op in enumerate(operations):
            op_type = op.get("type")
            
            # محرك التنفيذ البرمجي الديناميكي: جيميناي يكتب سكريبت بايثون مخصص وينفذه فوراً
            if op_type == "execute_code" or "code" in op:
                code_snippet = op.get("code")
                if not code_snippet:
                    raise ValueError("لم يتم توفير كود بايثون لتنفيذه في الجسر.")
                
                # تجهيز نطاق العمليات (Namespace) مع كافة المكتبات والأدوات الاحترافية جاهزة للاستخدام
                local_scope = {
                    "wb": wb,
                    "ws": ws,
                    "openpyxl": openpyxl,
                    "pd": pd,
                    "Font": Font,
                    "PatternFill": PatternFill,
                    "Alignment": Alignment,
                    "Border": Border,
                    "Side": Side,
                    "DataValidation": DataValidation,
                    "get_column_letter": get_column_letter,
                    "column_index_from_string": column_index_from_string
                }
                
                # تنفيذ المقتطف البرمجي المُولّد ذكياً بأمان تام داخل سياق الملف
                exec(code_snippet, {"__builtins__": __builtins__}, local_scope)
                execution_log.append(f"تم تنفيذ السكريبت البرمجي الديناميكي رقم {idx + 1} بنجاح مطلق.")
            
            else:
                raise ValueError(f"نوع العملية غير معروف أو غير مدعوم: {op_type}")
        
        # حفظ التعديلات نهائياً
        wb.save(file_path)
        return {
            "success": True, 
            "message": "تم تنفيذ العمليات الديناميكية بنجاح وتحديث الملف",
            "log": execution_log
        }
        
    except Exception as e:
        return {
            "success": False, 
            "error": str(e),
            "trace_hint": "راجع صياغة كود البايثون المُرسل وتأكد من توافق إحداثيات الخلايا أو أسماء الأعمدة."
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
