document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    
    // عناصر السايدبار والريسبونسف
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // 1. تفعيل السايدبار (فتح وإغلاق)
    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }

    // استرجاع المحادثات السابقة من التخزين المحلي عند فتح الصفحة
    loadChatHistory();

    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }

        // إضافة رسالة المستخدم وحفظها
        appendMessage('user', message);
        saveMessageToStorage('user', message);

        userInput.value = '';
        userInput.style.height = 'auto';

        // رسالة الانتظار
        const loadingId = appendMessage('assistant', 'جاري المعالجة... ⏳', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            removeMessage(loadingId);

            if (data && data.reply) {
                appendMessage('assistant', data.reply);
                saveMessageToStorage('assistant', data.reply);
            } else {
                appendMessage('assistant', '⚠️ حدث خطأ في استجابة السيرفر.');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            removeMessage(loadingId);
            appendMessage('assistant', '⚠️ تعذر الاتصال بالسيرفر. تأكد من الشبكة.');
        }
    }

    function appendMessage(sender, text, isLoading = false) {
        const messageDiv = document.createElement('div');
        const messageId = isLoading ? 'loading_' + Date.now() : 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        messageDiv.id = messageId;
        
        messageDiv.style.margin = '10px 0';
        messageDiv.style.padding = '12px 16px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.maxWidth = '80%';
        messageDiv.style.wordBreak = 'break-word';
        messageDiv.style.whiteSpace = 'pre-wrap';
        
        if (sender === 'user') {
            messageDiv.style.backgroundColor = '#007bff';
            messageDiv.style.color = '#fff';
            messageDiv.style.marginLeft = 'auto';
        } else {
            messageDiv.style.backgroundColor = '#f1f1f1';
            messageDiv.style.color = '#333';
            messageDiv.style.marginRight = 'auto';
        }

        messageDiv.innerText = text;
        chatArea.appendChild(messageDiv);
        chatArea.scrollTop = chatArea.scrollHeight;

        return messageId;
    }

    function removeMessage(id) {
        if (!id) return;
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // نظام التخزين المحلي (LocalStorage) لحفظ الجلسات من الريلود
    function saveMessageToStorage(sender, text) {
        let history = JSON.parse(localStorage.getItem('alatheer_chat_history') || '[]');
        history.push({ sender, text });
        localStorage.setItem('alatheer_chat_history', JSON.stringify(history));
    }

    function loadChatHistory() {
        let history = JSON.parse(localStorage.getItem('alatheer_chat_history') || '[]');
        if (history.length > 0 && welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
        history.forEach(item => {
            appendMessage(item.sender, item.text);
        });
    }

    // ربط الأحداث بالأزرار
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }

    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    const resetChat = () => {
        chatArea.innerHTML = '';
        localStorage.removeItem('alatheer_chat_history');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'flex';
        }
    };

    if (newChatBtn) newChatBtn.addEventListener('click', resetChat);
    if (newSessionBtn) newSessionBtn.addEventListener('click', resetChat);
});
