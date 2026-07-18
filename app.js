const API_URL = "/api/chat"; // سنبقيها تشير لسيرفرك على Vercel

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

let isWaiting = false;
let typingMsg = null;

function hideWelcome() {
  if (welcomeScreen) welcomeScreen.style.display = "none";
}

function addMessage(text, sender) {
  hideWelcome();
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  
  if (/[\u0600-\u06FF]/.test(text)) {
    msg.style.direction = "rtl";
    msg.style.textAlign = "right";
  } else {
    msg.style.direction = "ltr";
    msg.style.textAlign = "left";
  }

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function showTyping() {
  typingMsg = document.createElement("div");
  typingMsg.className = "typing";
  typingMsg.textContent = "جاري الرد...";
  chatArea.appendChild(typingMsg);
}

function hideTyping() {
  if (typingMsg) typingMsg.remove();
  typingMsg = null;
}

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
      body: JSON.stringify({ message: text }) // هنا السيرفر الخاص بك سيستلم النص
    });

    const data = await res.json();
    hideTyping();

    if (data.reply) {
      addMessage(data.reply, "ai");
    } else {
      addMessage("⚠️ حدث خطأ في الرد من السيرفر.", "ai");
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ في الاتصال: " + err.message, "ai");
  }
  isWaiting = false;
}

sendBtn.onclick = sendMessage;

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
