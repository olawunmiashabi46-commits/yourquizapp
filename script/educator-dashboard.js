import { supabase } from './supabase.js';

const SUBJECTS = ['Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Economics', 'Accounting', 'Commerce', 'Government',
    'Literature in English', 'History', 'CRS', 'Geography'];

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function icons() { if (window.lucide) lucide.createIcons(); }

// ---------- must be a signed-in educator ----------
const educator = JSON.parse(localStorage.getItem('loggedInEducator') || 'null');
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session || !educator) {
    window.location.href = 'login.html';
    await new Promise(() => {}); // stop here while the browser redirects
}

$('welcome').textContent = 'Welcome, ' + educator.name;
const isPremium = educator.plan === 'premium' &&
    (!educator.planExpiresAt || new Date(educator.planExpiresAt) > new Date());
const planPill = $('plan-pill');
planPill.textContent = isPremium ? 'Premium plan' : 'Free plan';
planPill.className = 'pill ' + (isPremium ? 'premium' : 'free');

$('logout-button').addEventListener('click', async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('loggedInEducator');
    window.location.href = 'login.html';
});

// ---------- form ----------
const subjectSelect = $('lesson-subject');
SUBJECTS.forEach((s) => {
    const o = el('option', '', s);
    o.value = s;
    subjectSelect.appendChild(o);
});

const YT_PATTERN = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/;

function friendly(error) {
    const m = (error && error.message) || '';
    const known = ['YouTube', 'subject', 'topic', 'title', 'description', 'waiting for approval', 'Only educators'];
    return known.some((k) => m.includes(k)) ? m : 'Something went wrong. Please try again.';
}

const addMessage = $('add-message');
$('add-button').addEventListener('click', async () => {
    const topic = $('lesson-topic').value.trim();
    const title = $('lesson-title').value.trim();
    const link = $('lesson-link').value.trim();

    addMessage.className = 'msg error';
    if (topic.length < 2) { addMessage.textContent = 'Please enter a topic.'; return; }
    if (title.length < 3) { addMessage.textContent = 'Please enter a lesson title.'; return; }
    if (!YT_PATTERN.test(link)) { addMessage.textContent = 'Please paste a valid YouTube link.'; return; }

    const btn = $('add-button');
    btn.disabled = true;
    addMessage.textContent = '';

    const { error } = await supabase.rpc('educator_add_lesson', {
        p_subject: subjectSelect.value,
        p_topic: topic,
        p_title: title,
        p_youtube_url: link,
        p_description: $('lesson-description').value
    });

    btn.disabled = false;
    if (error) {
        addMessage.className = 'msg error';
        addMessage.textContent = friendly(error);
        return;
    }

    addMessage.className = 'msg ok';
    addMessage.textContent = 'Submitted! Your lesson will appear for students once it is approved.';
    $('lesson-title').value = '';
    $('lesson-link').value = '';
    $('lesson-description').value = '';
    loadLessons();
});

// ---------- my lessons ----------
const STATUS = {
    pending: { cls: 'pending', icon: 'clock', text: 'Waiting for approval' },
    approved: { cls: 'approved', icon: 'circle-check', text: 'Live' },
    rejected: { cls: 'rejected', icon: 'circle-x', text: 'Not approved' }
};

async function loadLessons() {
    const list = $('lesson-list');
    const { data, error } = await supabase.rpc('educator_my_lessons');
    list.innerHTML = '';

    if (error) {
        list.appendChild(el('p', 'hint', 'Could not load your lessons right now.'));
        return;
    }
    if (!data || data.length === 0) {
        list.appendChild(el('p', 'hint', 'You have not added any lessons yet.'));
        return;
    }

    const suggestions = $('topic-suggestions');
    suggestions.innerHTML = '';
    [...new Set(data.map((l) => l.lesson_topic))].forEach((t) => {
        const o = document.createElement('option');
        o.value = t;
        suggestions.appendChild(o);
    });

    data.forEach((l) => {
        const card = el('div', 'card');
        const row = el('div', 'lesson-row');

        const thumb = el('img', 'lesson-thumb');
        thumb.src = 'https://img.youtube.com/vi/' + encodeURIComponent(l.lesson_youtube_id) + '/mqdefault.jpg';
        thumb.alt = '';
        row.appendChild(thumb);

        const info = el('div', 'lesson-info');
        info.appendChild(el('div', 'card-name', l.lesson_title));
        info.appendChild(el('div', 'card-sub', l.lesson_subject + ' · ' + l.lesson_topic));

        const st = STATUS[l.lesson_status] || STATUS.pending;
        const pill = el('span', 'pill ' + st.cls);
        const ic = document.createElement('i');
        ic.setAttribute('data-lucide', st.icon);
        pill.appendChild(ic);
        pill.appendChild(document.createTextNode(st.text));
        pill.style.marginTop = '6px';
        info.appendChild(pill);

        if (l.lesson_status === 'rejected' && l.lesson_reject_reason) {
            info.appendChild(el('div', 'reject-note', 'Reason: ' + l.lesson_reject_reason));
        }
        if (l.lesson_status === 'approved') {
            const stats = el('div', 'lesson-stats');
            stats.appendChild(el('span', '', Number(l.lesson_views) + ' viewed'));
            stats.appendChild(el('span', '', Number(l.lesson_impressions) + ' times shown'));
            info.appendChild(stats);
        }

        row.appendChild(info);
        card.appendChild(row);

        const del = el('button', 'btn small danger', 'Delete');
        del.type = 'button';
        del.style.marginTop = '10px';
        del.addEventListener('click', async () => {
            if (!confirm('Delete this lesson? This cannot be undone.')) return;
            del.disabled = true;
            const { error: err } = await supabase.rpc('educator_delete_lesson', { p_lesson_id: l.lesson_id });
            if (err) { alert('Could not delete the lesson.'); del.disabled = false; return; }
            loadLessons();
        });
        card.appendChild(del);

        list.appendChild(card);
    });
    icons();
}

loadLessons();
