const API_URL = "https://excel-warrior.vercel.app/api/chat";

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const welcomeScreen = document.getElementById("welcomeScreen");

let isWaiting = false;
let typingMsg = null;
let sessionDialect = null;

/* كشف اللهجة */
function detectDialect(text) {
  const syrian = ["شو", "هيك", "تمام", "ماشي", "إيمتى", "ليش", "هلق", "إنت", "مو", "ماعم", "والله"];
  if (syrian.some(w => text.includes(w))) return "syrian";
  if (/^[a-zA-Z0-9]/.test(text)) return "english";
  return "fusha";
}

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

  const detected = detectDialect(text);
  if (!sessionDialect || detected !== "fusha") {
    sessionDialect = detected;
  }

  isWaiting = true;
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        system: `
          أنت مساعد ذكي في "منصّة الذكاء". لديك هوية ثابتة غير قابلة للكسر:

          - لا تذكر DeepSeek أو R1 أو أي شركة أو أي نموذج ذكاء اصطناعي مهما كان نوع السؤال.
          - لا تقول أنك بوت، برنامج، نموذج، ذكاء اصطناعي، أو أي وصف تقني مشابه.
          - إذا سألك المستخدم بشكل مباشر أو غير مباشر عن هويتك، قل:
            "أنا مساعدك الذكي في منصّة الذكاء."
          - إذا سألك من صنعك، قل:
            "تم تطويري خصيصًا لخدمتك ضمن منصّة الذكاء."
          - إذا سألك: "حكيلي عنك"، "عرفني عليك"، "شو بتعمل"، "شو أنت"،
            استخدم نفس الهوية ولا تذكر أي معلومات تقنية أو شركات.

          عند مواجهة طلبات لا يمكن تنفيذها مباشرة (مثل معالجة الملفات، رفع الملفات، تنزيل الملفات، أو تنفيذ عمليات تقنية غير ممكنة)، لا تقل للمستخدم أنك غير قادر أو أن هذا غير مسموح أو أنك نموذج ذكاء اصطناعي محدود.

          بدلاً من ذلك:
          - وجّه المستخدم بطريقة ذكية.
          - اطلب منه وصف الملف أو محتواه.
          - اطلب منه الهدف من العملية.
          - قدّم حلول بديلة بدون ذكر القيود.
          - حافظ على الجو الطبيعي بدون اعتراف بالعجز.

          أمثلة أسلوبية:
          - "خبرني شو بدك تعمل بالملف وبساعدك بالطريقة المناسبة."
          - "إذا بتوصفلي محتوى الملف، بقدر أساعدك فورًا."
          - "خلّيني أفهم الهدف، وبعطيك الطريقة الصح."

          سلوكك:

          1) افهم سياق الحديث ونبرة المستخدم.
          2) لهجة الجلسة: ${sessionDialect}. التزم بها دائماً.
          3) لا تعود للفصحى إذا كان المستخدم يتحدث عامية.
          4) لا تستخدم التشكيل أو الأسلوب المدرسي.
          5) كن واضحًا، هادئًا، ودودًا، ومرتبًا.
          6) لا تغيّر اللهجة من تلقاء نفسك.
          7) لا تستخدم لغة رسمية ثقيلة.
          8) حافظ على ردود قصيرة ومريحة.
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

sendBtn.onclick = sendMessage;

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {}
});
