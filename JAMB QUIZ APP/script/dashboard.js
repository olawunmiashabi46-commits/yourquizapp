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
            localStorage.getItem('studentResult')
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
// LOGOUT
// ======================================

if (logoutButton) {
    logoutButton.addEventListener('click', function () {
        const confirmLogout = confirm('Are you sure you want to logout?');

        if (!confirmLogout) {
            return;
        }

        // Remove current login session
        localStorage.removeItem('loggedInStudent');

        // Remove current quiz selection
        localStorage.removeItem('studentData');
        localStorage.removeItem('joinedQuiz');

        // Return to login page
        window.location.href = 'login.html';
    });
}