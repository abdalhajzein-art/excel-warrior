// رابط API الصحيح على سيرفرك الجديد
const API_URL = "https://excel-warrior.vercel.app/api/chat";  // ← عدّل حسب اسم مشروعك

// عناصر الواجهة
const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// إضافة رسالة للواجهة
function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// إرسال الرسالة للذكاء الاصطناعي
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // عرض رسالة المستخدم
  addMessage(text, "user");
  userInput.value = "";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    // عرض رد الذكاء
    addMessage(data.reply || "❌ لم يصل رد من الذكاء الاصطناعي.", "ai");

  } catch (err) {
    addMessage("❌ خطأ في الاتصال بالسيرفر.", "ai");
  }
}

// زر الإرسال
sendBtn.onclick = sendMessage;

// إرسال عند الضغط على Enter
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
