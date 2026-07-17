import requests
import os

API_KEY = os.getenv("OPENROUTER_API_KEY")

def ask_ai(prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "deepseek/deepseek-chat",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post(url, json=payload, headers=headers)
    data = response.json()

    print("AI RAW RESPONSE:", data)

    return "OK"   # ← مهم جدًا لحتى السيرفر ما يوقع
