// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET LOGGED-IN STUDENT
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));

if (!loggedInStudent) {
    window.location.href = 'login.html';
}

// ======================================
// GET HTML ELEMENTS
// ======================================
const quizCodeInput = document.getElementById('quiz-code');
const joinButton = document.getElementById('join-button');
const backButton = document.getElementById('back-button');
const errorMessage = document.getElementById('error-message');
const joinForm = document.getElementById('join-form');
const waitingRoom = document.getElementById('waiting-room');
const waitingQuizTitle = document.getElementById('waiting-quiz-title');
const pageTitle = document.getElementById('page-title');
const joinDescription = document.getElementById('join-description');

let waitingTimer = null;
let currentQuizId = null;

// ======================================
// JOIN QUIZ
// ======================================
joinButton.addEventListener('click', async function () {
    errorMessage.textContent = '';
    const quizCode = quizCodeInput.value.trim().toUpperCase();

    if (quizCode === '') {
        errorMessage.textContent = 'Please enter a quiz code.';
        return;
    }

    if (quizCode.length !== 6) {
        errorMessage.textContent = 'Quiz code must contain 6 characters.';
        return;
    }

    joinButton.disabled = true;
    joinButton.textContent = '⏳ Joining...';

    try {
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('id, title, quiz_code, started, creator_id, category, subjects')
            .eq('quiz_code', quizCode)
            .maybeSingle();

        if (quizError) throw new Error(quizError.message);
        if (!quiz) throw new Error('Quiz not found. Please check the code and try again.');

        if (!quiz.subjects || !Array.isArray(quiz.subjects) || quiz.subjects.length === 0) {
            throw new Error('This quiz has no subjects.');
        }

        currentQuizId = quiz.id;

        // Check if student already joined
        const { data: existingParticipant, error: participantCheckError } = await supabase
            .from('quiz_participants')
            .select('id')
            .eq('quiz_id', quiz.id)
            .eq('student_id', loggedInStudent.id)
            .maybeSingle();

        if (participantCheckError) throw new Error(participantCheckError.message);

        // Add student if not existing
        if (!existingParticipant) {
            const { error: insertError } = await supabase
                .from('quiz_participants')
                .insert({
                    quiz_id: quiz.id,
                    student_id: loggedInStudent.id
                });

            if (insertError) throw new Error(insertError.message);
        }

        // Save joined quiz details locally
        const joinedQuiz = {
            quizId: quiz.id,
            quizCode: quiz.quiz_code,
            quizTitle: quiz.title,
            category: quiz.category,
            subjects: quiz.subjects,
            creatorId: quiz.creator_id,
            studentId: loggedInStudent.id,
            studentName: loggedInStudent.name,
            username: loggedInStudent.username,
            joinedAt: new Date().toISOString()
        };

        localStorage.setItem('joinedQuiz', JSON.stringify(joinedQuiz));

        // Show Waiting Room
        joinForm.style.display = 'none';
        joinButton.style.display = 'none';
        errorMessage.textContent = '';
        waitingRoom.style.display = 'block';
        pageTitle.textContent = 'Waiting Room';
        joinDescription.textContent = `Quiz Code: ${quiz.quiz_code}`;
        waitingQuizTitle.textContent = quiz.title;

        if (quiz.started === true) {
            window.location.href = 'quiz.html';
            return;
        }

        // Start checking for host to launch
        startWaitingForQuiz(quiz.id);

    } catch (error) {
        console.error('Join quiz error:', error);
        errorMessage.textContent = error.message;
        joinButton.disabled = false;
        joinButton.textContent = '🚀 Join Quiz';
    }
});

// ======================================
// WAIT FOR CREATOR TO START
// ======================================
function startWaitingForQuiz(quizId) {
    clearInterval(waitingTimer);

    waitingTimer = setInterval(async function () {
        try {
            const { data: quiz, error } = await supabase
                .from('quizzes')
                .select('id, started')
                .eq('id', quizId)
                .maybeSingle();

            if (error) {
                console.error('Waiting check error:', error);
                return;
            }

            if (quiz && quiz.started === true) {
                clearInterval(waitingTimer);
                window.location.href = 'quiz.html';
            }
        } catch (err) {
            console.error('Error while checking quiz status:', err);
        }
    }, 2000);
}

// ======================================
// BACK BUTTON
// ======================================
if (backButton) {
    backButton.addEventListener('click', function () {
        clearInterval(waitingTimer);
        window.location.href = 'dashboard.html';
    });
}