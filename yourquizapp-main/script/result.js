// ======================================
// GET LOGGED-IN STUDENT
// ======================================
const loggedInStudent =
    JSON.parse(
        localStorage.getItem('loggedInStudent')
    );


// ======================================
// CHECK LOGIN
// ======================================
if (!loggedInStudent) {

    window.location.href =
        'login.html';

}


// ======================================
// GET LAST QUIZ RESULT
// ======================================
const studentResult =
    JSON.parse(
        localStorage.getItem('lastQuizResult')
    );


// ======================================
// CHECK RESULT
// ======================================
if (!studentResult) {

    alert(
        'No quiz result was found.'
    );

    window.location.href =
        'dashboard.html';

}


// ======================================
// CHECK RESULT BELONGS TO STUDENT
// ======================================
if (
    studentResult.studentId &&
    loggedInStudent.id &&
    String(studentResult.studentId) !==
    String(loggedInStudent.id)
) {

    alert(
        'This result does not belong to the current student.'
    );

    window.location.href =
        'dashboard.html';

}


// ======================================
// RESULT INFORMATION
// ======================================
const studentName =
    studentResult.studentName ||
    loggedInStudent.name ||
    'Student';


const quizScores =
    studentResult.scores || {};


const quizAnswers =
    studentResult.answers || {};


const quizQuestions =
    studentResult.questions || {};


const totalQuestions =
    Number(
        studentResult.totalQuestionsCount
    ) || 0;


const correctAnswers =
    Number(
        studentResult.totalScore
    ) || 0;


const wrongAnswers =
    Math.max(
        0,
        totalQuestions -
        correctAnswers
    );


const overallScore =
    Number(
        studentResult.percentageScore
    ) || 0;


// ======================================
// GET HTML ELEMENTS
// ======================================
const studentNameElement =
    document.getElementById(
        'student-name'
    );


const performanceNameElement =
    document.getElementById(
        'performance-name'
    );


const totalQuestionsElement =
    document.getElementById(
        'total-questions'
    );


const correctAnswersElement =
    document.getElementById(
        'correct-answers'
    );


const wrongAnswersElement =
    document.getElementById(
        'wrong-answers'
    );


const overallScoreElement =
    document.getElementById(
        'overall-score'
    );


const performanceTitleElement =
    document.getElementById(
        'performance-title'
    );


const performanceMessageElement =
    document.getElementById(
        'performance-message'
    );


const scoresContainer =
    document.getElementById(
        'scores-container'
    );


const feedbackContainer =
    document.getElementById(
        'feedback-container'
    );


const improvementMessage =
    document.getElementById(
        'improvement-message'
    );


const reviewButton =
    document.getElementById(
        'review-button'
    );


const reviewSection =
    document.getElementById(
        'review-section'
    );


const reviewContainer =
    document.getElementById(
        'review-container'
    );


const goBackButton =
    document.getElementById(
        'go-back-button'
    );


const tryAgainButton =
    document.getElementById(
        'try-again-button'
    );


// ======================================
// DISPLAY BASIC RESULT
// ======================================
if (studentNameElement) {

    studentNameElement.textContent =
        `Student: ${studentName}`;

}


if (performanceNameElement) {

    performanceNameElement.textContent =
        studentName;

}


if (totalQuestionsElement) {

    totalQuestionsElement.textContent =
        totalQuestions;

}


if (correctAnswersElement) {

    correctAnswersElement.textContent =
        correctAnswers;

}


if (wrongAnswersElement) {

    wrongAnswersElement.textContent =
        wrongAnswers;

}


if (overallScoreElement) {

    overallScoreElement.textContent =
        overallScore;

}


// ======================================
// PERFORMANCE MESSAGE
// ======================================
function getOverallPerformance(score) {

    if (score >= 80) {

        return {

            title:
                'Excellent Performance!',

            message:
                'Excellent work! You have performed very well. Keep up the great effort and continue practising.'

        };

    }


    if (score >= 70) {

        return {

            title:
                'Great Performance!',

            message:
                'Great job! You are doing well. Keep practising and work towards an even higher score.'

        };

    }


    if (score >= 60) {

        return {

            title:
                'Good Performance!',

            message:
                'Good effort! You have a good foundation. Keep studying and practising to improve further.'

        };

    }


    if (score >= 50) {

        return {

            title:
                'Fair Performance',

            message:
                'You are making progress. Spend more time reviewing your topics and keep practising.'

        };

    }


    return {

        title:
            'Keep Working!',

        message:
            'Do not give up. Review your topics, practise more questions and try the quiz again.'

    };

}


const performance =
    getOverallPerformance(
        overallScore
    );


if (performanceTitleElement) {

    performanceTitleElement.textContent =
        performance.title;

}


if (performanceMessageElement) {

    performanceMessageElement.textContent =
        performance.message;

}


// ======================================
// SUBJECT SCORES
// ======================================
const percentageScores = {};


if (scoresContainer) {

    scoresContainer.innerHTML = '';

}


const selectedSubjects =
    Object.keys(quizScores);


selectedSubjects.forEach(
    function (subject) {

        const subjectResult =
            quizScores[subject] || {};


        const correct =
            Number(
                subjectResult.score
            ) || 0;


        const total =
            Number(
                subjectResult.total
            ) || 0;


        const percentage =
            total > 0
                ? Math.round(
                    (
                        correct /
                        total
                    ) * 100
                )
                : 0;


        percentageScores[subject] =
            percentage;


        if (!scoresContainer)
            return;


        const scoreCard =
            document.createElement('div');


        scoreCard.classList.add(
            'score-card'
        );


        const subjectElement =
            document.createElement('span');


        subjectElement.classList.add(
            'subject'
        );


        subjectElement.textContent =
            subject;


        const scoreElement =
            document.createElement('span');


        scoreElement.classList.add(
            'score'
        );


        scoreElement.textContent =
            percentage;


        scoreCard.appendChild(
            subjectElement
        );


        scoreCard.appendChild(
            scoreElement
        );


        scoresContainer.appendChild(
            scoreCard
        );

    }
);


// ======================================
// SUBJECT FEEDBACK
// ======================================
function getFeedback(score) {

    if (score >= 80) {

        return 'Excellent work! Keep up the great performance.';

    }


    if (score >= 70) {

        return 'Great job! Keep practising to maintain this performance.';

    }


    if (score >= 60) {

        return 'Good effort! A little more practice can make you even stronger.';

    }


    if (score >= 50) {

        return 'Fair performance. Spend more time reviewing this subject.';

    }


    if (score >= 40) {

        return 'You need more practice in this subject. Do not give up.';

    }


    return 'Work harder on this subject. Review the topics and try another quiz.';

}


if (feedbackContainer) {

    feedbackContainer.innerHTML = '';

}


selectedSubjects.forEach(
    function (subject) {

        if (!feedbackContainer)
            return;


        const score =
            percentageScores[subject] || 0;


        const feedbackCard =
            document.createElement('div');


        feedbackCard.classList.add(
            'feedback-card'
        );


        const heading =
            document.createElement('h3');


        heading.textContent =
            subject;


        const message =
            document.createElement('p');


        message.textContent =
            getFeedback(score);


        feedbackCard.appendChild(
            heading
        );


        feedbackCard.appendChild(
            message
        );


        feedbackContainer.appendChild(
            feedbackCard
        );

    }
);


// ======================================
// FIND WEAKEST SUBJECT
// ======================================
let lowestScore = 101;

let weakestSubjects = [];


selectedSubjects.forEach(
    function (subject) {

        const score =
            percentageScores[subject] || 0;


        if (score < lowestScore) {

            lowestScore =
                score;

            weakestSubjects = [
                subject
            ];

        }

        else if (
            score === lowestScore
        ) {

            weakestSubjects.push(
                subject
            );

        }

    }
);


// ======================================
// AREA TO IMPROVE
// ======================================
if (improvementMessage) {

    if (
        weakestSubjects.length === 1
    ) {

        improvementMessage.textContent =
            `${weakestSubjects[0]} is currently your weakest subject. Review your ${weakestSubjects[0]} topics and try another quiz to improve your score.`;

    }

    else if (
        weakestSubjects.length > 1
    ) {

        improvementMessage.textContent =
            `${weakestSubjects.join(' and ')} need more attention. Review these subjects and try another quiz to improve your scores.`;

    }

    else {

        improvementMessage.textContent =
            'Keep practising all your subjects to improve your performance.';

    }

}


// ======================================
// REVIEW ANSWERS
// ======================================
function displayReviewAnswers() {

    if (!reviewContainer)
        return;


    reviewContainer.innerHTML = '';


    selectedSubjects.forEach(
        function (subject) {

            const questions =
                quizQuestions[subject] || [];


            const studentSubjectAnswers =
                quizAnswers[subject] || [];


            if (!questions.length)
                return;


            const subjectHeading =
                document.createElement('h3');


            subjectHeading.classList.add(
                'review-subject'
            );


            subjectHeading.textContent =
                subject;


            reviewContainer.appendChild(
                subjectHeading
            );


            questions.forEach(
                function (
                    question,
                    index
                ) {

                    const studentAnswer =
                        studentSubjectAnswers[
                            index
                        ];


                    const isCorrect =
                        studentAnswer ===
                        question.answer;


                    const reviewQuestion =
                        document.createElement('div');


                    reviewQuestion.classList.add(
                        'review-question'
                    );


                    const number =
                        document.createElement('div');


                    number.classList.add(
                        'review-number'
                    );


                    number.textContent =
                        `Question ${index + 1}`;


                    const questionText =
                        document.createElement('div');


                    questionText.classList.add(
                        'review-question-text'
                    );


                    questionText.textContent =
                        question.question;


                    const studentAnswerElement =
                        document.createElement('div');


                    if (!studentAnswer) {

                        studentAnswerElement.classList.add(
                            'no-answer'
                        );


                        studentAnswerElement.innerHTML =
                            '🟡 <strong>Your answer:</strong> Not answered';

                    }

                    else if (isCorrect) {

                        studentAnswerElement.classList.add(
                            'student-answer',
                            'correct'
                        );


                        studentAnswerElement.innerHTML =
                            `🟢 <strong>Your answer:</strong> ${studentAnswer} ✅`;

                    }

                    else {

                        studentAnswerElement.classList.add(
                            'student-answer',
                            'incorrect'
                        );


                        studentAnswerElement.innerHTML =
                            `🔴 <strong>Your answer:</strong> ${studentAnswer} ❌`;

                    }


                    const correctAnswerElement =
                        document.createElement('div');


                    correctAnswerElement.classList.add(
                        'correct-answer'
                    );


                    correctAnswerElement.innerHTML =
                        `🔵 <strong>Correct answer:</strong> ${question.answer}`;


                    reviewQuestion.appendChild(
                        number
                    );


                    reviewQuestion.appendChild(
                        questionText
                    );


                    reviewQuestion.appendChild(
                        studentAnswerElement
                    );


                    reviewQuestion.appendChild(
                        correctAnswerElement
                    );


                    reviewContainer.appendChild(
                        reviewQuestion
                    );

                }
            );

        }
    );

}


// ======================================
// REVIEW BUTTON
// ======================================
if (reviewButton) {

    reviewButton.addEventListener(
        'click',
        function () {

            if (
                reviewSection.style.display ===
                    'none' ||
                reviewSection.style.display ===
                    ''
            ) {

                displayReviewAnswers();


                reviewSection.style.display =
                    'block';


                reviewButton.textContent =
                    'Hide Review Answers';


                reviewSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });

            }

            else {

                reviewSection.style.display =
                    'none';


                reviewButton.textContent =
                    'Review Answers';

            }

        }
    );

}


// ======================================
// INITIAL REVIEW STATE
// ======================================
if (reviewSection) {

    reviewSection.style.display =
        'none';

}


// ======================================
// GO BACK BUTTON
// ======================================
if (goBackButton) {

    goBackButton.addEventListener(
        'click',
        function () {

            window.location.href =
                'dashboard.html';

        }
    );

}


// ======================================
// TRY AGAIN BUTTON
// ======================================
if (tryAgainButton) {

    tryAgainButton.addEventListener(
        'click',
        function () {

            const confirmRestart =
                confirm(
                    'Are you sure you want to start a new quiz? Your current result will be cleared.'
                );


            if (!confirmRestart)
                return;


            localStorage.removeItem(
                'lastQuizResult'
            );


            localStorage.removeItem(
                'savedQuizResult'
            );


            window.location.href =
                'dashboard.html';

        }
    );

}