import requests

def ask_arena(prompt):
    url = "https://api.arena-ai.com/v1/chat/completions"

    payload = {
        "model": "arena-llm",
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    response = requests.post(url, json=payload)
    data = response.json()

    return data["choices"][0]["message"]["content"]
