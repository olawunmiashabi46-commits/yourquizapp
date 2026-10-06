import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

function isActivePremium(student) {
    if (!student || student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}
const isPremium = isActivePremium(loggedInStudent);

function renderIcons() { if (window.lucide) lucide.createIcons(); }

async function loadProgress() {
    const { data: attempts, error } = await supabase
        .from('solo_attempts')
        .select('*')
        .eq('student_id', loggedInStudent.id)
        .order('completed_at', { ascending: true });

    if (error) {
        $('loading-state').textContent = 'Could not load your progress right now. Please try again later.';
        return;
    }

    $('loading-state').style.display = 'none';
    $('progress-content').style.display = 'block';

    const list = attempts || [];

    // ---------- BASIC STATS (everyone) ----------
    let totalQuestions = 0, totalCorrect = 0;
    const perSubject = {}; // subject -> { correct, total }

    list.forEach((a) => {
        totalQuestions += a.total_questions || 0;
        totalCorrect += a.correct_answers || 0;
        const subjScores = a.per_subject || {};
        Object.keys(subjScores).forEach((subj) => {
            if (!perSubject[subj]) perSubject[subj] = { correct: 0, total: 0 };
            perSubject[subj].correct += Number(subjScores[subj].score) || 0;
            perSubject[subj].total += Number(subjScores[subj].total) || 0;
        });
    });

    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    $('stat-accuracy').textContent = totalQuestions > 0 ? overallAccuracy + '%' : '—';
    $('stat-total').textContent = totalQuestions;

    const subjectList = $('subject-list');
    const subjectNames = Object.keys(perSubject);
    if (subjectNames.length === 0) {
        $('empty-subjects').style.display = 'block';
    } else {
        subjectNames
            .sort((a, b) => (perSubject[b].total) - (perSubject[a].total))
            .forEach((subj) => {
                const { correct, total } = perSubject[subj];
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                const row = document.createElement('div');
                row.className = 'subject-row';
                row.innerHTML = `
                    <span style="width:120px;">${subj}</span>
                    <div class="subject-bar-track"><div class="subject-bar-fill" style="width:${pct}%;"></div></div>
                    <span class="subject-pct">${pct}%</span>`;
                subjectList.appendChild(row);
            });
    }

    // ---------- ADVANCED STATS (Premium only) ----------
    let weakestSubject = null;
    let dayStreak = 0;
    let recentTrendLabel = '—';

    if (isPremium) {
        $('advanced-content').style.display = 'block';

        // Weakest subject (needs a reasonable sample so one bad quiz doesn't skew it)
        const meaningfulSubjects = subjectNames.filter((s) => perSubject[s].total >= 10);
        if (meaningfulSubjects.length > 0) {
            weakestSubject = meaningfulSubjects.reduce((worst, s) => {
                const pct = perSubject[s].correct / perSubject[s].total;
                const worstPct = perSubject[worst].correct / perSubject[worst].total;
                return pct < worstPct ? s : worst;
            }, meaningfulSubjects[0]);
        }
        if (weakestSubject) {
            const pct = Math.round((perSubject[weakestSubject].correct / perSubject[weakestSubject].total) * 100);
            $('focus-callout').style.display = 'block';
            $('focus-callout').innerHTML =
                `<i data-lucide="target" style="width:14px; height:14px; vertical-align:-2px; margin-right:4px;"></i>` +
                `Focus area: <b>${weakestSubject}</b> (${pct}% so far). A little extra practice here will help the most.`;
        }

        // Day streak: consecutive calendar days with at least one attempt, ending today or yesterday
        const dayset = new Set(list.map((a) => new Date(a.completed_at).toDateString()));
        let cursor = new Date();
        if (!dayset.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1); // allow "yesterday" to still count
        while (dayset.has(cursor.toDateString())) {
            dayStreak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }
        $('stat-streak').textContent = dayStreak;

        // Recent trend: average of last 5 attempts vs the 5 before that
        if (list.length >= 2) {
            const recent = list.slice(-5);
            const prior = list.slice(-10, -5);
            const avg = (arr) => arr.reduce((sum, a) => sum + (a.percentage || 0), 0) / arr.length;
            const recentAvg = avg(recent);
            if (prior.length > 0) {
                const priorAvg = avg(prior);
                const diff = Math.round(recentAvg - priorAvg);
                recentTrendLabel = diff > 2 ? ('+' + diff + '% ↑') : diff < -2 ? (diff + '% ↓') : 'Steady';
            } else {
                recentTrendLabel = Math.round(recentAvg) + '% avg';
            }
        }
        $('stat-trend').textContent = recentTrendLabel;
    } else {
        $('advanced-locked').style.display = 'block';
    }

    // ---------- BADGES (shown to everyone; some need enough data to unlock) ----------
    const avgSecondsList = list.map((a) => a.avg_seconds_per_question).filter((v) => v != null);
    const avgSeconds = avgSecondsList.length >= 5
        ? avgSecondsList.reduce((a, b) => a + b, 0) / avgSecondsList.length
        : null;

    const championshipWon = await checkChampionshipWin(loggedInStudent.id);

    const badges = [
        {
            icon: 'trophy', name: 'Championship Winner',
            unlocked: championshipWon
        },
        {
            icon: 'flame', name: '7-Day Streak',
            unlocked: isPremium && dayStreak >= 7
        },
        {
            icon: 'book-marked', name: '500 Questions',
            unlocked: totalQuestions >= 500
        },
        {
            icon: 'target', name: '90% Accuracy',
            unlocked: totalQuestions >= 50 && overallAccuracy >= 90
        },
        {
            icon: 'zap', name: 'Fastest Solver',
            unlocked: avgSeconds !== null && avgSeconds <= 15
        }
    ];

    const badgeGrid = $('badge-grid');
    badges.forEach((b) => {
        const card = document.createElement('div');
        card.className = 'badge-card' + (b.unlocked ? ' unlocked' : '');
        card.innerHTML = `<i data-lucide="${b.icon}"></i><div class="badge-name">${b.name}</div>`;
        badgeGrid.appendChild(card);
    });

    renderIcons();
}

// A lightweight check: has this student ever had the top score in a
// championship? (Ties go to whoever submitted first, same rule the
// leaderboard already uses.)
async function checkChampionshipWin(studentId) {
    try {
        const { data: championships } = await supabase
            .from('quizzes')
            .select('id')
            .eq('is_championship', true);

        if (!championships || championships.length === 0) return false;

        for (const champ of championships) {
            const { data: results } = await supabase
                .from('quiz_results')
                .select('student_id, score, submitted_at')
                .eq('quiz_id', champ.id)
                .order('score', { ascending: false })
                .order('submitted_at', { ascending: true })
                .limit(1);

            if (results && results[0] && String(results[0].student_id) === String(studentId)) {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error('Could not check championship wins:', err);
        return false;
    }
}

renderIcons();
loadProgress();
