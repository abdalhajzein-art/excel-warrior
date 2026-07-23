/**
 * طبقة التخطيط الديناميكي - بناء خطة تنفيذ بناءً على النية والسياق
 */
export function buildPlan(intent, context = {}) {
    const plan = {
        steps: [],
        tools: [],
        dependencies: [],
        estimatedTime: '',
        riskLevel: 'low',
        fallbackPlan: null
    };

    switch (intent.primaryIntent) {
        case 'generate':
            plan.steps = buildGeneratePlan(intent, context);
            plan.tools = ['excel', 'python'];
            plan.estimatedTime = '1-3 دقائق';
            break;

        case 'modify':
            plan.steps = buildModifyPlan(intent, context);
            plan.tools = ['excel', 'python'];
            plan.estimatedTime = '30 ثانية - 2 دقائق';
            break;

        case 'analyze':
            plan.steps = buildAnalyzePlan(intent, context);
            plan.tools = ['excel', 'python'];
            plan.estimatedTime = '1-2 دقائق';
            break;

        case 'consult':
            plan.steps = buildConsultPlan(intent, context);
            plan.tools = ['excel', 'word'];
            plan.estimatedTime = '2-5 دقائق';
            break;

        case 'convert':
            plan.steps = buildConvertPlan(intent, context);
            plan.tools = ['convert'];
            plan.estimatedTime = '30 ثانية - 1 دقيقة';
            break;

        default:
            plan.steps = [
                { step: 1, action: 'طلب توضيح من المستخدم', description: 'النية غير واضحة' }
            ];
            plan.riskLevel = 'high';
            break;
    }

    return plan;
}

function buildGeneratePlan(intent, context) {
    const steps = [];
    let stepCounter = 1;

    // 1. تحليل المتطلبات
    steps.push({
        step: stepCounter++,
        action: 'تحليل متطلبات الملف',
        description: `فهم الغرض من الملف: ${intent.entities.purpose || 'عام'}`
    });

    // 2. اقتراح هيكل
    steps.push({
        step: stepCounter++,
        action: 'اقتراح هيكل الملف',
        description: 'اقتراح الأعمدة والصفوف والصيغ المناسبة'
    });

    // 3. تأكيد مع المستخدم
    steps.push({
        step: stepCounter++,
        action: 'تأكيد الخطة مع المستخدم',
        description: 'عرض الهيكل المقترح وطلب الموافقة'
    });

    // 4. التوليد
    steps.push({
        step: stepCounter++,
        action: 'توليد الملف',
        description: 'تنفيذ التوليد باستخدام محرك Python'
    });

    // 5. المراجعة
    steps.push({
        step: stepCounter++,
        action: 'مراجعة النتيجة',
        description: 'التأكد من صحة البيانات والتنسيقات'
    });

    // 6. التسليم
    steps.push({
        step: stepCounter++,
        action: 'تسليم الملف للمستخدم',
        description: 'إرسال الملف مع ملخص التنفيذ'
    });

    return steps;
}

function buildModifyPlan(intent, context) {
    const steps = [];
    let stepCounter = 1;

    // 1. تحليل التعديل المطلوب
    steps.push({
        step: stepCounter++,
        action: 'تحليل طلب التعديل',
        description: `نوع التعديل: ${intent.entities.modificationType || 'غير محدد'}`
    });

    // 2. تحديد الموقع
    steps.push({
        step: stepCounter++,
        action: 'تحديد موقع التعديل',
        description: `البحث عن العمود/الصف المطلوب`
    });

    // 3. تنفيذ التعديل
    steps.push({
        step: stepCounter++,
        action: 'تنفيذ التعديل',
        description: `تطبيق التغييرات مع الحفاظ على التنسيق`
    });

    // 4. التحقق
    steps.push({
        step: stepCounter++,
        action: 'التحقق من النتيجة',
        description: 'التأكد من صحة التعديلات والبيانات'
    });

    // 5. التسليم
    steps.push({
        step: stepCounter++,
        action: 'تسليم الملف المعدل',
        description: 'إرسال الملف للمستخدم مع ملخص التغييرات'
    });

    return steps;
}

function buildAnalyzePlan(intent, context) {
    const steps = [];
    let stepCounter = 1;

    // 1. تحليل البيانات
    steps.push({
        step: stepCounter++,
        action: 'تحليل البيانات الأساسية',
        description: 'استخراج إحصائيات أولية'
    });

    // 2. تحليل متقدم
    steps.push({
        step: stepCounter++,
        action: 'تحليل متقدم',
        description: 'استنتاجات وتوصيات بناءً على البيانات'
    });

    // 3. تقرير
    steps.push({
        step: stepCounter++,
        action: 'توليد تقرير',
        description: 'تنسيق التحليل في تقرير مفهوم'
    });

    // 4. التسليم
    steps.push({
        step: stepCounter++,
        action: 'تسليم التقرير',
        description: 'إرسال التقرير للمستخدم'
    });

    return steps;
}

function buildConsultPlan(intent, context) {
    const steps = [];
    let stepCounter = 1;

    steps.push({
        step: stepCounter++,
        action: 'فهم الاحتياجات',
        description: `الغرض: ${intent.entities.purpose || 'غير محدد'}`
    });

    steps.push({
        step: stepCounter++,
        action: 'تقديم خيارات',
        description: 'عرض 2-3 خيارات مع مزايا وعيوب كل خيار'
    });

    steps.push({
        step: stepCounter++,
        action: 'مناقشة مع المستخدم',
        description: 'الرد على أسئلة المستخدم وتوضيح النقاط'
    });

    steps.push({
        step: stepCounter++,
        action: 'تقديم توصية',
        description: 'اقتراح الخيار الأنسب حسب السياق'
    });

    return steps;
}

function buildConvertPlan(intent, context) {
    const steps = [];
    let stepCounter = 1;

    steps.push({
        step: stepCounter++,
        action: 'تحليل الملف المصدر',
        description: `الملف: ${context.fileName || 'غير محدد'}`
    });

    steps.push({
        step: stepCounter++,
        action: 'تحويل الملف',
        description: `إلى صيغة: ${intent.entities.targetFormat || 'غير محدد'}`
    });

    steps.push({
        step: stepCounter++,
        action: 'التحقق من النتيجة',
        description: 'التأكد من صحة التحويل والمحتوى'
    });

    steps.push({
        step: stepCounter++,
        action: 'تسليم الملف المحول',
        description: 'إرسال الملف للمستخدم'
    });

    return steps;
}
