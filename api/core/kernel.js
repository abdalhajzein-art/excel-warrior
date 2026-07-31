// api/core/kernel.js – Sovereign Kernel (محدث لتمرير السياق الجغرافي)

import groqService from "../groqService.js";
import memory from "./memory.js";

export default async function kernel(sessionId, message, ctx = {}) {
  const session = memory.getSession(sessionId);

  if (!message || typeof message !== "string" || !message.trim()) {
    return "ما استلمت رسالة مفهومة.";
  }

  const history = ctx.history || session.history || [];
  const locationContext = ctx.locationContext || ""; // ⭐ التقاط السياق الجغرافي القادم

  // ⭐ تمرير locationContext إلى groqService
  const reply = await groqService(message, { 
    history, 
    locationContext 
  });

  memory.appendHistory(sessionId, { sender: "user", text: message });
  memory.appendHistory(sessionId, { sender: "ai", text: reply });

  return reply;
}
