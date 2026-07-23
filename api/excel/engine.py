import sys
import json
import traceback
import openpyxl

# ✅ سجل كل خطوة
def log(msg):
    with open("/tmp/debug.log", "a") as f:
        f.write(f"{msg}\n")

log("🚀 بدء تشغيل المحرك")

try:
    log("📥 قراءة البيانات")
    input_data = json.loads(sys.stdin.read())
    log(f"📦 البيانات: {input_data}")
    
    # ... الكود حقك ...
    
    log("✅ تم التنفيذ بنجاح")
    
except Exception as e:
    log(f"❌ خطأ: {e}")
    log(traceback.format_exc())
    print(json.dumps({"success": False, "error": str(e)}))
