const API_URL = "/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

let isWaiting = false;
let typingMsg = null;
let isInitialLoad = true;   // ← أهم نقطة

/* ============================
   AUTO SCROLL (Copilot style)
============================ */
function smoothScrollToBottom() {
  if (isInitialLoad) return; // ← لا تعمل scroll أثناء التحميل الأولي

  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
    requestAnimationFrame(() => {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  });
}

/* ============================
   ADD MESSAGE
============================ */
function addMessage(text, sender, doScroll = true) {
  hideWelcome();

  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;

  if (/[\u0600-\u06FF]/.test(text)) {
    msg.style.direction = "rtl";
    msg.style.textAlign = "right";
  }

  chatArea.appendChild(msg);

  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(text);
    msg.appendChild(copyBtn);
  }

  if (doScroll) smoothScrollToBottom();
}

/* ============================
   LOAD CHAT ON PAGE RELOAD
============================ */
const saved = localStorage.getItem("chatHistory");
if (saved) {
  const messages = JSON.parse(saved);

  // نضيف الرسائل القديمة بدون scroll
  messages.forEach(m => addMessage(m.text, m.sender, false));

  // بعد انتهاء التحميل → رجّع الشات لفوق
  chatArea.scrollTop = 0;
}

isInitialLoad = false; // ← انتهى التحميل الأولي

/* ============================
   TYPING
============================ */
function showTyping() {
  typingMsg = document.createElement("div");
  typingMsg.className = "typing";
  typingMsg.textContent = "جاري الرد...";
  chatArea.appendChild(typingMsg);
  smoothScrollToBottom();
}

function hideTyping() {
  if (typingMsg) typingMsg.remove();
  typingMsg = null;
  smoothScrollToBottom();
}

/* ============================
   SEND MESSAGE
============================ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;

  addMessage(text, "user");
  saveChat();

  userInput.value = "";
  isWaiting = true;

  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    hideTyping();

    if (data.reply === "🔄 تم بدء جلسة جديدة.") return;

    if (data.reply) {
      addMessage(data.reply, "ai");
      saveChat();
    } else {
      addMessage("⚠️ حدث خطأ في الرد من السيرفر.", "ai");
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
  localStorage.removeItem("chatHistory");

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true })
  });

  welcomeScreen.style.display = "block";
};

clearChatBtn.onclick = () => {
  chatArea.innerHTML = "";
  localStorage.removeItem("chatHistory");
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
