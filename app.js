const API_URL = "https://excel-warrior.vercel.app/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

let isWaiting = false;
let typingMsg = null;

/* إخفاء شاشة الترحيب */
function hideWelcome() {
  if (welcomeScreen) {
    welcomeScreen.style.display = "none";
  }
}

/* إضافة رسالة */
function addMessage(text, sender) {
  hideWelcome(); // أول رسالة تخفي الترحيب

  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;

  // كشف اللغة الإنجليزية تلقائياً
  if (/^[a-zA-Z0-9]/.test(text)) {
    msg.style.direction = "ltr";
    msg.style.textAlign = "left";
  }

  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* عرض جاري الرد */
function showTyping() {
  typingMsg = document.createElement("div");
  typingMsg.className = "typing";
  typingMsg.textContent = "جاري الرد...";
  chatArea.appendChild(typingMsg);
  chatArea.scrollTop = chatArea.scrollHeight;
}

/* إخفاء جاري الرد */
function hideTyping() {
  if (typingMsg) {
    typingMsg.remove();
    typingMsg = null;
  }
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
        message: text,

        // وضع مطابقة اللغة تلقائياً
        system: `
          طابق لغة المستخدم ولهجته تلقائيًا:
          إذا كتب باللهجة السورية، رد باللهجة السورية.
          إذا كتب بالعربية الفصحى، رد بالفصحى.
          إذا كتب بالإنجليزية، رد بالإنجليزية.
          إذا كتب بلغة أخرى، طابقها.
          لا تعُد إلى الفصحى إذا كان المستخدم يتحدث بلهجة عامية.
          لا تغيّر اللغة أو اللهجة من تلقاء نفسك.
          
          لا تذكر أنك DeepSeek أو R1 أو أي نموذج ذكاء اصطناعي.
          إذا سألك المستخدم عن اسمك، فقل: "أنا مساعدك الذكي في منصّة الذكاء."
          إذا سألك من صنعك، فقل: "تم تطويري خصيصًا لخدمتك ضمن منصّة الذكاء."
        `
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

/* زر الإرسال */
sendBtn.onclick = sendMessage;

/* Enter ينزل سطر فقط */
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // ينزل سطر طبيعي
  }
});
