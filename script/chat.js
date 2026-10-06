import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

function isActivePremium(student) {
    if (!student || student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}

const messagesEl = $('chat-messages');
const inputBar = $('chat-input-bar');
const lockedScreen = $('locked-screen');
const messageInput = $('message-input');
const sendButton = $('send-button');

let lastSeenId = 0;
let pollTimer = null;
let atBottom = true;

function escapeAndLinkify(text) {
    // Plain text rendering via textContent handles escaping; this just
    // builds the DOM node, no raw HTML from message content is ever used.
    const span = document.createElement('span');
    span.textContent = text;
    return span;
}

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessages(messages) {
    if (messages.length === 0 && messagesEl.children.length === 0) {
        messagesEl.innerHTML = '<p class="empty-chat">No messages yet — say hello 👋</p>';
        return;
    }
    const emptyNote = messagesEl.querySelector('.empty-chat');
    if (emptyNote) emptyNote.remove();

    messages.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'msg-row' + (String(m.student_id) === String(loggedInStudent.id) ? ' mine' : '');

        const nameEl = document.createElement('div');
        nameEl.className = 'msg-name';
        nameEl.textContent = m.student_name;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(escapeAndLinkify(m.message));

        const timeEl = document.createElement('div');
        timeEl.className = 'msg-time';
        timeEl.textContent = formatTime(m.created_at);

        row.appendChild(nameEl);
        row.appendChild(bubble);
        row.appendChild(timeEl);
        messagesEl.appendChild(row);
    });

    if (atBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadInitialMessages() {
    const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        messagesEl.innerHTML = '<p class="empty-chat">Could not load chat right now.</p>';
        return;
    }

    renderMessages(data || []);
    if (data && data.length > 0) lastSeenId = data[data.length - 1].id;
}

async function pollNewMessages() {
    const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .gt('id', lastSeenId)
        .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    renderMessages(data);
    lastSeenId = data[data.length - 1].id;
}

messagesEl.addEventListener('scroll', () => {
    atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
});

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    sendButton.disabled = true;
    messageInput.disabled = true;

    const { error } = await supabase.from('group_messages').insert({
        student_id: loggedInStudent.id,
        student_name: loggedInStudent.name,
        message: text
    });

    if (error) {
        console.error('Could not send message:', error);
        alert('Could not send your message. Please try again.');
    } else {
        messageInput.value = '';
        atBottom = true;
        pollNewMessages();
    }

    sendButton.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(pollTimer); }
    else { pollNewMessages(); pollTimer = setInterval(pollNewMessages, 4000); }
});

if (isActivePremium(loggedInStudent)) {
    inputBar.style.display = 'flex';
    loadInitialMessages();
    pollTimer = setInterval(pollNewMessages, 4000);
} else {
    lockedScreen.style.display = 'flex';
}
