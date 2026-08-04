// api/core/router.js – Sovereign Router (Excel Warrior Edition)
// يربط العقل السيادي مع محرك Excel (الجسر) ويضمن الاستقرار الكامل

import globalOrchestrator from "./conversation_orchestrator.js";
import memory from "./memory.js";
import executionMonitor from "./execution_monitor.js";
import errorGuard from "./error_guard.js";
import { spawn } from "child_process";
import path from "path";

export default {
  async route(sessionId, message, ctx = {}) {
    const transactionId = executionMonitor.startTransaction("Router_Gateway");

    try {
      // 1) ضمان وجود جلسة
      const session =
        memory.getSession(sessionId) || memory.createSession(sessionId);

      const hasFiles = ctx.files && ctx.files.length > 0;

      executionMonitor.log(
        transactionId,
        `[Router] Incoming Request | Session: ${sessionId} | Files: ${hasFiles}`
      );

      // 2) بناء السياق للعقل السيادي
      const context = {
        ...ctx,
        message,
        sessionId,
        transactionId,
        hasFiles,
        timestamp: Date.now(),
        memoryState: session.memoryState || "active",
      };

      // 3) العقل السيادي يولّد خطة العمليات
      const result = await globalOrchestrator(sessionId, message, context);

      // إذا العقل السيادي قرر أن الجسر يجب أن يعمل
      if (result?.excelOperations) {
        const operations = result.excelOperations;
        const filePath = ctx.filePath;

        if (!filePath) {
          throw new Error(
            "لم يتم تمرير مسار الملف إلى الجسر. يجب توفير ctx.filePath."
          );
        }

        executionMonitor.log(
          transactionId,
          `[Router] Executing Excel Operations (${operations.length})`
        );

        // 4) تنفيذ الجسر عبر Python
        const bridgePath = path.resolve("api/core/excel_bridge.py");

        const python = spawn("python3", [
          bridgePath,
          filePath,
          JSON.stringify(operations),
        ]);

        let output = "";
        let errorOutput = "";

        python.stdout.on("data", (data) => {
          output += data.toString();
        });

        python.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        const bridgeResult = await new Promise((resolve) => {
          python.on("close", () => {
            try {
              const parsed = JSON.parse(output);
              resolve(parsed);
            } catch (err) {
              resolve({
                success: false,
                error: "فشل تحليل نتيجة الجسر.",
                raw: output,
                stderr: errorOutput,
              });
            }
          });
        });

        executionMonitor.log(
          transactionId,
          `[Router] Bridge Execution Completed`
        );

        return {
          ok: true,
          output: result.reply,
          excel: bridgeResult,
          metadata: {
            executionTime: executionMonitor.getDuration(transactionId),
            operationsCount: operations.length,
          },
        };
      }

      // 5) إذا ما في عمليات Excel
      executionMonitor.endTransaction(transactionId, "Success");

      return {
        ok: true,
        output: result.reply,
        raw: result,
        metadata: {
          executionTime: executionMonitor.getDuration(transactionId),
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
          "⚠️ حدث خلل أثناء التوجيه، تم تفعيل بروتوكول الحماية.",
        error: err.message,
        recoveryStrategy: recoveryPlan.strategy || "unknown",
      };
    }
  },
};
