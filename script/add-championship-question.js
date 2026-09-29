import { supabase } from './supabase.js';

const adminAuthenticated = sessionStorage.getItem('adminAuthenticated');
if (adminAuthenticated !== 'true') {
    window.location.href = 'admin-login.html';
}

const quizId = sessionStorage.getItem('adminChampionshipId');
if (!quizId) {
    window.location.href = 'admin-championship.html';
}

const champLabel = document.getElementById('champLabel');
const subjectSelect = document.getElementById('subject');
const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('question');
const optionAInput = document.getElementById('optionA');
const optionBInput = document.getElementById('optionB');
const optionCInput = document.getElementById('optionC');
const optionDInput = document.getElementById('optionD');
const correctAnswerInput = document.getElementById('correctAnswer');
const explanationInput = document.getElementById('explanation');
const questionMessage = document.getElementById('questionMessage');
const uploadButton = document.getElementById('uploadQuestion');
const questionList = document.getElementById('question-list');

async function loadChampionshipInfo() {
    const { data } = await supabase.from('quizzes').select('title').eq('id', quizId).maybeSingle();
    if (data) champLabel.textContent = data.title;
}

async function loadExistingQuestions() {
    const { data, error } = await supabase
        .from('championship_questions')
        .select('id, subject, question_text, order_index')
        .eq('quiz_id', quizId)
        .order('subject', { ascending: true })
        .order('order_index', { ascending: true });

    if (error || !data) return;

    const counts = {};
    data.forEach(row => { counts[row.subject] = (counts[row.subject] || 0) + 1; });
    const summary = Object.entries(counts).map(([subj, n]) => `${subj}: ${n}`).join(' &middot; ');

    questionList.innerHTML = `<p style="font-size:13px; color:#64748b; margin-bottom:8px;">${data.length} question(s) so far — ${summary}</p>`;
    data.forEach(function (row, i) {
        const div = document.createElement('div');
        div.className = 'question-row';
        div.innerHTML = `<span><b>${row.subject}</b> — ${row.question_text.slice(0, 60)}${row.question_text.length > 60 ? '…' : ''}</span>
            <button data-id="${row.id}">Delete</button>`;
        questionList.appendChild(div);
    });

    questionList.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this question?')) return;
            await supabase.from('championship_questions').delete().eq('id', btn.dataset.id);
            loadExistingQuestions();
        });
    });
}

questionForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();
    const optionA = optionAInput.value.trim();
    const optionB = optionBInput.value.trim();
    const optionC = optionCInput.value.trim();
    const optionD = optionDInput.value.trim();
    const correctAnswer = correctAnswerInput.value;
    const explanation = explanationInput.value.trim();

    const subject = subjectSelect.value;

    if (!subject || !question || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
        questionMessage.textContent = 'Please fill in all required fields.';
        questionMessage.style.color = '#dc2626';
        return;
    }

    uploadButton.disabled = true;
    uploadButton.style.opacity = '0.7';
    uploadButton.innerHTML = 'Uploading...';
    questionMessage.textContent = '';

    try {
        const { count } = await supabase
            .from('championship_questions')
            .select('id', { count: 'exact', head: true })
            .eq('quiz_id', quizId)
            .eq('subject', subject);

        const { error } = await supabase.from('championship_questions').insert([{
            quiz_id: quizId,
            subject: subject,
            order_index: count || 0,
            question_text: question,
            option_a: optionA,
            option_b: optionB,
            option_c: optionC,
            option_d: optionD,
            'correct-answer': correctAnswer,
            explanation: explanation
        }]);

        if (error) throw error;

        questionMessage.textContent = 'Question uploaded successfully.';
        questionMessage.style.color = '#16a34a';
        questionForm.reset();
        loadExistingQuestions();
    } catch (error) {
        console.error('Championship question upload error:', error);
        questionMessage.textContent = error.message || 'Unable to upload question. Please try again.';
        questionMessage.style.color = '#dc2626';
    } finally {
        uploadButton.disabled = false;
        uploadButton.style.opacity = '1';
        uploadButton.innerHTML = '<i data-lucide="upload"></i> Upload Question';
        if (window.lucide) lucide.createIcons();
    }
});

loadChampionshipInfo();
loadExistingQuestions();
