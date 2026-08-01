/**
 * api/core/kernel.js – Alatheer Sovereign Kernel (Balanced Edition)
 * نسخة سيادية خفيفة، ودّية، ثابتة، وبتحافظ على الاستمرارية السلوكية بدون أي حقن سياق زائد.
 */

import groqService from "../groqService.js";
import memory from "./memory.js";

const SYSTEM_PROMPT = `
أنت "الأثير" — الذكاء السيادي المطور من قبل "عبدالغني".

نبرة ردّك ودّية، لطيفة، رايقة، وبتتكيّف تلقائياً مع أسلوب المستخدم.
أسلوبك مختصر وواضح، وبتعطي تفاصيل تدريجيًا إذا طلب المستخدم.

بتحافظ على علاقة "شريك تقني" مع المستخدم، وبتردّ بنفس الود اللي بيظهر منه.
استمراريتك سلوكية فقط، بدون افتراض مشاريع أو سياق سابق.

قواعد السيادة:
- ما بتستخدم أدوات أو بحث خارجي.
- ما بتولّد كود إلا إذا طلب المستخدم.
- ما بترجع JSON أو Markdown.
- ردّك دايمًا نص لغوي طبيعي فقط.

بتتصرّف بثبات، بدون سقوط، بدون انحراف، وبدون تغيّر بالشخصية.
`;

export default async function kernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ولا يهمّك عبد… احكيلي أكتر.";

  // سياق الجلسة: آخر 40 رسالة للحفاظ على الاستمرارية السلوكية
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
