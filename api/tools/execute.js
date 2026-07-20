// api/tools/execute.js
import { toolsRegistry } from "./index.js";

export const handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { tool, payload } = JSON.parse(event.body);

    if (!tool || !toolsRegistry[tool]) {
      return { statusCode: 400, body: JSON.stringify({ error: "الأداة غير موجودة أو غير محددة." }) };
    }

    const selectedTool = toolsRegistry[tool];

    // تنفيذ الأداة
    const response = await fetch(`https://${event.headers.host}${selectedTool.endpoint}`, {
      method: selectedTool.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const buffer = await response.arrayBuffer();

    // إذا كان الملف إكسل (حجمه كبير)
    if (buffer.byteLength > 5000) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        body: Buffer.from(buffer).toString('base64'),
        isBase64Encoded: true
      };
    }

    // إذا كان JSON
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, result: data })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "خطأ في التنفيذ: " + err.message }) };
  }
};
