// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET LOGGED-IN STUDENT & ROOM DATA
// ======================================
const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
const joinedQuiz = JSON.parse(localStorage.getItem('joinedQuiz')) || {};

// Check authentication
if (!loggedInStudent) {
    window.location.href = 'login.html';
}

// ======================================
// GET HTML ELEMENTS
// ======================================
const leaderboardContainer = document.getElementById('leaderboard-container');
const backButton = document.getElementById('back-button');

// ======================================
// FETCH LEADERBOARD FROM SUPABASE
// ======================================
async function fetchLiveLeaderboard() {
    if (!leaderboardContainer) return;

    // Check all common key names for the room/quiz identifier
    const quizId = joinedQuiz.quizId || joinedQuiz.id || joinedQuiz.roomCode || localStorage.getItem('activeQuizId');

    // If no quiz ID exists at all, fall back to local storage results
    if (!quizId) {
        const localResults = JSON.parse(localStorage.getItem('leaderboardResults')) || [];
        renderLeaderboard(localResults);
        return;
    }

    try {
        // Query Supabase results for active room
        const { data: results, error } = await supabase
            .from('quiz_results')
            .select('*')
            .eq('quiz_id', quizId)
            .order('score', { ascending: false });

        if (error) throw error;

        // Fallback to local storage if no Supabase records match this quiz ID
        if (!results || results.length === 0) {
            const localResults = JSON.parse(localStorage.getItem('leaderboardResults')) || [];
            
            if (localResults.length > 0) {
                renderLeaderboard(localResults);
                return;
            }

            leaderboardContainer.innerHTML = `
                <div class="no-results" style="padding: 20px; text-align: center; color: #666;">
                    ⏳ Waiting for students to submit their quizzes...
                </div>
            `;
            return;
        }

        // Format data to match UI structure
        const formattedResults = results.map(entry => {
            const percentage = entry.total_questions > 0
                ? Math.round((entry.score / entry.total_questions) * 100)
                : 0;
            return {
                studentName: entry.student_name || 'Anonymous Student',
                percentage: percentage
            };
        });

        renderLeaderboard(formattedResults);

    } catch (err) {
        console.error('Leaderboard error:', err);
        
        // Print the specific error message to the screen for troubleshooting
        leaderboardContainer.innerHTML = `
            <div class="no-results" style="padding: 20px; text-align: center; color: #d93025;">
                Error loading live rankings: ${err.message || 'Unknown database error'}
            </div>
        `;
    }
}

// ======================================
// RENDER LEADERBOARD UI
// ======================================
function renderLeaderboard(results) {
    leaderboardContainer.innerHTML = '';

    if (results.length === 0) {
        leaderboardContainer.innerHTML = `
            <div class="no-results" style="padding: 20px; text-align: center; color: #666;">
                No completed quizzes yet.
            </div>
        `;
        return;
    }

    // Sort results by percentage descending if using local fallback
    results.sort((a, b) => b.percentage - a.percentage);

    results.forEach((result, index) => {
        const row = document.createElement('div');
        row.classList.add('leaderboard-row');

        // Position Badge
        const position = document.createElement('span');
        position.classList.add('position');

        if (index === 0) {
            position.textContent = '🥇 1st';
            row.classList.add('first-place');
        } else if (index === 1) {
            position.textContent = '🥈 2nd';
            row.classList.add('second-place');
        } else if (index === 2) {
            position.textContent = '🥉 3rd';
            row.classList.add('third-place');
        } else {
            position.textContent = `${index + 1}th`;
        }

        // Student Name
        const student = document.createElement('span');
        student.classList.add('student');
        student.textContent = result.studentName;

        // Score Percentage
        const score = document.createElement('span');
        score.classList.add('score');
        score.textContent = `${result.percentage}%`;

        // Assemble Row
        row.appendChild(position);
        row.appendChild(student);
        row.appendChild(score);

        leaderboardContainer.appendChild(row);
    });
}

// ======================================
// INITIALIZATION & REALTIME POLLING
// ======================================
window.addEventListener('DOMContentLoaded', () => {
    fetchLiveLeaderboard();
    // Poll Supabase every 3 seconds for real-time ranking updates
    setInterval(fetchLiveLeaderboard, 3000);
});

// ======================================
// BACK TO DASHBOARD
// ======================================
if (backButton) {
    backButton.addEventListener('click', function () {
        window.location.href = 'dashboard.html';
    });
}