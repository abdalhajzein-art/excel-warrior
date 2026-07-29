let currentSessionId = localStorage.getItem('alatheer_current_session') || generateSessionId();

export function generateSessionId() {
    try {
        if (window.crypto && window.crypto.randomUUID) {
            return 'session_' + window.crypto.randomUUID();
        }
    } catch (e) {}
    return 'session_' + Date.now();
}

export function getStoredSessions() {
    try {
        return JSON.parse(localStorage.getItem('alatheer_sessions') || '{}');
    } catch (e) {
        return {};
    }
}

export function saveSessions(sessions) {
    localStorage.setItem('alatheer_sessions', JSON.stringify(sessions));
}

export function getCurrentSessionId() {
    return currentSessionId;
}

export function setCurrentSessionId(id) {
    currentSessionId = id;
    localStorage.setItem('alatheer_current_session', id);
}

export function initSessions(callbacks) {
    let sessions = getStoredSessions();
    if (!sessions || Object.keys(sessions).length === 0) {
        sessions = {};
        sessions[currentSessionId] = {
            title: 'جلسة جديدة',
            messages: [],
            pinned: false,
            lastFile: null
        };
        saveSessions(sessions);
    } else if (!sessions[currentSessionId]) {
        currentSessionId = Object.keys(sessions)[0];
        localStorage.setItem('alatheer_current_session', currentSessionId);
    }
    renderSessionsList(callbacks);
    loadSession(currentSessionId, callbacks);
}

export function renderSessionsList(callbacks) {
    const sessionsList = document.getElementById('sessionsList');
    if (!sessionsList) return;
    sessionsList.innerHTML = '';
    
    let sessions = getStoredSessions();
    const sortedSessionIds = Object.keys(sessions).sort((a, b) => {
        const sessionA = sessions[a];
        const sessionB = sessions[b];
        if (sessionA.pinned && !sessionB.pinned) return -1;
        if (!sessionA.pinned && sessionB.pinned) return 1;
        return b.localeCompare(a);
    });

    if (sortedSessionIds.length === 0) return;

    sortedSessionIds.forEach(sessionId => {
        const session = sessions[sessionId];
        const item = document.createElement('div');
        item.className = `session-item ${sessionId === currentSessionId ? 'active' : ''}`;
        
        item.innerHTML = `
            <div class="session-title-row">
                <span class="session-title" style="max-width: 130px;">
                    ${session.pinned ? '📌 ' : ''}${session.title || 'جلسة جديدة'}
                </span>
                <div class="session-badges">
                    ${session.pinned ? '<span style="font-size: 10px; color: #d4af37; background: rgba(212, 175, 55, 0.1); padding: 2px 6px; border-radius: 4px;">مثبت</span>' : ''}
                    ${session.messages && session.messages.length > 0 ? `<span style="font-size: 10px; color: #888; background: #2a2a2a; padding: 2px 6px; border-radius: 4px;">${session.messages.length}</span>` : ''}
                </div>
            </div>
            <div class="session-actions">
                <button class="session-action-btn pin-btn" title="${session.pinned ? 'إلغاء التثبيت' : 'تثبيت الجلسة'}" style="color: #d4af37;">
                    ${session.pinned ? '📍 إلغاء التثبيت' : '📌 تثبيت'}
                </button>
                <button class="session-action-btn delete-btn" title="حذف الجلسة" style="color: #ff5555;">
                    🗑️ حذف
                </button>
            </div>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.session-actions')) return;
            switchSession(sessionId, callbacks);
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const sidebarOverlay = document.getElementById('sidebarOverlay');
                if (sidebar) {
                    sidebar.style.transform = 'translateX(-100%)';
                    sidebar.classList.remove('open');
                }
                if (sidebarOverlay) {
                    sidebarOverlay.style.opacity = '0';
                    setTimeout(() => sidebarOverlay.style.display = 'none', 300);
                }
            }
        });

        item.querySelector('.pin-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePinSession(sessionId, callbacks);
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(sessionId, callbacks);
        });

        sessionsList.appendChild(item);
    });
}

export function togglePinSession(sessionId, callbacks) {
    let sessions = getStoredSessions();
    if (sessions[sessionId]) {
        sessions[sessionId].pinned = !sessions[sessionId].pinned;
        saveSessions(sessions);
        renderSessionsList(callbacks);
    }
}

export function deleteSession(sessionId, callbacks) {
    let sessions = getStoredSessions();
    delete sessions[sessionId];
    
    let remainingIds = Object.keys(sessions);
    if (remainingIds.length === 0) {
        currentSessionId = generateSessionId();
        sessions[currentSessionId] = {
            title: 'جلسة جديدة',
            messages: [],
            pinned: false,
            lastFile: null
        };
    } else if (sessionId === currentSessionId) {
        currentSessionId = remainingIds[remainingIds.length - 1];
        localStorage.setItem('alatheer_current_session', currentSessionId);
    }

    saveSessions(sessions);
    renderSessionsList(callbacks);
    loadSession(currentSessionId, callbacks);
}

export function switchSession(sessionId, callbacks) {
    currentSessionId = sessionId;
    localStorage.setItem('alatheer_current_session', sessionId);
    renderSessionsList(callbacks);
    loadSession(sessionId, callbacks);
}

export function loadSession(sessionId, callbacks) {
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (!chatArea) return;
    chatArea.innerHTML = '';
    const sessions = getStoredSessions();
    const session = sessions[sessionId];

    if (callbacks && typeof callbacks.onResetFile === 'function') {
        callbacks.onResetFile();
    }

    if (session && session.messages && session.messages.length > 0) {
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        session.messages.forEach(msg => {
            callbacks.appendMessageToDOM(msg.sender, msg.text, msg.fileData);
        });
    } else {
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
    }
    if (callbacks && typeof callbacks.onUpdateSendState === 'function') {
        callbacks.onUpdateSendState();
    }
}

export function clearChat(callbacks) {
    let sessions = getStoredSessions();
    if (sessions[currentSessionId]) {
        sessions[currentSessionId].messages = [];
        sessions[currentSessionId].lastFile = null;
        saveSessions(sessions);
        loadSession(currentSessionId, callbacks);
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        renderSessionsList(callbacks);
    }
}

export function exportChat() {
    const sessions = getStoredSessions();
    const session = sessions[currentSessionId];
    if (!session || !session.messages || session.messages.length === 0) {
        alert('⚠️ لا توجد رسائل لتصديرها.');
        return;
    }
    const text = session.messages.map(m => {
        const sender = m.sender === 'user' ? '👤 المستخدم' : '🤖 الأثير';
        return `[${sender}]: ${m.text}`;
    }).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${session.title || 'session'}_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

export function createNewSession(callbacks) {
    currentSessionId = generateSessionId();
    localStorage.setItem('alatheer_current_session', currentSessionId);
    let sessions = getStoredSessions();
    sessions[currentSessionId] = {
        title: 'جلسة جديدة',
        messages: [],
        pinned: false,
        lastFile: null
    };
    saveSessions(sessions);
    renderSessionsList(callbacks);
    loadSession(currentSessionId, callbacks);
                             }
