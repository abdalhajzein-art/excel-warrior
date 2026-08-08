// api/core/cache_engine.js
import memory from "./memory.js";

const CACHE_TTL = 3600000; // ساعة واحدة (بالملي ثانية)

export default {
  save(sessionId, intent, payload = {}) {
    const session = memory.getSession(sessionId);
    
    // حماية: إذا لم توجد جلسة، لا تقم بشيء أو تعامل مع الخطأ
    if (!session) return null;

    session.cache = session.cache || {};

    session.cache[intent] = {
      payload,
      createdAt: Date.now() // أضفنا طابع زمني للتحقق لاحقاً
    };

    return session.cache[intent];
  },

  get(sessionId, intent) {
    const session = memory.getSession(sessionId);
    if (!session || !session.cache?.[intent]) return null;

    const entry = session.cache[intent];

    // حماية: تحقق من انتهاء الصلاحية
    if (Date.now() - entry.createdAt > CACHE_TTL) {
      delete session.cache[intent];
      return null;
    }

    return entry;
  },

  clear(sessionId) {
    const session = memory.getSession(sessionId);
    if (session) {
      session.cache = {};
      return true;
    }
    return false;
  }
};
