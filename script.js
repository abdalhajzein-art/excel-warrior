document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const newChatBtn = document.getElementById('newChatBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    
    async function handleSendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        if (welcomeScreen) welcomeScreen.style.display = 'none';

        appendMessage('user', message);
        userInput.value = '';

        const loadingId = appendMessage('assistant', 'جاري المعالجة... ⏳', true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();
            removeMessage(loadingId);

            if (data.reply) {
                appendMessage('assistant', data.reply);
            } else {
                appendMessage('assistant', '⚠️ خطأ في استجابة السيرفر.');
            }
        } catch (error) {
            removeMessage(loadingId);
            appendMessage('assistant', '⚠️ تعذر الاتصال بالسيرفر.');
        }
    }

    function appendMessage(sender, text) {
        const messageDiv = document.createElement('div');
        const messageId = 'msg_' + Date.now() + Math.random();
        messageDiv.id = messageId;
        messageDiv.style.margin = '10px 0';
        messageDiv.style.padding = '12px 16px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.maxWidth = '80%';
        
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
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
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
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
    };

    if (newChatBtn) newChatBtn.addEventListener('click', resetChat);
    if (newSessionBtn) newSessionBtn.addEventListener('click', resetChat);
});
