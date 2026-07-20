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
fileInput.multiple = false;
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
   SESSIONS SYSTEM (COPILOT STYLE)
============================ */
const sessionsList = document.getElementById("sessionsList");
const newSessionBtn = document.getElementById("newSessionBtn");

let sessions = [];
let currentSessionId = null;

function createSession() {
  const id = Date.now();

  const newSession = {
    id,
    title: "جلسة جديدة",
    pinned: false,
    messages: [],
    files: []
  };

  sessions.push(newSession);
  currentSessionId = id;

  resetUIForSession();
  renderSessions();
}

function resetUIForSession() {
  chatArea.innerHTML = "";
  welcomeScreen.style.display = "block";

  attachedFiles = [];
  renderFileBubbles();

  userInput.value = "";
}

function renderSessions() {
  sessionsList.innerHTML = "";

  const ordered = [
    ...sessions.filter(s => s.pinned),
    ...sessions.filter(s => !s.pinned)
  ];

  ordered.forEach(s => {
    const item = document.createElement("div");
    item.className = "session-item";
    if (s.id === currentSessionId) item.classList.add("active");

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
      pinBadge.textContent = "مثبّتة";
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

    const actions = document.createElement("div");
    actions.className = "session-actions";

    const pinBtn = document.createElement("button");
    pinBtn.className = "session-action-btn";
    pinBtn.textContent = s.pinned ? "Unpin" : "Pin";
    pinBtn.onclick = (e) => {
      e.stopPropagation();
      s.pinned = !s.pinned;
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

    item.appendChild(titleRow);
    item.appendChild(actions);

    item.onclick = () => {
      switchSession(s.id);
    };

    sessionsList.appendChild(item);
  });
}

function switchSession(id) {
  currentSessionId = id;

  const session = sessions.find(s => s.id === id);
  if (!session) return;

  chatArea.innerHTML = "";
  welcomeScreen.style.display = "none";

  attachedFiles = [...session.files];
  renderFileBubbles();

  session.messages.forEach(m => addMessage(m.text, m.sender));

  renderSessions();
}

function deleteSession(id) {
  sessions = sessions.filter(s => s.id !== id);

  if (sessions.length === 0) {
    currentSessionId = null;
    resetUIForSession();
  } else {
    currentSessionId = sessions[sessions.length - 1].id;
    switchSession(currentSessionId);
  }

  renderSessions();
}

function duplicateSession(id) {
  const original = sessions.find(s => s.id === id);
  if (!original) return;

  const copy = {
    id: Date.now(),
    title: original.title + " (نسخة)",
    pinned: original.pinned,
    messages: [...original.messages],
    files: [...original.files]
  };

  sessions.push(copy);
  currentSessionId = copy.id;

  switchSession(copy.id);
  renderSessions();
}

newSessionBtn.onclick = () => {
  createSession();
};

/* ============================
   SIDEBAR TOGGLE
============================ */
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const mainArea = document.querySelector(".main-area");

sidebarToggle.onclick = () => {
  sidebar.classList.toggle("collapsed");
  mainArea.classList.toggle("expanded");
};

/* ============================
   AUTO SCROLL
============================ */
function autoScroll() {
  chatArea.scrollTop = chatArea.scrollHeight;
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
  msg.innerHTML = text;

  if (/[\u0600-\u06FF]/.test(text)) {
    msg.style.direction = "rtl";
    msg.style.textAlign = "right";
  }

  chatArea.appendChild(msg);

  if (sender === "ai") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.onclick = () => navigator.clipboard.writeText(msg.textContent.trim());
    msg.appendChild(copyBtn);
  }

  if (currentSessionId) {
    const session = sessions.find(s => s.id === currentSessionId);
    session.messages.push({ text, sender });
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
   SEND MESSAGE
============================ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text && attachedFiles.length === 0) return;

  addMessage(text || "📎 ملفات مرفقة", "user");

  const excelJSON = attachedFiles.map(f => f.json);

  if (currentSessionId) {
    const session = sessions.find(s => s.id === currentSessionId);

    if (session.messages.length === 0 && text) {
      session.title = text.length > 30 ? text.slice(0, 30) + "…" : text;
    }

    session.files = [...attachedFiles];
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
    session.messages = [];
    session.files = [];
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
