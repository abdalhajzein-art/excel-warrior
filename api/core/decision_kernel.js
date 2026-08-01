/**
 * api/core/decision_kernel.js – Sovereign Context Stitching (Final Edition)
 */

import memory from "./memory.js";
import globalOrchestrator from "./global_orchestrator.js";

export default async function decisionKernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return { ok: false, reply: "ما استلمت شي واضح يا عبد." };

  const session = memory.getSession(sessionId);
  const history = session.history || [];

  // آخر رسالتين
  const lastUser = [...history].reverse().find(h => h.role === "user");
  const lastAi = [...history].reverse().find(h => h.role === "assistant");

  let finalMessage = message;

  // 🟩 تكملة ذكية للرسائل القصيرة
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

  // 🟦 تمرير الرسالة للمايسترو
  const orchestratorResult = await globalOrchestrator(sessionId, finalMessage, ctx);

  // 🟧 استخراج الرد النصي
  let replyText = "تمام يا عبد.";
  if (typeof orchestratorResult === "string") {
    replyText = orchestratorResult;
  } else if (orchestratorResult && typeof orchestratorResult === "object") {
    replyText = orchestratorResult.reply || replyText;
  }

  // 🟪 حفظ الرسالة والرد في الذاكرة
  memory.appendHistory(sessionId, { role: "user", content: message });
  memory.appendHistory(sessionId, { role: "assistant", content: replyText });

  return orchestratorResult;
}
