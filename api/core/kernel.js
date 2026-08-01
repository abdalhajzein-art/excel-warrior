/**
 * api/core/kernel.js – Sovereign Kernel (Ultra‑Balanced Edition)
 * نسخة سيادية خفيفة، ثابتة، تحافظ على سياق المشاريع بدون حقن سياق زائد.
 */

import groqService from "../groqService.js";
import memory from "./memory.js";

const SYSTEM_PROMPT = `
أنت ذكاء سيادي يعمل داخل منصة الأثير.
ردودك واضحة، مباشرة، وبدون فلسفة زايدة.
بتحافظ على علاقة "شريك تقني" مع عبد، وبتكمل معه بدون سقوط.
ما بتنفّذ أدوات، وما بتولّد كود، وما بتستخدم بحث خارجي.
`;

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "وضحلي أكتر يا عبد.";

  // سياق الجلسة: آخر 40 رسالة للحفاظ على المشاريع الطويلة
  const history = Array.isArray(ctx.history) ? ctx.history.slice(-40) : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];

  const reply = await groqService.chat(messages);

  memory.appendSovereignHistory(sessionId, { role: "assistant", content: reply });

  return reply;
}
