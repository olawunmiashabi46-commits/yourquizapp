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

// ---------- sections, overview and navigation ----------
const state = { lessons: [], reviews: [], questions: [] };
const SECTIONS = ['overview', 'submit', 'videos', 'ratings', 'questions', 'qsubmit', 'qmine', 'guidelines'];

function updateOverview() {
    const L = state.lessons;
    const live = L.filter((l) => l.lesson_status === 'approved');
    const pending = L.filter((l) => l.lesson_status === 'pending').length;
    const views = live.reduce((sum, l) => sum + Number(l.lesson_views || 0), 0);
    const waiting = state.questions.filter((q) => !q.answer_text).length;
    const R = state.reviews;
    const avg = R.length ? (R.reduce((sum, r) => sum + r.rating, 0) / R.length).toFixed(1) : '-';

    $('ov-live').textContent = live.length;
    $('ov-pending').textContent = pending;
    $('ov-views').textContent = views;
    $('ov-questions').textContent = waiting;
    $('ov-rating').textContent = avg;
    $('ov-reviews').textContent = R.length;
    $('badge-videos').textContent = L.filter((l) => l.lesson_status === 'changes_required').length || '';
    $('badge-questions').textContent = waiting || '';
}

function showSection(name) {
    if (!SECTIONS.includes(name)) name = 'overview';
    SECTIONS.forEach((s) => {
        $('sec-' + s).hidden = s !== name;
        const item = document.querySelector('[data-nav="' + s + '"]');
        if (item) item.classList.toggle('active', s === name);
    });
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
}
document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => showSection(b.dataset.nav)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showSection(b.dataset.go)));
showSection(location.hash.slice(1));

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
    addMessage.textContent = 'Submitted! It is now waiting for the admin. Taking you to My Videos...';
    setTimeout(() => showSection('videos'), 1200);
    $('lesson-title').value = '';
    $('lesson-link').value = '';
    $('lesson-description').value = '';
    loadLessons();
});

// ---------- my lessons ----------
const STATUS = {
    pending: { cls: 'pending', icon: 'clock', text: 'Waiting for approval' },
    approved: { cls: 'approved', icon: 'circle-check', text: 'Approved, now live' },
    rejected: { cls: 'rejected', icon: 'circle-x', text: 'Not approved' },
    changes_required: { cls: 'free', icon: 'pencil', text: 'Changes required' }
};

async function loadLessons() {
    const list = $('lesson-list');
    const { data, error } = await supabase.rpc('educator_my_lessons');
    list.innerHTML = '';

    if (error) {
        list.appendChild(el('p', 'hint', 'Could not load your lessons right now.'));
        return;
    }
    state.lessons = data || []; updateOverview();
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
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
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
        if (l.lesson_status === 'changes_required') {
            info.appendChild(el('div', 'reject-note', 'What to change: ' + (l.lesson_reject_reason || 'Please check the details and send it again.')));
            const editBtn = el('button', 'btn small primary', 'Edit and send again');
            editBtn.type = 'button';
            editBtn.style.marginTop = '10px';
            editBtn.addEventListener('click', () => openEditForm(l, card, editBtn));
            info.appendChild(editBtn);
        }
        if (l.lesson_status === 'approved') {
            const stats = el('div', 'lesson-stats');
            stats.appendChild(el('span', '', Number(l.lesson_views) + ' viewed'));
            stats.appendChild(el('span', '', Number(l.lesson_impressions) + ' times shown'));
            info.appendChild(stats);
        }

        row.appendChild(info);
        card.appendChild(row);


        list.appendChild(card);
    });
    icons();
}

// ---------- what students say (read-only) ----------
const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starsRow(rating) {
    const ns = 'http://www.w3.org/2000/svg';
    const wrap = el('span', 'stars');
    for (let i = 1; i <= 5; i++) {
        const filled = i <= Math.round(rating);
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', filled ? '#f59e0b' : 'none');
        svg.setAttribute('stroke', filled ? '#f59e0b' : '#cbd5e1');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linejoin', 'round');
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', STAR_POINTS);
        svg.appendChild(poly);
        wrap.appendChild(svg);
    }
    return wrap;
}

async function loadReviews() {
    const summary = $('review-summary');
    const list = $('review-list');
    const { data, error } = await supabase.rpc('educator_my_reviews');
    summary.innerHTML = '';
    list.innerHTML = '';

    if (error) {
        list.appendChild(el('p', 'hint', 'Could not load your reviews right now.'));
        return;
    }
    state.reviews = data || []; updateOverview();
    if (!data || data.length === 0) {
        list.appendChild(el('p', 'hint', 'No reviews yet. They will appear here when students rate you.'));
        return;
    }

    const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
    const head = el('div', 'card');
    const line = el('div', 'rating-line');
    line.style.marginTop = '0';
    line.appendChild(starsRow(avg));
    line.appendChild(el('span', '', avg.toFixed(1) + ' average from ' + data.length +
        (data.length === 1 ? ' review' : ' reviews')));
    head.appendChild(line);
    summary.appendChild(head);

    data.forEach((r) => {
        const card = el('div', 'card');
        const top = el('div', 'review-head');
        top.appendChild(el('div', 'card-name', r.author_name));
        top.appendChild(starsRow(r.rating));
        card.appendChild(top);
        card.appendChild(el('div', 'review-meta', new Date(r.created_at).toLocaleDateString()));
        if (r.comment) card.appendChild(el('div', 'review-comment', r.comment));
        list.appendChild(card);
    });
}

// ---------- student questions ----------
async function loadQuestions() {
    const list = $('question-list');
    const { data, error } = await supabase.rpc('educator_lesson_questions');
    list.innerHTML = '';

    if (error) {
        list.appendChild(el('p', 'hint', 'Could not load questions right now.'));
        return;
    }
    state.questions = data || []; updateOverview();
    if (!data || data.length === 0) {
        list.appendChild(el('p', 'hint', 'No questions yet. They will appear here when students ask about your lessons.'));
        return;
    }

    data.forEach((q) => {
        const card = el('div', 'card');

        const top = el('div', 'review-head');
        top.appendChild(el('div', 'card-name', q.author_name));
        const waiting = !q.answer_text;
        const pill = el('span', 'pill ' + (waiting ? 'pending' : 'approved'), waiting ? 'Waiting for your answer' : 'Answered');
        top.appendChild(pill);
        card.appendChild(top);

        card.appendChild(el('div', 'card-sub', 'On: ' + q.lesson_title + ' · ' + new Date(q.asked_at).toLocaleDateString()));
        card.appendChild(el('div', 'review-comment', q.question_text));

        const box = el('textarea', 'review-text');
        box.maxLength = 1000;
        box.placeholder = 'Type your answer';
        box.value = q.answer_text || '';
        box.style.marginTop = '10px';
        card.appendChild(box);

        const send = el('button', 'btn small primary', waiting ? 'Send answer' : 'Update answer');
        send.type = 'button';
        send.style.marginTop = '10px';
        const msg = el('div', 'msg');
        send.addEventListener('click', async () => {
            if (box.value.trim().length < 1) {
                msg.className = 'msg error';
                msg.textContent = 'Please type your answer first.';
                return;
            }
            send.disabled = true;
            const { error: err } = await supabase.rpc('educator_answer_question',
                { p_question_id: q.question_id, p_answer: box.value });
            if (err) {
                msg.className = 'msg error';
                msg.textContent = 'Could not send your answer. Please try again.';
                send.disabled = false;
                return;
            }
            loadQuestions();
        });
        card.appendChild(send);
        card.appendChild(msg);
        list.appendChild(card);
    });
}

loadLessons();
loadQuestions();
loadReviews();

// ---------- quiz question submissions ----------
SUBJECTS.forEach((name) => {
    const o = el('option', '', name);
    o.value = name;
    $('q-subject').appendChild(o);
});

const qMessage = $('q-message');
$('q-button').addEventListener('click', async () => {
    const v = (id) => $(id).value.trim();
    const opts = [v('q-a'), v('q-b'), v('q-c'), v('q-d')];
    qMessage.className = 'msg error';

    if (v('q-topic').length < 2) { qMessage.textContent = 'Please enter the topic.'; return; }
    if (v('q-text').length < 10) { qMessage.textContent = 'Please type the full question.'; return; }
    if (opts.some((o) => o === '')) { qMessage.textContent = 'Please fill in all four options.'; return; }
    if (new Set(opts.map((o) => o.toLowerCase())).size < 4) { qMessage.textContent = 'Two of the options are the same.'; return; }
    if (!v('q-answer')) { qMessage.textContent = 'Please choose the correct answer.'; return; }

    const btn = $('q-button');
    btn.disabled = true;
    qMessage.textContent = '';

    const { error } = await supabase.rpc('educator_submit_question', {
        p_subject: $('q-subject').value, p_topic: v('q-topic'), p_difficulty: $('q-difficulty').value,
        p_question: v('q-text'), p_a: opts[0], p_b: opts[1], p_c: opts[2], p_d: opts[3],
        p_answer: v('q-answer'), p_explanation: v('q-explanation')
    });
    btn.disabled = false;

    if (error) {
        qMessage.className = 'msg error';
        qMessage.textContent = /subject|topic|difficulty|question|option|answer|waiting|educators/i.test(error.message || '')
            ? error.message : 'Something went wrong. Please try again.';
        return;
    }
    qMessage.className = 'msg ok';
    qMessage.textContent = 'Submitted! The admin will review it. You can follow it in My Question Submissions.';
    ['q-text', 'q-a', 'q-b', 'q-c', 'q-d', 'q-explanation'].forEach((id) => { $(id).value = ''; });
    $('q-answer').value = '';
    loadMyQuestions();
});

const Q_STATUS = {
    pending: { cls: 'pending', text: 'Waiting for review' },
    approved: { cls: 'approved', text: 'Approved, added to the question bank' },
    rejected: { cls: 'rejected', text: 'Not approved' }
};

async function loadMyQuestions() {
    const list = $('qmine-list');
    const { data, error } = await supabase.rpc('educator_my_questions');
    list.innerHTML = '';
    if (error) { list.appendChild(el('p', 'hint', 'Could not load your questions right now.')); return; }
    if (!data || data.length === 0) {
        list.appendChild(el('p', 'hint', 'You have not submitted any questions yet.'));
        return;
    }
    data.forEach((q) => {
        const card = el('div', 'card');
        const st = Q_STATUS[q.q_status] || Q_STATUS.pending;
        const top = el('div', 'review-head');
        top.appendChild(el('div', 'card-sub', q.q_subject + ' · ' + q.q_topic + ' · ' + q.q_difficulty));
        top.appendChild(el('span', 'pill ' + st.cls, st.text));
        card.appendChild(top);
        card.appendChild(el('div', 'review-comment', q.q_text));
        if (q.q_status === 'rejected' && q.q_reject_reason) {
            card.appendChild(el('div', 'reject-note', 'Reason: ' + q.q_reject_reason));
        }
        card.appendChild(el('div', 'review-meta', new Date(q.q_created_at).toLocaleDateString()));
        list.appendChild(card);
    });
}
loadMyQuestions();

// ---------- fix a lesson that was sent back ----------
function openEditForm(l, card, editBtn) {
    editBtn.style.display = 'none';
    const form = el('div');
    form.style.marginTop = '12px';

    function field(labelText, control) {
        const f = el('div', 'field');
        f.appendChild(el('label', '', labelText));
        f.appendChild(control);
        form.appendChild(f);
        return control;
    }
    const subject = field('Subject', el('select'));
    SUBJECTS.forEach((name) => { const o = el('option', '', name); o.value = name; subject.appendChild(o); });
    subject.value = l.lesson_subject;
    const topic = field('Topic', el('input')); topic.type = 'text'; topic.maxLength = 80; topic.value = l.lesson_topic;
    const title = field('Lesson title', el('input')); title.type = 'text'; title.maxLength = 100; title.value = l.lesson_title;
    const link = field('YouTube link', el('input')); link.type = 'url';
    link.value = l.lesson_source_video_id ? 'https://www.youtube.com/watch?v=' + l.lesson_source_video_id : '';
    const desc = field('Short description (optional)', el('textarea')); desc.maxLength = 300; desc.value = l.lesson_description || '';

    const msg = el('div', 'msg');
    const send = el('button', 'btn small primary', 'Send again');
    send.type = 'button';
    const cancel = el('button', 'btn small', 'Cancel');
    cancel.type = 'button';
    cancel.style.marginLeft = '8px';
    cancel.addEventListener('click', () => { form.remove(); editBtn.style.display = ''; });

    send.addEventListener('click', async () => {
        msg.className = 'msg error';
        if (topic.value.trim().length < 2) { msg.textContent = 'Please enter a topic.'; return; }
        if (title.value.trim().length < 3) { msg.textContent = 'Please enter a lesson title.'; return; }
        if (!/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.test(link.value)) {
            msg.textContent = 'Please paste a valid YouTube link.'; return;
        }
        send.disabled = true;
        msg.textContent = '';
        const { error } = await supabase.rpc('educator_update_lesson', {
            p_lesson_id: l.lesson_id, p_subject: subject.value, p_topic: topic.value, p_title: title.value,
            p_youtube_url: link.value, p_description: desc.value
        });
        if (error) {
            msg.textContent = friendly(error);
            send.disabled = false;
            return;
        }
        loadLessons();
    });

    const buttons = el('div');
    buttons.appendChild(send);
    buttons.appendChild(cancel);
    form.appendChild(buttons);
    form.appendChild(msg);
    card.appendChild(form);
}
