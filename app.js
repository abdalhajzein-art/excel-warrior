/* ============================
   SIDEBAR — MOBILE FIRST OVERLAY
============================ */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

sidebarToggle.onclick = () => {
  sidebar.classList.toggle("open");
};

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
const API_URL = "/.netlify/functions/chat";
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
        body: JSON.stringify({ filename: file.name, data: base64 })
      });
      const data = await res.json();
      const payload = Array.isArray(data) ? data[0] : data;
      attachedFiles.push({ name: file.name, payload });
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
    bubble.innerHTML = `<span>📎 ${f.name}</span> <button onclick="removeFile(${index})">❌</button>`;
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

function loadSessionsFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveSessionsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function saveCurrentSessionId() {
  if (currentSessionId) localStorage.setItem(CURRENT_KEY, currentSessionId);
}

function trimOldSessions() {
  const pinned = sessions.filter(s => s.pinned);
  const normal = sessions.filter(s => !s.pinned);
  if (normal.length > 20) {
    const keep = normal.slice(-20);
    sessions = [...pinned, ...keep];
  }
}

function updateSessionMeta(session, lastMessage = null) {
  session.updatedAt = Date.now();
  if (lastMessage) session.lastMessage = lastMessage;
}

function createStoredSession() {
  const id = Date.now();
  const newSession = { id, title: "جلسة جديدة", pinned: false, files: [], messages: [], lastMessage: null, createdAt: Date.now(), updatedAt: Date.now() };
  sessions.push(newSession);
  trimOldSessions();
  saveSessionsToStorage();
  currentSessionId = id;
  saveCurrentSessionId();
  return newSession;
}

/* ============================
   SESSIONS SYSTEM
============================ */
const sessionsList = document.getElementById("sessionsList");
const newSessionBtn = document.getElementById("newSessionBtn");
let sessions = [];
let currentSessionId = null;

function createSession() {
  const session = createStoredSession();
  loadSessionIntoUI(session);
  renderSessions();
}

function resetUIForSession() {
  chatArea.innerHTML = "";
  welcomeScreen.style.display = "block";
  attachedFiles = [];
  renderFileBubbles();
  userInput.value = "";
}

function formatTime(ts) {
  return new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
}

function renderSessions() {
  sessionsList.innerHTML = "";
  const ordered = [...sessions.filter(s => s.pinned).sort((a,b) => b.updatedAt - a.updatedAt), ...sessions.filter(s => !s.pinned).sort((a,b) => b.updatedAt - a.updatedAt)];

  ordered.forEach(s => {
    const item = document.createElement("div");
    item.className = `session-item ${s.id === currentSessionId ? "active" : ""}`;
    item.innerHTML = `
      <div class="session-title-row">
        <span class="session-title">${s.title}</span>
        <div class="session-badges">
          ${s.pinned ? '<span class="session-badge">📌</span>' : ''}
          ${s.files && s.files.length > 0 ? `<span class="session-badge">${s.files.length} ملف</span>` : ''}
        </div>
      </div>
      <div class="session-last-msg">${s.lastMessage ? s.lastMessage.slice(0, 40) + (s.lastMessage.length > 40 ? "…" : "") : "لا توجد رسائل بعد"}</div>
      <div class="session-time">${formatTime(s.updatedAt)}</div>
    `;
    
    const actions = document.createElement("div");
    actions.className = "session-actions";
    
    const pinBtn = document.createElement("button");
    pinBtn.className = "session-action-btn";
    pinBtn.textContent = s.pinned ? "Unpin" : "Pin";
    pinBtn.onclick = (e) => { e.stopPropagation(); s.pinned = !s.pinned; saveSessionsToStorage(); renderSessions(); };
    
    const dupBtn = document.createElement("button");
    dupBtn.className = "session-action-btn";
    dupBtn.textContent = "Duplicate";
    dupBtn.onclick = (e) => { e.stopPropagation(); duplicateSession(s.id); };
    
    const renameBtn = document.createElement("button");
    renameBtn.className = "session-action-btn";
    renameBtn.textContent = "Rename";
    renameBtn.onclick = (e) => { e.stopPropagation(); const t = prompt("اسم الجلسة:", s.title); if(t) { s.title = t; saveSessionsToStorage(); renderSessions(); } };
    
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "session-action-btn";
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteSession(s.id); };
    
    actions.append(pinBtn, dupBtn, renameBtn, deleteBtn);
    item.appendChild(actions);
    item.onclick = () => switchSession(s.id);
    sessionsList.appendChild(item);
  });
}

function loadSessionIntoUI(session) {
  if (!session) return;
  chatArea.innerHTML = "";
  welcomeScreen.style.display = session.messages.length > 0 ? "none" : "block";
  session.messages.forEach(m => addMessageToUI(m.text, m.sender));
  attachedFiles = session.files ? [...session.files] : [];
  renderFileBubbles();
}

function addMessageToUI(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.innerHTML = text;
  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.textContent.trim());
    msg.appendChild(copyBtn);
  }
  chatArea.appendChild(msg);
}

function switchSession(id) {
  currentSessionId = id;
  saveCurrentSessionId();
  loadSessionIntoUI(sessions.find(s => s.id === id));
  renderSessions();
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);
  saveSessionsToStorage();
  if (sessions.length === 0) {
    currentSessionId = null;
    resetUIForSession();
  } else {
    currentSessionId = sessions[sessions.length - 1].id;
    loadSessionIntoUI(sessions.find(s => s.id === currentSessionId));
  }
  renderSessions();
}

function duplicateSession(id) {
  const original = sessions.find(s => s.id === id);
  const copy = { ...original, id: Date.now(), title: original.title + " (نسخة)", messages: [...original.messages], files: [...original.files], createdAt: Date.now(), updatedAt: Date.now() };
  sessions.push(copy);
  saveSessionsToStorage();
  currentSessionId = copy.id;
  loadSessionIntoUI(copy);
  renderSessions();
}

/* ============================
   CHAT & TOOL SYSTEM (CORRECTED)
============================ */
function addMessage(text, sender) {
  welcomeScreen.style.display = "none";
  addMessageToUI(text, sender);
  if (currentSessionId) {
    const s = sessions.find(i => i.id == currentSessionId);
    s.messages.push({ sender, text });
    updateSessionMeta(s, text);
    saveSessionsToStorage();
  }
}

async function executeTool(toolCall) {
  showTyping();
  try {
    const res = await fetch(EXECUTOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toolCall)
    });
    hideTyping();
    const blob = await res.blob();
    if (blob.type.includes("excel") || blob.type.includes("sheet")) {
      const url = URL.createObjectURL(blob);
      addMessage('📥 تم تنفيذ الأداة. <a href="'+url+'" download="result.xlsx">تحميل الملف</a>', "ai");
    } else {
      const txt = await blob.text();
      addMessage(`🔧 نتيجة: ${txt}`, "ai");
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ في الأداة: " + err.message, "ai");
  }
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text && attachedFiles.length === 0) return;
  addMessage(text || "📎 ملفات مرفقة", "user");
  const excelJSON = attachedFiles.map(f => f.payload);
  userInput.value = "";
  attachedFiles = []; renderFileBubbles();
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, excelJSON, sessionId: currentSessionId })
    });
    const data = await res.json();
    hideTyping();

    if (data.reply) addMessage(data.reply, "ai");
    
    // الحل الجذري: التعامل مع tool_calls التي يرسلها السيرفر مباشرة
    if (data.tool_calls) {
      for (const call of data.tool_calls) {
        await executeTool({ tool: call.function.name, payload: JSON.parse(call.function.arguments) });
      }
    }
  } catch (err) {
    hideTyping();
    addMessage("⚠️ خطأ: " + err.message, "ai");
  }
}

// Initializers
document.addEventListener("DOMContentLoaded", () => {
  sessions = loadSessionsFromStorage();
  currentSessionId = localStorage.getItem(CURRENT_KEY);
  if (sessions.length > 0) {
    const s = sessions.find(i => i.id == currentSessionId) || sessions[sessions.length - 1];
    switchSession(s.id);
  }
  sendBtn.onclick = sendMessage;
  newChatBtn.onclick = newSessionBtn.onclick = createSession;
  clearChatBtn.onclick = () => { if(confirm("مسح؟")) { deleteSession(currentSessionId); } };
});

function showTyping() { typingMsg = document.createElement("div"); typingMsg.className = "typing"; typingMsg.innerText = "جاري المعالجة..."; chatArea.appendChild(typingMsg); }
function hideTyping() { if(typingMsg) typingMsg.remove(); }
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

