/**
 * api/core/kernel.js – Sovereign Kernel (Final Production Edition)
 * تاريخ طويل داخل النظام + Snapshot صغير داخل البرومبت.
 */

import groqService from "../groqService.js";
import routeIntent from "./intent/intent_router.js";
import systemPrompt from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "وضحلي أكتر يا عبد.";

  // التاريخ الكامل داخل النظام (30 رسالة)
  let history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

  // Snapshot صغير للبرومبت (آخر 6 رسائل فقط)
  const historySnapshot = history.slice(-6);

  // الذاكرة — Snapshot خفيف
  const fusedMemory = ctx.fusedMemory || {};

  // النية — خفيفة
  const intent = ctx.intent || routeIntent(message);

  // تنبيه الحماية إذا موجود
  const shieldWarning = ctx.shieldWarning || null;

  // بناء البرومبت النهائي — نسخة خفيفة
  const prompt = `
${systemPrompt()}

${shieldWarning ? `[تنبيه أمني: ${shieldWarning}]` : ""}

الرسالة:
"${message}"

النية:
${intent.type || "chat"}

سياق مختصر:
${JSON.stringify(fusedMemory).slice(0, 300)}

تاريخ مختصر:
${historySnapshot.map(h => `${h.role}: ${h.content}`).join("\n")}

مهمتك:
- رد واضح ومختصر.
- الرسائل القصيرة → رد طبيعي.
- الأسئلة → جواب مباشر.
- النقاش → ناقش بدون تطويل.
`.trim();

  const reply = await groqService(prompt);

  return reply || "ما طلع معي رد مناسب، جرّب صياغة تانية.";
}
