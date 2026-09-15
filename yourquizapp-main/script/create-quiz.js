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
const quizTitleInput = document.getElementById('quiz-title');
const categorySelect = document.getElementById('quiz-category');
const subjectsContainer = document.getElementById('subjects-container');
const createButton = document.getElementById('create-button');
const errorMessage = document.getElementById('error-message');
const quizResult = document.getElementById('quiz-result');
const quizCodeElement = document.getElementById('quiz-code');
const copyButton = document.getElementById('copy-button');
const backButton = document.getElementById('back-button');
const participantCount = document.getElementById('participant-count');
const creatorStatus = document.getElementById('creator-status');
const startQuizButton = document.getElementById('start-quiz-button');

// ======================================
// SUBJECTS BY CATEGORY
// ======================================
const subjectsByCategory = {
    Science: ['Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Agricultural Science'],
    Commercial: ['Use of English', 'Mathematics', 'Economics', 'Accounting', 'Commerce', 'Government'],
    Arts: ['Use of English', 'Literature in English', 'Government', 'History', 'CRS', 'Economics'],
    'Social Science': ['Use of English', 'Mathematics', 'Economics', 'Government', 'Geography', 'Commerce']
};

let currentQuizId = null;
let participantTimer = null;

// ======================================
// DISPLAY SUBJECTS & ENFORCE MAX 4
// ======================================
categorySelect.addEventListener('change', function () {
    const category = categorySelect.value;
    subjectsContainer.innerHTML = '';

    if (!category) {
        subjectsContainer.classList.remove('active'); // Hide container
        return;
    }

    // Show container when a valid category is selected
    subjectsContainer.classList.add('active');

    const subjects = subjectsByCategory[category];

    subjects.forEach(function (subject) {
        const label = document.createElement('label');
        label.className = 'subject-option';
        label.innerHTML = `
            <input type="checkbox" name="quiz-subject" value="${subject}">
            <span>${subject}</span>
        `;
        subjectsContainer.appendChild(label);
    });

    // Enforce 4 Subject Max Limit
    const checkboxes = document.querySelectorAll('input[name="quiz-subject"]');
    checkboxes.forEach(function (checkbox) {
        checkbox.addEventListener('change', function () {
            const checkedBoxes = document.querySelectorAll('input[name="quiz-subject"]:checked');
            checkboxes.forEach(function (item) {
                if (checkedBoxes.length >= 4 && !item.checked) {
                    item.disabled = true;
                } else {
                    item.disabled = false;
                }
            });
        });
    });
});

// ======================================
// GENERATE QUIZ CODE
// ======================================
function generateQuizCode() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters[Math.floor(Math.random() * characters.length)];
    }
    return code;
}

// ======================================
// CHECK PARTICIPANTS
// ======================================
async function checkParticipants() {
    if (!currentQuizId) return;

    try {
        const { data: participants, error } = await supabase
            .from('quiz_participants')
            .select('id, student_id')
            .eq('quiz_id', currentQuizId);

        if (error) {
            console.error('Participant check error:', error);
            return;
        }

        const count = participants ? participants.length : 0;
        participantCount.textContent = `${count} ${count === 1 ? 'student has' : 'students have'} joined.`;

        if (count > 0) {
            startQuizButton.disabled = false;
            creatorStatus.textContent = '🟢 Student(s) have joined. You can start the quiz.';
        } else {
            startQuizButton.disabled = true;
            creatorStatus.textContent = '🟡 Waiting for students to join...';
        }
    } catch (error) {
        console.error('Participant check failed:', error);
    }
}

function startParticipantChecking() {
    clearInterval(participantTimer);
    checkParticipants();
    participantTimer = setInterval(checkParticipants, 2000);
}

// ======================================
// CREATE QUIZ
// ======================================
createButton.addEventListener('click', async function () {
    errorMessage.textContent = '';

    const quizTitle = quizTitleInput.value.trim();
    const category = categorySelect.value;
    const selectedCheckboxes = document.querySelectorAll('input[name="quiz-subject"]:checked');
    
    // Read directly from DOM to prevent state mismatch
    const selectedSubjects = Array.from(selectedCheckboxes).map(cb => cb.value);

    // Validation
    if (!quizTitle) {
        errorMessage.textContent = 'Please enter a quiz title.';
        return;
    }
    if (!category) {
        errorMessage.textContent = 'Please select a category.';
        return;
    }
    if (selectedSubjects.length === 0) {
        errorMessage.textContent = 'Please select at least 1 subject.';
        return;
    }
    if (selectedSubjects.length > 4) {
        errorMessage.textContent = 'You can select a maximum of 4 subjects.';
        return;
    }

    createButton.disabled = true;
    createButton.textContent = '⏳ Creating Quiz...';

    try {
        const quizCode = generateQuizCode();

        const { data: insertedQuiz, error } = await supabase
            .from('quizzes')
            .insert({
                title: quizTitle,
                quiz_code: quizCode,
                creator_id: loggedInStudent.id,
                category: category,
                subjects: selectedSubjects,
                started: false,
                status: 'waiting',
                started_at: null
            })
            .select();

        if (error) throw new Error(error.message);
        if (!insertedQuiz || insertedQuiz.length === 0) throw new Error('Failed to create quiz in database.');

        const data = insertedQuiz[0];
        currentQuizId = data.id;

        // Save locally
        const quizRooms = JSON.parse(localStorage.getItem('quizRooms')) || [];
        quizRooms.push({
            id: data.id,
            code: data.quiz_code,
            title: data.title,
            category: data.category,
            subjects: selectedSubjects,
            creatorId: data.creator_id,
            creatorName: loggedInStudent.name,
            participants: [],
            status: data.status,
            started: data.started,
            createdAt: data.created_at
        });
        localStorage.setItem('quizRooms', JSON.stringify(quizRooms));

        // Display interface update
        quizCodeElement.textContent = quizCode;
        quizResult.classList.remove('hidden');
        participantCount.textContent = '0 students have joined.';
        creatorStatus.textContent = '🟡 Waiting for students to join...';

        quizTitleInput.disabled = true;
        categorySelect.disabled = true;
        selectedCheckboxes.forEach(cb => cb.disabled = true);

        createButton.textContent = '✅ Quiz Created';
        startQuizButton.disabled = true;

        startParticipantChecking();
    } catch (error) {
        console.error('Create quiz error:', error);
        errorMessage.textContent = `Could not create quiz: ${error.message}`;
        createButton.disabled = false;
        createButton.textContent = '🚀 Create Quiz';
    }
});

// ======================================
// START QUIZ
// ======================================
startQuizButton.addEventListener('click', async function () {
    if (!currentQuizId) return;

    startQuizButton.disabled = true;
    startQuizButton.textContent = '⏳ Starting...';

    try {
        const { data: participants, error: participantError } = await supabase
            .from('quiz_participants')
            .select('id')
            .eq('quiz_id', currentQuizId);

        if (participantError) throw new Error(participantError.message);

        if (!participants || participants.length === 0) {
            throw new Error('At least one student must join before the quiz can start.');
        }

        const { data: updatedQuizzes, error: updateError } = await supabase
            .from('quizzes')
            .update({
                started: true,
                status: 'started',
                started_at: new Date().toISOString()
            })
            .eq('id', currentQuizId)
            .select();

        if (updateError) throw new Error(updateError.message);

        if (!updatedQuizzes || updatedQuizzes.length === 0) {
            throw new Error('Could not update quiz status. Check Supabase RLS row policies.');
        }

        const updatedQuiz = updatedQuizzes[0];

        const creatorJoinedQuiz = {
            quizId: updatedQuiz.id,
            quizCode: updatedQuiz.quiz_code,
            quizTitle: updatedQuiz.title,
            category: updatedQuiz.category,
            subjects: updatedQuiz.subjects,
            creatorId: updatedQuiz.creator_id,
            creatorName: loggedInStudent.name,
            studentId: loggedInStudent.id,
            studentName: loggedInStudent.name,
            username: loggedInStudent.username,
            joinedAt: new Date().toISOString()
        };

        localStorage.setItem('joinedQuiz', JSON.stringify(creatorJoinedQuiz));

        clearInterval(participantTimer);
        window.location.href = 'quiz.html';
    } catch (error) {
        console.error('Start quiz error:', error);
        errorMessage.textContent = error.message;
        startQuizButton.disabled = false;
        startQuizButton.textContent = '▶️ Start Quiz';
    }
});

// ======================================
// UTILITIES
// ======================================
copyButton.addEventListener('click', async function () {
    const code = quizCodeElement.textContent;
    try {
        await navigator.clipboard.writeText(code);
        copyButton.textContent = '✅ Code Copied!';
        setTimeout(() => copyButton.textContent = '📋 Copy Code', 2000);
    } catch (error) {
        alert(`Quiz Code: ${code}`);
    }
});

backButton.addEventListener('click', function () {
    clearInterval(participantTimer);
    window.location.href = 'dashboard.html';
});