// api/core/kernel.js – Sovereign Kernel (محدث لمنع استخدام الأدوات الداخلية)

import groqService from "../groqService.js";
import memory from "./memory.js";

export default async function kernel(sessionId, message, ctx = {}) {
  const session = memory.getSession(sessionId);

  if (!message || typeof message !== "string" || !message.trim()) {
    return "ما استلمت رسالة مفهومة.";
  }

  const history = ctx.history || session.history || [];
  const locationContext = ctx.locationContext || "";

  // ⭐ قفل الأدوات داخل النموذج
  const SYSTEM_LOCK = `
أنت ممنوع تماماً من استخدام أي أدوات داخلية مثل browser.search أو أي tool.
لا تستخدم أي وظيفة بحث أو استدعاء أدوات.
إذا احتجت معلومات خارجية، سيتم تزويدك بها حصراً من طبقة البحث السيادية (searchAgent).
ممنوع توليد أو تخمين روابط من عندك.
استخدم فقط المعلومات التي يقدمها لك النظام.
`;

  // ⭐ تمرير system prompt + التاريخ + السياق الجغرافي
  const reply = await groqService(
    `${SYSTEM_LOCK}\n\n${message}`,
    { history, locationContext }
  );

  memory.appendHistory(sessionId, { sender: "user", text: message });
  memory.appendHistory(sessionId, { sender: "ai", text: reply });

  return reply;
}
