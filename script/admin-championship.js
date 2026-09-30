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
const durationInput = document.getElementById('champ-duration');
const prizeInput = document.getElementById('champ-prize');
const createButton = document.getElementById('create-button');
const errorMessage = document.getElementById('error-message');
const champList = document.getElementById('champ-list');

function statusLabel(row) {
    if (row.status === 'started') return { text: 'Live now', cls: 'status-started' };
    if (row.status === 'ended') return { text: 'Ended', cls: 'status-ended' };
    return { text: 'Scheduled', cls: 'status-scheduled' };
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
        const st = statusLabel(row);
        const when = row.scheduled_at ? new Date(row.scheduled_at).toLocaleString() : 'No date set';
        const div = document.createElement('div');
        div.className = 'champ-row';
        const eligLabel = row.eligible_plan === 'free' ? '🎟️ Free — ₦2,000 entry' : '⭐ Premium only';
        div.innerHTML = `
            <div class="champ-info">
                <b>${row.title}</b>
                ${when} &middot; ${row.duration_minutes} min &middot; ${eligLabel} &nbsp; <span class="champ-status ${st.cls}">${st.text}</span>
            </div>
            <div>
                <button class="secondary" data-add="${row.id}">Add Questions</button>
                ${row.status === 'scheduled' ? `<button data-start="${row.id}">Start Now</button>` : ''}
                <button class="secondary" style="color:#dc2626;" data-delete="${row.id}" data-title="${row.title.replace(/"/g, '&quot;')}">Delete</button>
            </div>`;
        champList.appendChild(div);
    });

    champList.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
            sessionStorage.setItem('adminChampionshipId', btn.dataset.add);
            window.location.href = 'add-championship-question.html';
        });
    });
    champList.querySelectorAll('[data-start]').forEach(btn => {
        btn.addEventListener('click', () => startChampionship(btn.dataset.start, btn));
    });
    champList.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteChampionship(btn.dataset.delete, btn.dataset.title));
    });
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
    if (regOpens && regCloses && new Date(regOpens) >= new Date(regCloses)) {
        return (errorMessage.textContent = 'Registration must open before it closes.');
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
        createButton.textContent = '🏆 Create Championship';
    }
});

loadChampionships();
