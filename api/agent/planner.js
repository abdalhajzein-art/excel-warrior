/**
 * طبقة التخطيط – النسخة المحترفة
 * تبني خطة تنفيذ بسيطة ومباشرة بناءً على النية
 */

export function buildPlan(intent, context = {}) {
    const { intent: primaryIntent, summary } = intent;

    // الخطة الأساسية
    const plan = {
        action: primaryIntent,
        summary,
        steps: [],
        tool: null
    };

    switch (primaryIntent) {

        case "modify":
            plan.tool = "excel.modify";
            plan.steps = [
                "تحديد نوع التعديل المطلوب من نص المستخدم",
                "تحميل الملف الحالي من الجلسة",
                "تطبيق التعديل المطلوب على الملف",
                "إرجاع نسخة معدّلة للمستخدم"
            ];
            break;

        case "generate":
            plan.tool = "excel.generate";
            plan.steps = [
                "فهم نوع الملف المطلوب إنشاؤه",
                "تجهيز هيكل أولي للملف",
                "إنشاء الملف عبر محرك التوليد",
                "إرجاع الملف الجديد للمستخدم"
            ];
            break;

        case "analyze":
            plan.tool = "excel.analyze";
            plan.steps = [
                "قراءة الملف الحالي",
                "استخراج معلومات وإحصائيات",
                "تلخيص النتائج",
                "إرجاع تقرير للمستخدم"
            ];
            break;

        case "convert":
            plan.tool = "convert";
            plan.steps = [
                "قراءة الملف الحالي",
                "تحويله للصيغة المطلوبة",
                "إرجاع النسخة المحوّلة"
            ];
            break;

        case "chat":
            plan.tool = null;
            plan.steps = [
                "الرد على المستخدم بأسلوب بشري طبيعي",
                "تقديم مساعدة أو توضيح حسب الحاجة"
            ];
            break;

        default:
            plan.action = "chat";
            plan.tool = null;
            plan.steps = [
                "طلب توضيح من المستخدم لأن النية غير واضحة"
            ];
            break;
    }

    return plan;
                }
