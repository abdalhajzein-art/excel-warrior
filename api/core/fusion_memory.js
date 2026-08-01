/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Sovereign Edition)
 * ذاكرة سياقية خفيفة، دقيقة، بدون نوايا، بدون حماية، بدون طبقات زائدة.
 */

import memory from "./memory.js";

export default {
  apply(sessionId) {
    const session = memory.getSession(sessionId);

    if (!session) {
      return {
        history: [],
        userProfile: null,
        lastTopics: [],
        tags: []
      };
    }

    // 🟩 تاريخ الجلسة (آخر 30 رسالة فقط)
    const history = session.chatHistory || [];
    const recentHistory = history.slice(-30);

    // 🟩 استخراج المواضيع
    const lastTopics = extractTopics(recentHistory);

    // 🟩 استخراج النبرة (Tags)
    const tags = extractTags(recentHistory);

    // 🟩 بروفايل المستخدم (اختياري للتوسعة لاحقاً)
    const userProfile = session.userProfile || null;

    return {
      history: recentHistory,
      userProfile,
      lastTopics,
      tags
    };
  },

  // 🟩 آخر رسالة للمستخدم (مفيد للكرنل)
  getLastUserMessage(sessionId) {
    const history = memory.getChatHistory(sessionId, 5);
    const userMessages = history.filter(msg => msg.role === "user");
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }
};

/* ============================================================
   🧠 استخراج المواضيع من الرسائل
   ============================================================ */
function extractTopics(history) {
  const topics = [];

  history.forEach(h => {
    const text = (h.content || "").toLowerCase();

    if (text.includes("ملف")) topics.push("file");
    if (text.includes("شجرة")) topics.push("tree");
    if (text.includes("كرنل")) topics.push("kernel");
    if (text.includes("ذاكرة")) topics.push("memory");
    if (text.includes("نظام")) topics.push("system");
    if (text.includes("تنظيف")) topics.push("cleanup");
    if (text.includes("سياق")) topics.push("context");
  });

  return [...new Set(topics)].slice(-10);
}

/* ============================================================
   🧠 استخراج النبرة (Tags)
   ============================================================ */
function extractTags(history) {
  const tags = [];

  history.forEach(h => {
    const text = (h.content || "").toLowerCase();

    if (text.includes("يلا")) tags.push("fast");
    if (text.includes("جاهز")) tags.push("ready");
    if (text.includes("بدون عشوائية")) tags.push("precision");
    if (text.includes("نظام")) tags.push("system");
    if (text.includes("بناء")) tags.push("build");
    if (text.includes("شيل")) tags.push("remove");
  });

  return [...new Set(tags)].slice(-10);
  }
