import { supabase } from './supabase.js';

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

const params = new URLSearchParams(window.location.search);
const quizIdFromUrl = params.get('id');

const titleEl = document.getElementById('champ-title');
const whenEl = document.getElementById('champ-when');
const badgeEl = document.getElementById('champ-status-badge');
const prizeEl = document.getElementById('champ-prize');
const countdownEl = document.getElementById('countdown');
const actionButton = document.getElementById('action-button');
const errorMessage = document.getElementById('error-message');
const lockedNote = document.getElementById('locked-note');
const electiveGroup = document.getElementById('elective-group');
const electiveSelect = document.getElementById('elective-subject');

let countdownTimer = null;
let quiz = null;

function isActivePremium(student) {
    if (student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}

function startCountdown(target) {
    clearInterval(countdownTimer);
    function tick() {
        const diff = new Date(target) - new Date();
        if (diff <= 0) {
            countdownEl.textContent = 'Starting any moment now...';
            clearInterval(countdownTimer);
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countdownEl.textContent = (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm ' + s + 's';
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
}

async function loadChampionship() {
    let query = supabase.from('quizzes').select('*').eq('is_championship', true);
    query = quizIdFromUrl
        ? query.eq('id', quizIdFromUrl)
        : query.in('status', ['scheduled', 'started']).order('scheduled_at', { ascending: true }).limit(1);

    const { data, error } = quizIdFromUrl ? await query.maybeSingle() : await query;
    quiz = quizIdFromUrl ? data : (data && data[0]);

    if (error || !quiz) {
        titleEl.textContent = 'No championship found';
        whenEl.textContent = 'Check back later for the next one.';
        actionButton.style.display = 'none';
        return;
    }

    titleEl.textContent = quiz.title;
    whenEl.textContent = quiz.scheduled_at ? new Date(quiz.scheduled_at).toLocaleString() : '';

    if (quiz.prize_info) {
        prizeEl.textContent = '🎁 ' + quiz.prize_info;
        prizeEl.style.display = 'block';
    }

    if (quiz.status === 'started') {
        badgeEl.innerHTML = '<span class="champ-badge live">🔴 Live now</span>';
        countdownEl.textContent = '';
    } else if (quiz.status === 'ended') {
        badgeEl.innerHTML = '<span class="champ-badge">Ended</span>';
        countdownEl.textContent = '';
    } else {
        badgeEl.innerHTML = '<span class="champ-badge">Scheduled</span>';
        if (quiz.scheduled_at) startCountdown(quiz.scheduled_at);
    }

    await renderAction();
}

let myElective = null;

async function renderAction() {
    if (quiz.status === 'ended') {
        actionButton.textContent = 'Championship has ended';
        actionButton.disabled = true;
        return;
    }

    const { data: reg } = await supabase
        .from('championship_registrations')
        .select('id, elective_subject')
        .eq('quiz_id', quiz.id)
        .eq('student_id', loggedInStudent.id)
        .maybeSingle();

    const isRegistered = !!reg;
    myElective = reg ? reg.elective_subject : null;

    if (quiz.status === 'started') {
        if (isRegistered) {
            actionButton.textContent = '🚀 Join Championship Now';
            actionButton.disabled = false;
            actionButton.onclick = joinChampionship;
        } else {
            actionButton.textContent = 'Registration closed for this one';
            actionButton.disabled = true;
        }
        return;
    }

    // status === 'scheduled'
    if (isRegistered) {
        actionButton.textContent = '✅ Registered — English + ' + myElective;
        actionButton.disabled = true;
        return;
    }

    electiveGroup.style.display = 'block';

    if (!isActivePremium(loggedInStudent)) {
        actionButton.textContent = 'Register Now';
        actionButton.disabled = true;
        lockedNote.style.display = 'block';
        return;
    }

    actionButton.textContent = 'Register Now';
    actionButton.disabled = false;
    actionButton.onclick = registerForChampionship;
}

async function registerForChampionship() {
    const chosenSubject = electiveSelect.value;
    if (!chosenSubject) {
        errorMessage.textContent = 'Please choose your second subject first.';
        return;
    }

    actionButton.disabled = true;
    actionButton.textContent = 'Registering...';
    errorMessage.textContent = '';

    const { error } = await supabase.rpc('register_for_championship', {
        p_quiz_id: quiz.id,
        p_student_id: loggedInStudent.id,
        p_elective_subject: chosenSubject
    });

    if (error) {
        errorMessage.textContent = error.message || 'Could not register. Please try again.';
        actionButton.disabled = false;
        actionButton.textContent = 'Register Now';
        return;
    }

    myElective = chosenSubject;
    electiveGroup.style.display = 'none';
    actionButton.textContent = '✅ Registered — English + ' + chosenSubject;
}

function joinChampionship() {
    localStorage.setItem('joinedQuiz', JSON.stringify({
        quizId: quiz.id,
        subjects: ['Use of English', myElective],
        isChampionship: true,
        championshipDurationMinutes: quiz.duration_minutes,
        studentId: loggedInStudent.id,
        studentName: loggedInStudent.name
    }));
    window.location.href = 'quiz.html';
}

loadChampionship();
