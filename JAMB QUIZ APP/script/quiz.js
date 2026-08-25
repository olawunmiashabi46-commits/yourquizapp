// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET LOGGED-IN STUDENT & DATA
// ======================================
let loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent')) || {};
let studentData = JSON.parse(localStorage.getItem('studentData')) || {};
let joinedQuiz = JSON.parse(localStorage.getItem('joinedQuiz')) || {};

const studentId = loggedInStudent.id || studentData.id || joinedQuiz.studentId || 'default_student';
const studentName = loggedInStudent.name || studentData.name || joinedQuiz.studentName || 'Student';

// Prioritize subjects chosen specifically during room creation
let selectedSubjects = [];
if (joinedQuiz.subjects && Array.isArray(joinedQuiz.subjects) && joinedQuiz.subjects.length > 0) {
    selectedSubjects = joinedQuiz.subjects;
} else if (studentData.subjects && studentData.subjects.length > 0) {
    selectedSubjects = studentData.subjects;
} else if (loggedInStudent.subjects && loggedInStudent.subjects.length > 0) {
    selectedSubjects = loggedInStudent.subjects;
} else {
    selectedSubjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry']; // Default fallback
}

// State variables
let currentSubjectIndex = 0;
let currentQuestionIndex = 0;
let activeSessionQuestions = {}; // Holds fetched questions per subject
let userAnswers = {};            // Stores answers per subject: { "Mathematics": ["A", "B"], ... }
let timerInterval = null;
let timeRemaining = 7200;        // 2 Hours = 120 Minutes = 7200 Seconds

const getEl = (id) => document.getElementById(id);

// ======================================
// UTILITY: RANDOM SHUFFLE ENGINE
// ======================================
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Format subject name for ALOC API endpoint
function formatSubjectForAPI(subject) {
    const cleanSub = subject.toLowerCase().trim();
    if (cleanSub.includes('english')) return 'english';
    if (cleanSub.includes('math')) return 'mathematics';
    if (cleanSub.includes('physic')) return 'physics';
    if (cleanSub.includes('chem')) return 'chemistry';
    if (cleanSub.includes('biol')) return 'biology';
    if (cleanSub.includes('econ')) return 'economics';
    if (cleanSub.includes('gov')) return 'government';
    if (cleanSub.includes('comm')) return 'commerce';
    if (cleanSub.includes('lit')) return 'literature';
    if (cleanSub.includes('account')) return 'accounting';
    if (cleanSub.includes('crs') || cleanSub.includes('christian')) return 'christian-religious-knowledge';
    if (cleanSub.includes('irs') || cleanSub.includes('islamic')) return 'islamic-religious-knowledge';
    if (cleanSub.includes('geog')) return 'geography';
    if (cleanSub.includes('agric')) return 'agricultural-science';
    return cleanSub;
}

// ======================================
// API FETCHING & QUIZ SESSION INIT
// ======================================
async function initializeQuizSession() {
    const questionHeading = getEl('question');
    if (questionHeading) {
        questionHeading.textContent = "Fetching questions from live JAMB database...";
    }

    for (const sub of selectedSubjects) {
        const isEnglish = (sub.toLowerCase() === 'use of english' || sub.toLowerCase() === 'english');
        const limit = isEnglish ? 60 : 40; // Scoped outside try/catch so fallback can read it
        const apiSubject = formatSubjectForAPI(sub);

        try {
            const response = await fetch(`https://questions.aloc.com.ng/api/v2/q/${limit}?subject=${apiSubject}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'AccessToken': 'QB-69c5e3f16bf8f47'
                }
            });

            const result = await response.json();

            if (result && result.status === 200 && Array.isArray(result.data) && result.data.length > 0) {
                activeSessionQuestions[sub] = result.data.map(item => {
                    const optionMap = item.option || {};
                    const rawOptions = [
                        optionMap.a,
                        optionMap.b,
                        optionMap.c,
                        optionMap.d
                    ].filter(Boolean);

                    const rawAnswerKey = (item.answer || '').toLowerCase();
                    const correctAnswerText = optionMap[rawAnswerKey] || item.answer;

                    return {
                        question: item.question,
                        options: rawOptions,
                        answer: correctAnswerText
                    };
                });
            } else {
                throw new Error(`API returned no data for ${sub}`);
            }

        } catch (error) {
            console.warn(`Primary API call failed for ${sub}. Falling back to local question bank...`, error);
            
            const rawBank = (typeof questionBank !== 'undefined') ? questionBank : {};
            const subjectQuestions = rawBank[sub] || [];
            const shuffled = shuffleArray(subjectQuestions);
            activeSessionQuestions[sub] = shuffled.slice(0, Math.min(limit, shuffled.length));
        }

        userAnswers[sub] = new Array(activeSessionQuestions[sub]?.length || 0).fill(null);
    }
}

// ======================================
// INITIALIZATION
// ======================================
window.addEventListener('DOMContentLoaded', async function () {
    if (!selectedSubjects || selectedSubjects.length === 0) {
        if (typeof questionBank !== 'undefined' && questionBank) {
            selectedSubjects = Object.keys(questionBank);
        } else {
            selectedSubjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
        }
    }

    const waitingRoom = getEl('waiting-room');
    const quizContent = getEl('quiz-content');

    if (waitingRoom) waitingRoom.style.display = 'none';
    if (quizContent) quizContent.style.display = 'block';

    const studentNameEl = getEl('student-name');
    if (studentNameEl) studentNameEl.textContent = `Student: ${studentName}`;

    await initializeQuizSession();

    renderSubjectTabs();
    loadQuestion();
    startTimer();
});

// ======================================
// TIMER ENGINE (2 HOURS COUNTDOWN)
// ======================================
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up! Submitting your quiz now.');
            finishQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerElement = getEl('timer');
    if (!timerElement) return;

    const hrs = Math.floor(timeRemaining / 3600);
    const mins = Math.floor((timeRemaining % 3600) / 60);
    const secs = timeRemaining % 60;

    const formattedHrs = hrs < 10 ? `0${hrs}` : hrs;
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const formattedSecs = secs < 10 ? `0${secs}` : secs;

    timerElement.textContent = `${formattedHrs}:${formattedMins}:${formattedSecs}`;
}

// ======================================
// RENDER SUBJECT TABS
// ======================================
function renderSubjectTabs() {
    const subjectNavContainer = getEl('subject-navigation');
    if (!subjectNavContainer) return;

    subjectNavContainer.innerHTML = '';
    selectedSubjects.forEach((sub, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `subject-tab ${index === currentSubjectIndex ? 'active' : ''}`;
        btn.textContent = sub;
        btn.onclick = () => {
            currentSubjectIndex = index;
            currentQuestionIndex = 0;
            renderSubjectTabs();
            loadQuestion();
        };
        subjectNavContainer.appendChild(btn);
    });
}

// ======================================
// RENDER QUESTION PALETTE (TEST DRILLER GRID)
// ======================================
function renderQuestionPalette() {
    const paletteContainer = getEl('question-palette');
    if (!paletteContainer) return;

    paletteContainer.innerHTML = '';
    const activeSubject = selectedSubjects[currentSubjectIndex];
    const questions = activeSessionQuestions[activeSubject] || [];

    questions.forEach((_, idx) => {
        const numBtn = document.createElement('button');
        numBtn.type = 'button';
        numBtn.className = 'palette-btn';

        if (idx === currentQuestionIndex) {
            numBtn.classList.add('current');
        }

        if (userAnswers[activeSubject] && userAnswers[activeSubject][idx] !== null) {
            numBtn.classList.add('answered');
        }

        numBtn.textContent = idx + 1;
        numBtn.onclick = () => {
            currentQuestionIndex = idx;
            loadQuestion();
        };

        paletteContainer.appendChild(numBtn);
    });
}

// ======================================
// LOAD QUESTION FROM ACTIVE SESSION
// ======================================
function loadQuestion() {
    const activeSubject = selectedSubjects[currentSubjectIndex] || selectedSubjects[0];
    const subjectQuestions = activeSessionQuestions[activeSubject] || [];

    const subjectNameElement = getEl('subject-name');
    const questionNumberElement = getEl('question-number');
    const questionHeading = getEl('question');
    const optionsContainer = getEl('options-container');

    if (subjectNameElement) subjectNameElement.textContent = activeSubject;

    renderQuestionPalette();

    if (!subjectQuestions || subjectQuestions.length === 0) {
        if (questionHeading) questionHeading.textContent = "No questions available for this subject.";
        if (optionsContainer) optionsContainer.innerHTML = '';
        if (questionNumberElement) questionNumberElement.textContent = "Question 0 of 0";
        return;
    }

    const currentQ = subjectQuestions[currentQuestionIndex];

    if (questionNumberElement) {
        questionNumberElement.textContent = `Question ${currentQuestionIndex + 1} of ${subjectQuestions.length}`;
    }
    if (questionHeading) {
        questionHeading.innerHTML = `${currentQuestionIndex + 1}. ${currentQ.question}`;
    }

    if (optionsContainer) {
        optionsContainer.innerHTML = '';
        const optionLabels = ['A', 'B', 'C', 'D'];

        currentQ.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'option-btn';

            if (userAnswers[activeSubject] && userAnswers[activeSubject][currentQuestionIndex] === opt) {
                btn.classList.add('selected');
            }

            const labelPrefix = optionLabels[idx] ? `<strong>${optionLabels[idx]}.</strong> ` : '';
            btn.innerHTML = `${labelPrefix}${opt}`;

            btn.onclick = () => {
                if (!userAnswers[activeSubject]) userAnswers[activeSubject] = [];
                userAnswers[activeSubject][currentQuestionIndex] = opt;
                loadQuestion();
            };
            optionsContainer.appendChild(btn);
        });
    }

    const prevButton = getEl('previous-button');
    const nextButton = getEl('next-button');

    if (prevButton) prevButton.disabled = currentQuestionIndex === 0;
    if (nextButton) nextButton.disabled = currentQuestionIndex === subjectQuestions.length - 1;
}

// ======================================
// EVENT LISTENERS
// ======================================
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'next-button') {
        const activeSubject = selectedSubjects[currentSubjectIndex];
        const subjectQuestions = activeSessionQuestions[activeSubject] || [];

        if (currentQuestionIndex < subjectQuestions.length - 1) {
            currentQuestionIndex++;
            loadQuestion();
        }
    }

    if (e.target && e.target.id === 'previous-button') {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadQuestion();
        }
    }

    if (e.target && e.target.id === 'submit-button') {
        if (confirm('Are you sure you want to submit your quiz?')) {
            finishQuiz();
        }
    }
});

// ======================================
// SUBMIT AND CALCULATE RESULTS
// ======================================
async function finishQuiz() {
    if (timerInterval) clearInterval(timerInterval);

    let scores = {};
    let totalScore = 0;
    let totalQuestionsCount = 0;

    selectedSubjects.forEach((sub) => {
        const questions = activeSessionQuestions[sub] || [];
        const studentSubAnswers = userAnswers[sub] || [];
        let correctCount = 0;

        questions.forEach((q, idx) => {
            if (studentSubAnswers[idx] === q.answer) {
                correctCount++;
            }
        });

        scores[sub] = {
            score: correctCount,
            total: questions.length
        };

        totalScore += correctCount;
        totalQuestionsCount += questions.length;
    });

    const resultPayload = {
        studentId,
        studentName,
        scores,
        totalScore,
        totalQuestionsCount,
        submittedAt: new Date().toISOString()
    };

    localStorage.setItem('lastQuizResult', JSON.stringify(resultPayload));
    alert(`Quiz Submitted Successfully!\nTotal Score: ${totalScore}/${totalQuestionsCount}`);
    
    // Redirect to results page
    window.location.href = 'result.html';
}