const API_URL = "https://excel-warrior.vercel.app/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

let isWaiting = false;
let typingMsg = null;

/* إخفاء شاشة الترحيب */
function hideWelcome() {
  if (welcomeScreen) welcomeScreen.style.display = "none";
}

/* إضافة رسالة */
function addMessage(text, sender) {
  hideWelcome();
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;

  if (/^[a-zA-Z0-9]/.test(text)) {
    msg.style.direction = "ltr";
    msg.style.textAlign = "left";
  }

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* جاري الرد */
function showTyping() {
  typingMsg = document.createElement("div");
  typingMsg.className = "typing";
  typingMsg.textContent = "جاري الرد...";
  chatArea.appendChild(typingMsg);
}

/* إخفاء جاري الرد */
function hideTyping() {
  if (typingMsg) typingMsg.remove();
  typingMsg = null;
}

/* إرسال الرسالة */
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
        message: text
      })
    });

    const data = await res.json();

    hideTyping();
    addMessage(data.reply || "❌ لم يصل رد من الذكاء الاصطناعي.", "ai");

  } catch (err) {
    hideTyping();
    addMessage("❌ خطأ في الاتصال بالسيرفر.", "ai");
  }

  isWaiting = false;
}

sendBtn.onclick = sendMessage;

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {}
});
