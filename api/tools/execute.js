// /api/tools/execute.js

import { toolsRegistry } from "./index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tool, payload } = req.body;

    if (!tool) {
      return res.status(400).json({ error: "لم يتم تحديد اسم الأداة." });
    }

    const selectedTool = toolsRegistry[tool];

    if (!selectedTool) {
      return res.status(400).json({
        error: `الأداة "${tool}" غير موجودة ضمن السجل.`
      });
    }

    // التحقق من الحقول المطلوبة
    for (const field of selectedTool.requiredFields) {
      if (!(field in payload)) {
        return res.status(400).json({
          error: `الأداة "${tool}" تحتاج الحقل "${field}".`
        });
      }
    }

    // تنفيذ الأداة عبر endpoint الخاص بها
    const response = await fetch(selectedTool.endpoint, {
      method: selectedTool.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // إذا الأداة رجعت ملف (Blob)
    const contentType = response.headers.get("Content-Type");

    if (contentType?.includes("application/vnd.openxmlformats-officedocument")) {
      const buffer = await response.arrayBuffer();
      return res.status(200).send(Buffer.from(buffer));
    }

    // إذا الأداة رجعت JSON
    const data = await response.json();
    return res.status(200).json({
      tool,
      result: data
    });

  } catch (err) {
    return res.status(500).json({
      error: "خطأ أثناء تنفيذ الأداة: " + err.message
    });
  }
  }
