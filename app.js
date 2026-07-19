const API_URL = "/api/chat";
const EXECUTOR_URL = "/api/tools/execute";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

let isWaiting = false;
let typingMsg = null;

window.lastEditMap = null;
window.lastUploadedExcelJSON = null;

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
   ADD MESSAGE
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
   ATTACHMENT BOX
============================ */
const attachmentBox = document.getElementById("attachmentBox");

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

  // عرض الملف داخل صندوق الرسالة فقط
  attachmentBox.innerHTML = `
    <span>📎 ${file.name}</span>
    <button id="removeAttachment">❌</button>
  `;
  attachmentBox.classList.remove("hidden");

  document.getElementById("removeAttachment").onclick = () => {
    attachmentBox.classList.add("hidden");
    window.lastUploadedExcelJSON = null;
  };

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
      window.lastUploadedExcelJSON = data;

    } catch (err) {
      addMessage("⚠️ فشل رفع الملف: " + err.message, "ai");
    }
  };

  reader.readAsDataURL(file);
};

/* ============================
   TOOL CALL PARSER
============================ */
function extractToolCall(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const json = JSON.parse(match[0]);

    if (json.tool && json.payload) {
      return json;
    }

    return null;
  } catch {
    return null;
  }
}

/* ============================
   EXECUTE TOOL (FIXED)
============================ */
async function executeTool(toolCall) {
  showTyping();

  try {
    const res = await fetch(EXECUTOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toolCall)
    });

    hideTyping();

    const clone = res.clone();
    let blob;

    try {
      blob = await clone.blob();

      if (blob.type.includes("sheet") || blob.type.includes("excel") || blob.size > 50_000) {
        const url = URL.createObjectURL(blob);

        addMessage("📥 تم تنفيذ الأداة. الملف جاهز للتحميل:", "ai");

        const link = document.createElement("a");
        link.href = url;
        link.download = "result.xlsx";
        link.textContent = "تحميل الملف";
        link.style.display = "inline-block";
        link.style.marginTop = "10px";
        link.style.color = "#2d6cff";
        link.style.fontWeight = "bold";

        chatArea.lastChild.appendChild(link);

        return;
      }
    } catch (err) {
      console.log("Blob read failed, fallback to JSON");
    }

    const data = await res.json();
    addMessage(`🔧 نتيجة تنفيذ الأداة:\n${JSON.stringify(data, null, 2)}`, "ai");

  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ أثناء تنفيذ الأداة: " + err.message, "ai");
  }
}

/* ============================
   SEND MESSAGE
============================ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;

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
        excelJSON: window.lastUploadedExcelJSON || null
      })
    });

    const data = await res.json();
    hideTyping();

    if (!data.reply) {
      addMessage("⚠️ خطأ في الرد من السيرفر.", "ai");
      isWaiting = false;
      return;
    }

    addMessage(data.reply, "ai");

    const toolCall = extractToolCall(data.reply);

    if (toolCall) {
      await executeTool(toolCall);
      isWaiting = false;
      return;
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
  window.lastEditMap = null;
  window.lastUploadedExcelJSON = null;
  attachmentBox.classList.add("hidden");

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true })
  });

  welcomeScreen.style.display = "block";
};

clearChatBtn.onclick = () => {
  chatArea.innerHTML = "";
  window.lastUploadedExcelJSON = null;
  attachmentBox.classList.add("hidden");
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
