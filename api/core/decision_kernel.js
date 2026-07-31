// api/core/decision_kernel.js — Sovereign Decision Kernel (Pure Context Linking)

import globalOrchestrator from "./global_orchestrator.js";
import memory from "./memory.js";

/**
 * الفكرة:
 * - ما في كلمات ثابتة
 * - ما في قواعد نصية
 * - ما في ذكاء داخلي
 * - ما في بحث داخلي
 * - ما في نوايا داخلية
 * - ما في حقن سياق
 * 
 * فقط: ربط الرسائل ببعض بشكل بشري.
 */

export default async function decisionKernel(sessionId, rawMessage, ctx = {}) {
  const message = (rawMessage || "").trim();
  if (!message) return "ما استلمت رسالة مفهومة.";

  const session = memory.getSession(sessionId);
  const history = session.history || [];

  // آخر رسالتين
  const lastUser = [...history].reverse().find(h => h.sender === "user");
  const lastAi = [...history].reverse().find(h => h.sender === "ai");

  let finalMessage = message;

  /**
   * 🧠 قاعدة بشرية:
   * إذا الأثير طلب توضيح (بدون كلمات ثابتة)
   * وإذا رسالتك قصيرة (كلمة أو كلمتين)
   * نعتبرها "تكملة" للسؤال السابق.
   * 
   * كيف نعرف إنو الأثير طلب توضيح بدون كلمات ثابتة؟
   * - نستخدم طول الرد السابق
   * - نستخدم بنية الرد السابق
   * - نستخدم إنو الرد السابق ما فيه معلومة نهائية
   * - نستخدم إنو الرد السابق كان سؤالًا وليس جوابًا
   */

  const isShort = message.split(" ").length <= 3; // كلمة أو كلمتين أو ثلاث
  const aiWasAsking =
    lastAi &&
    lastAi.text &&
    lastAi.text.endsWith("?") && // الأثير كان يسأل، مو يجاوب
    lastUser &&
    lastUser.text &&
    lastUser.text.length > 10; // السؤال السابق كان طويل (سؤال ناقص)

  if (isShort && aiWasAsking) {
    // نركّب السؤال السابق + التوضيح
    finalMessage = `${lastUser.text} (${message})`;
  }

  // نمرّر الرسالة للـ orchestrator
  const reply = await globalOrchestrator(sessionId, finalMessage, ctx);

  // حفظ التاريخ
  memory.appendHistory(sessionId, { sender: "user", text: message });
  memory.appendHistory(sessionId, { sender: "ai", text: reply });

  return reply;
      }
