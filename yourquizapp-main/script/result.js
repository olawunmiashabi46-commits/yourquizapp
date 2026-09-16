// ======================================
// GET LOGGED-IN STUDENT & QUIZ RESULT
// ======================================

const loggedInStudent =
    JSON.parse(localStorage.getItem('loggedInStudent')) || {};

const studentResult =
    JSON.parse(localStorage.getItem('lastQuizResult')) || null;

if (!studentResult) {
    alert('No quiz result was found.');
    window.location.href = 'dashboard.html';
} else {

    // ======================================
    // PARSE RESULT METRICS
    // ======================================

    const studentName =
        studentResult.studentName ||
        loggedInStudent.name ||
        'Student';

    const quizScores = studentResult.scores || {};
    const quizAnswers = studentResult.answers || {};
    const quizQuestions = studentResult.questions || {};

    const totalQuestions =
        Number(studentResult.totalQuestionsCount) || 0;

    const correctAnswers =
        Number(studentResult.totalScore) || 0;

    const wrongAnswers =
        Math.max(0, totalQuestions - correctAnswers);

    const overallScore =
        Number(studentResult.percentageScore) || 0;

    // ======================================
    // GET HTML ELEMENTS
    // ======================================

    const studentNameElement =
        document.getElementById('student-name');

    const performanceNameElement =
        document.getElementById('performance-name');

    const totalQuestionsElement =
        document.getElementById('total-questions');

    const correctAnswersElement =
        document.getElementById('correct-answers');

    const wrongAnswersElement =
        document.getElementById('wrong-answers');

    const overallScoreElement =
        document.getElementById('overall-score');

    const performanceTitleElement =
        document.getElementById('performance-title');

    const performanceMessageElement =
        document.getElementById('performance-message');

    const scoresContainer =
        document.getElementById('scores-container');

    const feedbackContainer =
        document.getElementById('feedback-container');

    const improvementMessageElement =
        document.getElementById('improvement-message');

    const reviewButton =
        document.getElementById('review-button');

    const reviewSection =
        document.getElementById('review-section');

    const reviewContainer =
        document.getElementById('review-container');

    const goBackButton =
        document.getElementById('go-back-button');

    const tryAgainButton =
        document.getElementById('try-again-button');

    // ======================================
    // UPDATE BASIC RESULT INFORMATION
    // ======================================

    if (studentNameElement) {
        studentNameElement.textContent = `Student: ${studentName}`;
    }

    if (performanceNameElement) {
        performanceNameElement.textContent = studentName;
    }

    if (totalQuestionsElement) {
        totalQuestionsElement.textContent = totalQuestions;
    }

    if (correctAnswersElement) {
        correctAnswersElement.textContent = correctAnswers;
    }

    if (wrongAnswersElement) {
        wrongAnswersElement.textContent = wrongAnswers;
    }

    if (overallScoreElement) {
        overallScoreElement.textContent = `${overallScore}%`;
    }

    // ======================================
    // PERFORMANCE MESSAGE
    // ======================================

    function getOverallPerformance(score) {
        if (score >= 80) {
            return {
                title: 'Excellent Performance!',
                message:
                    'Excellent work! You have performed very well.'
            };
        }

        if (score >= 70) {
            return {
                title: 'Great Performance!',
                message:
                    'Great job! Keep practicing towards an even higher score.'
            };
        }

        if (score >= 60) {
            return {
                title: 'Good Performance!',
                message:
                    'Good effort! You have a good foundation.'
            };
        }

        if (score >= 50) {
            return {
                title: 'Fair Performance',
                message:
                    'You are making progress. Spend more time reviewing.'
            };
        }

        return {
            title: 'Keep Working!',
            message:
                'Review your topics and try the quiz again.'
        };
    }

    const performance =
        getOverallPerformance(overallScore);

    if (performanceTitleElement) {
        performanceTitleElement.textContent =
            performance.title;
    }

    if (performanceMessageElement) {
        performanceMessageElement.textContent =
            performance.message;
    }

    // ======================================
    // PERFORMANCE FEEDBACK
    // ======================================

    if (feedbackContainer) {
        feedbackContainer.textContent =
            performance.message;
    }

    // ======================================
    // AREA TO IMPROVE
    // ======================================

    if (improvementMessageElement) {
        improvementMessageElement.textContent =
            overallScore >= 70
                ? 'Great mastery overall! Focus on maintaining speed and accuracy across all subjects.'
                : 'Review key textbook topics and practise more tests, especially in your lowest-scoring subjects.';
    }

    // ======================================
    // RENDER SUBJECT BREAKDOWN
    // ======================================

    if (scoresContainer) {
        scoresContainer.innerHTML = '';

        const selectedSubjects =
            Object.keys(quizScores);

        if (selectedSubjects.length === 0) {
            scoresContainer.innerHTML =
                '<p>No subject score details are available.</p>';
        } else {

            selectedSubjects.forEach(subject => {
                const subjectResult =
                    quizScores[subject] || {};

                const correct =
                    Number(subjectResult.score) || 0;

                const total =
                    Number(subjectResult.total) || 0;

                const percentage =
                    total > 0
                        ? Math.round((correct / total) * 100)
                        : 0;

                const scoreCard =
                    document.createElement('div');

                scoreCard.classList.add('score-card');

                scoreCard.innerHTML = `
                    <span class="subject">
                        ${subject}
                    </span>

                    <span class="score">
                        ${correct}/${total} (${percentage}%)
                    </span>
                `;

                scoresContainer.appendChild(scoreCard);
            });
        }
    }

    // ======================================
    // REVIEW ANSWERS
    // ======================================

    if (reviewButton) {
        reviewButton.addEventListener('click', () => {
            if (!reviewSection || !reviewContainer) {
                return;
            }

            reviewSection.style.display = 'block';
            reviewContainer.innerHTML = '';

            const questionKeys =
                Object.keys(quizQuestions);

            if (questionKeys.length === 0) {
                reviewContainer.innerHTML =
                    '<p>No answer review is available for this quiz.</p>';
                return;
            }

            questionKeys.forEach((key, index) => {
                const questionData =
                    quizQuestions[key];

                let questionText = '';
                let correctAnswer = '';
                let selectedAnswer = '';

                if (typeof questionData === 'string') {
                    questionText = questionData;
                } else if (questionData && typeof questionData === 'object') {
                    questionText =
                        questionData.question ||
                        questionData.text ||
                        `Question ${index + 1}`;

                    correctAnswer =
                        questionData.correctAnswer ||
                        questionData.answer ||
                        '';
                }

                selectedAnswer =
                    quizAnswers[key] ||
                    quizAnswers[index] ||
                    'Not answered';

                const reviewItem =
                    document.createElement('div');

                reviewItem.classList.add('review-item');

                reviewItem.innerHTML = `
                    <h3>Question ${index + 1}</h3>
                    <p><strong>Question:</strong> ${questionText}</p>
                    <p><strong>Your Answer:</strong> ${selectedAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${correctAnswer || 'Not available'}</p>
                `;

                reviewContainer.appendChild(reviewItem);
            });

            reviewSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    }

    // ======================================
    // GO BACK TO DASHBOARD
    // ======================================

    if (goBackButton) {
        goBackButton.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }

    // ======================================
    // TRY QUIZ AGAIN
    // ======================================

    if (tryAgainButton) {
        tryAgainButton.addEventListener('click', () => {
            window.location.href = 'dashboard.html';
        });
    }

    // ======================================
    // ACTIVATE LUCIDE ICONS
    // ======================================

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}