// ======================================
// GET LOGGED-IN STUDENT & QUIZ RESULT
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent')) || {};
const studentResult = JSON.parse(localStorage.getItem('lastQuizResult'));

if (!studentResult) {
    alert('No quiz result was found.');
    window.location.href = 'dashboard.html';
}

// Ownership validation (Softened to prevent breaking guest/joined sessions)
if (
    studentResult.studentId &&
    loggedInStudent.id &&
    String(studentResult.studentId) !== String(loggedInStudent.id)
) {
    console.warn('Result ID differs from loggedInStudent ID; proceeding as guest or updated session.');
}

// ======================================
// PARSE RESULT METRICS
// ======================================
const studentName = studentResult.studentName || loggedInStudent.name || 'Student';
const quizScores = studentResult.scores || {};
const quizAnswers = studentResult.answers || {};
const quizQuestions = studentResult.questions || {};
const totalQuestions = Number(studentResult.totalQuestionsCount) || 0;
const correctAnswers = Number(studentResult.totalScore) || 0;
const wrongAnswers = Math.max(0, totalQuestions - correctAnswers);
const overallScore = Number(studentResult.percentageScore) || 0;

// ======================================
// UPDATE UI DISPLAY
// ======================================
const studentNameElement = document.getElementById('student-name');
const performanceNameElement = document.getElementById('performance-name');
const totalQuestionsElement = document.getElementById('total-questions');
const correctAnswersElement = document.getElementById('correct-answers');
const wrongAnswersElement = document.getElementById('wrong-answers');
const overallScoreElement = document.getElementById('overall-score');
const performanceTitleElement = document.getElementById('performance-title');
const performanceMessageElement = document.getElementById('performance-message');
const scoresContainer = document.getElementById('scores-container');
const improveContainer = document.getElementById('improve-container') || document.getElementById('area-to-improve');
if (studentNameElement) studentNameElement.textContent = `Student: ${studentName}`;
if (performanceNameElement) performanceNameElement.textContent = studentName;
if (totalQuestionsElement) totalQuestionsElement.textContent = totalQuestions;
if (correctAnswersElement) correctAnswersElement.textContent = correctAnswers;
if (wrongAnswersElement) wrongAnswersElement.textContent = wrongAnswers;
if (overallScoreElement) overallScoreElement.textContent = `${overallScore}%`;

// Calculate performance messaging
function getOverallPerformance(score) {
    if (score >= 80) return { title: 'Excellent Performance!', message: 'Excellent work! You have performed very well.' };
    if (score >= 70) return { title: 'Great Performance!', message: 'Great job! Keep practicing towards an even higher score.' };
    if (score >= 60) return { title: 'Good Performance!', message: 'Good effort! You have a good foundation.' };
    if (score >= 50) return { title: 'Fair Performance', message: 'You are making progress. Spend more time reviewing.' };
    return { title: 'Keep Working!', message: 'Review your topics and try the quiz again.' };
}

const performance = getOverallPerformance(overallScore);
if (performanceTitleElement) performanceTitleElement.textContent = performance.title;
if (performanceMessageElement) performanceMessageElement.textContent = performance.message;

if (feedbackContainer) {
    feedbackContainer.textContent = performance.message;
}

if (improveContainer) {
    improveContainer.textContent = overallScore >= 70 
        ? "Great mastery overall! Focus on maintaining speed and accuracy across all subjects." 
        : "Re-read key textbook topics and practice more practice tests on your lowest scoring subjects.";
}

// ======================================
// RENDER SUBJECT BREAKDOWN
// ======================================
if (scoresContainer) scoresContainer.innerHTML = '';
const selectedSubjects = Object.keys(quizScores);

selectedSubjects.forEach(subject => {
    const subjectResult = quizScores[subject] || {};
    const correct = Number(subjectResult.score) || 0;
    const total = Number(subjectResult.total) || 0;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    if (scoresContainer) {
        const scoreCard = document.createElement('div');
        scoreCard.classList.add('score-card');
        scoreCard.innerHTML = `<span class="subject">${subject}</span><span class="score">${percentage}%</span>`;
        scoresContainer.appendChild(scoreCard);
    }
});

// Navigation actions
const goBackButton = document.getElementById('go-back-button');
if (goBackButton) {
    goBackButton.addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
}