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
        
        const { data: results, error } = await query.order('percentage', { ascending: false });

        if (error) throw error;

        if (!results || results.length === 0) {
            leaderboardContainer.innerHTML = `
                <div class="no-results" style="padding: 20px; text-align: center; color: #666;">
                    ⏳ Waiting for students to submit their quizzes...
                </div>
            `;
            return;
        }

        renderLeaderboard(results);

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

    results.forEach((entry, index) => {
        const row = document.createElement('div');
        row.classList.add('leaderboard-row');

        // Position Badge
        let posBadge = `${index + 1}th`;
        if (index === 0) { posBadge = '🥇 1st'; row.classList.add('first-place'); }
        else if (index === 1) { posBadge = '🥈 2nd'; row.classList.add('second-place'); }
        else if (index === 2) { posBadge = '🥉 3rd'; row.classList.add('third-place'); }

        const name = entry.student_name || 'Anonymous Student';
        const scorePct = `${entry.percentage ?? 0}%`;

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