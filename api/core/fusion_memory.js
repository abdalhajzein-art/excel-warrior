/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Final Edition)
 * نسخة خفيفة تمنع تضخم التوكنز وتبقي السياق دقيق وواضح.
 */

import memory from "./memory.js";

export default {
  apply(sessionId) {
    const session = memory.getSession(sessionId);

    // 🟩 تاريخ خفيف للكرنل (آخر 12 رسالة فقط)
    const chatHistory = memory.getChatHistory(sessionId, 12) || [];

    // 🟩 تاريخ سيادي خفيف (آخر 4 ردود فقط)
    const sovereignHistory = memory.getSovereignHistory(sessionId, 4) || [];

    // 🟩 آخر نية
    const currentIntent = session.meta?.lastIntent || null;

    // 🟩 نص سياقي مختصر (Snapshot)
    const fusedContextString = chatHistory
      .slice(-6)
      .map(msg => `${msg.role === 'user' ? 'المستخدم' : 'الأثير'}: ${msg.content}`)
      .join("\n");

    return {
      lastIntent: currentIntent,

      // 🟩 التاريخ الذي يراه الكيرنل (خفيف)
      history: chatHistory.slice(-12),

      // 🟩 تاريخ سيادي خفيف
      sovereignHistory: sovereignHistory.slice(-4),

      // 🟩 لا نحقن personaHistory داخل البرومبت نهائياً
      personaHistory: [],

      // 🟩 نص سياقي خفيف
      fusedContextText: fusedContextString,

      // 🟩 بيانات نهائية خفيفة جداً
      final: {
        intent: currentIntent,
        historyCount: chatHistory.length,
        sovereignCount: sovereignHistory.length
      }
    };
  },

  // 🟩 دالة فهم التكملة القصيرة
  getLastUserMessage(sessionId) {
    const chatHistory = memory.getChatHistory(sessionId, 5);
    const userMessages = chatHistory.filter(msg => msg.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }
};
