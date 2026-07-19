const API_URL = "/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

let isWaiting = false;
let typingMsg = null;
let lastUserRequest = "";

/* ============================
   AUTO SCROLL
============================ */
function autoScroll() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* ============================
   WELCOME SCREEN
============================ */
function hideWelcome() {
  if (welcomeScreen) welcomeScreen.style.display = "none";
}

/* ============================
   ADD MESSAGE (HTML)
============================ */
function addMessage(text, sender) {
  hideWelcome();

  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerHTML = text;

  if (/[\u0600-\u06FF]/.test(text)) {
    msg.style.direction = "rtl";
    msg.style.textAlign = "right";
  }

  chatArea.appendChild(msg);

  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.textContent.trim());
    msg.appendChild(copyBtn);
  }

  autoScroll();
}

/* ============================
   TYPING
============================ */
function showTyping() {
  typingMsg = document.createElement("div");
  typingMsg.className = "typing";
  typingMsg.textContent = "جاري الرد...";
  chatArea.appendChild(typingMsg);
  autoScroll();
}

function hideTyping() {
  if (typingMsg) typingMsg.remove();
  typingMsg = null;
  autoScroll();
}

/* ============================
   FILE UPLOAD
============================ */
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".xlsx,.xls,.csv";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

const attachBtn = document.getElementById("attachBtn");
attachBtn.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  addMessage(`📎 تم رفع الملف: ${file.name}`, "user");

  const reader = new FileReader();

  reader.onload = async () => {
    const base64 = reader.result.split(",")[1];

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          data: base64
        })
      });

      const data = await res.json();

      window.lastUploadedExcel = data.content;

      addMessage(`📄 تم قراءة الملف.\nاحكي معي لنناقش التعديلات.`, "ai");

    } catch (err) {
      addMessage("⚠️ فشل رفع الملف: " + err.message, "ai");
    }
  };

  reader.readAsDataURL(file);
};

/* ============================
   EXECUTE FINAL EXCEL CHANGE
============================ */
async function processExcel(instruction) {
  if (!window.lastUploadedExcel) {
    addMessage("⚠️ لا يوجد ملف Excel مرفوع.", "ai");
    return;
  }

  showTyping();

  try {
    const res = await fetch("/api/excel/modify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: window.lastUploadedExcel,
        instruction
      })
    });

    hideTyping();

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    addMessage("تم تجهيز النسخة المعدّلة، تقدر تحملها من هون:", "ai");

    const link = document.createElement("a");
    link.href = url;
    link.download = "modified.xlsx";
    link.textContent = "تحميل الملف المعدّل";
    link.style.display = "inline-block";
    link.style.marginTop = "10px";
    link.style.color = "#007bff";
    link.style.fontWeight = "bold";

    chatArea.lastChild.appendChild(link);

  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ أثناء تعديل الملف: " + err.message, "ai");
  }
}

/* ============================
   SEND MESSAGE (CHAT + FILE ANALYSIS)
============================ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;

  lastUserRequest = text;

  addMessage(text, "user");
  userInput.value = "";
  isWaiting = true;
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        excelContent: window.lastUploadedExcel || null
      })
    });

    const data = await res.json();
    hideTyping();

    if (data.reply) {
      addMessage(data.reply, "ai");

      // إذا الذكاء قال جملة تدل على إنه رح يجهّز نسخة جديدة → نفّذ التعديل من السيرفر
      if (
        data.reply.includes("حضّرلك النسخة الجديدة") ||
        data.reply.includes("جهّزلك النسخة المعدّلة") ||
        data.reply.includes("أرتّبلك النسخة الجديدة")
      ) {
        // نستخدم آخر طلب للمستخدم كتعليمات للتعديل
        processExcel(lastUserRequest);
      }

    } else {
      addMessage("⚠️ خطأ في الرد من السيرفر.", "ai");
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ في الاتصال: " + err.message, "ai");
  }

  isWaiting = false;
}

/* ============================
   BUTTONS
============================ */
sendBtn.onclick = sendMessage;

newChatBtn.onclick = async () => {
  chatArea.innerHTML = "";

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true })
  });

  welcomeScreen.style.display = "block";
};

clearChatBtn.onclick = () => {
  chatArea.innerHTML = "";
  welcomeScreen.style.display = "block";
};

/* ============================
   ENTER BEHAVIOR
============================ */
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.ctrlKey) {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    textarea.value =
      textarea.value.substring(0, start) +
      "\n" +
      textarea.value.substring(end);

    textarea.selectionStart = textarea.selectionEnd = start + 1;
  }

  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
});
