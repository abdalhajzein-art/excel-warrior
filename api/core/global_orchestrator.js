/**
 * api/core/global_orchestrator.js – Sovereign Global Orchestrator (AI-Driven Decision with Fallback)
 */

import memory from "./memory.js";
import conversationOrchestrator from "./conversation_orchestrator.js";
import agentsOrchestrator from "./agents_orchestrator.js";
import searchAgent from "./agents/searchAgent.js";

import systemAgent from "../agent/system.js";
import uploadHandler from "../upload.js";

import kernel from "../groqService.js";
import * as toolsIndex from "../tools/index.js";

/**
 * 🧠 دالة اتخاذ القرار بالذكاء الاصطناعي (مع كشف الزمن)
 * تحدد إذا كان السؤال يحتاج بحث خارجي أم لا
 */
async function detectModeWithAI(input) {
  try {
    // ✅ كشف الزمن (أساسي)
    const timeIndicators = [
      "اليوم", "أمس", "غداً", "هذا الأسبوع", "الشهر الماضي", "السنة الحالية",
      "آخر", "أحدث", "جديد", "تحديث", "مستجد", "الحالي", "الآن",
      "2026", "2025", "هذا العام", "هذا الشهر", "هذه السنة"
    ];
    const hasTimeIndicator = timeIndicators.some(word => input.includes(word));

    // ✅ نطلب من Groq تصنيف السؤال
    const decisionPrompt = `أنت خبير تصنيف. السؤال: "${input}"

🔹 اكتب "search" إذا كان السؤال:
- يحتوي على إشارة زمنية (اليوم، أمس، آخر، جديد، تحديث، 2026، إلخ).
- يستفسر عن معلومات حديثة (أخبار، طقس، إصدارات، إحصاءات).
- يطلب تعريفاً أو شرحاً لمفهوم غير معروف بشكل عام.
- يحتوي على كلمات مثل: ما هو، من هو، أين، متى، كم، كيف، لماذا.

🔹 اكتب "chat" إذا كان السؤال:
- مجرد تحية (مرحبا، كيفك).
- سؤال عام عن الرأي (ما رأيك بـ...).
- طلب مساعدة تقنية (كيف أعدل ملف؟).

⚠️ **ملاحظة مهمة:** إذا كان السؤال يحتوي على إشارة زمنية، صنفه تلقائياً كـ "search".

إجابتك (كلمة واحدة فقط):`;

    const reply = await kernel(decisionPrompt, {
      temperature: 0.1,
      max_tokens: 10
    });

    const decision = typeof reply === "string" ? reply.trim().toLowerCase() : "chat";

    // ✅ إذا كان هناك إشارة زمنية، نرجح كفة "search"
    if (hasTimeIndicator && decision.includes("chat")) {
      console.log(`🧠 [AI Decision] تم تصنيف السؤال كـ "search" بسبب إشارة زمنية: "${input}"`);
      return "search";
    }

    if (decision.includes("search")) {
      console.log(`🧠 [AI Decision] تم تصنيف السؤال كـ "بحث": "${input}"`);
      return "search";
    } else {
      console.log(`🧠 [AI Decision] تم تصنيف السؤال كـ "دردشة": "${input}"`);
      return "chat";
    }

  } catch (err) {
    console.error("🔥 خطأ في AI Decision، التراجع للـ Fallback:", err);
    // Fallback: كلمات مفتاحية بسيطة
    const text = typeof input === "string" ? input.toLowerCase() : "";
    if (/طقس|weather|بحث|ابحث|أخبار|news|عدد سكان|إحصاء|من هو|ما هو|آخر إصدار|إصدارات|ميزات جديدة|تحديث|2026|اليوم|أمس|غداً|جديد|أحدث/.test(text)) {
      console.log(`🔄 [Fallback] تم تصنيف السؤال كـ "بحث" عبر الكلمات المفتاحية.`);
      return "search";
    }
    return "chat";
  }
}

export default async function globalOrchestrator(sessionId, input, ctx = {}) {
  const session = memory.getSession(sessionId);

  // ✅ استخدم الذكاء الاصطناعي لتحديد النية (مع كشف الزمن)
  const mode = ctx.mode || await detectModeWithAI(input);

  let result;

  switch (mode) {
    case "file":
      result = await conversationOrchestrator(sessionId, input, {
        ...ctx,
        file: ctx.file || session.sovereign?.lastFile || null
      });
      break;

    case "search":
      try {
        const searchResult = await searchAgent.run(sessionId, null, input, ctx);
        result = { ok: true, reply: searchResult };
      } catch (err) {
        console.error("🔥 خطأ في searchAgent:", err);
        result = { ok: false, reply: "⚠️ عذراً، حدث خطأ في جلب نتائج البحث." };
      }
      break;

    case "chat":
      try {
        const history = session.history || [];
        const aiReply = await kernel(input, { history, temperature: 0.6 });
        result = { ok: true, reply: aiReply };
      } catch (err) {
        console.error("🔥 خطأ في kernel:", err);
        result = { ok: false, reply: "⚠️ عذراً، حدث خطأ في معالجة طلبك." };
      }
      break;

    case "agent":
      result = await agentsOrchestrator(sessionId, input, ctx);
      break;

    case "system":
      result = await systemAgent(sessionId, input, ctx);
      break;

    case "upload":
      result = await uploadHandler(sessionId, input, ctx);
      break;

    case "tools":
      if (ctx.fileResult) {
        result = { ok: true, reply: await toolsIndex.autoRead(ctx.fileResult) };
      } else {
        result = { ok: true, reply: await toolsIndex.autoSearch(input) };
      }
      break;

    default:
      result = await conversationOrchestrator(sessionId, input, ctx);
      break;
  }

  return {
    ok: result?.ok ?? true,
    mode,
    reply: result?.reply ?? null,
    data: result?.data ?? null,
    fileBase64: result?.fileBase64 ?? null,
    fileName: result?.fileName ?? null,
    filePath: result?.filePath ?? null,
    raw: result
  };
      }
