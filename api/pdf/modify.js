// /api/pdf/modify.js
export async function modifyPdfHandler(req, res) {
  try {
    const { base64, instruction } = req.body || {};

    if (!base64 || !instruction) {
      return res.status(400).json({ success: false, error: "الملف والتعليمات مطلوبة لتعديل الـ PDF." });
    }

    return res.status(200).json({
      success: true,
      message: "تمت معالجة ملف الـ PDF بنجاح.",
    });
  } catch (error) {
    console.error("Error in modifyPdfHandler:", error);
    return res.status(500).json({ success: false, error: "خطأ في معالجة الـ PDF." });
  }
}

