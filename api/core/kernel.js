/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Balanced Edition)
 */

import groqService from "../groqService.js";
import memory from "./memory.js";
import { SYSTEM_PROMPT } from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك… احكيلي أكتر.";

  let userMessage = message;
  if (ctx.fileData) {
    userMessage += `\n\n(📎 تم استلام بيانات ملف — جاهز استخدمها إذا احتجت)`;
  }

  const history = Array.isArray(ctx.history) ? ctx.history.slice(-40) : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage }
  ];

  // ⭐⭐ التعديل الحاسم
  const reply = await groqService.chat(messages, {
    fileData: ctx.fileData || null
  });

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  return reply;
}
