import XLSX from 'xlsx';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function modifyExcelHandler(req, res) {
  try {
    const body = req.body || req || {};
    const { base64, instruction } = body;

    console.log(`📝 modifyExcelHandler: base64 موجود؟ ${!!base64}`);
    console.log(`📝 instruction: ${instruction}`);

    if (!base64) {
      return { success: false, error: "لا يوجد ملف Excel مرفق." };
    }

    // ✅ قراءة الملف
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`📊 عدد الصفوف: ${jsonData.length}`);

    // ✅ استخدام Groq لفهم التعديل المطلوب
    const groqResponse = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `أنت محلل بيانات Excel. مهمتك فهم طلب التعديل وتحديد:
1. أي عمود نضيف أو نعدل
2. أين نضيفه (بعد أي عمود)
3. ماذا نسمي العمود الجديد

أجب فقط بـ JSON بهذا الشكل:
{
  "action": "add_column" | "modify_data" | "delete_column",
  "targetColumn": "اسم العمود المستهدف",
  "newColumnName": "اسم العمود الجديد (إذا كان الإضافة)",
  "position": "after" | "before"
}`
        },
        {
          role: "user",
          content: `طلب التعديل: ${instruction}\n\nهيكل الملف الحالي (العناوين في الصف ${jsonData[0] ? 'الأول' : 'غير موجود'}):\n${JSON.stringify(jsonData[0] || [], null, 2)}`
        }
      ],
      temperature: 0.2,
      max_completion_tokens: 200
    });

    const analysisText = groqResponse.choices[0].message.content;
    console.log(`🔍 تحليل Groq: ${analysisText}`);

    // ✅ استخراج JSON من الرد
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    } catch (parseErr) {
      console.error("❌ فشل تحليل JSON من Groq:", parseErr);
      // Fallback: نضيف عمود في النهاية
      analysis = { action: "add_column", newColumnName: "عمود جديد", position: "end" };
    }

    console.log(`📋 التحليل:`, analysis);

    let modifiedData = [...jsonData];

    // ✅ تنفيذ التعديل حسب تحليل Groq
    if (analysis.action === "add_column") {
      const newColumnName = analysis.newColumnName || "عمود جديد";
      const position = analysis.position || "end";
      
      // البحث عن العمود المستهدف
      let targetIndex = -1;
      if (analysis.targetColumn && modifiedData[0]) {
        targetIndex = modifiedData[0].findIndex(col => 
          col && col.toString().toLowerCase().includes(analysis.targetColumn.toLowerCase())
        );
      }

      // إذا ما لقى العمود أو ما في targetColumn، نضيف في النهاية
      if (targetIndex === -1) {
        console.log(`⚠️ لم يتم العثور على العمود المستهدف، نضيف في النهاية`);
        targetIndex = modifiedData[0] ? modifiedData[0].length - 1 : -1;
      }

      // تحديد موقع الإضافة
      let insertIndex;
      if (position === "after" && targetIndex !== -1) {
        insertIndex = targetIndex + 1;
      } else if (position === "before" && targetIndex !== -1) {
        insertIndex = targetIndex;
      } else {
        insertIndex = modifiedData[0] ? modifiedData[0].length : 0;
      }

      console.log(`📍 إضافة عمود "${newColumnName}" في الفهرس ${insertIndex}`);

      // إضافة العمود
      modifiedData = modifiedData.map((row, index) => {
        const newRow = [...row];
        if (index === 0) {
          // صف العناوين
          newRow.splice(insertIndex, 0, newColumnName);
        } else {
          // باقي الصفوف (فارغة)
          newRow.splice(insertIndex, 0, '');
        }
        return newRow;
      });

      console.log(`✅ تم إضافة العمود "${newColumnName}"`);

    } else if (analysis.action === "modify_data") {
      // منطق تعديل البيانات (يمكن تطويره لاحقاً)
      console.log(`⚠️ تعديل البيانات غير مدعوم حالياً`);
    } else if (analysis.action === "delete_column") {
      // منطق حذف عمود (يمكن تطويره لاحقاً)
      console.log(`⚠️ حذف عمود غير مدعوم حالياً`);
    }

    // ✅ حفظ الملف المعدل
    const newWorksheet = XLSX.utils.aoa_to_sheet(modifiedData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

    const outputBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      success: true,
      message: `✅ تم تعديل الملف بنجاح (تم إضافة عمود "${analysis.newColumnName || 'عمود جديد'}")`,
      fileBase64: outputBuffer.toString('base64'),
      fileName: `modified_${Date.now()}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    console.error("❌ Error in modifyExcelHandler:", error);
    return {
      success: false,
      error: "حدث خطأ أثناء تعديل الملف: " + error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await modifyExcelHandler(body);

    if (result.success && result.fileBase64) {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(result.fileName)}"`);
      return res.status(200).send(Buffer.from(result.fileBase64, 'base64'));
    }

    return res.status(400).json({ error: result.error || "فشل تعديل الملف" });

  } catch (err) {
    console.error("Error in modify route:", err);
    return res.status(500).json({ error: "خطأ في التعديل: " + err.message });
  }
  }
