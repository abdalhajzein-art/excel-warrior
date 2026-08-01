/**
 * api/core/kernel.js – Sovereign Kernel (Stable Edition)
 */

import groqService from "../groqService.js";
import routeIntent from "./intent/intent_router.js";
import systemPrompt from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "وضحلي أكتر يا عبد.";

  // التاريخ الكامل داخل النظام (آخر 30 رسالة)
  const history = Array.isArray(ctx.history) ? ctx.history.slice(-30) : [];

  // Snapshot صغير للبرومبت (آخر 6 رسائل فقط)
  const historySnapshot = history.slice(-6);

  // الذاكرة الخفيفة
  const fusedMemory = ctx.fusedMemory || {};

  // النية — نستخدمها فقط للقرار، مو للبرومبت
  const intent = ctx.intent || routeIntent(message);

  // تنبيه الحماية إذا موجود
  const shieldWarning = ctx.shieldWarning || null;

  // 🟩 البرومبت النهائي — بدون إدخال "النية" نهائيًا
  const prompt = `
${systemPrompt()}

${shieldWarning ? `[تنبيه أمني: ${shieldWarning}]` : ""}

الرسالة:
"${message}"

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

  // 🟩 استدعاء النموذج
  const reply = await groqService(prompt);

  return reply || "ما طلع معي رد مناسب، جرّب صياغة تانية.";
}
