// api/core/router.js – Sovereign Router (Advanced Edition)
// يعمل كبوابة سيادية ذكية: يراقب، يحمي من الانهيار، ويوجّه للعقل الأعلى

import globalOrchestrator from "./conversation_orchestrator.js"; // أو conversation_orchestrator.js حسب تسميتك
import memory from "./memory.js";
import executionMonitor from "./execution_monitor.js";
import errorGuard from "./error_guard.js";

export default {
  async route(sessionId, message, ctx = {}) {
    // 1. بدء تتبع العملية (تسجيل توقيت البدء لمراقبة الأداء)
    const transactionId = executionMonitor.startTransaction('Router_Gateway');
    
    try {
      // 2. ضمان وجود جلسة صحيحة أو إنشائها إن لم تكن موجودة
      const session = memory.getSession(sessionId) || memory.createSession(sessionId);

      // 3. تحليل أولي سريع (هل يوجد ملفات؟ هل هو استعلام عن بيانات؟)
      const hasFiles = ctx.files && ctx.files.length > 0;
      executionMonitor.log(transactionId, `[Incoming Request] Session: ${sessionId} | Files Attached: ${hasFiles}`);

      // 4. إثراء السياق (Enriching Context) ليكون جاهزاً للعقل السيادي
      const context = {
        ...ctx,
        message,
        sessionId,
        transactionId,
        hasFiles,
        timestamp: Date.now(),
        // إعطاء العقل الأعلى مرجعاً عن الذاكرة المرتبطة
        memoryState: session.memoryState || 'active' 
      };

      // 5. التوجيه المباشر للعقل السيادي الأعلى
      const result = await globalOrchestrator(sessionId, message, context);

      // 6. إنهاء التتبع وتغليف الرد النهائي بنجاح
      executionMonitor.endTransaction(transactionId, 'Success');
      
      return {
        ok: true,
        output: result.reply,
        raw: result,
        metadata: {
           executionTime: executionMonitor.getDuration(transactionId),
           filesProcessed: hasFiles ? ctx.files.length : 0
        }
      };

    } catch (err) {
      // 7. التدخل السيادي لاحتواء الأخطاء (Self-Healing Fallback)
      console.error(`🔥 [Router Critical Error] Session: ${sessionId}:`, err);
      
      // درع الأخطاء يقوم بتقييم الخطأ ومحاولة التعافي أو توليد رسالة لطيفة للمستخدم
      const recoveryPlan = await errorGuard.handleError(err, 'Router_Gateway', { sessionId, message });

      executionMonitor.endTransaction(transactionId, 'Failed');

      return {
        ok: false,
        // الرد المهذب بدلاً من الأخطاء التقنية المزعجة
        output: recoveryPlan.userMessage || "⚠️ واجه 'الأثير' تحدياً غير متوقع أثناء التوجيه. جاري إعادة ضبط المسار بأمان.",
        error: err.message,
        recoveryStrategy: recoveryPlan.strategy || 'unknown'
      };
    }
  }
};
