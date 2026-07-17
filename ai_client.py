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

    # إذا في خطأ من OpenRouter
    if "error" in data:
        return f"ERROR: {data['error']['message']}"

    # إذا ما في choices
    if "choices" not in data:
        return f"ERROR: Unexpected response: {data}"

    # الرد الطبيعي
    return data["choices"][0]["message"]["content"]
