// ======================================
// GET LOGGED-IN STUDENT
// ======================================

const loggedInStudent = JSON.parse(
    localStorage.getItem('loggedInStudent')
);

// ======================================
// CHECK LOGIN
// ======================================

if (!loggedInStudent) {
    window.location.href = 'login.html';
}

// ======================================
// GET HTML ELEMENTS
// ======================================

const welcomeMessage = document.getElementById('welcome-message');
const startQuizButton = document.getElementById('start-quiz-button');
const resultsButton = document.getElementById('results-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const joinQuizButton = document.getElementById('join-quiz-button');
const createQuizButton = document.getElementById('create-quiz-button');
const adminLoginButton = document.getElementById('admin-login-button');
const logoutButton = document.getElementById('logout-button');

// ======================================
// WELCOME STUDENT
// ======================================

if (welcomeMessage) {
    welcomeMessage.textContent = `Welcome, ${loggedInStudent.name}! 👋`;
}

// ======================================
// START QUIZ (SOLO MODE)
// ======================================

if (startQuizButton) {
    startQuizButton.addEventListener('click', function () {
        // Tag session as Solo Mode before going to subject selection
        const quizSession = {
            isSolo: true,
            is_solo: true,
            mode: 'solo'
        };

        localStorage.setItem('joinedQuiz', JSON.stringify(quizSession));
        window.location.href = 'index.html';
    });
}

// ======================================
// VIEW RESULTS
// ======================================

if (resultsButton) {
    resultsButton.addEventListener('click', function () {
        const studentResult = JSON.parse(
            localStorage.getItem('lastQuizResult')
        );

        if (!studentResult) {
            alert('You have not completed a quiz yet.');
            return;
        }

        if (studentResult.studentId !== loggedInStudent.id) {
            alert('No result was found for your account.');
            return;
        }

        window.location.href = 'result.html';
    });
}

// ======================================
// LEADERBOARD
// ======================================

if (leaderboardButton) {
    leaderboardButton.addEventListener('click', function () {
        window.location.href = 'leaderboard.html';
    });
}

// ======================================
// JOIN QUIZ (MULTIPLAYER)
// ======================================

if (joinQuizButton) {
    joinQuizButton.addEventListener('click', function () {
        window.location.href = 'join-quiz.html';
    });
}

// ======================================
// CREATE QUIZ
// ======================================

if (createQuizButton) {
    createQuizButton.addEventListener('click', function () {
        window.location.href = 'create-quiz.html';
    });
}

// ======================================
// ADMIN LOGIN
// ======================================

if (adminLoginButton) {
    adminLoginButton.addEventListener('click', function () {
        window.location.href = 'admin-login.html';
    });
}

// ======================================
// LOGOUT
// ======================================

if (logoutButton) {
    logoutButton.addEventListener('click', function () {
        const confirmLogout = confirm('Are you sure you want to logout?');

        if (!confirmLogout) {
            return;
        }

        // Sign out of the secure login too
        import('./supabase.js').then(m => m.supabase.auth.signOut());

        // Remove current login session
        localStorage.removeItem('loggedInStudent');

        // Remove current quiz selection
        localStorage.removeItem('studentData');
        localStorage.removeItem('joinedQuiz');

        // Return to login page (short wait so sign-out finishes)
        setTimeout(function () { window.location.href = 'login.html'; }, 400);
    });
}
document.getElementById('upgrade-button').addEventListener('click', function () {
    window.location.href = 'upgrade.html';
});

// ======================================
// CHAMPIONSHIP BANNER
// ======================================
(function loadChampionshipBanners() {
    import('./supabase.js').then(async ({ supabase }) => {
        const now = new Date().toISOString();

        async function showBanner(eligiblePlan, prefix) {
            const banner = document.getElementById('champ-banner-' + prefix);
            if (!banner) return;

            const { data, error } = await supabase
                .from('quizzes')
                .select('id, title, status, scheduled_at, registration_opens_at, registration_closes_at')
                .eq('is_championship', true)
                .eq('eligible_plan', eligiblePlan)
                .in('status', ['scheduled', 'started'])
                .order('scheduled_at', { ascending: true })
                .limit(1);

            if (error || !data || data.length === 0) return;

            const champ = data[0];

            // Don't show a "scheduled" banner before registration has opened.
            if (champ.status === 'scheduled' && champ.registration_opens_at && now < champ.registration_opens_at) {
                return;
            }

            // The start time has passed and nobody ever clicked "Start Now" —
            // treat it as missed rather than keep showing it as upcoming.
            if (champ.status === 'scheduled' && champ.scheduled_at && now > champ.scheduled_at) {
                return;
            }

            const titleEl = document.getElementById('champ-banner-' + prefix + '-title');
            const subEl = document.getElementById('champ-banner-' + prefix + '-sub');

            titleEl.textContent = champ.title;
            subEl.textContent = champ.status === 'started'
                ? 'Live now — tap to join →'
                : (champ.scheduled_at
                    ? 'Starts ' + new Date(champ.scheduled_at).toLocaleString() + ' — tap for details'
                    : 'Tap for details');

            banner.style.display = 'block';
            if (window.lucide) lucide.createIcons();
            banner.addEventListener('click', function () {
                window.location.href = 'championship.html?id=' + champ.id;
            });
        }

        function isActivePremium(student) {
            if (student.plan !== 'premium') return false;
            if (!student.planExpiresAt) return true;
            return new Date(student.planExpiresAt) > new Date();
        }

        // A student only ever sees the championship meant for their plan,
        // not both, so there's no confusion about which one they can join.
        if (isActivePremium(loggedInStudent)) {
            showBanner('premium', 'premium');
        } else {
            showBanner('free', 'free');
        }
    });
})();

document.getElementById('progress-button').addEventListener('click', function () {
    window.location.href = 'progress.html';
});

// Group Chat button — only shown to active Premium students, hidden
// entirely for Free students (not even a locked preview).
(function setupGroupChatButton() {
    function isActivePremium(student) {
        if (!student || student.plan !== 'premium') return false;
        if (!student.planExpiresAt) return true;
        return new Date(student.planExpiresAt) > new Date();
    }
    const btn = document.getElementById('group-chat-button');
    if (!btn) return;
    if (isActivePremium(loggedInStudent)) {
        btn.style.display = 'flex';
        btn.addEventListener('click', function () {
            window.location.href = 'chat-rooms.html';
        });
    }
})();

// Educators button — only shown to active Premium students, hidden
// entirely for Free students (not even a locked preview).
(function setupEducatorsButton() {
    function isActivePremium(student) {
        if (!student || student.plan !== 'premium') return false;
        if (!student.planExpiresAt) return true;
        return new Date(student.planExpiresAt) > new Date();
    }
    const btn = document.getElementById('educators-button');
    if (!btn) return;
    if (isActivePremium(loggedInStudent)) {
        btn.style.display = 'flex';
        btn.addEventListener('click', function () {
            window.location.href = 'educators.html';
        });
    }
})();

// Lessons button — only shown to active Premium students, hidden
// entirely for Free students (not even a locked preview).
(function setupLessonsButton() {
    function isActivePremium(student) {
        if (!student || student.plan !== 'premium') return false;
        if (!student.planExpiresAt) return true;
        return new Date(student.planExpiresAt) > new Date();
    }
    const btn = document.getElementById('lessons-button');
    if (!btn) return;
    if (isActivePremium(loggedInStudent)) {
        btn.style.display = 'flex';
        btn.addEventListener('click', function () {
            window.location.href = 'lessons.html';
        });
    }
})();
