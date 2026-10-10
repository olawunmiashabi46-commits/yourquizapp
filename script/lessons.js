import { supabase } from './supabase.js';

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

function isActivePremium(student) {
    if (!student || student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}

const view = document.getElementById('view');
const pageTitle = document.getElementById('page-title');
const backLink = document.getElementById('back-link');
const params = new URLSearchParams(window.location.search);
const subject = params.get('subject');
const topic = params.get('topic');
const lessonId = params.get('lesson');

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
function icons() { if (window.lucide) lucide.createIcons(); }
function friendly(error) {
    const m = (error && error.message) || '';
    return m.includes('Premium') || m.includes('not found') ? m : 'Something went wrong. Please try again.';
}
function link(href, className, text) {
    const a = el('a', className, text);
    a.href = href;
    return a;
}

function showLocked() {
    view.innerHTML = '';
    const box = el('div', 'locked');
    box.appendChild(el('p', '', 'Video lessons are a Premium feature.'));
    box.appendChild(link('upgrade.html', 'btn primary', 'Upgrade to unlock'));
    view.appendChild(box);
}

// ---------------- 1. subjects ----------------
async function showSubjects() {
    pageTitle.textContent = 'Lessons';
    backLink.href = 'dashboard.html';
    const { data, error } = await supabase.rpc('list_lesson_subjects');
    view.innerHTML = '';
    if (error) { view.appendChild(el('p', 'hint', friendly(error))); return; }
    if (!data || data.length === 0) {
        view.appendChild(el('p', 'hint', 'No lessons are available yet. Check back soon!'));
        return;
    }
    data.forEach((s) => {
        const card = link('lessons.html?subject=' + encodeURIComponent(s.subject_name), 'card tree-card');
        card.appendChild(el('div', 'card-name', s.subject_name));
        card.appendChild(el('div', 'tree-count', s.lesson_count + (Number(s.lesson_count) === 1 ? ' lesson' : ' lessons')));
        view.appendChild(card);
    });
}

// ---------------- 2. topics in a subject ----------------
async function showTopics() {
    pageTitle.textContent = subject;
    backLink.href = 'lessons.html';
    const { data, error } = await supabase.rpc('list_lesson_topics', { p_subject: subject });
    view.innerHTML = '';
    if (error) { view.appendChild(el('p', 'hint', friendly(error))); return; }
    if (!data || data.length === 0) {
        view.appendChild(el('p', 'hint', 'No lessons in this subject yet.'));
        return;
    }
    data.forEach((t) => {
        const card = link('lessons.html?subject=' + encodeURIComponent(subject) +
            '&topic=' + encodeURIComponent(t.topic_name), 'card tree-card');
        card.appendChild(el('div', 'card-name', t.topic_name));
        card.appendChild(el('div', 'tree-count', t.lesson_count + (Number(t.lesson_count) === 1 ? ' lesson' : ' lessons')));
        view.appendChild(card);
    });
}

// ---------------- 3. lessons in a topic ----------------
async function showLessonList() {
    pageTitle.textContent = topic;
    backLink.href = 'lessons.html?subject=' + encodeURIComponent(subject);
    const { data, error } = await supabase.rpc('list_lessons', { p_subject: subject, p_topic: topic });
    view.innerHTML = '';
    if (error) { view.appendChild(el('p', 'hint', friendly(error))); return; }
    if (!data || data.length === 0) {
        view.appendChild(el('p', 'hint', 'No lessons in this topic yet.'));
        return;
    }
    data.forEach((l) => {
        const card = link('lessons.html?lesson=' + encodeURIComponent(l.lesson_id), 'card');
        const row = el('div', 'lesson-row');

        const thumb = el('img', 'lesson-thumb');
        thumb.src = 'https://img.youtube.com/vi/' + encodeURIComponent(l.lesson_youtube_id) + '/mqdefault.jpg';
        thumb.alt = '';
        row.appendChild(thumb);

        const info = el('div', 'lesson-info');
        info.appendChild(el('div', 'card-name', l.lesson_title));
        info.appendChild(el('div', 'card-sub', 'by ' + l.educator_name));
        if (l.is_watched) {
            const tick = el('div', 'watched-tick');
            const ic = document.createElement('i');
            ic.setAttribute('data-lucide', 'circle-check');
            tick.appendChild(ic);
            tick.appendChild(document.createTextNode('Watched'));
            info.appendChild(tick);
        }
        row.appendChild(info);
        card.appendChild(row);
        view.appendChild(card);
    });
    icons();
}

// ---------------- 4. watching one lesson ----------------
async function showPlayer() {
    const { data, error } = await supabase.rpc('open_lesson', { p_lesson_id: Number(lessonId) });
    view.innerHTML = '';
    if (error || !data || data.length === 0) {
        backLink.href = 'lessons.html';
        view.appendChild(el('p', 'hint', error ? friendly(error) : 'This lesson could not be found.'));
        return;
    }

    const l = data[0];
    pageTitle.textContent = l.lesson_topic;
    backLink.href = 'lessons.html?subject=' + encodeURIComponent(l.lesson_subject) +
        '&topic=' + encodeURIComponent(l.lesson_topic);

    const wrap = el('div', 'video-wrap');
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(l.lesson_youtube_id) + '?rel=0&modestbranding=1';
    frame.title = l.lesson_title;
    frame.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    wrap.appendChild(frame);
    view.appendChild(wrap);

    const info = el('div', 'card');
    info.style.marginTop = '14px';
    info.appendChild(el('div', 'card-name', l.lesson_title));
    info.appendChild(el('div', 'card-sub', l.lesson_subject + ' · ' + l.lesson_topic));
    if (l.lesson_description) info.appendChild(el('div', 'card-bio', l.lesson_description));
    view.appendChild(info);

    const teacher = link('educators.html?id=' + encodeURIComponent(l.lesson_educator_id), 'card');
    teacher.style.display = 'flex';
    teacher.style.justifyContent = 'space-between';
    teacher.style.alignItems = 'center';
    const left = el('div');
    left.appendChild(el('div', 'card-name', l.educator_name));
    left.appendChild(el('div', 'card-sub', 'See reviews and rate this educator'));
    teacher.appendChild(left);
    const arrow = document.createElement('i');
    arrow.setAttribute('data-lucide', 'chevron-right');
    teacher.appendChild(arrow);
    view.appendChild(teacher);
    icons();
}

// ---------------------------------------------------------------
if (!isActivePremium(loggedInStudent)) {
    showLocked();
} else if (lessonId) {
    showPlayer();
} else if (subject && topic) {
    showLessonList();
} else if (subject) {
    showTopics();
} else {
    showSubjects();
}
