/**
 * api/core/decision_kernel.js – Sovereign Context Stitching & Orchestrator Bridge
 */

import memory from "./memory.js";
import globalOrchestrator from "./global_orchestrator.js";

export default async function decisionKernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return { ok: false, reply: "ما استلمت رسالة مفهومة." };

  const session = memory.getSession(sessionId);
  const history = session.history || [];

  // آخر رسالتين
  const lastUser = [...history].reverse().find(h => h.role === "user");
  const lastAi = [...history].reverse().find(h => h.role === "assistant");

  let finalMessage = message;

  // إذا الرسالة قصيرة جداً ← نعتبرها تكملة للسؤال السابق
  const isShort = message.split(" ").length <= 3;

  const aiWasAsking =
    lastAi &&
    typeof lastAi.content === "string" &&
    lastAi.content.trim().endsWith("?") &&
    lastUser &&
    lastUser.content &&
    lastUser.content.length > 10;

  if (isShort && aiWasAsking) {
    finalMessage = `${lastUser.content} (${message})`;
  }

  // 🔑 الحلقة المفقودة: تمرير الرسالة المترابطة إلى الـ Global Orchestrator لتنفيذ الطلب
  const orchestratorResult = await globalOrchestrator(sessionId, finalMessage, ctx);

  // استخراج النص الصافي للرد لحفظه في الذاكرة بدقة
  let replyText = "تم إنجاز طلبك بنجاح!";
  if (typeof orchestratorResult === "string") {
    replyText = orchestratorResult;
  } else if (orchestratorResult && typeof orchestratorResult === "object") {
    replyText = orchestratorResult.reply || replyText;
  }

  // تحديث الذاكرة بالسجل النظيف
  memory.appendHistory(sessionId, { role: "user", content: message });
  memory.appendHistory(sessionId, { role: "assistant", content: replyText });

  return orchestratorResult;
}
