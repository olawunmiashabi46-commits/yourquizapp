import { supabase } from './supabase.js';

// ======================================
// USER
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));

if (!loggedInStudent) {
    window.location.href = 'login.html';
}

const leaderboardContainer = document.getElementById('leaderboard-container');
const backButton = document.getElementById('back-button');

// How many students each session shows before "Show all"
const TOP_COUNT = 5;

// Poll interval (ms). Results only change when someone submits.
const REFRESH_MS = 10000;

// Which session cards the student has expanded (kept across refreshes)
const expandedSessions = new Set();

let lastSessions = [];
let lastSignature = '';

// ======================================
// SMALL HELPERS
// ======================================
function makeEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function ordinal(n) {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
        case 1: return `${n}st`;
        case 2: return `${n}nd`;
        case 3: return `${n}rd`;
        default: return `${n}th`;
    }
}

function percentOf(entry) {
    const total = Number(entry.total_questions) || 0;
    const score = Number(entry.score) || 0;
    return total > 0 ? (score / total) * 100 : 0;
}

function formatDate(iso) {
    if (!iso) return 'Date unknown';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date unknown';

    const datePart = d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    return `${datePart} · ${timePart}`;
}

// ======================================
// GROUP RESULTS INTO SESSIONS (ONE PER QUIZ)
// Each quiz session is ranked on its own, so different days / different
// quizzes are never added together.
// ======================================
function buildSessions(results, quizzes) {
    const quizById = new Map();
    (quizzes || []).forEach(q => quizById.set(String(q.id), q));

    const groups = new Map();

    (results || []).forEach(entry => {
        const key = String(entry.quiz_id);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    });

    const sessions = [];

    groups.forEach((entries, quizKey) => {
        // Keep only each student's best attempt within THIS session
        const bestByStudent = new Map();

        entries.forEach(entry => {
            const id = String(entry.student_id || entry.student_name || 'unknown');
            const current = bestByStudent.get(id);

            if (!current) {
                bestByStudent.set(id, entry);
                return;
            }

            const better =
                percentOf(entry) > percentOf(current) ||
                (percentOf(entry) === percentOf(current) &&
                    (Number(entry.score) || 0) > (Number(current.score) || 0));

            if (better) bestByStudent.set(id, entry);
        });

        const ranked = Array.from(bestByStudent.values()).sort((a, b) => {
            const pctDiff = percentOf(b) - percentOf(a);
            if (pctDiff !== 0) return pctDiff;

            const scoreDiff = (Number(b.score) || 0) - (Number(a.score) || 0);
            if (scoreDiff !== 0) return scoreDiff;

            // Tie-break: whoever submitted first ranks higher
            const aTime = new Date(a.submitted_at || a.completed_at || 0).getTime();
            const bTime = new Date(b.submitted_at || b.completed_at || 0).getTime();
            return aTime - bTime;
        });

        const quiz = quizById.get(quizKey) || {};

        // Date of the session: quiz creation time, else earliest submission
        const earliestSubmit = entries
            .map(e => e.submitted_at || e.completed_at)
            .filter(Boolean)
            .sort()[0];

        const dateIso = quiz.started_at || quiz.created_at || earliestSubmit || null;

        sessions.push({
            key: quizKey,
            title: quiz.title || 'Multiplayer Quiz',
            dateIso,
            ranked
        });
    });

    // Newest session first
    sessions.sort((a, b) => {
        const aT = a.dateIso ? new Date(a.dateIso).getTime() : 0;
        const bT = b.dateIso ? new Date(b.dateIso).getTime() : 0;
        return bT - aT;
    });

    return sessions;
}

// ======================================
// FETCH DATA
// ======================================
async function fetchAllResults() {
    const columns =
        'quiz_id, student_id, student_name, score, total_questions, submitted_at, completed_at';
    const pageSize = 1000;
    const maxRows = 5000;
    let all = [];
    let from = 0;

    // Supabase returns at most 1000 rows per request, so page through
    while (from < maxRows) {
        const { data, error } = await supabase
            .from('quiz_results')
            .select(columns)
            .order('submitted_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) throw error;

        all = all.concat(data || []);
        if (!data || data.length < pageSize) break;
        from += pageSize;
    }

    return all;
}

async function fetchQuizzes(results) {
    const ids = Array.from(
        new Set(
            results
                .map(r => r.quiz_id)
                .filter(id => id !== null && id !== undefined)
        )
    );

    if (ids.length === 0) return [];

    const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, created_at, started_at')
        .in('id', ids);

    if (error) {
        // Not fatal: sessions still show, just without title/date from quizzes
        console.error('Could not load quiz details:', error);
        return [];
    }

    return data || [];
}

async function fetchLiveLeaderboard() {
    if (!leaderboardContainer) return;
    if (document.hidden) return;

    try {
        const results = await fetchAllResults();

        if (results.length === 0) {
            lastSessions = [];
            lastSignature = 'empty';
            renderEmpty();
            return;
        }

        const quizzes = await fetchQuizzes(results);
        const sessions = buildSessions(results, quizzes);

        // Skip re-drawing when nothing changed (avoids flicker / scroll jump)
        const signature = JSON.stringify(
            sessions.map(s => [
                s.key,
                s.title,
                s.dateIso,
                s.ranked.map(r => [r.student_id, r.student_name, r.score, r.total_questions])
            ])
        );

        if (signature === lastSignature) return;

        lastSignature = signature;
        lastSessions = sessions;
        renderSessions();
    } catch (err) {
        console.error('Leaderboard fetch error:', err);
        leaderboardContainer.innerHTML = '';
        leaderboardContainer.appendChild(
            makeEl(
                'div',
                'leaderboard-message error',
                `Unable to load rankings: ${err.message || 'Database error'}`
            )
        );
    }
}

// ======================================
// RENDER
// ======================================
function renderEmpty() {
    leaderboardContainer.innerHTML = '';
    leaderboardContainer.appendChild(
        makeEl(
            'div',
            'leaderboard-message',
            'No multiplayer quiz results yet. Results appear here after students submit.'
        )
    );
}

function buildRow(entry, index, isMe) {
    const row = makeEl('div', 'leaderboard-row');

    let badge = ordinal(index + 1);
    if (index === 0) { badge = '🥇 1st'; row.classList.add('first-place'); }
    else if (index === 1) { badge = '🥈 2nd'; row.classList.add('second-place'); }
    else if (index === 2) { badge = '🥉 3rd'; row.classList.add('third-place'); }

    if (isMe) row.classList.add('my-row');

    const name = entry.student_name || 'Anonymous Student';

    row.appendChild(makeEl('span', 'position', badge));
    row.appendChild(makeEl('span', 'student', isMe ? `${name} (You)` : name));
    row.appendChild(makeEl('span', 'score', `${Math.round(percentOf(entry))}%`));

    return row;
}

function isMine(entry) {
    if (!loggedInStudent) return false;
    if (entry.student_id !== null && entry.student_id !== undefined && loggedInStudent.id !== undefined) {
        return String(entry.student_id) === String(loggedInStudent.id);
    }
    return entry.student_name === loggedInStudent.name;
}

function renderSessions() {
    leaderboardContainer.innerHTML = '';

    lastSessions.forEach(session => {
        const card = makeEl('div', 'leaderboard-card session-card');

        // Header: date + time, quiz title, then number of students
        const header = makeEl('div', 'session-header');
        header.appendChild(makeEl('div', 'session-date', formatDate(session.dateIso)));
        header.appendChild(makeEl('div', 'session-title', session.title));
        header.appendChild(
            makeEl(
                'div',
                'session-meta',
                `${session.ranked.length} student${session.ranked.length === 1 ? '' : 's'}`
            )
        );
        card.appendChild(header);

        // Column labels
        const labels = makeEl('div', 'table-header');
        labels.appendChild(makeEl('span', '', 'Position'));
        labels.appendChild(makeEl('span', '', 'Student'));
        labels.appendChild(makeEl('span', '', 'Score'));
        card.appendChild(labels);

        const expanded = expandedSessions.has(session.key);
        const visible = expanded ? session.ranked : session.ranked.slice(0, TOP_COUNT);

        visible.forEach((entry, index) => {
            card.appendChild(buildRow(entry, index, isMine(entry)));
        });

        // If collapsed and the student is outside the top list, still show them
        if (!expanded && session.ranked.length > TOP_COUNT) {
            const myIndex = session.ranked.findIndex(isMine);

            if (myIndex >= TOP_COUNT) {
                card.appendChild(makeEl('div', 'gap-row', '• • •'));
                card.appendChild(buildRow(session.ranked[myIndex], myIndex, true));
            }
        }

        // Show all / Show top 5
        if (session.ranked.length > TOP_COUNT) {
            const toggle = makeEl(
                'button',
                'show-all-button',
                expanded ? `Show top ${TOP_COUNT} only` : `Show all ${session.ranked.length} students`
            );
            toggle.type = 'button';

            toggle.addEventListener('click', () => {
                if (expandedSessions.has(session.key)) {
                    expandedSessions.delete(session.key);
                } else {
                    expandedSessions.add(session.key);
                }
                renderSessions();
            });

            card.appendChild(toggle);
        }

        leaderboardContainer.appendChild(card);
    });
}

// ======================================
// INIT
// ======================================
window.addEventListener('DOMContentLoaded', () => {
    fetchLiveLeaderboard();
    setInterval(fetchLiveLeaderboard, REFRESH_MS);
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchLiveLeaderboard();
});

if (backButton) {
    backButton.addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
}
