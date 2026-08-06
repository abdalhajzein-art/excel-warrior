/**
 * api/core/router.js – Sovereign Router (Gemini Harmonized Edition)
 */

import globalOrchestrator from "./conversation_orchestrator.js";
import memory from "./memory.js";
import executionMonitor from "./execution_monitor.js";
import errorGuard from "./error_guard.js";

export default {
  async route(sessionId, message, ctx = {}) {
    const transactionId = executionMonitor.startTransaction("Router_Gateway");

    try {
      const session =
        memory.getSession(sessionId) || memory.createSession(sessionId);

      const hasFiles = (ctx.files && ctx.files.length > 0) || ctx.filePath || session.activeFile;

      executionMonitor.log(
        transactionId,
        `[Router] Request | Session: ${sessionId} | Active File: ${!!hasFiles}`
      );

      const context = {
        ...ctx,
        message,
        sessionId,
        transactionId,
        hasFiles,
        timestamp: Date.now(),
        memoryState: session.memoryState || "active",
      };

      const result = await globalOrchestrator(sessionId, message, context);

      if (!result.ok && result.error) {
        throw new Error(result.error);
      }

      executionMonitor.endTransaction(transactionId, "Success");

      return {
        ok: true,
        output: result.reply,
        fileBase64: result.fileBase64 || null,
        fileName: result.fileName || null,
        operations: result.operations || [],
        metadata: {
          executionTime: executionMonitor.getDuration(transactionId),
          operationsCount: (result.operations || []).length,
        },
      };

    } catch (err) {
      console.error(`🔥 [Router Critical Error] Session: ${sessionId}:`, err);

      const recoveryPlan = await errorGuard.handleError(
        err,
        "Router_Gateway",
        { sessionId, message }
      );

      executionMonitor.endTransaction(transactionId, "Failed");

      return {
        ok: false,
        output:
          recoveryPlan.userMessage ||
          "⚠️ حدث خلل أثناء التوجيه، تم تفعيل بروتوكول الحماية السيادية.",
        error: err.message,
        recoveryStrategy: recoveryPlan.strategy || "unknown",
      };
    }
  },
};
