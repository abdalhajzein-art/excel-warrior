/**
 * api/core/intent/intent_router.js – Sovereign Intent Router (Safe Edition)
 * بدون أي LLM – فقط قواعد خفيفة.
 */

export default function routeIntent(message = "", hasFile = false) {
  const text = message.trim().toLowerCase();

  // ملف مرفق
  if (hasFile) {
    return { type: "file", intent: "file_action" };
  }

  // رسائل قصيرة جداً
  if (!text) {
    return { type: "chat", intent: "chat" };
  }

  // نوايا بسيطة
  if (text.includes("مرحبا") || text.includes("اهلا")) {
    return { type: "chat", intent: "greeting" };
  }

  if (text.includes("مين") && text.includes("انت")) {
    return { type: "chat", intent: "identity" };
  }

  if (text.includes("حكيلي") || text.includes("احكيلي")) {
    return { type: "chat", intent: "story" };
  }

  // افتراضي
  return { type: "chat", intent: "chat" };
}
