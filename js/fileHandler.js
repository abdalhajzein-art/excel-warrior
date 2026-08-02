let selectedFileObject = null;
let attachedFileName = null;
let isFileLoading = false;
const fileInput = document.createElement('input');

/* ============================================================
   ⭐ تهيئة زر رفع الملف
   ============================================================ */
export function initFileHandler(callbacks) {
    fileInput.type = 'file';
    fileInput.accept = '.xlsx, .xls, .csv, .json, .txt, .docx, .pdf, .png, .jpg, .jpeg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const attachBtn = document.getElementById('attachBtn');
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            if (callbacks && callbacks.isGenerating()) return;
            fileInput.click();
        });
    }

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        isFileLoading = true;
        if (callbacks && typeof callbacks.onUpdateSendState === 'function') {
            callbacks.onUpdateSendState();
        }

        const fileBubbles = document.getElementById('fileBubbles');
        if (fileBubbles) {
            fileBubbles.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; background: rgba(212, 175, 55, 0.05); color: #d4af37; padding: 6px 12px; border-radius: 6px; border: 1px dashed rgba(212, 175, 55, 0.3); opacity: 0.6; margin-bottom: 6px;">
                    <span>جاري تحميل الملف...</span>
                </div>
            `;
        }

        try {
            selectedFileObject = file;
            attachedFileName = file.name;
            await new Promise(resolve => setTimeout(resolve, 300));
            isFileLoading = false;

            if (callbacks && typeof callbacks.onUpdateSendState === 'function') {
                callbacks.onUpdateSendState();
            }

            showFileBubbleUI();
        } catch (err) {
            console.error("Error processing file upload:", err);
            isFileLoading = false;
            selectedFileObject = null;
            attachedFileName = null;

            if (fileBubbles) {
                fileBubbles.innerHTML = '<span style="color:#ff5555; font-size:12px; padding: 4px;">⚠️ فشل تحميل الملف</span>';
            }

            if (callbacks && typeof callbacks.onUpdateSendState === 'function') {
                callbacks.onUpdateSendState();
            }
        }
    });
}

/* ============================================================
   ⭐ عرض فقاعة الملف
   ============================================================ */
export function showFileBubbleUI() {
    const fileBubbles = document.getElementById('fileBubbles');
    if (!fileBubbles || !attachedFileName) return;

    fileBubbles.innerHTML = `
        <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(212, 175, 55, 0.15); color: #d4af37; padding: 6px 12px; border-radius: 6px; border: 1px solid rgba(212, 175, 55, 0.4); opacity: 1; margin-bottom: 6px;">
            <span>📎 ${attachedFileName}</span>
            <button type="button" id="removeFileBtn" style="background:none; border:none; color: #ff5555; cursor:pointer; font-weight:bold; font-size:14px; padding:0; line-height:1;" title="إزالة الملف">&times;</button>
        </div>
    `;

    const removeFileBtn = document.getElementById('removeFileBtn');
    if (removeFileBtn) {
        removeFileBtn.addEventListener('click', () => {
            resetFile();
        });
    }
}

/* ============================================================
   ⭐ إزالة الملف
   ============================================================ */
export function resetFile() {
    selectedFileObject = null;
    attachedFileName = null;
    isFileLoading = false;

    const fileBubbles = document.getElementById('fileBubbles');
    if (fileBubbles) fileBubbles.innerHTML = '';

    fileInput.value = '';
}

/* ============================================================
   ⭐ دوال مساعدة
   ============================================================ */
export function getSelectedFile() {
    return selectedFileObject;
}

export function getAttachedFileName() {
    return attachedFileName;
}

/* ============================================================
   ⭐ إرسال الملف إلى السيرفر عبر /api/upload
   ============================================================ */
export async function sendSelectedFileToServer() {
    if (!selectedFileObject) {
        return { error: "⚠️ لا يوجد ملف مرفوع." };
    }

    const formData = new FormData();

    // 🟢 اسم آمن فقط
    const fileExtension = selectedFileObject.name.split('.').pop();
    const safeFilename = `upload_${Date.now()}.${fileExtension}`;

    formData.append("file", selectedFileObject, safeFilename);

    // 🚫 لا ترسل الاسم الأصلي إطلاقاً
    formData.append("action", "preview");

    try {
        const response = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        return await response.json();

    } catch (err) {
        console.error("❌ خطأ أثناء إرسال الملف:", err);
        return { error: "❌ فشل إرسال الملف إلى السيرفر." };
    }
                }
