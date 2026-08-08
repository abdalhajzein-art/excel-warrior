/**
 * api/core/excel_tools.js - تعريف أدوات Gemini لمعالجة Excel
 * هذه الأدوات تسمح لـ Gemini باستدعاء وظائف معالجة Excel
 */

import ExcelProcessor from './excel_processor.js';

// ============================================================
// 🔧 تعريف الأدوات (Function Declarations)
// ============================================================

export const EXCEL_TOOLS = [
    {
        functionDeclarations: [
            // 📁 إدارة المصنفات
            {
                name: "excel_get_info",
                description: "الحصول على معلومات كاملة عن ملف Excel: عدد الأوراق، الأعمدة، الصفوف، وغيرها",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: {
                            type: "STRING",
                            description: "المسار الكامل لملف Excel"
                        }
                    },
                    required: ["file_path"]
                }
            },
            // 📋 إدارة الأوراق
            {
                name: "excel_add_sheet",
                description: "إضافة ورقة جديدة إلى ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        sheet_name: { type: "STRING", description: "اسم الورقة الجديدة" }
                    },
                    required: ["file_path", "sheet_name"]
                }
            },
            {
                name: "excel_delete_sheet",
                description: "حذف ورقة من ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        sheet_name: { type: "STRING", description: "اسم الورقة المراد حذفها" }
                    },
                    required: ["file_path", "sheet_name"]
                }
            },
            {
                name: "excel_rename_sheet",
                description: "إعادة تسمية ورقة في ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        old_name: { type: "STRING", description: "الاسم الحالي للورقة" },
                        new_name: { type: "STRING", description: "الاسم الجديد للورقة" }
                    },
                    required: ["file_path", "old_name", "new_name"]
                }
            },
            // 📊 إدارة الأعمدة
            {
                name: "excel_add_column",
                description: "إضافة عمود جديد بعد عمود معين في ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        target_column: { type: "STRING", description: "اسم العمود الذي تريد الإضافة بعده" },
                        new_column: { type: "STRING", description: "اسم العمود الجديد" }
                    },
                    required: ["file_path", "target_column", "new_column"]
                }
            },
            {
                name: "excel_add_column_with_dropdown",
                description: "إضافة عمود جديد مع قائمة منسدلة (Data Validation) في ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        target_column: { type: "STRING", description: "اسم العمود الذي تريد الإضافة بعده" },
                        new_column: { type: "STRING", description: "اسم العمود الجديد" },
                        dropdown_values: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "قائمة الخيارات للقائمة المنسدلة"
                        }
                    },
                    required: ["file_path", "target_column", "new_column", "dropdown_values"]
                }
            },
            {
                name: "excel_delete_column",
                description: "حذف عمود من ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        column_name: { type: "STRING", description: "اسم العمود المراد حذفه" }
                    },
                    required: ["file_path", "column_name"]
                }
            },
            {
                name: "excel_rename_column",
                description: "إعادة تسمية عمود في ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        old_name: { type: "STRING", description: "الاسم الحالي للعمود" },
                        new_name: { type: "STRING", description: "الاسم الجديد للعمود" }
                    },
                    required: ["file_path", "old_name", "new_name"]
                }
            },
            // 🔢 إدارة البيانات
            {
                name: "excel_get_all_data",
                description: "قراءة جميع البيانات من ورقة في ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        sheet_name: { type: "STRING", description: "اسم الورقة (اختياري)" }
                    },
                    required: ["file_path"]
                }
            },
            // 📊 الرسوم البيانية
            {
                name: "excel_add_chart",
                description: "إضافة رسم بياني إلى ملف Excel",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        chart_type: { 
                            type: "STRING", 
                            enum: ["column", "bar", "line", "pie", "area", "scatter", "doughnut"],
                            description: "نوع الرسم البياني" 
                        },
                        data_range: { type: "STRING", description: "نطاق البيانات (مثل: A1:C10)" },
                        position: {
                            type: "OBJECT",
                            properties: {
                                row: { type: "INTEGER", description: "صف البداية" },
                                col: { type: "INTEGER", description: "عمود البداية" },
                                width: { type: "INTEGER", description: "العرض بالبكسل" },
                                height: { type: "INTEGER", description: "الارتفاع بالبكسل" }
                            }
                        }
                    },
                    required: ["file_path", "chart_type", "data_range"]
                }
            },
            // 🔍 التصفية والفرز
            {
                name: "excel_sort_data",
                description: "ترتيب البيانات في ملف Excel حسب عمود معين",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        sort_column: { type: "STRING", description: "اسم العمود الذي سيتم الترتيب حسبه" },
                        ascending: { type: "BOOLEAN", description: "ترتيب تصاعدي (true) أو تنازلي (false)" }
                    },
                    required: ["file_path", "sort_column"]
                }
            },
            // 📤 التصدير
            {
                name: "excel_export_csv",
                description: "تصدير ورقة Excel إلى ملف CSV",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        output_path: { type: "STRING", description: "مسار ملف CSV الناتج" }
                    },
                    required: ["file_path", "output_path"]
                }
            },
            {
                name: "excel_export_json",
                description: "تصدير ورقة Excel إلى ملف JSON",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_path: { type: "STRING", description: "مسار ملف Excel" },
                        output_path: { type: "STRING", description: "مسار ملف JSON الناتج" }
                    },
                    required: ["file_path", "output_path"]
                }
            }
        ]
    }
];

// ============================================================
// 🧠 معالج استدعاء الأدوات
// ============================================================

export async function handleExcelToolCall(functionCall, filePath) {
    const { name, args } = functionCall;
    
    console.log(`🔧 [ExcelTools] استدعاء: ${name}`, args);

    try {
        switch (name) {
            // 📁 إدارة المصنفات
            case 'excel_get_info':
                return await ExcelProcessor.getInfo(filePath || args.file_path);

            // 📋 إدارة الأوراق
            case 'excel_add_sheet':
                return await ExcelProcessor.addSheet(args.file_path, args.sheet_name);
            
            case 'excel_delete_sheet':
                return await ExcelProcessor.deleteSheet(args.file_path, args.sheet_name);
            
            case 'excel_rename_sheet':
                return await ExcelProcessor.renameSheet(args.file_path, args.old_name, args.new_name);

            // 📊 إدارة الأعمدة
            case 'excel_add_column':
                return await ExcelProcessor.addColumn(
                    args.file_path, 
                    args.target_column, 
                    args.new_column
                );
            
            case 'excel_add_column_with_dropdown':
                return await ExcelProcessor.addColumnWithDropdown(
                    args.file_path,
                    args.target_column,
                    args.new_column,
                    args.dropdown_values || ['مرض', 'ظرف طارئ', 'إجازة مرضية', 'أخرى']
                );
            
            case 'excel_delete_column':
                return await ExcelProcessor.deleteColumn(args.file_path, args.column_name);
            
            case 'excel_rename_column':
                return await ExcelProcessor.renameColumn(args.file_path, args.old_name, args.new_name);

            // 🔢 إدارة البيانات
            case 'excel_get_all_data':
                return await ExcelProcessor.getAllData(args.file_path, args.sheet_name || null);

            // 📊 الرسوم البيانية
            case 'excel_add_chart':
                return await ExcelProcessor.addChart(
                    args.file_path,
                    args.chart_type,
                    args.data_range,
                    args.position || { row: 0, col: 10, width: 400, height: 300 }
                );

            // 🔍 التصفية والفرز
            case 'excel_sort_data':
                return await ExcelProcessor.sortData(
                    args.file_path,
                    args.sort_column,
                    args.ascending !== undefined ? args.ascending : true
                );

            // 📤 التصدير
            case 'excel_export_csv':
                return await ExcelProcessor.exportToCSV(args.file_path, args.output_path);
            
            case 'excel_export_json':
                return await ExcelProcessor.exportToJSON(args.file_path, args.output_path);

            default:
                return { success: false, error: `أداة غير معروفة: ${name}` };
        }
    } catch (error) {
        console.error(`❌ [ExcelTools] فشل في ${name}:`, error);
        return { success: false, error: error.message };
    }
}

// ============================================================
// 🚀 تصدير افتراضي
// ============================================================

export default {
    EXCEL_TOOLS,
    handleExcelToolCall
};
