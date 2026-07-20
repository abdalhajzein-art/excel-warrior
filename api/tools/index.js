export const toolsDefinition = [
  {
    type: "function",
    function: {
      name: "excel_modify",
      description: "تعديل محتوى ملف إكسل موجود بناءً على خريطة تعديلات (editMap) محددة.",
      parameters: {
        type: "object",
        properties: {
          base64: { type: "string", description: "الملف بصيغة base64" },
          editMap: { type: "object", description: "التغييرات المطلوبة مثل تغيير قيم أو إضافة صفوف" }
        },
        required: ["base64", "editMap"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "excel_generate",
      description: "إنشاء ملف إكسل جديد بالكامل بناءً على تعليمات المستخدم.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "وصف لهيكلية ومحتوى ملف الإكسل المطلوب" }
        },
        required: ["instruction"]
      }
    }
  }
];
