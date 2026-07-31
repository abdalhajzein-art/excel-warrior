/**
 * api/core/kernel.js – Sovereign Kernel (النسخة المتوافقة مع groqService الجديد)
 */

import groqService from "../groqService.js";
import memory from "./memory.js";
import routeIntent from "./intent/intent_router.js";
import fusionMemory from "./fusion_memory.js";
import systemPrompt from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ما استلمت رسالة مفهومة.";

  const session = memory.getSession(sessionId);

  // التاريخ
  let history = ctx.history || session.history || [];
  if (!Array.isArray(history)) history = [];
  history = history.slice(-20);

  // دمج الذاكرة السيادية
  const fusedMemory = fusionMemory.apply(sessionId);

  // استخراج النية
  const intent = routeIntent(message);

  // بناء الـ prompt النهائي
  const prompt = `
${systemPrompt()}

الرسالة:
"${message}"

النية:
${JSON.stringify(intent, null, 2)}

السياق:
${JSON.stringify(fusedMemory, null, 2)}

التاريخ:
${history.map(h => `${h.role}: ${h.content}`).join("\n")}

مهمتك:
- الرد دائماً برد لغوي واضح
- ممنوع ترجع نص فاضي
- ممنوع تتجاهل
- ممنوع تسكت
- إذا الرسالة قصيرة → رد طبيعي
- إذا الرسالة سؤال → جاوب
- إذا الرسالة نقاش → ناقش
- اذا ما انطلب منك تفاصيل اكتفي باختصار وشرح وافي بنفس الوقت
`.trim();

  // إرسال الطلب للنموذج
  const reply = await groqService(prompt);

  // حفظ التاريخ
  memory.appendChatHistory(sessionId, { role: "user", content: message });
  memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

  return reply;
}
