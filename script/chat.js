import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

function isActivePremium(student) {
    if (!student || student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}

const ROOM_NAMES = { general: 'General', science: 'Science', commercial: 'Commercial', arts: 'Arts' };
const params = new URLSearchParams(window.location.search);
const room = ROOM_NAMES[params.get('room')] ? params.get('room') : 'general';
$('room-title').textContent = ROOM_NAMES[room] + ' Chat';

const messagesEl = $('chat-messages');
const inputBar = $('chat-input-bar');
const lockedScreen = $('locked-screen');
const messageInput = $('message-input');
const sendButton = $('send-button');
const micButton = $('mic-button');
const recordingIndicator = $('recording-indicator');
const recordingTime = $('recording-time');

const MAX_RECORDING_SECONDS = 120;

// Change this if your own student id is ever different — it decides
// who is allowed to pin/unpin messages. Also enforced on the server,
// so this is just for showing/hiding the pin button in the UI.
const ADMIN_STUDENT_ID = 9;
const isAdmin = String(loggedInStudent.id) === String(ADMIN_STUDENT_ID);

const pinnedBar = $('pinned-bar');

let lastSeenId = 0;
let pollTimer = null;
let atBottom = true;
let isPolling = false;

function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDuration(totalSeconds) {
    const s = Math.round(totalSeconds);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
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

        if (m.pinned) row.classList.add('pinned');

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        if (m.message_type === 'voice' && m.voice_url) {
            bubble.classList.add('voice-bubble');
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = m.voice_url;
            bubble.appendChild(audio);
            if (m.voice_duration_seconds) {
                const dur = document.createElement('span');
                dur.style.fontSize = '12px';
                dur.textContent = formatDuration(m.voice_duration_seconds);
                bubble.appendChild(dur);
            }
        } else {
            const textSpan = document.createElement('span');
            textSpan.textContent = m.message;
            bubble.appendChild(textSpan);
        }

        const timeEl = document.createElement('div');
        timeEl.className = 'msg-time';
        timeEl.textContent = formatTime(m.created_at);

        row.appendChild(nameEl);
        row.appendChild(bubble);
        row.appendChild(timeEl);

        if (isAdmin) {
            const pinBtn = document.createElement('button');
            pinBtn.className = 'pin-toggle';
            pinBtn.textContent = m.pinned ? 'Unpin' : 'Pin';
            pinBtn.addEventListener('click', () => togglePin(m.id, !m.pinned));
            row.appendChild(pinBtn);
        }

        messagesEl.appendChild(row);
    });

    if (atBottom) messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function loadInitialMessages() {
    // Messages older than 7 days quietly drop out of view here — they
    // stay safely in the database, nothing is deleted.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('room', room)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        messagesEl.innerHTML = '<p class="empty-chat">Could not load chat right now.</p>';
        return;
    }

    renderMessages(data || []);
    if (data && data.length > 0) lastSeenId = data[data.length - 1].id;

    loadPinnedMessages();
}

// ---------- PINNED MESSAGES ----------
async function loadPinnedMessages() {
    const { data, error } = await supabase
        .from('group_messages')
        .select('id, student_name, message, message_type')
        .eq('room', room)
        .eq('pinned', true)
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        pinnedBar.style.display = 'none';
        pinnedBar.innerHTML = '';
        return;
    }

    pinnedBar.innerHTML = '<div class="pinned-bar-title"><i data-lucide="pin"></i> Pinned</div>';
    data.forEach((m) => {
        const item = document.createElement('div');
        item.className = 'pinned-item';
        const text = m.message_type === 'voice' ? '🎙️ Voice note' : m.message;
        const span = document.createElement('span');
        span.innerHTML = '';
        const nameB = document.createElement('b');
        nameB.textContent = m.student_name + ': ';
        span.appendChild(nameB);
        span.appendChild(document.createTextNode(text));
        item.appendChild(span);

        if (isAdmin) {
            const unpinBtn = document.createElement('button');
            unpinBtn.textContent = 'Unpin';
            unpinBtn.addEventListener('click', () => togglePin(m.id, false));
            item.appendChild(unpinBtn);
        }
        pinnedBar.appendChild(item);
    });
    pinnedBar.style.display = 'block';
    if (window.lucide) lucide.createIcons();
}

async function togglePin(messageId, newPinned) {
    const { error } = await supabase
        .from('group_messages')
        .update({ pinned: newPinned })
        .eq('id', messageId);

    if (error) {
        console.error('Could not update pin:', error);
        alert('Could not update pin status.');
        return;
    }
    // Re-draw the room so the Pin/Unpin label and highlight update.
    messagesEl.innerHTML = '';
    lastSeenId = 0;
    loadInitialMessages();
}

async function pollNewMessages() {
    if (isPolling) return;
    isPolling = true;
    try {
        const { data, error } = await supabase
            .from('group_messages')
            .select('*')
            .eq('room', room)
            .gt('id', lastSeenId)
            .order('created_at', { ascending: true });

        if (error || !data || data.length === 0) return;

        renderMessages(data);
        lastSeenId = data[data.length - 1].id;
    } finally {
        isPolling = false;
    }
}

messagesEl.addEventListener('scroll', () => {
    atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
});

// ---------- TEXT MESSAGES ----------
async function sendTextMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    sendButton.disabled = true;
    messageInput.disabled = true;

    const { error } = await supabase.from('group_messages').insert({
        student_id: loggedInStudent.id,
        student_name: loggedInStudent.name,
        message: text,
        message_type: 'text',
        room
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

sendButton.addEventListener('click', sendTextMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendTextMessage();
    }
});
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 100) + 'px';
});

// ---------- VOICE NOTES ----------
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimerInterval = null;

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Voice notes are not supported on this browser.');
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            handleRecordingStop();
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        micButton.classList.add('recording');
        recordingIndicator.style.display = 'flex';

        recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            recordingTime.textContent = 'Recording... ' + formatDuration(elapsed);
            if (elapsed >= MAX_RECORDING_SECONDS) stopRecording();
        }, 250);
    } catch (err) {
        console.error('Microphone access error:', err);
        alert('Could not access your microphone. Please allow microphone permission and try again.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    clearInterval(recordingTimerInterval);
    micButton.classList.remove('recording');
    recordingIndicator.style.display = 'none';
}

async function handleRecordingStop() {
    const durationSeconds = Math.min(MAX_RECORDING_SECONDS, Math.round((Date.now() - recordingStartTime) / 1000));
    if (durationSeconds < 1 || recordedChunks.length === 0) return;

    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const fileName = 'voice_' + loggedInStudent.id + '_' + Date.now() + '.webm';

    micButton.disabled = true;
    try {
        const { error: uploadErr } = await supabase.storage
            .from('voice-notes')
            .upload(fileName, blob, { contentType: 'audio/webm' });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName);

        const { error: insertErr } = await supabase.from('group_messages').insert({
            student_id: loggedInStudent.id,
            student_name: loggedInStudent.name,
            message_type: 'voice',
            voice_url: urlData.publicUrl,
            voice_duration_seconds: durationSeconds,
            room
        });
        if (insertErr) throw insertErr;

        atBottom = true;
        pollNewMessages();
    } catch (err) {
        console.error('Could not send voice note:', err);
        alert('Could not send your voice note. Please try again.');
    } finally {
        micButton.disabled = false;
    }
}

micButton.addEventListener('mousedown', startRecording);
micButton.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
micButton.addEventListener('mouseup', stopRecording);
micButton.addEventListener('mouseleave', () => { if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording(); });
micButton.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

// ---------- POLLING LIFECYCLE ----------
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
