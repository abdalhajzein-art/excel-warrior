document.addEventListener('DOMContentLoaded', () => {

    // عناصر DOM
    const chatArea = document.getElementById('chatArea');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.createElement('input');
    const fileBubbles = document.getElementById('fileBubbles');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionsList = document.getElementById('sessionsList');

    // إعداد input للملفات
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls,.csv,.pdf,.docx,.png,.jpg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // حالة الجلسات
    let currentSessionId = localStorage.getItem('alatheer_current_session') || generateSessionId();
    let selectedFileObject = null;
    let attachedFileName = null;
    let isFileLoading = false;

    // دوال الجلسات
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }

    function getStoredSessions() {
        return JSON.parse(localStorage.getItem('alatheer_sessions') || '{}');
    }

    function saveSessions(sessions) {
        localStorage.setItem('alatheer_sessions', JSON.stringify(sessions));
    }

    function renderSessionsList() {
        const sessions = getStoredSessions();
        sessionsList.innerHTML = '';

        Object.keys(sessions).forEach(sessionId => {
            const session = sessions[sessionId];
            const item = document.createElement('div');
            item.className = 'session-item';
            if (sessionId === currentSessionId) item.classList.add('active');

            item.innerHTML = `
                <span class="session-title">${session.title}</span>
                <button class="pin-btn">${session.pinned ? '📌' : '📍'}</button>
                <button class="delete-btn">🗑️</button>
            `;

            item.addEventListener('click', () => switchSession(sessionId));

            item.querySelector('.pin-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                togglePinSession(sessionId);
            });

            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSession(sessionId);
            });

            sessionsList.appendChild(item);
        });
    }

    function togglePinSession(sessionId) {
        let sessions = getStoredSessions();
        sessions[sessionId].pinned = !sessions[sessionId].pinned;
        saveSessions(sessions);
        renderSessionsList();
    }

    function deleteSession(sessionId) {
        let sessions = getStoredSessions();
        delete sessions[sessionId];

        const ids = Object.keys(sessions);
        if (ids.length === 0) {
            currentSessionId = generateSessionId();
            sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        } else if (sessionId === currentSessionId) {
            currentSessionId = ids[ids.length - 1];
        }

        saveSessions(sessions);
        renderSessionsList();
        loadSession(currentSessionId);
    }

    function switchSession(sessionId) {
        currentSessionId = sessionId;
        localStorage.setItem('alatheer_current_session', sessionId);
        renderSessionsList();
        loadSession(sessionId);
    }

    function loadSession(sessionId) {
        chatArea.innerHTML = '';
        const sessions = getStoredSessions();
        const session = sessions[sessionId];

        if (session && session.messages.length > 0) {
            welcomeScreen.style.display = 'none';
            session.messages.forEach(msg => {
                appendMessageToDOM(msg.sender, msg.text, false, msg.fileData);
            });
        } else {
            welcomeScreen.style.display = 'flex';
        }
    }

    // زر الإرفاق
    attachBtn.addEventListener('click', () => fileInput.click());

    // قراءة الملف
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        isFileLoading = true;
        updateSendButtonState();

        fileBubbles.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;background:rgba(212,175,55,0.05);color:#d4af37;padding:6px 12px;border-radius:6px;border:1px dashed rgba(212,175,55,0.3);opacity:0.6;margin-bottom:6px;">
                جاري تحميل الملف من الذاكرة...
            </div>
        `;

        try {
            selectedFileObject = file;
            attachedFileName = file.name;

            await new Promise(r => setTimeout(r, 400));

            fileBubbles.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;font-size:12px;background:rgba(212,175,55,0.15);color:#d4af37;padding:6px 12px;border-radius:6px;border:1px solid rgba(212,175,55,0.4);margin-bottom:6px;">
                    📎 ${file.name}
                    <button id="removeFileBtn" style="background:none;border:none;color:#ff5555;font-weight:bold;font-size:14px;cursor:pointer;">×</button>
                </div>
            `;

            document.getElementById('removeFileBtn').addEventListener('click', () => {
                selectedFileObject = null;
                attachedFileName = null;
                fileInput.value = '';
                fileBubbles.innerHTML = '';
                updateSendButtonState();
            });

        } catch (err) {
            fileBubbles.innerHTML = '<span style="color:#ff5555;font-size:12px;">⚠️ فشل تحميل الملف</span>';
        }

        isFileLoading = false;
        updateSendButtonState();
    });

    // تحويل الملف إلى Base64
    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve([{
                    fileName: file.name,
                    fileBase64: event.target.result.split(',')[1],
                    size: file.size,
                    type: file.type
                }]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // إرسال الرسالة
    async function handleSendMessage() {
        const message = userInput.value.trim();
        const file = selectedFileObject;

        if (!message && !file) return;

        welcomeScreen.style.display = 'none';

        let displayMessage = message || `تحليل الملف المرفق: ${attachedFileName}`;

        appendMessageToDOM('user', displayMessage);
        saveMessageToCurrentSession('user', displayMessage);

        let payloadExcel = null;
        if (file) payloadExcel = await readFileAsBase64(file);

        userInput.value = '';
        selectedFileObject = null;
        attachedFileName = null;
        fileInput.value = '';
        fileBubbles.innerHTML = '';
        updateSendButtonState();

        const loadingId = appendMessageToDOM('assistant', 'جاري المعالجة السيادية... ⏳', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: displayMessage,
                    excelJSON: payloadExcel,
                    sessionId: currentSessionId
                })
            });

            const data = await response.json();
            removeMessageFromDOM(loadingId);

            appendMessageToDOM('assistant', data.reply);

            if (data.fileBase64) {
                const downloadBtn = document.createElement('a');
                downloadBtn.href = `data:application/octet-stream;base64,${data.fileBase64}`;
                downloadBtn.download = data.fileName || 'file.xlsx';
                downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
                downloadBtn.style.cssText = 'display:inline-block;margin-top:8px;color:#d4af37;text-decoration:underline;font-weight:bold;';
                chatArea.appendChild(downloadBtn);
            }

            saveMessageToCurrentSession('assistant', data.reply, data.fileBase64 ? {
                base64: data.fileBase64,
                name: data.fileName || 'file.xlsx'
            } : null);

        } catch (err) {
            removeMessageFromDOM(loadingId);
            appendMessageToDOM('assistant', '⚠️ تعذر الاتصال بالسيرفر.');
        }
    }

    // عرض الرسائل
    function appendMessageToDOM(sender, text, isLoading = false, fileData = null) {
        const messageDiv = document.createElement('div');
        const messageId = isLoading ? 'loading_' + Date.now() : 'msg_' + Date.now();
        messageDiv.id = messageId;

        messageDiv.className = `message ${sender === 'user' ? 'user' : 'ai'}`;
        messageDiv.innerText = text;
        chatArea.appendChild(messageDiv);

        if (fileData) {
            const downloadBtn = document.createElement('a');
            downloadBtn.href = `data:application/octet-stream;base64,${fileData.base64}`;
            downloadBtn.download = fileData.name;
            downloadBtn.innerText = '📥 اضغط هنا لتحميل الملف الناتج';
            downloadBtn.style.cssText = 'display:inline-block;margin-top:8px;color:#d4af37;text-decoration:underline;font-weight:bold;';
            chatArea.appendChild(downloadBtn);
        }

        chatArea.scrollTop = chatArea.scrollHeight;
        return messageId;
    }

    function removeMessageFromDOM(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // جلسة جديدة
    const createNewSession = () => {
        currentSessionId = generateSessionId();
        localStorage.setItem('alatheer_current_session', currentSessionId);

        let sessions = getStoredSessions();
        sessions[currentSessionId] = { title: 'جلسة جديدة', messages: [], pinned: false };
        saveSessions(sessions);

        renderSessionsList();
        loadSession(currentSessionId);
    };

    newChatBtn.addEventListener('click', createNewSession);
    newSessionBtn.addEventListener('click', createNewSession);

    sendBtn.addEventListener('click', handleSendMessage);

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        updateSendButtonState();
    });

    renderSessionsList();
    loadSession(currentSessionId);

    function updateSendButtonState() {
        const hasText = userInput.value.trim().length > 0;
        const hasFile = selectedFileObject !== null && !isFileLoading;
        sendBtn.disabled = !(hasText || hasFile);
    }
});
