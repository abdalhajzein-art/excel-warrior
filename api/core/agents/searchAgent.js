/**
 * api/core/agents/searchAgent.js
 * Sovereign Search Agent – وكيل البحث الخارجي الحقيقي
 */

import routeIntent from "../intent/intent_router.js";
import { autoSearch } from "../../tools/index.js";

export default {
  name: "searchAgent",

  async run(sessionId, intent, input, ctx = {}) {
    try {
      const text = typeof input === "string" ? input : ctx.message || "";
      const routed = routeIntent(text);

      // إذا لم تكن النية بحث → تجاوز
      if (routed.type !== "search") return "تجاوز";

      const query = text.trim();
      if (!query) return "⚠️ لم يتم تحديد استعلام بحث واضح.";

      // تنفيذ البحث الخارجي الحقيقي
      const result = await autoSearch(query);

      if (!result || typeof result !== "string") {
        return "⚠️ لم يتم العثور على نتائج بحث واضحة.";
      }

      return result;

    } catch (err) {
      console.error("🔥 خطأ في searchAgent:", err);
      return "⚠️ حدث خطأ أثناء تنفيذ وكيل البحث الخارجي.";
    }
  }
};
