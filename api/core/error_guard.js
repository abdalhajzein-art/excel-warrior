// api/core/error_guard.js – Sovereign Error Guard (Advanced Self-Healing Edition)

export default {
  guard(fn) {
    return async (...args) => {
      try {
        const result = await fn(...args);

        // إذا رجع null أو undefined → اعتبره خطأ
        if (result === null || result === undefined) {
          return {
            ok: false,
            reason: "null_or_undefined_output",
            safe: "⚠️ لم يتم توليد نتيجة صالحة."
          };
        }

        return { ok: true, result };
      } catch (err) {
        return {
          ok: false,
          reason: "exception_thrown",
          error: err.message,
          safe: "⚠️ حدث خطأ أثناء التنفيذ."
        };
      }
    };
  },

  /**
   * 🛡️ معالج الأخطاء المتقدم للتعافي الذاتي (Self-Healing Recovery Plan)
   */
  async handleError(err, contextName = 'Unknown', metadata = {}) {
    console.error(`🛡️ [ErrorGuard] معالجة خطأ في [${contextName}]:`, err.message);
    
    const errorMessage = err.message || '';
    let strategy = 'standard_fallback';
    let userMessage = "⚠️ واجه 'الأثير' تحدياً غير متوقع أثناء المعالجة. جاري إعادة ضبط المسار بأمان.";

    // تصنيف ذكي للخطأ لتوجيه المستخدم بدقة
    if (errorMessage.includes('الملف غير موجود') || errorMessage.includes('FileNotFound') || errorMessage.includes('غير موجود على القرص')) {
        strategy = 'file_missing_recovery';
        userMessage = "⚠️ عذراً يا مهندس، يبدو أن الملف المؤقت قد تبخر أو أُعيد تشغيل الحاوية. يرجى إعادة رفع الملف لنستأنف العمليات فوراً.";
    } else if (errorMessage.includes('API') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        strategy = 'api_quota_recovery';
        userMessage = "⚠️ حدث ضغط مؤقت على مزود الذكاء الاصطناعي. يرجى المحاولة مرة أخرى بعد قليل.";
    }

    return {
        ok: false,
        strategy,
        userMessage,
        error: errorMessage,
        timestamp: Date.now(),
        metadata
    };
  }
};
