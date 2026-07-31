// api/core/kernel.js – Sovereign Kernel (نسخة مستقرة مع دمج الهوية والسيادة)

import groqService from "../groqService.js";
import memory from "./memory.js";
import routeIntent from "./intent/intent_router.js";
import fusionMemory from "./fusion_memory.js";
import systemPrompt from "../agent/system.js";

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ما استلمت رسالة مفهومة.";

  const session = memory.getSession(sessionId);

  // التاريخ + السياق الجغرافي
  let history = ctx.history || session.history || [];
  const locationContext = ctx.locationContext || "";

  // حماية من تضخم التاريخ
  if (Array.isArray(history)) {
    history = history.slice(-50);
  } else {
    history = [];
  }

  // دمج الذاكرة السيادية
  const fusedMemory = fusionMemory.apply(sessionId);

  // استخراج النية
  const intent = routeIntent(message);

  // قفل الأدوات داخل النموذج (سيادة الروابط والأدوات)
  const SYSTEM_LOCK = `
أنت ممنوع تماماً من استخدام أي أدوات داخلية مثل browser.search أو أي tool.
لا تستخدم أي وظيفة بحث أو استدعاء أدوات.
إذا احتجت معلومات خارجية، سيتم تزويدك بها حصراً من طبقة البحث السيادية (searchAgent).
ممنوع توليد أو تخمين روابط من عندك.
استخدم فقط المعلومات التي يقدمها لك النظام.
`;

  // بناء system prompt النهائي (هوية الأثير + القفل السيادي)
  const FINAL_SYSTEM_PROMPT = `
${SYSTEM_LOCK}

${systemPrompt()}
`.trim();

  // إرسال الطلب للنموذج
  const reply = await groqService(
    `${FINAL_SYSTEM_PROMPT}\n\n${message}`,
    {
      history,
      locationContext,
      intent,
      fusedMemory
    }
  );

  // حفظ التاريخ بصيغة موحّدة
  memory.appendChatHistory(sessionId, { role: "user", content: message });
  memory.appendChatHistory(sessionId, { role: "assistant", content: reply });

  return reply;
}
