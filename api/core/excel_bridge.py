# api/core/excel_bridge.py
import sys
import json
import openpyxl

def execute_operations(file_path, operations):
    try:
        wb = openpyxl.load_workbook(file_path)
        ws = wb.active
        
        for op in operations:
            op_type = op.get("type")
            
            # 1. إضافة عمود جديد
            if op_type == "add_column":
                header = op.get("header")
                after_col_name = op.get("after")
                target_col = ws.max_column + 1
                
                if after_col_name:
                    for col in range(1, ws.max_column + 1):
                        if ws.cell(row=3, column=col).value == after_col_name:
                            target_col = col + 1
                            ws.insert_cols(target_col)
                            break
                else:
                    ws.insert_cols(target_col)
                
                ws.cell(row=3, column=target_col, value=header)
                # ملء قيم افتراضية للصفوف
                for r in range(4, ws.max_row + 1):
                    ws.cell(row=r, column=target_col, value="-")

            # 2. تعديل خلية محددة
            elif op_type == "update_cell":
                address = op.get("address")
                value = op.get("value")
                ws[address] = value

        wb.save(file_path)
        return {"success": True, "message": "تم تنفيذ العمليات بنجاح"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    file_path = sys.argv[1]
    operations_json = sys.argv[2]
    operations = json.loads(operations_json)
    result = execute_operations(file_path, operations)
    print(json.dumps(result))
