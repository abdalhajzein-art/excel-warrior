/**
 * api/core/agents/searchAgent.js
 * Sovereign Search Agent – البحث الخارجي متوقف بالكامل
 * لا يتم تنفيذ أي بحث خارجي إلا إذا طلب المستخدم صراحة "بحث خارجي".
 */

export default {
  name: "searchAgent",

  async run(sessionId, intent, input, ctx = {}) {
    const text = typeof input === "string" ? input.trim().toLowerCase() : "";

    // 🔥 فقط إذا طلب المستخدم "بحث خارجي" صراحة
    const explicitExternalSearch =
      text.includes("بحث خارجي") ||
      text.includes("ابحث عالنت") ||
      text.includes("من الانترنت") ||
      text.includes("من الويب") ||
      text.includes("مصادر خارجية");

    if (!explicitExternalSearch) {
      // لا بحث خارجي → تجاوز كامل
      return "تجاوز";
    }

    // 🔥 رد سيادي رسمي
    return "🔍 ميزة البحث الخارجي لسا ما اكتملت… عبد عم يشتغل عليها، رح تنزل قريباً.";
  }
};
