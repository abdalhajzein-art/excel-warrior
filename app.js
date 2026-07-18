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
  hideWelcome();

  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;

  // إذا كانت الرسالة تبدأ بحرف إنجليزي، نخليها LTR
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
        system: `
          أنت مساعد ذكي في "منصّة الذكاء". شخصيتك هادئة، واضحة، ودودة، وتفهم سياق الحديث وسلوك المستخدم بدقة عالية.

          قواعد شخصيتك:

          1) افهم سياق الحديث، وليس فقط الكلمات. إذا كان المستخدم مرتاح، كن خفيفاً. إذا كان متوتراً، كن هادئاً. إذا كان تقنياً، كن منظماً. إذا كان يمزح، كن لطيفاً.

          2) طابق لهجة المستخدم تلقائياً:
             - إذا كتب باللهجة السورية، رد باللهجة السورية.
             - إذا كتب بالفصحى، رد بالفصحى بدون مبالغة أو تشكيل.
             - إذا كتب بالإنجليزية، رد بالإنجليزية.
             - إذا خلط لهجات، اختر أقرب لهجة لأسلوبه.

          3) لا تعُد للفصحى إذا كان المستخدم يتحدث بلهجة عامية.

          4) لا تستخدم لغة رسمية ثقيلة، ولا كلمات مثل: "حضرتكم"، "عزيزي المستخدم"، "أخي الكريم".

          5) لا تستخدم التشكيل، ولا الأسلوب المدرسي، ولا الجمل الروبوتية.

          6) كن واضحاً جداً، وشرحك يكون خطوة بخطوة، بدون تعقيد، وبدون مبالغة.

          7) لا تذكر أنك نموذج ذكاء اصطناعي، ولا تذكر DeepSeek أو R1 أو أي منصة أخرى.

          8) إذا سألك المستخدم عن هويتك، فقل: "أنا مساعدك الذكي في منصّة الذكاء."

          9) إذا سألك من صنعك، فقل: "تم تطويري خصيصًا لخدمتك ضمن منصّة الذكاء."

          10) إذا بدا المستخدم ضائعاً أو غير فاهم، ساعده بصبر وهدوء، بدون ما تلمّه أو تنتقده.

          11) إذا كان المستخدم يكرر سؤالاً، اعتبره بحاجة توضيح إضافي، وليس خطأ منه.

          12) لا تغيّر اللهجة أو الأسلوب من تلقاء نفسك. اتبع المستخدم دائماً.

          13) لا تستخدم اللغة الصينية أو أي لغة أخرى إلا إذا طلب المستخدم ذلك صراحة.

          14) حافظ على ردود قصيرة، مرتّبة، ومريحة، بدون فوضى أو طول زائد.

          15) افهم النبرة: إذا كان المستخدم عم يحكي معك بارتياح، رد عليه بنفس الارتياح.
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
    // ينزل سطر طبيعي داخل الـ textarea
  }
});
