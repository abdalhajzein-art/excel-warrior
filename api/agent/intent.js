import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Professional Intent Analyzer – Copilot-Level
 */
export async function analyzeIntent(message, context = {}) {
    const prompt = `
You are an advanced intent analyzer. Your mission is to understand the user's request with high precision.

User message: "${message}"
Attached file: ${context.fileName ? context.fileName : "none"}
File type: ${context.fileType ? context.fileType : "unknown"}

🎯 Extract the following:

1) The **primary intent**, choose only one:
   - modify      (modify an existing file)
   - generate    (create a new file)
   - analyze     (analyze a file)
   - convert     (convert file format)
   - chat        (general conversation)
   - unknown     (unclear)

2) Determine if the request is clear: true/false

3) Provide a short summary of the user's request.

4) If unclear, provide clarifying questions.

📋 Respond ONLY in JSON format:
{
  "intent": "modify | generate | analyze | convert | chat | unknown",
  "isClear": true,
  "summary": "short summary",
  "questions": []
}
`;

    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: "You are a precise and intelligent intent analyzer." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        return {
            success: true,
            data: JSON.parse(completion.choices[0].message.content)
        };

    } catch (error) {
        console.error("❌ Intent analysis error:", error);
        return {
            success: false,
            data: {
                intent: "unknown",
                isClear: false,
                summary: "Unable to understand the request",
                questions: ["Could you please rephrase your request?"]
            }
        };
    }
}
