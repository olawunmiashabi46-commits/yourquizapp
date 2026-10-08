import { supabase } from './supabase.js';

const adminAuthenticated = sessionStorage.getItem('adminAuthenticated');
if (adminAuthenticated !== 'true') {
    window.location.href = 'admin-login.html';
}

function generateQuizCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

const titleInput = document.getElementById('champ-title');
const eligibleSelect = document.getElementById('champ-eligible');
const regOpensInput = document.getElementById('champ-reg-opens');
const regClosesInput = document.getElementById('champ-reg-closes');
const dateInput = document.getElementById('champ-date');

// Don't let the admin scroll into a past DAY. The exact "can't be in the
// past" check (down to the minute) still happens when Create is clicked,
// so this is just a gentle floor, it won't un-pick a value while you type.
function startOfTodayInputValue() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T00:00';
}
[regOpensInput, regClosesInput, dateInput].forEach((input) => {
    if (input) input.min = startOfTodayInputValue();
});

const durationInput = document.getElementById('champ-duration');
const prizeInput = document.getElementById('champ-prize');
const createButton = document.getElementById('create-button');
const errorMessage = document.getElementById('error-message');
const champList = document.getElementById('champ-list');

function statusPill(row) {
    if (row.status === 'started') return '<span class="pill-badge live"><i data-lucide="radio"></i> Live now</span>';
    if (row.status === 'ended') return '<span class="pill-badge ended"><i data-lucide="flag"></i> Ended</span>';

    // Scheduled, but its start time has already passed and it was never started.
    if (row.scheduled_at && new Date(row.scheduled_at) < new Date()) {
        return '<span class="pill-badge free"><i data-lucide="alert-triangle"></i> Missed — start time passed</span>';
    }
    return '<span class="pill-badge premium"><i data-lucide="clock"></i> Scheduled</span>';
}

async function loadChampionships() {
    champList.innerHTML = '<p style="color:#64748b; font-size:14px;">Loading...</p>';
    const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, status, scheduled_at, duration_minutes, eligible_plan')
        .eq('is_championship', true)
        .order('scheduled_at', { ascending: false });

    if (error) {
        champList.innerHTML = '<p style="color:#dc2626; font-size:14px;">Could not load championships.</p>';
        return;
    }
    if (!data || data.length === 0) {
        champList.innerHTML = '<p style="color:#64748b; font-size:14px;">No championships yet.</p>';
        return;
    }

    champList.innerHTML = '';
    data.forEach(function (row) {
        const when = row.scheduled_at ? new Date(row.scheduled_at).toLocaleString() : 'No date set';
        const div = document.createElement('div');
        div.className = 'champ-row';
        const eligLabel = row.eligible_plan === 'free'
            ? '<span class="pill-badge free"><i data-lucide="ticket"></i> ₦2,000 entry</span>'
            : '<span class="pill-badge premium"><i data-lucide="star"></i> Premium only</span>';
        div.innerHTML = `
            <div class="champ-info">
                <b>${row.title}</b><br>
                ${when} &middot; ${row.duration_minutes} min
                <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">${eligLabel} ${statusPill(row)}</div>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                <button class="app-button" data-add="${row.id}"><i data-lucide="plus-circle"></i> Add Questions</button>
                ${row.status === 'scheduled' ? `<button class="app-button primary" data-start="${row.id}"><i data-lucide="play"></i> Start Now</button>` : ''}
                ${row.status === 'started' ? `<button class="app-button primary" data-end="${row.id}"><i data-lucide="square"></i> End Now</button>` : ''}
                <button class="app-button" style="color:#dc2626; border-color:#fecaca;" data-delete="${row.id}" data-title="${row.title.replace(/"/g, '&quot;')}"><i data-lucide="trash-2"></i> Delete</button>
            </div>`;
        champList.appendChild(div);
    });

    if (window.lucide) lucide.createIcons();

    champList.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            sessionStorage.setItem('adminChampionshipId', btn.dataset.add);
            window.location.href = 'add-championship-question.html';
        });
    });
    champList.querySelectorAll('[data-start]').forEach(btn => {
        btn.addEventListener('click', () => startChampionship(btn.dataset.start, btn));
    });
    champList.querySelectorAll('[data-end]').forEach(btn => {
        btn.addEventListener('click', () => endChampionship(btn.dataset.end, btn));
    });
    champList.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteChampionship(btn.dataset.delete, btn.dataset.title));
    });
    if (window.lucide) lucide.createIcons();
}

async function endChampionship(quizId, btn) {
    if (!confirm('End this championship now? Every student still answering will be submitted immediately.')) return;
    btn.disabled = true;
    const { error } = await supabase.from('quizzes').update({ status: 'ended' }).eq('id', quizId);
    if (error) {
        alert('Could not end: ' + error.message);
        btn.disabled = false;
        return;
    }
    loadChampionships();
}

async function deleteChampionship(quizId, title) {
    if (!confirm('Delete "' + title + '"? This also removes its questions, registrations, and results. This cannot be undone.')) return;

    try {
        // Clean up related rows first, regardless of how the original
        // tables were set up, so the delete below never fails.
        await supabase.from('quiz_results').delete().eq('quiz_id', quizId);
        await supabase.from('quiz_participants').delete().eq('quiz_id', quizId);
        await supabase.from('championship_registrations').delete().eq('quiz_id', quizId);
        await supabase.from('championship_questions').delete().eq('quiz_id', quizId);

        const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
        if (error) throw error;

        loadChampionships();
    } catch (err) {
        alert('Could not delete: ' + err.message);
    }
}

async function startChampionship(quizId, btn) {
    if (!confirm('Start this championship now? Registered students will be able to join immediately.')) return;
    btn.disabled = true;
    btn.textContent = 'Starting...';
    const { error } = await supabase
        .from('quizzes')
        .update({ started: true, status: 'started', started_at: new Date().toISOString() })
        .eq('id', quizId);
    if (error) {
        alert('Could not start: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Start Now';
        return;
    }
    loadChampionships();
}

createButton.addEventListener('click', async function () {
    errorMessage.textContent = '';
    const title = titleInput.value.trim();
    const eligiblePlan = eligibleSelect.value;
    const regOpens = regOpensInput.value;
    const regCloses = regClosesInput.value;
    const scheduledAt = dateInput.value;
    const duration = parseInt(durationInput.value, 10);
    const prizeInfo = prizeInput.value.trim();

    if (!title) return (errorMessage.textContent = 'Please enter a title.');
    if (!scheduledAt) return (errorMessage.textContent = 'Please pick a date and time.');
    if (!duration || duration < 10) return (errorMessage.textContent = 'Please set a time limit of at least 10 minutes.');
    // A small buffer (5 min), so the normal time it takes to fill this form
    // doesn't accidentally push your chosen time into the past by the time
    // you click Create.
    const earliestAllowed = new Date(Date.now() + 5 * 60 * 1000);
    const fmt = (d) => d.toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

    if (new Date(scheduledAt) < earliestAllowed) {
        return (errorMessage.textContent =
            'Start time (' + fmt(new Date(scheduledAt)) + ') must be at least 5 minutes from now (' + fmt(new Date()) + ').');
    }
    if (regOpens && new Date(regOpens) < earliestAllowed) {
        return (errorMessage.textContent =
            'Registration Opens (' + fmt(new Date(regOpens)) + ') must be at least 5 minutes from now (' + fmt(new Date()) + ').');
    }
    if (regOpens && regCloses && new Date(regOpens) >= new Date(regCloses)) {
        return (errorMessage.textContent = 'Registration Opens must be earlier than Registration Closes.');
    }

    createButton.disabled = true;
    createButton.textContent = 'Creating...';

    try {
        const { error } = await supabase.from('quizzes').insert({
            title,
            quiz_code: generateQuizCode(),
            category: 'General',
            subjects: ['Use of English'],
            is_championship: true,
            eligible_plan: eligiblePlan,
            registration_opens_at: regOpens ? new Date(regOpens).toISOString() : null,
            registration_closes_at: regCloses ? new Date(regCloses).toISOString() : null,
            scheduled_at: new Date(scheduledAt).toISOString(),
            duration_minutes: duration,
            prize_info: prizeInfo,
            started: false,
            status: 'scheduled'
        });
        if (error) throw error;

        titleInput.value = '';
        eligibleSelect.value = 'premium';
        regOpensInput.value = '';
        regClosesInput.value = '';
        dateInput.value = '';
        durationInput.value = '60';
        prizeInput.value = '';
        loadChampionships();
    } catch (err) {
        errorMessage.textContent = 'Could not create championship: ' + err.message;
    } finally {
        createButton.disabled = false;
        createButton.innerHTML = '<i data-lucide="trophy"></i> Create Championship';
        if (window.lucide) lucide.createIcons();
    }
});

loadChampionships();
