import pandas as pd
import json
import sys

try:
    df = pd.read_excel(sys.argv[1], nrows=10)
    print(json.dumps({
        "rows": len(df),
        "columns": len(df.columns),
        "sheets": 1,
        "text": df.to_markdown(index=False)
    }, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"error": str(e)}))
