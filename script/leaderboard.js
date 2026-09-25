import { supabase } from './supabase.js';

// ======================================
// GET USER & ROOM INFORMATION
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
const joinedQuiz = JSON.parse(localStorage.getItem('joinedQuiz')) || {};

if (!loggedInStudent) {
    window.location.href = 'login.html';
}

const leaderboardContainer = document.getElementById('leaderboard-container');
const backButton = document.getElementById('back-button');

// ======================================
// FETCH LEADERBOARD FROM SUPABASE
// ======================================
async function fetchLiveLeaderboard() {
    if (!leaderboardContainer) return;

    const quizId = joinedQuiz.quizId || joinedQuiz.quiz_id || joinedQuiz.id || localStorage.getItem('activeQuizId');

    try {
        let query = supabase.from('quiz_results').select('*');
        if (quizId) {
            query = query.eq('quiz_id', quizId);
        }
        
        const { data: results, error } = await query;

        if (error) throw error;

        if (!results || results.length === 0) {
            leaderboardContainer.innerHTML = `
                <div class="no-results" style="padding: 20px; text-align: center; color: #666;">
                    ⏳ Waiting for students to submit their quizzes...
                </div>
            `;
            return;
        }

        // Rank by percentage rather than raw score, since quizzes/attempts
        // can have different total question counts.
        const rankedResults = [...results].sort((a, b) => {
            const aPct = a.total_questions
                ? (Number(a.score) || 0) / Number(a.total_questions)
                : 0;
            const bPct = b.total_questions
                ? (Number(b.score) || 0) / Number(b.total_questions)
                : 0;
            return bPct - aPct;
        });

        renderLeaderboard(rankedResults);

    } catch (err) {
        console.error('Leaderboard fetch error:', err);
        leaderboardContainer.innerHTML = `
            <div class="no-results" style="padding: 20px; text-align: center; color: #d93025;">
                Unable to load rankings: ${err.message || 'Database error'}
            </div>
        `;
    }
}

// ======================================
// RENDER LEADERBOARD
// ======================================
function renderLeaderboard(results) {
    leaderboardContainer.innerHTML = '';

    // Filter out duplicates so each student only shows their best/latest attempt
    const uniqueStudentResults = [];
    const seenStudents = new Set();

    results.forEach(entry => {
        const identifier = entry.student_id || entry.student_name;
        if (!seenStudents.has(identifier)) {
            seenStudents.add(identifier);
            uniqueStudentResults.push(entry);
        }
    });

    uniqueStudentResults.forEach((entry, index) => {
        const row = document.createElement('div');
        row.classList.add('leaderboard-row');

        // Position Badge
        let posBadge = `${index + 1}th`;
        if (index === 0) { posBadge = '🥇 1st'; row.classList.add('first-place'); }
        else if (index === 1) { posBadge = '🥈 2nd'; row.classList.add('second-place'); }
        else if (index === 2) { posBadge = '🥉 3rd'; row.classList.add('third-place'); }

        const name = entry.student_name || 'Anonymous Student';

        // Calculate percentage safely whether 'percentage', 'score', or fallback fields are present
        let percentageVal = entry.percentage;
        if (percentageVal === undefined || percentageVal === null) {
            const rawScore = Number(entry.score) || 0;
            const totalQ = Number(entry.total_questions) || 40;
            percentageVal = totalQ > 0 ? Math.round((rawScore / totalQ) * 100) : 0;
        }

        const scorePct = `${percentageVal}%`;

        row.innerHTML = `
            <span class="position">${posBadge}</span>
            <span class="student">${name}</span>
            <span class="score">${scorePct}</span>
        `;

        leaderboardContainer.appendChild(row);
    });
}

// ======================================
// INITIALIZATION & REALTIME POLLING
// ======================================
window.addEventListener('DOMContentLoaded', () => {
    fetchLiveLeaderboard();
    setInterval(fetchLiveLeaderboard, 3000);
});

if (backButton) {
    backButton.addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
}