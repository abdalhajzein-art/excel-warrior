/* ============================
   SIDEBAR — MOBILE FIRST OVERLAY
============================ */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

// فتح / إغلاق السايدبار (toggle)
sidebarToggle.onclick = () => {
  sidebar.classList.toggle("open");
};

// إغلاق عند الضغط خارج السايدبار
document.addEventListener("click", (e) => {
  const insideSidebar = sidebar.contains(e.target);
  const insideToggle = sidebarToggle.contains(e.target);

  if (!insideSidebar && !insideToggle) {
    sidebar.classList.remove("open");
  }
});

/* ============================
   BASE ELEMENTS
============================ */
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

/* ============================
   MULTI FILE ATTACH SYSTEM
============================ */
const fileBubbles = document.getElementById("fileBubbles");
let attachedFiles = [];

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".xlsx,.xls,.csv";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

document.getElementById("attachBtn").onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

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

      attachedFiles.push({
        name: file.name,
        json: data
      });

      renderFileBubbles();

    } catch (err) {
      addMessage("⚠️ فشل رفع الملف: " + err.message, "ai");
    }
  };

  reader.readAsDataURL(file);
};

function renderFileBubbles() {
  fileBubbles.innerHTML = "";

  attachedFiles.forEach((f, index) => {
    const bubble = document.createElement("div");
    bubble.className = "file-bubble";
    bubble.innerHTML = `
      <span>📎 ${f.name}</span>
      <button onclick="removeFile(${index})">❌</button>
    `;
    fileBubbles.appendChild(bubble);
  });
}

function removeFile(i) {
  attachedFiles.splice(i, 1);
  renderFileBubbles();
}

/* ============================
   LOCAL STORAGE — UNIFIED STORAGE
============================ */

const STORAGE_KEY = "excel-warrior-sessions";
const CURRENT_KEY = "excel-warrior-current-session";

/* تحميل الجلسات من التخزين */
function loadSessionsFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/* حفظ الجلسات داخل التخزين */
function saveSessionsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/* تحميل الجلسة الحالية */
function loadCurrentSessionId() {
  return localStorage.getItem(CURRENT_KEY);
}

/* حفظ الجلسة الحالية */
function saveCurrentSessionId() {
  if (currentSessionId) {
    localStorage.setItem(CURRENT_KEY, currentSessionId);
  }
}

/* حذف الجلسات القديمة — آخر 20 فقط (غير المثبّتة) */
function trimOldSessions() {
  const pinned = sessions.filter(s => s.pinned);
  const normal = sessions.filter(s => !s.pinned);

  if (normal.length > 20) {
    const keep = normal.slice(-20);
    sessions = [...pinned, ...keep];
  }
}

/* تحديث بيانات الجلسة */
function updateSessionMeta(session, lastMessage = null) {
  session.updatedAt = Date.now();
  if (lastMessage) session.lastMessage = lastMessage;
}

/* إنشاء جلسة جديدة داخل التخزين */
function createStoredSession() {
  const id = Date.now();

  const newSession = {
    id,
    title: "جلسة جديدة",
    pinned: false,
    files: [],          // أسماء الملفات فقط
    lastMessage: null,  // آخر رسالة فقط
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  sessions.push(newSession);
  trimOldSessions();
  saveSessionsToStorage();

  currentSessionId = id;
  saveCurrentSessionId();

  return newSession;
}

/* ============================
   SESSIONS SYSTEM — COPILOT STYLE (NEW)
============================ */

const sessionsList = document.getElementById("sessionsList");
const newSessionBtn = document.getElementById("newSessionBtn");

let sessions = [];
let currentSessionId = null;

/* إنشاء جلسة جديدة */
function createSession() {
  const session = createStoredSession();
  resetUIForSession();
  renderSessions();
}

/* إعادة ضبط الواجهة عند فتح جلسة */
function resetUIForSession() {
  chatArea.innerHTML = "";
  welcomeScreen.style.display = "block";

  attachedFiles = [];
  renderFileBubbles();

  userInput.value = "";
}

/* تنسيق الوقت مثل Copilot */
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short"
  });
}

/* عرض الجلسات داخل السايدبار — نسخة محسّنة */
function renderSessions() {
  sessionsList.innerHTML = "";

  /* ترتيب الجلسات: المثبّتة أولًا ثم حسب آخر تحديث */
  const ordered = [
    ...sessions.filter(s => s.pinned).sort((a, b) => b.updatedAt - a.updatedAt),
    ...sessions.filter(s => !s.pinned).sort((a, b) => b.updatedAt - a.updatedAt)
  ];

  ordered.forEach(s => {
    const item = document.createElement("div");
    item.className = "session-item";
    if (s.id === currentSessionId) item.classList.add("active");

    /* الصف العلوي: العنوان + البادجات */
    const titleRow = document.createElement("div");
    titleRow.className = "session-title-row";

    const titleSpan = document.createElement("span");
    titleSpan.className = "session-title";
    titleSpan.textContent = s.title;

    const badges = document.createElement("div");
    badges.className = "session-badges";

    if (s.pinned) {
      const pinBadge = document.createElement("span");
      pinBadge.className = "session-badge";
      pinBadge.textContent = "📌";
      badges.appendChild(pinBadge);
    }

    if (s.files.length > 0) {
      const fileBadge = document.createElement("span");
      fileBadge.className = "session-badge";
      fileBadge.textContent = `${s.files.length} ملف`;
      badges.appendChild(fileBadge);
    }

    titleRow.appendChild(titleSpan);
    titleRow.appendChild(badges);

    /* الصف الثاني: آخر رسالة */
    const lastMsg = document.createElement("div");
    lastMsg.className = "session-last-msg";
    lastMsg.textContent = s.lastMessage
      ? s.lastMessage.slice(0, 40) + (s.lastMessage.length > 40 ? "…" : "")
      : "لا توجد رسائل بعد";

    /* الصف الثالث: وقت آخر تحديث */
    const timeRow = document.createElement("div");
    timeRow.className = "session-time";
    timeRow.textContent = formatTime(s.updatedAt);

    /* أزرار الجلسة */
    const actions = document.createElement("div");
    actions.className = "session-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "session-action-btn";
    pinBtn.textContent = s.pinned ? "Unpin" : "Pin";
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      s.pinned = !s.pinned;
      saveSessionsToStorage();
      renderSessions();
    };

    const dupBtn = document.createElement("button");
    dupBtn.className = "session-action-btn";
    dupBtn.textContent = "Duplicate";
    dupBtn.onclick = (e) => {
      e.stopPropagation();
      duplicateSession(s.id);
    };

    const renameBtn = document.createElement("button");
    renameBtn.className = "session-action-btn";
    renameBtn.textContent = "Rename";
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      const newTitle = prompt("اسم الجلسة:", s.title);
      if (newTitle && newTitle.trim()) {
        s.title = newTitle.trim();
        saveSessionsToStorage();
        renderSessions();
      }
    };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "session-action-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSession(s.id);
    };

    actions.appendChild(pinBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    /* تجميع العناصر */
    item.appendChild(titleRow);
    item.appendChild(lastMsg);
    item.appendChild(timeRow);
    item.appendChild(actions);

    item.onclick = () => {
      switchSession(s.id);
    };

    sessionsList.appendChild(item);
  });
}

/* تبديل الجلسة */
function switchSession(id) {
  currentSessionId = id;
  saveCurrentSessionId();

  const session = sessions.find(s => s.id === id);
  if (!session) return;

  chatArea.innerHTML = "";
  welcomeScreen.style.display = "none";

  attachedFiles = [...session.files];
  renderFileBubbles();

  renderSessions();
}

/* حذف جلسة */
function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  saveSessionsToStorage();

  if (sessions.length === 0) {
    const s = createStoredSession();
    resetUIForSession();
    renderSessions();
    return;
  }

  currentSessionId = sessions[sessions.length - 1].id;
  saveCurrentSessionId();

  switchSession(currentSessionId);
  renderSessions();
}

/* نسخ جلسة */
function duplicateSession(id) {
  const original = sessions.find(s => s.id === id);
  if (!original) return;

  const copy = {
    id: Date.now(),
    title: original.title + " (نسخة)",
    pinned: original.pinned,
    files: [...original.files],
    lastMessage: original.lastMessage,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  sessions.push(copy);
  saveSessionsToStorage();

  currentSessionId = copy.id;
  saveCurrentSessionId();

  switchSession(copy.id);
  renderSessions();
}

/* ============================
   CHAT SYSTEM — UPDATED FOR STORAGE
============================ */
function addMessage(text, sender) {
  welcomeScreen.style.display = "none";

  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerHTML = text;

  chatArea.appendChild(msg);

  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.textContent.trim());
    msg.appendChild(copyBtn);
  }

  /* تحديث التخزين */
  if (currentSessionId) {
    const session = sessions.find(s => s.id === currentSessionId);
    updateSessionMeta(session, text);
    saveSessionsToStorage();
  }
}

/* ============================
   TYPING
============================ */
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
   EXECUTE TOOL
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
   SEND MESSAGE — UPDATED FOR STORAGE
============================ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text && attachedFiles.length === 0) return;

  addMessage(text || "📎 ملفات مرفقة", "user");

  const excelJSON = attachedFiles.map(f => f.json);

  if (currentSessionId) {
    const session = sessions.find(s => s.id === currentSessionId);

    /* تحديث عنوان الجلسة عند أول رسالة */
    if (!session.lastMessage && text) {
      session.title = text.length > 30 ? text.slice(0, 30) + "…" : text;
    }

    /* حفظ أسماء الملفات فقط */
    session.files = attachedFiles.map(f => f.name);

    /* تحديث وقت آخر تعديل + آخر رسالة */
    updateSessionMeta(session, text);

    saveSessionsToStorage();
  }

  userInput.value = "";
  attachedFiles = [];
  renderFileBubbles();

  isWaiting = true;
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        excelJSON
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

    /* تحديث التخزين بعد رد الذكاء */
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      updateSessionMeta(session, data.reply);
      saveSessionsToStorage();
    }

    const toolCall = extractToolCall(data.reply);
    if (toolCall) {
      await executeTool(toolCall);
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

newChatBtn.onclick = () => {
  createSession();
};

clearChatBtn.onclick = () => {
  chatArea.innerHTML = "";
  welcomeScreen.style.display = "block";

  attachedFiles = [];
  renderFileBubbles();

  if (currentSessionId) {
    const session = sessions.find(s => s.id === currentSessionId);
    session.files = [];
    session.lastMessage = null;
    updateSessionMeta(session);
    saveSessionsToStorage();
    renderSessions();
  }
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

/* ============================
   INITIAL LOAD — DOMContentLoaded
============================ */
document.addEventListener("DOMContentLoaded", () => {
  // تحميل الجلسات من التخزين
  sessions = loadSessionsFromStorage();

  // تحميل الجلسة الحالية
  currentSessionId = loadCurrentSessionId();

  // إذا لا يوجد جلسات → إنشاء جلسة جديدة
  if (!sessions || sessions.length === 0) {
    const s = createStoredSession();
    resetUIForSession();
    renderSessions();
    return;
  }

  // إذا يوجد جلسات لكن لا يوجد جلسة حالية → افتح آخر جلسة
  if (!currentSessionId) {
    currentSessionId = sessions[sessions.length - 1].id;
    saveCurrentSessionId();
  }

  // تحميل الجلسة الحالية
  const session = sessions.find(s => s.id === currentSessionId);

  if (!session) {
    const s = createStoredSession();
    resetUIForSession();
    renderSessions();
    return;
  }

  // عرض الجلسة الحالية
  resetUIForSession();
  renderSessions();
});
