/**
 * api/core/decision_kernel.js – Sovereign Context Stitching
 * طبقة ربط سياقي بسيطة وآمنة بدون أي ذكاء أو استدعاء خارجي
 */

import memory from "./memory.js";

export default function decisionKernel(sessionId, rawMessage) {
  const message = (rawMessage || "").trim();
  if (!message) return message;

  const session = memory.getSession(sessionId);
  const history = session.history || [];

  // آخر رسالتين
  const lastUser = [...history].reverse().find(h => h.role === "user");
  const lastAi = [...history].reverse().find(h => h.role === "assistant");

  let finalMessage = message;

  // إذا الرسالة قصيرة جداً → نعتبرها تكملة للسؤال السابق
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

  return finalMessage;
}
