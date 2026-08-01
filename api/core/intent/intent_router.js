/**
 * api/core/intent/intent_router.js
 * Sovereign Intent Router (Agentic JSON Edition)
 * المعالج القبلي الذكي: يقرأ رسالة المستخدم، يحلل النية، يستخرج القيود، ويرجع JSON مهيكل.
 */

import groqService from "../../groqService.js";

export default async function routeIntent(message = "", hasFile = false) {
  const text = message.trim();
  
  // إذا كانت الرسالة فارغة أو قصيرة جداً وليس هناك ملف، لا تضيع التوكنز
  if (!text && !hasFile) {
    return { type: "chat", intent: "casual_chat", constraints: null, entities: [] };
  }

  // 1. بناء الـ System Prompt المصغر (Micro-Prompt) لنموذج النوايا
  const systemPrompt = `
أنت "محلل نوايا" (Intent Analyzer) صامت في منصة الأثير.
مهمتك الوحيدة هي قراءة رسالة المستخدم وإرجاع كائن JSON صالح (Valid JSON) فقط، بدون أي نص إضافي أو شروحات.

هيكلية الـ JSON المطلوبة:
{
  "type": "chat | file_action | tech_inquiry | system_command",
  "intent": "حدد النية بدقة (مثال: casual_chat, read_excel, fact_check, modify_pdf, extract_text)",
  "constraints": "أي قيود أو شروط طلبها المستخدم (مثال: '30 كلمة', 'ملخص قصير', 'باللغة الإنجليزية')، وإذا لم يوجد ضع null",
  "entities": ["قائمة بأسماء التقنيات، الإصدارات، الهواتف، أو الشركات المذكورة (مثال: 'Gemini 30', 'S25')، وإذا لم يوجد ضع مصفوفة فارغة"]
}

معلومات إضافية للسياق:
- هل المستخدم أرفق ملفاً في هذه الرسالة؟ ${hasFile ? "نعم" : "لا"}
`.trim();

  const prompt = `${systemPrompt}\n\nرسالة المستخدم: "${text}"`;

  try {
    // 2. استدعاء سريع لنموذج Groq (تكلفة شبه صفرية وسرعة بالملي ثانية)
    const response = await groqService(prompt);
    
    // 3. تنظيف الاستجابة لضمان أنها JSON نقي (إزالة علامات Markdown إذا أضافها النموذج)
    const cleanedResponse = response.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedJSON = JSON.parse(cleanedResponse);
    return parsedJSON;

  } catch (error) {
    console.error("🔥 [Intent Router Error]: فشل في تحليل الـ JSON:", error);
    // 4. خطة طوارئ (Fallback) في حال فشل التحليل
    return {
      type: "chat",
      intent: "chat",
      constraints: null,
      entities: []
    };
  }
}
