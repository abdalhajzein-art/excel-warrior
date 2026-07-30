// api/core/error_guard.js – Sovereign Error Guard (Final Edition)

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
  }
};