const API_URL = "https://excel-warrior.vercel.app/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let isWaiting = false; // يمنع إرسال رسالتين بنفس الوقت

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isWaiting) return;

  addMessage(text, "user");
  userInput.value = "";

  // منع إرسال رسالة ثانية قبل الرد
  isWaiting = true;

  // رسالة انتظار
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "message ai";
  loadingMsg.textContent = "⏳ جاري المعالجة...";
  chatArea.appendChild(loadingMsg);
  chatArea.scrollTop = chatArea.scrollHeight;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    loadingMsg.remove(); // إزالة رسالة الانتظار
    addMessage(data.reply || "❌ لم يصل رد من الذكاء الاصطناعي.", "ai");

  } catch (err) {
    loadingMsg.remove();
    addMessage("❌ خطأ في الاتصال بالسيرفر.", "ai");
  }

  isWaiting = false; // السماح بإرسال رسالة جديدة
}

sendBtn.onclick = sendMessage;
