import { supabase } from './supabase.js';

if (sessionStorage.getItem('adminAuthenticated') !== 'true') {
    window.location.href = 'admin-login.html';
}

const SUBJECTS = ['Use of English', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'Agricultural Science', 'Economics', 'Accounting', 'Commerce', 'Government',
    'Literature in English', 'History', 'CRS', 'Geography'];
const MAX_ROWS = 500;
const BATCH = 50;

const $ = (id) => document.getElementById(id);
function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}

const subjectSelect = $('subject');
SUBJECTS.forEach((s) => { const o = el('option', '', s); o.value = s; subjectSelect.appendChild(o); });

$('template-link').href = URL.createObjectURL(new Blob([
    'Question,A,B,C,D,Answer,Explanation\n' +
    '"Which of these is a noun?","Run","Happy","Table","Quickly","C","A noun names a thing."\n'
], { type: 'text/csv' }));

// Reads pasted spreadsheet cells (tab-separated). Handles quoted cells and line breaks inside cells.
export function parseTable(text, delim = '\t') {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    const endRow = () => { row.push(cell); cell = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
            else cell += ch;
        } else if (ch === '"' && cell === '') inQuotes = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
        else cell += ch;
    }
    if (cell !== '' || row.length) endRow();
    return rows;
}

export function validateRow(cells) {
    if (cells.length < 6) return { error: 'Only ' + cells.length + ' column(s) found. Each row needs 6: Question, A, B, C, D, Answer' };
    const [q, a, b, c, d, ans, expl] = cells.map((x) => (x || '').trim());
    if (q.length < 10) return { error: 'The question is too short' };
    if (q.length > 1000) return { error: 'The question is too long (over 1000 characters)' };
    const opts = [a, b, c, d];
    const emptyAt = opts.findIndex((o) => o === '');
    if (emptyAt !== -1) return { error: 'Option ' + 'ABCD'[emptyAt] + ' is empty' };
    if (opts.some((o) => o.length > 300)) return { error: 'An option is too long (over 300 characters)' };
    if (new Set(opts.map((o) => o.toLowerCase())).size < 4) return { error: 'Two options are the same' };
    let letter = ans.toUpperCase().replace(/^(OPTION|ANSWER)[:\s]*/, '').replace(/[.)\s]/g, '');
    if (!/^[A-D]$/.test(letter)) {
        const at = opts.findIndex((o) => o.toLowerCase() === ans.toLowerCase());   // answer written as the option's words
        if (at === -1) return { error: 'The answer is "' + ans.slice(0, 30) + '" but it must be the letter A, B, C or D' };
        letter = 'ABCD'[at];
    }
    if ((expl || '').length > 1000) return { error: 'The explanation is too long (over 1000 characters)' };
    return { q, a, b, c, d, letter, explanation: expl || '' };
}

const norm = (t) => String(t).toLowerCase().replace(/\s+/g, ' ').trim();

async function existingQuestions(subject) {
    const seen = new Set();
    for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase.from('questions').select('question_text')
            .eq('subject', subject).range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((r) => seen.add(norm(r.question_text)));
        if (!data || data.length < 1000) break;
    }
    return seen;
}

let ready = [];
let readySubject = '';

$('check-button').addEventListener('click', async () => {
    const msg = $('check-message');
    msg.className = 'msg error';
    msg.textContent = '';
    $('preview').style.display = 'none';

    const raw = $('paste-box').value;
    const firstLine = raw.split(/\r?\n/).find((l) => l.trim() !== '') || '';
    const delim = firstLine.includes('\t') ? '\t' : (firstLine.includes(',') ? ',' : '\t');
    let rows = parseTable(raw, delim);
    let offset = 0;
    if (rows.length && ((rows[0][5] || '').trim().toLowerCase() === 'answer' ||
                        (rows[0][0] || '').trim().toLowerCase() === 'question')) {
        rows = rows.slice(1);
        offset = 1;
    }
    if (rows.length === 0) { msg.textContent = 'Paste your questions in the box first.'; return; }
    if (rows.length > MAX_ROWS) { msg.textContent = 'That is ' + rows.length + ' questions. Please import up to ' + MAX_ROWS + ' at a time.'; return; }

    const btn = $('check-button');
    btn.disabled = true;
    msg.className = 'msg';
    msg.textContent = 'Checking...';

    try {
        readySubject = subjectSelect.value;
        const seen = await existingQuestions(readySubject);
        const problems = [];
        let dupes = 0;
        ready = [];

        rows.forEach((cells, i) => {
            const rowNo = i + 1 + offset;
            const res = validateRow(cells);
            if (res.error) { problems.push({ rowNo, text: res.error }); return; }
            const key = norm(res.q);
            if (seen.has(key)) { dupes++; return; }
            seen.add(key);
            ready.push(res);
        });

        $('counts').innerHTML = '';
        $('counts').appendChild(el('span', 'pill approved', ready.length + ' ready'));
        $('counts').appendChild(el('span', 'pill pending', dupes + ' already in the bank (skipped)'));
        $('counts').appendChild(el('span', 'pill rejected', problems.length + ' with problems'));

        const pb = $('problem-box');
        pb.innerHTML = '';
        if (problems.length) {
            pb.appendChild(el('div', 'card-name', 'Fix these rows in your spreadsheet'));
            problems.slice(0, 20).forEach((p) => pb.appendChild(el('div', 'reject-note', 'Row ' + p.rowNo + ': ' + p.text)));
            if (problems.length > 20) pb.appendChild(el('div', 'card-sub', '...and ' + (problems.length - 20) + ' more.'));
        }

        const sb = $('sample-box');
        sb.innerHTML = '';
        if (ready.length) {
            sb.appendChild(el('div', 'card-name', 'A look at the first ready questions'));
            ready.slice(0, 3).forEach((r) => {
                const q = el('div', 'quote');
                q.appendChild(el('b', '', r.q));
                q.appendChild(el('div', 'card-sub', 'A) ' + r.a + '   B) ' + r.b + '   C) ' + r.c + '   D) ' + r.d + '   Answer: ' + r.letter));
                sb.appendChild(q);
            });
        }

        $('import-button').disabled = ready.length === 0;
        $('import-button').textContent = 'Import ' + ready.length + ' questions into ' + readySubject;
        $('import-message').textContent = '';
        $('preview').style.display = 'block';
        msg.textContent = '';
    } catch (err) {
        console.error(err);
        msg.className = 'msg error';
        msg.textContent = 'Could not check right now. Please try again.';
    }
    btn.disabled = false;
});

$('import-button').addEventListener('click', async () => {
    const btn = $('import-button');
    const msg = $('import-message');
    btn.disabled = true;
    msg.className = 'msg';
    let includeExplanation = true;
    let done = 0;

    for (let i = 0; i < ready.length; i += BATCH) {
        const batch = ready.slice(i, i + BATCH);
        const build = () => batch.map((r) => {
            const row = {
                quiz_id: 2, subject: readySubject, question_text: r.q,
                option_a: r.a, option_b: r.b, option_c: r.c, option_d: r.d,
                'correct-answer': r.letter
            };
            if (includeExplanation) row.explanation = r.explanation;
            return row;
        });

        let { error } = await supabase.from('questions').insert(build());
        if (error && includeExplanation && /explanation/i.test(error.message || '')) {
            includeExplanation = false;           // this table has no explanation column
            ({ error } = await supabase.from('questions').insert(build()));
        }
        if (error) {
            console.error(error);
            msg.className = 'msg error';
            msg.textContent = 'Stopped after ' + done + ' questions: ' + (error.message || 'a problem happened') +
                '. Press Check questions again to continue. Ones already saved are skipped.';
            btn.disabled = false;
            return;
        }
        done += batch.length;
        msg.textContent = 'Importing... ' + done + ' of ' + ready.length;
    }

    msg.className = 'msg ok';
    msg.textContent = 'Done! ' + done + ' questions were added to ' + readySubject + '.';
    $('paste-box').value = '';
    ready = [];
});
