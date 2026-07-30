// api/core/kernel.js – Sovereign Kernel (Final Minimal Edition)
// العقل السيادي للدردشة فقط – بدون أي طبقات قديمة

import groqService from "../groqService.js";
import memory from "./memory.js";

export default async function kernel(sessionId, message, ctx = {}) {
  const session = memory.getSession(sessionId);

  // حماية الرسالة
  if (!message || typeof message !== "string" || !message.trim()) {
    return "ما استلمت رسالة مفهومة.";
  }

  // التاريخ
  const history = ctx.history || session.history || [];

  // استدعاء الذكاء اللغوي فقط للدردشة
  const reply = await groqService(message, { history });

  // تحديث الذاكرة
  memory.appendHistory(sessionId, { sender: "user", text: message });
  memory.appendHistory(sessionId, { sender: "ai", text: reply });

  return reply;
}