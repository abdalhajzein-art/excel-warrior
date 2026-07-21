// api/tools/execute.js
import { toolsRegistry } from "./index.js";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { tool, payload } = body || {};

    if (!tool || !toolsRegistry || !toolsRegistry[tool]) {
      return res.status(400).json({ error: "الأداة غير موجودة أو غير محددة في السجل." });
    }

    const selectedTool = toolsRegistry[tool];

    // تنفيذ الوظيفة المرتبطة بالأداة مباشرة برمجياً لتجنب مشاكل الـ fetch الداخلي على Vercel
    if (typeof selectedTool.handler === 'function') {
      const result = await selectedTool.handler(payload);
      return res.status(200).json({ tool, result });
    }

    // إذا كانت الأداة موجهة لـ Endpoint خارجي أو مسار منفصل
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const targetUrl = `${protocol}://${host}${selectedTool.endpoint}`;

    const response = await fetch(targetUrl, {
      method: selectedTool.method || 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("spreadsheetml") || contentType.includes("octet-stream")) {
      const buffer = await response.arrayBuffer();
      return res.status(200).json({
        success: true,
        fileBase64: Buffer.from(buffer).toString('base64'),
        contentType
      });
    }

    const data = await response.json();
    return res.status(200).json({ tool, result: data });

  } catch (err) {
    console.error("Error in execute API:", err);
    return res.status(500).json({ error: "خطأ في التنفيذ التقني: " + err.message });
  }
}
