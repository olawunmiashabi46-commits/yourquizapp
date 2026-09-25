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
// LOAD ADMIN-ADDED QUESTIONS (SUPABASE)
// Fails gracefully: if the 'questions' table/columns aren't set up yet,
// or aren't readable by the anon key, the quiz still runs on the local bank.
// ======================================
async function loadAdminQuestions() {
    const map = {};

    try {
        const { data, error } = await supabase
            .from('questions')
            .select('*');

        if (error) {
            console.error('Could not load admin-added questions:', error);
            return map;
        }

        (data || []).forEach(row => {
            const mapped = mapAdminQuestion(row);
            if (!mapped) return;

            const key = normalizeSubjectName(row.subject || '');
            if (!map[key]) map[key] = [];
            map[key].push(mapped);
        });
    } catch (err) {
        console.error('Admin question fetch failed:', err);
    }

    return map;
}

// ======================================
// CONVERT AN ADMIN-UPLOADED ROW TO THE
// SAME {question, options, answer} SHAPE
// AS THE LOCAL QUESTION BANK
// ======================================
function mapAdminQuestion(row) {
    if (!row || !row.question_text) return null;

    const optionMap = {
        a: row.option_a,
        b: row.option_b,
        c: row.option_c,
        d: row.option_d
    };

    const letter = String(row['correct-answer'] || '').trim().toLowerCase();
    const answerText = optionMap[letter];

    if (!answerText) return null;

    const options = [row.option_a, row.option_b, row.option_c, row.option_d]
        .filter(opt => opt !== undefined && opt !== null && String(opt).trim() !== '');

    if (options.length < 2) return null;

    return {
        question: String(row.question_text),
        options: options.map(String),
        answer: String(answerText)
    };
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
    // "CRS" (Christian Religious Studies) and "CRK" (Christian Religious
    // Knowledge) are the same subject under two different common names.
    if (clean === 'crs' || clean === 'crk' || clean.includes('christian')) return 'christian-religious-knowledge';
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
function buildSubjectQuestions(subject, requiredCount, adminQuestionsMap) {
    let localQuestions = getLocalQuestions(subject);

    const normalizedSubjectKey = normalizeSubjectName(subject);
    const adminQuestions = (adminQuestionsMap && adminQuestionsMap[normalizedSubjectKey]) || [];

    let combinedQuestions = [...localQuestions, ...adminQuestions];
    let normalizedQuestions = combinedQuestions.map(normalizeQuestion).filter(Boolean);
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

    const adminQuestionsMap = await loadAdminQuestions();

    for (const sub of selectedSubjects) {
        const cleanSubject = String(sub).toLowerCase().trim();
        const isEnglish = cleanSubject === 'use of english' || cleanSubject === 'english';
        const requiredCount = isEnglish ? 60 : 40;

        const questions = buildSubjectQuestions(sub, requiredCount, adminQuestionsMap);
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

    renderMathInQuiz();
}

// ======================================
// RENDER LATEX MATH (KaTeX)
// Mathematics questions use $...$ delimiters for formulas.
// ======================================
function renderMathInQuiz() {
    if (typeof renderMathInElement !== 'function') return;

    const questionBox = document.querySelector('.question-box');
    if (!questionBox) return;

    renderMathInElement(questionBox, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
        ],
        throwOnError: false
    });
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

    // SAVE RESULT TO SUPABASE (MULTIPLAYER QUIZZES ONLY)
    // Solo practice sessions use a local 'solo_...' id and are never a real
    // row in the 'quizzes' table, so they are intentionally kept local-only
    // and never appear on the leaderboard.
    const isSoloQuiz = !quizId || String(quizId).startsWith('solo_');

    if (quizId && !isSoloQuiz) {
        try {
            const { data, error } = await supabase
    .from('quiz_results')
    .insert([{
        quiz_id: quizId,
        student_id: studentId,
        student_name: studentName,
        total_questions: totalQuestionsCount,
        correct_answers: totalScore,
        score: totalScore,
        completed_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
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
    window.location.href = 'result.html';
}