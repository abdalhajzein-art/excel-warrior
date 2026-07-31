/**
 * api/chat.js – Sovereign Chat Layer (مع رادار الـ IP الجغرافي الصامت)
 */

import conversationOrchestrator from "./core/conversation_orchestrator.js";

// ⭐ دالة استشعار الموقع تلقائياً من الـ IP الخاص بالطلب (بدون أي أذونات متصفح)
async function getIPLocation(req) {
  try {
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    
    // إذا كان السيرفر يعمل محلياً (Localhost)
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return "[موقع المستخدم: شبكة محلية / Localhost]";
    }

    // جلب بيانات الموقع من الـ IP بخدمة سريعة وصامتة
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return `[معلومات الموقع الجغرافي التلقائي للمستخدم: الدولة ${data.country}, المنطقة ${data.regionName}, المدينة ${data.city}]`;
    }
  } catch (err) {
    console.error("⚠️ خطأ في تحديد الموقع عبر الـ IP:", err);
  }
  return "";
}

export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const userContent = (body.message || body.prompt || "").trim();
    const sessionKey = body.sessionId || "default";
    const fileResult = body.fileResult || null;
    const history = body.history || [];
    
    // ⭐ استشعار الموقع تلقائياً في الخلفية من جهة السيرفر
    const locationContext = await getIPLocation(req);

    if (!userContent && !fileResult) {
      return res.status(400).json({
        reply: "⚠️ الرجاء إرسال رسالة أو ملف."
      });
    }

    const output = await conversationOrchestrator(sessionKey, userContent, {
      fileResult,
      history,
      locationContext // ⭐ تمرير الموقع المكتشف صمتاً إلى العقل المدبر
    });

    let reply = "تم إنجاز طلبك بنجاح!";
    let fileBase64 = null;
    let fileName = null;

    if (typeof output === "string") {
      reply = output;
    } else if (output && typeof output === "object") {
      reply = output.reply || reply;
      fileBase64 = output.fileBase64 || null;
      fileName = output.fileName || null;
    }

    return res.status(200).json({
      reply,
      fileBase64,
      fileName
    });

  } catch (error) {
    console.error("❌ خطأ في api/chat.js:", error);
    return res.status(500).json({
      reply: `⚠️ خطأ داخلي أثناء المعالجة: ${error.message}`
    });
  }
}
