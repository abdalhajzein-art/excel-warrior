const API_URL = "/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

const newChatBtn = document.getElementById("newChatBtn");
const clearChatBtn = document.getElementById("clearChatBtn");

let isWaiting = false;
let typingMsg = null;
let firstMessage = true;

/* ============================
   AUTO SCROLL
============================ */
function autoScroll() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* ============================
   SAVE CHAT LOCALLY
============================ */
function saveChat() {
  const messages = [...chatArea.querySelectorAll(".message")].map(m => ({
    sender: m.classList.contains("user") ? "user" : "ai",
    text: m.textContent
  }));
  localStorage.setItem("chatHistory", JSON.stringify(messages));
}

/* ============================
   LOAD CHAT ON PAGE RELOAD
============================ */
const saved = localStorage.getItem("chatHistory");
if (saved) {
  const messages = JSON.parse(saved);
  messages.forEach(m => addMessage(m.text, m.sender));
  firstMessage = false;
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
  msg.textContent = text;

  if (/[\u0600-\u06FF]/.test(text)) {
    msg.style.direction = "rtl";
    msg.style.textAlign = "right";
  }

  chatArea.appendChild(msg);

  /* زر نسخ لرسائل الذكاء */
  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(text);
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
    let payload = { message: text };

    if (firstMessage) {
      payload.reset = true;
      firstMessage = false;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    hideTyping();

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

/* جلسة جديدة */
newChatBtn.onclick = async () => {
  chatArea.innerHTML = "";
  localStorage.removeItem("chatHistory");
  firstMessage = true;

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true })
  });

  welcomeScreen.style.display = "block";
};

/* حذف المحادثة */
clearChatBtn.onclick = () => {
  chatArea.innerHTML = "";
  localStorage.removeItem("chatHistory");
  welcomeScreen.style.display = "block";
};

/* ENTER BEHAVIOR */
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
