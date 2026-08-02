/**
 * api/core/execution_monitor.js – Sovereign Execution & Token Audit Guard (Standalone Edition)
 * مراقب سيادي محلي مستقل يسجل حالة كل عملية واسم الملف المسؤول بدقة مطلقة دون تبعات خارجية.
 */

export function auditExecution({ action, target = "Unknown File", isLocal = true, usage = null }) {
  const timestamp = new Date().toLocaleTimeString("en-GB");

  if (isLocal) {
    console.log(`\x1b[32m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🛡️ [LOCAL SOVEREIGN EXECUTION]`);
    console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
    console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
    console.log(`   └─ Cost        : \x1b[32m0 Tokens (Processed Locally via Python)\x1b[0m\n`);
  } else {
    console.log(`\x1b[33m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🧠 [LLM INFERENCE TRIGGERED]`);
    console.log(`   ├─ Target File : \x1b[35m${target}\x1b[0m`);
    console.log(`   ├─ Action      : \x1b[36m${action}\x1b[0m`);
    
    if (usage) {
      console.log(`   └─ Cost        : \x1b[31mConsumed via LLM API (${usage.total_tokens || usage.totalTokenCount || 'Active'} Tokens)\x1b[0m\n`);
    } else {
      console.log(`   └─ Cost        : \x1b[31mUnknown LLM Cost\x1b[0m\n`);
    }
  }
}
