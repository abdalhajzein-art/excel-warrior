/**
 * api/core/kernel.js – Sovereign Kernel (Architect Edition)
 * العقل المدبر النقي: بناء البرومبت، استدعاء نموذج Groq، وتجنب التكرار المزدوج للذاكرة
 */

import groqService from "../groqService.js";
import routeIntent from "./intent/intent_router.js";
import systemPrompt from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ما استلمت رسالة مفهومة يا مهندس.";

  // التاريخ والسياق القادمين من المايسترو والذاكرة المدمجة
  let history = ctx.history || [];
  if (!Array.isArray(history)) history = [];
  history = history.slice(-20);

  const fusedMemory = ctx.fusedMemory || {};
  const intent = ctx.intent || routeIntent(message);
  const shieldWarning = ctx.shieldWarning || null;

  // بناء الـ prompt النهائي السيادي
  const prompt = `
${systemPrompt()}

${shieldWarning ? `[تنبيه أمني من جدار الحماية: ${shieldWarning}]` : ""}

الرسالة الحالية:
"${message}"

النية المكتشفة:
${JSON.stringify(intent, null, 2)}

السياق المدمج والذاكرة:
${JSON.stringify(fusedMemory, null, 2)}

التاريخ السابق:
${history.map(h => `${h.role}: ${h.content}`).join("\n")}

مهمتك:
- الرد دائماً برد لغوي واضح وعميق.
- ممنوع ترجع نص فاضي أو null أو undefined.
- إذا الرسالة قصيرة → رد بروح الزميل الذكي.
- إذا الرسالة سؤال أو نقاش → أعطِ الزبدة بذكاء واحترافية.
- خاطب عبدالغني دائماً بروح المعماري والزميل المطور.
`.trim();

  // إرسال الطلب لـ Groq عبر الخدمة المركزية
  const reply = await groqService(prompt);

  // *ملاحظة معمارية*: تم فصل حفظ الذاكرة ليتم حصراً في الأوركسترا لضمان عدم الازدواجية والتضخم.
  return reply || "يبدو أن النموذج لم يعرِف رداً مناسباً، جرب مرة أخرى.";
}
