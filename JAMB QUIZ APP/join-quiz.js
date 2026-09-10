// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET LOGGED-IN STUDENT
// ======================================
const loggedInStudent =
    JSON.parse(localStorage.getItem('loggedInStudent')) || null;

if (!loggedInStudent || !loggedInStudent.id) {
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

const waitingQuizTitle =
    document.getElementById('waiting-quiz-title');

const pageTitle =
    document.getElementById('page-title');

const joinDescription =
    document.getElementById('join-description');

let waitingTimer = null;

// ======================================
// HELPER: SHOW ERROR
// ======================================
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = '🚀 Join Quiz';
    }
}

// ======================================
// JOIN QUIZ
// ======================================
if (joinButton) {

    joinButton.addEventListener('click', async function () {

        if (joinButton.disabled) return;

        if (errorMessage) {
            errorMessage.textContent = '';
        }

        const quizCode =
            String(quizCodeInput?.value || '')
                .trim()
                .toUpperCase();

        // ------------------------------
        // VALIDATE CODE
        // ------------------------------
        if (!quizCode) {
            showError('Please enter a quiz code.');
            return;
        }

        if (quizCode.length !== 6) {
            showError('Quiz code must contain 6 characters.');
            return;
        }

        // ------------------------------
        // LOCK BUTTON
        // ------------------------------
        joinButton.disabled = true;
        joinButton.textContent = '⏳ Joining...';

        try {

            // ==================================
            // 1. FIND QUIZ
            // ==================================
            const {
                data: quiz,
                error: quizError
            } = await supabase
                .from('quizzes')
                .select(`
                    id,
                    title,
                    quiz_code,
                    started,
                    creator_id,
                    category,
                    subjects
                `)
                .eq('quiz_code', quizCode)
                .maybeSingle();

            if (quizError) {
                console.error('Quiz lookup error:', quizError);
                throw new Error(
                    'Unable to connect to the quiz server. Please try again.'
                );
            }

            if (!quiz) {
                throw new Error(
                    'Quiz not found. Please check the code and try again.'
                );
            }

            // ==================================
            // 2. VALIDATE SUBJECTS
            // ==================================
            if (
                !Array.isArray(quiz.subjects) ||
                quiz.subjects.length === 0
            ) {
                throw new Error(
                    'This quiz has no subjects.'
                );
            }

            // ==================================
            // 3. JOIN USING UPSERT
            // ==================================
            //
            // IMPORTANT:
            // The database should have a UNIQUE constraint
            // on quiz_id + student_id.
            //
            const {
                error: joinError
            } = await supabase
                .from('quiz_participants')
                .upsert(
                    {
                        quiz_id: quiz.id,
                        student_id: loggedInStudent.id
                    },
                    {
                        onConflict: 'quiz_id,student_id',
                        ignoreDuplicates: true
                    }
                );

            if (joinError) {
                console.error(
                    'Participant upsert error:',
                    joinError
                );

                throw new Error(
                    'Could not join this quiz. Please try again.'
                );
            }

            // ==================================
            // 4. SAVE QUIZ LOCALLY
            // ==================================
            const joinedQuiz = {

                quizId: quiz.id,

                quizCode: quiz.quiz_code,

                quizTitle: quiz.title,

                category: quiz.category,

                subjects: quiz.subjects,

                creatorId: quiz.creator_id,

                studentId: loggedInStudent.id,

                studentName:
                    loggedInStudent.name || 'Student',

                username:
                    loggedInStudent.username || '',

                joinedAt:
                    new Date().toISOString()
            };

            localStorage.setItem(
                'joinedQuiz',
                JSON.stringify(joinedQuiz)
            );

            // ==================================
            // 5. SHOW WAITING ROOM
            // ==================================
            if (joinForm)
                joinForm.style.display = 'none';

            if (joinButton)
                joinButton.style.display = 'none';

            if (errorMessage)
                errorMessage.textContent = '';

            if (waitingRoom)
                waitingRoom.style.display = 'block';

            if (pageTitle)
                pageTitle.textContent = 'Waiting Room';

            if (joinDescription)
                joinDescription.textContent =
                    `Quiz Code: ${quiz.quiz_code}`;

            if (waitingQuizTitle)
                waitingQuizTitle.textContent =
                    quiz.title;

            // ==================================
            // 6. IF ALREADY STARTED
            // ==================================
            if (quiz.started === true) {

                window.location.href =
                    'quiz.html';

                return;
            }

            // ==================================
            // 7. WAIT FOR CREATOR
            // ==================================
            startWaitingForQuiz(quiz.id);

        }

        catch (error) {

            console.error(
                'JOIN QUIZ ERROR:',
                error
            );

            showError(
                error?.message ||
                'Unable to join quiz. Please try again.'
            );
        }

    });

}

// ======================================
// WAIT FOR CREATOR TO START
// ======================================
function startWaitingForQuiz(quizId) {

    if (waitingTimer) {
        clearInterval(waitingTimer);
    }

    let checking = false;

    waitingTimer = setInterval(
        async function () {

            // Prevent overlapping polling requests
            if (checking) return;

            checking = true;

            try {

                const {
                    data: quiz,
                    error
                } = await supabase
                    .from('quizzes')
                    .select('id, started')
                    .eq('id', quizId)
                    .maybeSingle();

                if (error) {

                    console.error(
                        'Waiting check error:',
                        error
                    );

                    return;
                }

                if (
                    quiz &&
                    quiz.started === true
                ) {

                    clearInterval(
                        waitingTimer
                    );

                    window.location.href =
                        'quiz.html';
                }

            }

            catch (error) {

                console.error(
                    'Waiting room error:',
                    error
                );

            }

            finally {

                checking = false;

            }

        },
        3000
    );
}

// ======================================
// BACK BUTTON
// ======================================
if (backButton) {

    backButton.addEventListener(
        'click',
        function () {

            if (waitingTimer) {
                clearInterval(waitingTimer);
            }

            window.location.href =
                'dashboard.html';
        }
    );

}