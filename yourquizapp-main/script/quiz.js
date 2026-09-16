// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET LOGGED-IN STUDENT & QUIZ DATA
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent')) || {};
const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
const joinedQuiz = JSON.parse(localStorage.getItem('joinedQuiz')) || {};

// ======================================
// STUDENT INFORMATION
// ======================================
const studentId =
    loggedInStudent.id ||
    studentData.id ||
    joinedQuiz.studentId ||
    null;

const studentName =
    loggedInStudent.name ||
    studentData.name ||
    joinedQuiz.studentName ||
    'Student';

// ======================================
// QUIZ INFORMATION
// ======================================
const quizId =
    joinedQuiz.quizId ||
    joinedQuiz.quiz_id ||
    joinedQuiz.id ||
    null;

// ======================================
// SELECTED SUBJECTS
// ======================================
let selectedSubjects = [];

if (Array.isArray(joinedQuiz.subjects) && joinedQuiz.subjects.length > 0) {
    selectedSubjects = joinedQuiz.subjects;
} else if (Array.isArray(studentData.subjects) && studentData.subjects.length > 0) {
    selectedSubjects = studentData.subjects;
} else if (Array.isArray(loggedInStudent.subjects) && loggedInStudent.subjects.length > 0) {
    selectedSubjects = loggedInStudent.subjects;
} else {
    selectedSubjects = [
        'Use of English',
        'Mathematics',
        'Physics',
        'Chemistry'
    ];
}

// ======================================
// QUIZ STATE
// ======================================
let currentSubjectIndex = 0;
let currentQuestionIndex = 0;

let activeSessionQuestions = {};
let userAnswers = {};

let timerInterval = null;
let timeRemaining = 7200;

let quizSubmitting = false;

// ======================================
// GET HTML ELEMENT
// ======================================
const getEl = (id) => document.getElementById(id);

// ======================================
// SHUFFLE ARRAY
// ======================================
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ======================================
// GET LOCAL QUESTION BANK
// ======================================
function getLocalQuestions(subject) {
    const rawBank = typeof questionBank !== 'undefined' ? questionBank : {};

    if (!rawBank || typeof rawBank !== 'object') {
        console.error('questionBank was not found.');
        return [];
    }

    if (Array.isArray(rawBank[subject])) {
        return rawBank[subject];
    }

    const cleanSubject = String(subject).toLowerCase().trim();
    const matchingKey = Object.keys(rawBank).find(
        key => String(key).toLowerCase().trim() === cleanSubject
    );

    if (matchingKey) {
        return rawBank[matchingKey];
    }

    const normalizedSubject = normalizeSubjectName(subject);
    const normalizedKey = Object.keys(rawBank).find(
        key => normalizeSubjectName(key) === normalizedSubject
    );

    if (normalizedKey) {
        return rawBank[normalizedKey];
    }

    console.warn(`No local questions found for ${subject}`);
    return [];
}

// ======================================
// NORMALIZE SUBJECT NAME
// ======================================
function normalizeSubjectName(subject) {
    const clean = String(subject).toLowerCase().trim();

    if (clean === 'english' || clean === 'use of english' || clean === 'use of english language') {
        return 'english';
    }
    if (clean.includes('math')) return 'mathematics';
    if (clean.includes('physic')) return 'physics';
    if (clean.includes('chem')) return 'chemistry';
    if (clean.includes('biol')) return 'biology';
    if (clean.includes('econ')) return 'economics';
    if (clean.includes('gov')) return 'government';
    if (clean.includes('comm')) return 'commerce';
    if (clean.includes('lit')) return 'literature';
    if (clean.includes('account')) return 'accounting';
    if (clean.includes('crs') || clean.includes('christian')) return 'christian-religious-knowledge';
    if (clean.includes('irs') || clean.includes('islamic')) return 'islamic-religious-knowledge';
    if (clean.includes('geog')) return 'geography';
    if (clean.includes('agric')) return 'agricultural-science';

    return clean;
}

// ======================================
// NORMALIZE QUESTION
// ======================================
function normalizeQuestion(item) {
    if (!item) return null;

    if (item.question && Array.isArray(item.options)) {
        return {
            question: String(item.question),
            options: item.options.map(option => String(option)),
            answer: item.answer
        };
    }

    if (item.q && Array.isArray(item.options)) {
        return {
            question: String(item.q),
            options: item.options.map(option => String(option)),
            answer: item.answer
        };
    }

    if (item.question && item.option) {
        const optionMap = item.option || {};
        const options = [
            optionMap.a,
            optionMap.b,
            optionMap.c,
            optionMap.d
        ].filter(value => value !== undefined && value !== null && String(value).trim() !== '');

        const answerKey = String(item.answer || '').toLowerCase().trim();
        const correctAnswer = optionMap[answerKey] || item.answer;

        return {
            question: String(item.question),
            options,
            answer: correctAnswer
        };
    }

    return null;
}

// ======================================
// REMOVE DUPLICATE QUESTIONS
// ======================================
function removeDuplicateQuestions(questions) {
    const seen = new Set();
    return questions.filter(q => {
        if (!q) return false;
        const questionText = String(q.question || '').trim().toLowerCase();
        if (!questionText || seen.has(questionText)) return false;
        seen.add(questionText);
        return true;
    });
}

// ======================================
// BUILD QUESTIONS FOR ONE SUBJECT
// ======================================
function buildSubjectQuestions(subject, requiredCount) {
    let localQuestions = getLocalQuestions(subject);
    let normalizedQuestions = localQuestions.map(normalizeQuestion).filter(Boolean);
    normalizedQuestions = removeDuplicateQuestions(normalizedQuestions);
    normalizedQuestions = shuffleArray(normalizedQuestions);

    const finalQuestions = normalizedQuestions.slice(0, requiredCount);

    if (finalQuestions.length < requiredCount) {
        console.warn(`${subject}: Only ${finalQuestions.length}/${requiredCount} usable questions are available.`);
    }

    return finalQuestions;
}

// ======================================
// FETCH / BUILD ALL QUIZ QUESTIONS
// ======================================
async function initializeQuizSession() {
    const questionHeading = getEl('question');
    if (questionHeading) {
        questionHeading.textContent = 'Loading JAMB questions...';
    }

    activeSessionQuestions = {};
    userAnswers = {};

    for (const sub of selectedSubjects) {
        const cleanSubject = String(sub).toLowerCase().trim();
        const isEnglish = cleanSubject === 'use of english' || cleanSubject === 'english';
        const requiredCount = isEnglish ? 60 : 40;

        const questions = buildSubjectQuestions(sub, requiredCount);
        activeSessionQuestions[sub] = questions;
        userAnswers[sub] = new Array(questions.length).fill(null);
    }

    if (questionHeading) {
        questionHeading.textContent = 'Questions loaded successfully.';
    }
}

// ======================================
// INITIALIZE QUIZ
// ======================================
window.addEventListener('DOMContentLoaded', async function () {
    if (!selectedSubjects || selectedSubjects.length === 0) {
        selectedSubjects = ['Use of English'];
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
// TIMER
// ======================================
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            finishQuiz();
        }
    }, 1000);
}

// ======================================
// TIMER DISPLAY
// ======================================
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
// SUBJECT TABS
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
// QUESTION PALETTE
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
// LOAD QUESTION
// ======================================
function loadQuestion() {
    const activeSubject = selectedSubjects[currentSubjectIndex];
    const subjectQuestions = activeSessionQuestions[activeSubject] || [];

    const subjectNameElement = getEl('subject-name');
    const questionNumberElement = getEl('question-number');
    const questionHeading = getEl('question');
    const optionsContainer = getEl('options-container');

    if (subjectNameElement) subjectNameElement.textContent = activeSubject;

    renderQuestionPalette();

    if (!subjectQuestions || subjectQuestions.length === 0) {
        if (questionHeading) questionHeading.textContent = 'No questions available for this subject.';
        if (optionsContainer) optionsContainer.innerHTML = '';
        if (questionNumberElement) questionNumberElement.textContent = 'Question 0 of 0';
        return;
    }

    if (currentQuestionIndex >= subjectQuestions.length) {
        currentQuestionIndex = subjectQuestions.length - 1;
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
                if (!userAnswers[activeSubject]) {
                    userAnswers[activeSubject] = [];
                }
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
// BUTTON EVENTS (FIXED WITH .closest)
// ======================================
document.addEventListener('click', function (e) {
    const nextBtn = e.target.closest('#next-button');
    const prevBtn = e.target.closest('#previous-button');
    const submitBtn = e.target.closest('#submit-button');

    // NEXT
    if (nextBtn) {
        const activeSubject = selectedSubjects[currentSubjectIndex];
        const subjectQuestions = activeSessionQuestions[activeSubject] || [];

        if (currentQuestionIndex < subjectQuestions.length - 1) {
            currentQuestionIndex++;
            loadQuestion();
        }
    }

    // PREVIOUS
    if (prevBtn) {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            loadQuestion();
        }
    }

    // SUBMIT
    if (submitBtn) {
        if (quizSubmitting) return;

        const confirmed = confirm('Are you sure you want to submit your quiz?');
        if (confirmed) {
            finishQuiz();
        }
    }
});

// ======================================
// FINISH QUIZ & SUBMIT
// ======================================
async function finishQuiz() {
    if (quizSubmitting) return;
    quizSubmitting = true;

    if (timerInterval) clearInterval(timerInterval);

    let scores = {};
    let totalScore = 0;
    let totalQuestionsCount = 0;

    // CALCULATE SUBJECT SCORES
    selectedSubjects.forEach(sub => {
        const questions = activeSessionQuestions[sub] || [];
        const studentSubAnswers = userAnswers[sub] || [];

        let correctCount = 0;

        questions.forEach((q, idx) => {
            if (String(studentSubAnswers[idx] || '').trim() === String(q.answer || '').trim()) {
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

    // CALCULATE PERCENTAGE
    const percentageScore = totalQuestionsCount > 0
        ? Math.round((totalScore / totalQuestionsCount) * 100)
        : 0;

    // SAVE COMPLETE RESULT LOCALLY
    const localResult = {
        studentId,
        studentName,
        quizId,
        scores,
        totalScore,
        totalQuestionsCount,
        percentageScore,
        answers: userAnswers,
        questions: activeSessionQuestions,
        submittedAt: new Date().toISOString()
    };

    localStorage.setItem('lastQuizResult', JSON.stringify(localResult));

    // SAVE RESULT TO SUPABASE (FIXED TABLE & PAYLOAD)
    if (quizId) {
        try {
            const { data, error } = await supabase
                .from('quiz_results')
                .insert([{
                    quiz_id: quizId,
                    student_id: studentId,
                    student_name: studentName,
                    score: totalScore,
                    total_questions: totalQuestionsCount,
                    percentage: percentageScore
                }])
                .select()
                .single();

            if (error) {
                console.error('Supabase result error:', error);
            } else {
                localStorage.setItem('savedQuizResult', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Could not save result to Supabase:', error);
        }
    }

    // GO TO RESULT PAGE
    window.location.href = 'results.html';
}