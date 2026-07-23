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

    // ✅ تنفيذ الوظيفة المرتبطة بالأداة مباشرة برمجياً
    if (typeof selectedTool.handler === 'function') {
      console.log(`🔧 تنفيذ الأداة: ${tool}`);
      console.log(`📦 البيانات المرسلة:`, JSON.stringify(payload).substring(0, 200));
      
      try {
        const result = await selectedTool.handler(payload);
        console.log(`✅ تم تنفيذ الأداة ${tool} بنجاح`);
        
        // ✅ تحقق من نجاح النتيجة
        if (result && result.success === false) {
          console.warn(`⚠️ الأداة ${tool} رجعت فشل:`, result.error);
          return res.status(400).json({ 
            tool, 
            success: false, 
            error: result.error || "فشل تنفيذ الأداة" 
          });
        }
        
        return res.status(200).json({ 
          tool, 
          result,
          _data: result // ✅ للحفاظ على التوافق مع chat.js
        });
      } catch (handlerError) {
        console.error(`❌ خطأ في تنفيذ الأداة ${tool}:`, handlerError);
        return res.status(500).json({ 
          tool, 
          success: false, 
          error: handlerError.message || "خطأ في تنفيذ الأداة" 
        });
      }
    }

    // ✅ إذا كانت الأداة موجهة لـ Endpoint خارجي
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const targetUrl = `${protocol}://${host}${selectedTool.endpoint}`;

    console.log(`🌐 توجيه إلى: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: selectedTool.method || 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ خطأ من الـ Endpoint: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        success: false, 
        error: `الـ Endpoint رجع خطأ: ${response.status}`,
        details: errorText
      });
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("spreadsheetml") || contentType.includes("octet-stream") || contentType.includes("pdf")) {
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return res.status(200).json({
        success: true,
        fileBase64: base64,
        contentType,
        _data: { success: true, fileBase64: base64, contentType }
      });
    }

    const data = await response.json();
    return res.status(200).json({ 
      tool, 
      result: data,
      _data: data
    });

  } catch (err) {
    console.error("❌ خطأ في execute API:", err);
    return res.status(500).json({ 
      success: false,
      error: "خطأ في التنفيذ التقني: " + err.message 
    });
  }
}
