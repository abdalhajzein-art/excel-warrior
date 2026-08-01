/**
 * api/core/fusion_memory.js – Sovereign Memory Fusion (Architect Edition)
 * التوليف الذكي: يطبق التثبيت المرجعي، يصلح مسارات النوايا، ويستخلص السياق الضمني للنموذج
 */

import memory from "./memory.js";

export default {
  apply(sessionId) {
    const session = memory.getSession(sessionId);

    // 1. استخدام الدوال الذكية حصراً لتفعيل التثبيت المرجعي (Anchoring) وحماية التوكنز
    const chatHistory = memory.getChatHistory(sessionId, 12) || [];
    const sovereignHistory = memory.getSovereignHistory(sessionId, 6) || [];

    // 2. إصلاح المسار المعماري للنية ليقرأ من meta
    const currentIntent = session.meta?.lastIntent || null;

    // 3. بناء سياق نصي مكثف (Fused Context Text) لعمليات الحقن المعقدة
    let fusedContextString = "";
    if (chatHistory.length > 0) {
      fusedContextString = chatHistory
        .map(msg => `${msg.role === 'user' ? 'المستخدم' : 'الأثير'}: ${msg.content}`)
        .join("\n");
    }

    return {
      lastIntent: currentIntent,
      history: chatHistory, 
      sovereignHistory: sovereignHistory,
      personaHistory: session.persona?.history || [], 
      fusedContextText: fusedContextString, 

      final: {
        intent: currentIntent,
        historyCount: chatHistory.length,
        sovereignCount: sovereignHistory.length,
        personaCount: (session.persona?.history || []).length
      }
    };
  },

  /**
   * 🧠 دالة لقط السياق القصير (لحل مشكلة التكملة مثل: "وعن بايثون ١٥")
   * هذه الدالة نمررها لـ decision_kernel لفهم النية الممتدة من الرسالة السابقة
   */
  getLastUserMessage(sessionId) {
    const chatHistory = memory.getChatHistory(sessionId, 5); // نبحث في آخر 5 رسائل فقط
    const userMessages = chatHistory.filter(msg => msg.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
  }
};
