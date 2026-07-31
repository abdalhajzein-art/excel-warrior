/**
 * api/core/intent/intent_general.js
 * Sovereign General Intent – بدون أي بحث خارجي تلقائي
 */

export default function detectGeneralIntent(message = "") {
  const text = message.toLowerCase().trim();

  if (!text || text.length < 2) return "chat";

  /* ============================================================
     🟥 بحث خارجي صريح فقط
     ============================================================ */
  const explicitExternalSearch =
    text.includes("بحث خارجي") ||
    text.includes("ابحث خارجي") ||
    text.includes("من الإنترنت") ||
    text.includes("من الويب") ||
    text.includes("مصادر خارجية");

  if (explicitExternalSearch) {
    return "external_search";
  }

  /* ============================================================
     🟦 كل شيء آخر = دردشة
     ============================================================ */
  return "chat";
}
