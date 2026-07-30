// api/core/fusion_memory.js – Sovereign Memory Fusion (Final Edition)

import memory from "./memory.js";

export default {
  apply(sessionId) {
    const session = memory.getSession(sessionId);

    return {
      lastIntent: session.lastIntent || null,
      history: session.history || [],
      sovereignHistory: session.sovereign?.history || [],
      personaHistory: session.persona?.history || [],
      final: {
        intent: session.lastIntent || null,
        historyCount: (session.history || []).length,
        sovereignCount: (session.sovereign?.history || []).length,
        personaCount: (session.persona?.history || []).length
      }
    };
  }
};