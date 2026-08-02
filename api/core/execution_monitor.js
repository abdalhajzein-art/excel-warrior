/**
 * api/core/execution_monitor.js – Sovereign Execution & Token Audit Guard
 * مراقب سيادي محلي يسجل في لوغ السيرفر حالة كل عملية بدقة:
 * يكشف فوراً إذا تمت العملية محلياً عبر محركات بايثون (0 توكنز) أو استدعت النموذج اللغوي.
 */

import { trackTokens } from "./token_tracker.js";

export function auditExecution({ action, target = "Excel/Pandas Engine", isLocal = true, usage = null }) {
  const timestamp = new Date().toLocaleTimeString("en-GB");

  if (isLocal) {
    console.log(`\x1b[32m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🛡️ [LOCAL SOVEREIGN EXECUTION]`);
    console.log(`   ├─ Action : \x1b[36m${action}\x1b[0m`);
    console.log(`   ├─ Target : \x1b[33m${target}\x1b[0m`);
    console.log(`   └─ Tokens : \x1b[32m0 Tokens (Isolated & Executed Locally via Python)\x1b[0m\n`);
  } else {
    console.log(`\x1b[33m[ALATHEER AUDIT @ ${timestamp}]\x1b[0m 🧠 [LLM INFERENCE TRIGGERED]`);
    console.log(`   ├─ Action : \x1b[36m${action}\x1b[0m`);
    console.log(`   ├─ Target : \x1b[33m${target}\x1b[0m`);
    
    if (usage) {
      trackTokens(usage);
      console.log(`   └─ Tokens : \x1b[31mConsumed via LLM API\x1b[0m\n`);
    } else {
      console.log(`   └─ Tokens : \x1b[31mUnknown LLM Cost\x1b[0m\n`);
    }
  }
}
