// api/core/kernel.js – Sovereign Kernel (Final Stable Edition)

import groqService from "../groqService.js";
import memory from "./memory.js";
import routeIntent from "./intent/intent_router.js";
import decisionKernel from "./decision_kernel.js";
import fusionMemory from "./fusion_memory.js";
import getSystemPrompt from "../agent/system.js"; // ← سيتم تعديله لاحقاً

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ما استلمت رسالة مفهومة.";

  const session = memory.getSession(sessionId);

  /* ============================================================
     🧠 1) استخراج التاريخ + السياق الجغرافي
     ============================================================ */
  const history = ctx.history || session.history || [];
  const locationContext = ctx.locationContext || "";

  /* ============================================================
     🧠 2) دمج الذاكرة السيادية
     ============================================================ */
  const fused = fusionMemory.apply(sessionId);

  /* ============================================================
     🧠 3) استخراج النية
     ============================================================ */
  const intent = routeIntent(message);

  /* ============================================================
     🧠 4) اتخاذ القرار
     ============================================================ */
  const decision = await decisionKernel(sessionId, message, {
    ...ctx,
    intent,
    fusedMemory: fused
  });

  /* ============================================================
     🧠 5) بناء الـ system prompt النهائي
     ============================================================ */
  const SYSTEM_PROMPT = getSystemPrompt({
    intent,
    decision,
    locationContext,
    fusedMemory: fused
  });

  /* ============================================================
     🧠 6) حماية من تضخم التاريخ
     ============================================================ */
  const safeHistory = Array.isArray(history)
    ? history.slice(-50)
    : [];

  /* ============================================================
     🧠 7) إرسال الطلب للنموذج
     ============================================================ */
  const reply = await groqService(
    `${SYSTEM_PROMPT}\n\n${message}`,
    {
      history: safeHistory,
      locationContext,
      intent,
      decision,
      fusedMemory: fused
    }
  );

  /* ============================================================
     🧠 8) حفظ التاريخ
     ============================================================ */
  memory.appendChatHistory(sessionId, { role: "user", content: message });
  memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

  return reply;
}
