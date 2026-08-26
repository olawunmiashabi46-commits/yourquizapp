// ======================================
// IMPORT SUPABASE
// ======================================

import { supabase } from './supabase.js';


// ======================================
// GET LOGGED-IN STUDENT & QUIZ DATA
// ======================================

const loggedInStudent =
    JSON.parse(localStorage.getItem('loggedInStudent')) || {};

const studentData =
    JSON.parse(localStorage.getItem('studentData')) || {};

const joinedQuiz =
    JSON.parse(localStorage.getItem('joinedQuiz')) || {};


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

if (
    joinedQuiz.subjects &&
    Array.isArray(joinedQuiz.subjects) &&
    joinedQuiz.subjects.length > 0
) {

    selectedSubjects =
        joinedQuiz.subjects;

}

else if (
    studentData.subjects &&
    Array.isArray(studentData.subjects) &&
    studentData.subjects.length > 0
) {

    selectedSubjects =
        studentData.subjects;

}

else if (
    loggedInStudent.subjects &&
    Array.isArray(loggedInStudent.subjects) &&
    loggedInStudent.subjects.length > 0
) {

    selectedSubjects =
        loggedInStudent.subjects;

}

else {

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

const getEl = (id) =>
    document.getElementById(id);


// ======================================
// SHUFFLE ARRAY
// ======================================

function shuffleArray(array) {

    const arr = [...array];

    for (
        let i = arr.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            arr[i],
            arr[j]
        ] = [
            arr[j],
            arr[i]
        ];

    }

    return arr;
}


// ======================================
// FORMAT SUBJECT FOR API
// ======================================

function formatSubjectForAPI(subject) {

    const cleanSub =
        subject.toLowerCase().trim();

    if (cleanSub.includes('english'))
        return 'english';

    if (cleanSub.includes('math'))
        return 'mathematics';

    if (cleanSub.includes('physic'))
        return 'physics';

    if (cleanSub.includes('chem'))
        return 'chemistry';

    if (cleanSub.includes('biol'))
        return 'biology';

    if (cleanSub.includes('econ'))
        return 'economics';

    if (cleanSub.includes('gov'))
        return 'government';

    if (cleanSub.includes('comm'))
        return 'commerce';

    if (cleanSub.includes('lit'))
        return 'literature';

    if (cleanSub.includes('account'))
        return 'accounting';

    if (
        cleanSub.includes('crs') ||
        cleanSub.includes('christian')
    )
        return 'christian-religious-knowledge';

    if (
        cleanSub.includes('irs') ||
        cleanSub.includes('islamic')
    )
        return 'islamic-religious-knowledge';

    if (cleanSub.includes('geog'))
        return 'geography';

    if (cleanSub.includes('agric'))
        return 'agricultural-science';

    return cleanSub;
}


// ======================================
// GET LOCAL QUESTION BANK
// ======================================

function getLocalQuestions(subject) {

    const rawBank =
        typeof questionBank !== 'undefined'
            ? questionBank
            : {};

    if (
        Array.isArray(rawBank[subject])
    ) {

        return rawBank[subject];

    }


    const matchingKey =
        Object.keys(rawBank).find(
            key =>
                key.toLowerCase().trim() ===
                subject.toLowerCase().trim()
        );


    if (matchingKey) {

        return rawBank[matchingKey];

    }


    const apiSubject =
        formatSubjectForAPI(subject);


    const formattedKey =
        Object.keys(rawBank).find(
            key =>
                key.toLowerCase().trim() ===
                apiSubject.toLowerCase().trim()
        );


    if (formattedKey) {

        return rawBank[formattedKey];

    }


    return [];

}


// ======================================
// NORMALIZE QUESTION
// ======================================

function normalizeQuestion(item) {

    if (!item)
        return null;


    // ----------------------------------
    // ONLINE API QUESTION
    // ----------------------------------

    if (item.option) {

        const optionMap =
            item.option || {};


        const rawOptions = [
            optionMap.a,
            optionMap.b,
            optionMap.c,
            optionMap.d
        ].filter(
            value =>
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ''
        );


        const rawAnswerKey =
            String(item.answer || '')
                .toLowerCase()
                .trim();


        const correctAnswerText =
            optionMap[rawAnswerKey] ||
            item.answer;


        return {

            question:
                item.question,

            options:
                rawOptions,

            answer:
                correctAnswerText

        };

    }


    // ----------------------------------
    // LOCAL QUESTION
    // ----------------------------------

    return {

        question:
            item.question ||
            item.q ||
            '',

        options:
            Array.isArray(item.options)
                ? item.options
                : [],

        answer:
            item.answer

    };

}


// ======================================
// REMOVE DUPLICATE QUESTIONS
// ======================================

function removeDuplicateQuestions(
    questions
) {

    const seen =
        new Set();


    return questions.filter(
        q => {

            const questionText =
                String(
                    q.question || ''
                )
                .trim()
                .toLowerCase();


            if (!questionText)
                return false;


            if (
                seen.has(
                    questionText
                )
            ) {

                return false;

            }


            seen.add(
                questionText
            );


            return true;

        }
    );

}


// ======================================
// FETCH ONLINE QUESTIONS
// ======================================

async function fetchOnlineQuestions(
    apiSubject,
    limit
) {

    try {

        console.log(
            `Requesting ${limit} online ${apiSubject} questions...`
        );


        /*
         * ALOC endpoint
         *
         * We request the questions directly.
         */

        const url =
            `https://questions.aloc.com.ng/api/v2/q/${limit}?subject=${encodeURIComponent(apiSubject)}`;


        const response =
            await fetch(
                url,
                {
                    method: 'GET',

                    headers: {
                        'Accept':
                            'application/json',

                        'Content-Type':
                            'application/json',

                        'AccessToken':
                            'QB-69c5e3f16bf8f47'
                    }
                }
            );


        console.log(
            `ALOC response for ${apiSubject}:`,
            response.status
        );


        if (!response.ok) {

            const errorText =
                await response.text()
                    .catch(() => '');


            console.warn(
                `ALOC returned HTTP ${response.status} for ${apiSubject}`,
                errorText
            );


            return [];

        }


        const result =
            await response.json();


        console.log(
            `ALOC data for ${apiSubject}:`,
            result
        );


        if (
            result &&
            Array.isArray(result.data)
        ) {

            return result.data
                .map(
                    normalizeQuestion
                )
                .filter(Boolean);

        }


        return [];

    }

    catch (error) {

        console.warn(
            `Could not fetch online questions for ${apiSubject}:`,
            error
        );

        return [];

    }

}


// ======================================
// BUILD QUESTIONS FOR ONE SUBJECT
// ======================================

async function buildSubjectQuestions(
    subject,
    requiredCount
) {

    console.log(
        `\n================================`
    );

    console.log(
        `BUILDING ${subject}`
    );

    console.log(
        `REQUIRED: ${requiredCount}`
    );

    console.log(
        `================================`
    );


    // ==================================
    // 1. ONLINE QUESTIONS FIRST
    // ==================================

    let onlineQuestions =
        await fetchOnlineQuestions(
            formatSubjectForAPI(subject),
            requiredCount
        );


    onlineQuestions =
        removeDuplicateQuestions(
            onlineQuestions
        );


    onlineQuestions =
        shuffleArray(
            onlineQuestions
        );


    onlineQuestions =
        onlineQuestions.slice(
            0,
            requiredCount
        );


    console.log(
        `${subject}: API supplied ${onlineQuestions.length}/${requiredCount}`
    );


    // ==================================
    // 2. CHECK REMAINING QUESTIONS
    // ==================================

    const remainingCount =
        requiredCount -
        onlineQuestions.length;


    // ==================================
    // 3. LOCAL FALLBACK
    // ==================================

    if (remainingCount > 0) {

        console.log(
            `${subject}: Using local questions for remaining ${remainingCount}.`
        );


        const localQuestions =
            getLocalQuestions(
                subject
            );


        let normalizedLocalQuestions =
            localQuestions
                .map(
                    normalizeQuestion
                )
                .filter(Boolean);


        // Remove duplicates inside local bank

        normalizedLocalQuestions =
            removeDuplicateQuestions(
                normalizedLocalQuestions
            );


        // Remove questions already
        // supplied by online API

        const onlineQuestionTexts =
            new Set(
                onlineQuestions.map(
                    q =>
                        String(
                            q.question
                        )
                        .trim()
                        .toLowerCase()
                )
            );


        normalizedLocalQuestions =
            normalizedLocalQuestions.filter(
                q =>
                    !onlineQuestionTexts.has(
                        String(
                            q.question
                        )
                        .trim()
                        .toLowerCase()
                    )
            );


        normalizedLocalQuestions =
            shuffleArray(
                normalizedLocalQuestions
            );


        const fillerQuestions =
            normalizedLocalQuestions.slice(
                0,
                remainingCount
            );


        onlineQuestions = [
            ...onlineQuestions,
            ...fillerQuestions
        ];

    }


    // ==================================
    // 4. FINAL CLEANUP
    // ==================================

    onlineQuestions =
        removeDuplicateQuestions(
            onlineQuestions
        );


    onlineQuestions =
        shuffleArray(
            onlineQuestions
        );


    // ==================================
    // 5. FINAL SAFETY LIMIT
    // ==================================

    onlineQuestions =
        onlineQuestions.slice(
            0,
            requiredCount
        );


    console.log(
        `FINAL ${subject}: ${onlineQuestions.length}/${requiredCount} questions`
    );


    return onlineQuestions;

}


// ======================================
// FETCH / BUILD ALL QUIZ QUESTIONS
// ======================================

async function initializeQuizSession() {

    const questionHeading =
        getEl('question');


    if (questionHeading) {

        questionHeading.textContent =
            'Fetching JAMB questions...';

    }


    activeSessionQuestions = {};

    userAnswers = {};


    // ==================================
    // BUILD SUBJECT BY SUBJECT
    // ==================================

    for (
        const sub of selectedSubjects
    ) {

        const cleanSubject =
            sub
                .toLowerCase()
                .trim();


        const isEnglish =
            cleanSubject ===
                'use of english' ||
            cleanSubject ===
                'english';


        const requiredCount =
            isEnglish
                ? 60
                : 40;


        const questions =
            await buildSubjectQuestions(
                sub,
                requiredCount
            );


        activeSessionQuestions[sub] =
            questions;


        userAnswers[sub] =
            new Array(
                questions.length
            ).fill(null);


        console.log(
            `${sub}: ${questions.length} questions loaded`
        );

    }


    // ==================================
    // FINAL TOTAL
    // ==================================

    const totalLoaded =
        Object.values(
            activeSessionQuestions
        )
        .reduce(
            (
                total,
                questions
            ) =>
                total +
                questions.length,
            0
        );


    console.log(
        `================================`
    );

    console.log(
        `TOTAL QUESTIONS LOADED: ${totalLoaded}`
    );

    console.log(
        `================================`
    );


    if (questionHeading) {

        questionHeading.textContent =
            'Questions loaded successfully.';

    }

}


// ======================================
// INITIALIZE QUIZ
// ======================================

window.addEventListener(
    'DOMContentLoaded',
    async function () {

        if (
            !selectedSubjects ||
            selectedSubjects.length === 0
        ) {

            selectedSubjects = [
                'Use of English'
            ];

        }


        const waitingRoom =
            getEl('waiting-room');


        const quizContent =
            getEl('quiz-content');


        if (waitingRoom)
            waitingRoom.style.display =
                'none';


        if (quizContent)
            quizContent.style.display =
                'block';


        const studentNameEl =
            getEl('student-name');


        if (studentNameEl) {

            studentNameEl.textContent =
                `Student: ${studentName}`;

        }


        await initializeQuizSession();


        renderSubjectTabs();

        loadQuestion();

        startTimer();

    }
);


// ======================================
// TIMER
// ======================================

function startTimer() {

    if (timerInterval)
        clearInterval(
            timerInterval
        );


    updateTimerDisplay();


    timerInterval =
        setInterval(
            () => {

                timeRemaining--;


                updateTimerDisplay();


                if (
                    timeRemaining <= 0
                ) {

                    clearInterval(
                        timerInterval
                    );


                    finishQuiz();

                }

            },
            1000
        );

}


// ======================================
// TIMER DISPLAY
// ======================================

function updateTimerDisplay() {

    const timerElement =
        getEl('timer');


    if (!timerElement)
        return;


    const hrs =
        Math.floor(
            timeRemaining /
            3600
        );


    const mins =
        Math.floor(
            (
                timeRemaining %
                3600
            ) / 60
        );


    const secs =
        timeRemaining %
        60;


    const formattedHrs =
        hrs < 10
            ? `0${hrs}`
            : hrs;


    const formattedMins =
        mins < 10
            ? `0${mins}`
            : mins;


    const formattedSecs =
        secs < 10
            ? `0${secs}`
            : secs;


    timerElement.textContent =
        `${formattedHrs}:${formattedMins}:${formattedSecs}`;

}


// ======================================
// SUBJECT TABS
// ======================================

function renderSubjectTabs() {

    const subjectNavContainer =
        getEl(
            'subject-navigation'
        );


    if (!subjectNavContainer)
        return;


    subjectNavContainer.innerHTML =
        '';


    selectedSubjects.forEach(
        (
            sub,
            index
        ) => {

            const btn =
                document.createElement(
                    'button'
                );


            btn.type =
                'button';


            btn.className =
                `subject-tab ${
                    index ===
                    currentSubjectIndex
                        ? 'active'
                        : ''
                }`;


            btn.textContent =
                sub;


            btn.onclick = () => {

                currentSubjectIndex =
                    index;


                currentQuestionIndex =
                    0;


                renderSubjectTabs();


                loadQuestion();

            };


            subjectNavContainer.appendChild(
                btn
            );

        }
    );

}


// ======================================
// QUESTION PALETTE
// ======================================

function renderQuestionPalette() {

    const paletteContainer =
        getEl(
            'question-palette'
        );


    if (!paletteContainer)
        return;


    paletteContainer.innerHTML =
        '';


    const activeSubject =
        selectedSubjects[
            currentSubjectIndex
        ];


    const questions =
        activeSessionQuestions[
            activeSubject
        ] || [];


    questions.forEach(
        (
            _,
            idx
        ) => {

            const numBtn =
                document.createElement(
                    'button'
                );


            numBtn.type =
                'button';


            numBtn.className =
                'palette-btn';


            if (
                idx ===
                currentQuestionIndex
            ) {

                numBtn.classList.add(
                    'current'
                );

            }


            if (
                userAnswers[
                    activeSubject
                ] &&
                userAnswers[
                    activeSubject
                ][idx] !== null
            ) {

                numBtn.classList.add(
                    'answered'
                );

            }


            numBtn.textContent =
                idx + 1;


            numBtn.onclick = () => {

                currentQuestionIndex =
                    idx;


                loadQuestion();

            };


            paletteContainer.appendChild(
                numBtn
            );

        }
    );

}


// ======================================
// LOAD QUESTION
// ======================================

function loadQuestion() {

    const activeSubject =
        selectedSubjects[
            currentSubjectIndex
        ];


    const subjectQuestions =
        activeSessionQuestions[
            activeSubject
        ] || [];


    const subjectNameElement =
        getEl(
            'subject-name'
        );


    const questionNumberElement =
        getEl(
            'question-number'
        );


    const questionHeading =
        getEl(
            'question'
        );


    const optionsContainer =
        getEl(
            'options-container'
        );


    if (subjectNameElement)
        subjectNameElement.textContent =
            activeSubject;


    renderQuestionPalette();


    if (
        !subjectQuestions ||
        subjectQuestions.length === 0
    ) {

        if (questionHeading)
            questionHeading.textContent =
                'No questions available for this subject.';


        if (optionsContainer)
            optionsContainer.innerHTML =
                '';


        if (questionNumberElement)
            questionNumberElement.textContent =
                'Question 0 of 0';


        return;

    }


    if (
        currentQuestionIndex >=
        subjectQuestions.length
    ) {

        currentQuestionIndex =
            subjectQuestions.length - 1;

    }


    const currentQ =
        subjectQuestions[
            currentQuestionIndex
        ];


    if (questionNumberElement) {

        questionNumberElement.textContent =
            `Question ${
                currentQuestionIndex + 1
            } of ${
                subjectQuestions.length
            }`;

    }


    if (questionHeading) {

        questionHeading.innerHTML =
            `${
                currentQuestionIndex + 1
            }. ${
                currentQ.question
            }`;

    }


    if (optionsContainer) {

        optionsContainer.innerHTML =
            '';


        const optionLabels =
            [
                'A',
                'B',
                'C',
                'D'
            ];


        currentQ.options.forEach(
            (
                opt,
                idx
            ) => {

                const btn =
                    document.createElement(
                        'button'
                    );


                btn.type =
                    'button';


                btn.className =
                    'option-btn';


                if (
                    userAnswers[
                        activeSubject
                    ] &&
                    userAnswers[
                        activeSubject
                    ][
                        currentQuestionIndex
                    ] === opt
                ) {

                    btn.classList.add(
                        'selected'
                    );

                }


                const labelPrefix =
                    optionLabels[idx]
                        ? `<strong>${optionLabels[idx]}.</strong> `
                        : '';


                btn.innerHTML =
                    `${labelPrefix}${opt}`;


                btn.onclick = () => {

                    if (
                        !userAnswers[
                            activeSubject
                        ]
                    ) {

                        userAnswers[
                            activeSubject
                        ] = [];

                    }


                    userAnswers[
                        activeSubject
                    ][
                        currentQuestionIndex
                    ] = opt;


                    loadQuestion();

                };


                optionsContainer.appendChild(
                    btn
                );

            }
        );

    }


    const prevButton =
        getEl(
            'previous-button'
        );


    const nextButton =
        getEl(
            'next-button'
        );


    if (prevButton) {

        prevButton.disabled =
            currentQuestionIndex === 0;

    }


    if (nextButton) {

        nextButton.disabled =
            currentQuestionIndex ===
            subjectQuestions.length - 1;

    }

}


// ======================================
// BUTTON EVENTS
// ======================================

document.addEventListener(
    'click',
    function (e) {

        // --------------------------------
        // NEXT
        // --------------------------------

        if (
            e.target &&
            e.target.id ===
                'next-button'
        ) {

            const activeSubject =
                selectedSubjects[
                    currentSubjectIndex
                ];


            const subjectQuestions =
                activeSessionQuestions[
                    activeSubject
                ] || [];


            if (
                currentQuestionIndex <
                subjectQuestions.length - 1
            ) {

                currentQuestionIndex++;


                loadQuestion();

            }

        }


        // --------------------------------
        // PREVIOUS
        // --------------------------------

        if (
            e.target &&
            e.target.id ===
                'previous-button'
        ) {

            if (
                currentQuestionIndex > 0
            ) {

                currentQuestionIndex--;


                loadQuestion();

            }

        }


        // --------------------------------
        // SUBMIT
        // --------------------------------

        if (
            e.target &&
            e.target.id ===
                'submit-button'
        ) {

            if (quizSubmitting)
                return;


            const confirmed =
                confirm(
                    'Are you sure you want to submit your quiz?'
                );


            if (confirmed) {

                finishQuiz();

            }

        }

    }
);


// ======================================
// FINISH QUIZ
// ======================================

async function finishQuiz() {

    if (quizSubmitting)
        return;


    quizSubmitting =
        true;


    if (timerInterval)
        clearInterval(
            timerInterval
        );


    let scores = {};

    let totalScore = 0;

    let totalQuestionsCount = 0;


    // ==================================
    // CALCULATE SUBJECT SCORES
    // ==================================

    selectedSubjects.forEach(
        sub => {

            const questions =
                activeSessionQuestions[
                    sub
                ] || [];


            const studentSubAnswers =
                userAnswers[
                    sub
                ] || [];


            let correctCount = 0;


            questions.forEach(
                (
                    q,
                    idx
                ) => {

                    if (
                        studentSubAnswers[
                            idx
                        ] ===
                        q.answer
                    ) {

                        correctCount++;

                    }

                }
            );


            scores[sub] = {

                score:
                    correctCount,

                total:
                    questions.length

            };


            totalScore +=
                correctCount;


            totalQuestionsCount +=
                questions.length;

        }
    );


    // ==================================
    // CALCULATE PERCENTAGE
    // ==================================

    const percentageScore =
        totalQuestionsCount > 0
            ? Math.round(
                (
                    totalScore /
                    totalQuestionsCount
                ) * 100
            )
            : 0;


    // ==================================
    // SAVE COMPLETE RESULT LOCALLY
    // ==================================

    const localResult = {

        studentId,

        studentName,

        quizId,

        scores,

        totalScore,

        totalQuestionsCount,

        percentageScore,

        answers:
            userAnswers,

        questions:
            activeSessionQuestions,

        submittedAt:
            new Date().toISOString()

    };


    localStorage.setItem(
        'lastQuizResult',
        JSON.stringify(
            localResult
        )
    );


    // ==================================
    // SAVE RESULT TO SUPABASE
    // ==================================

    if (
        studentId &&
        quizId
    ) {

        try {

            const {
                data,
                error
            } = await supabase
                .from(
                    'quiz-results'
                )
                .insert({

                    quiz_id:
                        quizId,

                    student_id:
                        studentId,

                    total_questions:
                        totalQuestionsCount,

                    correct_answers:
                        totalScore,

                    score:
                        percentageScore

                })
                .select()
                .single();


            if (error) {

                console.error(
                    'Supabase result error:',
                    error
                );

            }

            else {

                localStorage.setItem(
                    'savedQuizResult',
                    JSON.stringify(
                        data
                    )
                );

            }

        }

        catch (error) {

            console.error(
                'Could not save result to Supabase:',
                error
            );

        }

    }


    // ==================================
    // GO TO RESULT PAGE
    // ==================================

    window.location.href =
        'result.html';

}