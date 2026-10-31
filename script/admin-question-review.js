import { supabase } from './supabase.js';

if (sessionStorage.getItem('adminAuthenticated') !== 'true') {
    window.location.href = 'admin-login.html';
}

const view = document.getElementById('view');
function el(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}

function card(q, pending) {
    const c = el('div', 'card');
    const top = el('div', 'review-head');
    top.appendChild(el('div', 'card-name', q.q_subject + ' · ' + q.q_topic));
    top.appendChild(el('span', 'pill ' + (q.q_status === 'approved' ? 'approved' : q.q_status === 'rejected' ? 'rejected' : 'pending'),
        q.q_difficulty));
    c.appendChild(top);
    c.appendChild(el('div', 'card-sub', 'By ' + q.educator_name + ' · ' + new Date(q.q_created_at).toLocaleDateString()));
    c.appendChild(el('div', 'review-comment', q.q_text));

    const opts = el('div', 'quote');
    [['A', q.q_a], ['B', q.q_b], ['C', q.q_c], ['D', q.q_d]].forEach(([letter, text]) => {
        const line = el('div', 'card-sub', letter + ') ' + text + (letter === q.q_answer ? '   (correct)' : ''));
        if (letter === q.q_answer) { line.style.fontWeight = 'bold'; line.style.color = '#166534'; }
        opts.appendChild(line);
    });
    c.appendChild(opts);
    if (q.q_explanation) {
        const ex = el('div', 'review-comment');
        ex.appendChild(el('b', '', 'Explanation: '));
        ex.appendChild(document.createTextNode(q.q_explanation));
        c.appendChild(ex);
    }

    if (pending) {
        const actions = el('div');
        actions.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; margin-top:12px;';

        const approve = el('button', 'btn small primary', 'Approve');
        approve.type = 'button';
        approve.addEventListener('click', async () => {
            approve.disabled = true;
            const { error } = await supabase.rpc('admin_review_question', { p_id: q.submission_id, p_approve: true, p_reason: null });
            if (error) { alert(error.message); approve.disabled = false; return; }
            load();
        });

        const reject = el('button', 'btn small danger', 'Reject');
        reject.type = 'button';
        reject.addEventListener('click', async () => {
            const reason = prompt('Why is this question not approved? (the educator will see this)');
            if (reason === null) return;
            reject.disabled = true;
            const { error } = await supabase.rpc('admin_review_question', { p_id: q.submission_id, p_approve: false, p_reason: reason });
            if (error) { alert(error.message); reject.disabled = false; return; }
            load();
        });

        actions.appendChild(approve);
        actions.appendChild(reject);
        c.appendChild(actions);
    } else if (q.q_status === 'rejected' && q.q_reject_reason) {
        c.appendChild(el('div', 'reject-note', 'Reason: ' + q.q_reject_reason));
    }
    return c;
}

async function load() {
    view.innerHTML = '<p class="hint">Loading...</p>';
    const { data, error } = await supabase.rpc('admin_list_question_submissions');
    view.innerHTML = '';

    if (error) {
        view.appendChild(el('p', 'hint', (error.message || '').includes('Admins only')
            ? 'This screen only works while you are logged in to your own (admin) student account. Log in with it, then open this page again.'
            : 'Could not load questions right now. Please try again.'));
        return;
    }
    const pending = (data || []).filter((q) => q.q_status === 'pending');
    const done = (data || []).filter((q) => q.q_status !== 'pending');

    view.appendChild(el('div', 'section-title', 'Waiting for review (' + pending.length + ')'));
    if (!pending.length) view.appendChild(el('p', 'hint', 'Nothing waiting. All caught up.'));
    pending.forEach((q) => view.appendChild(card(q, true)));

    if (done.length) {
        view.appendChild(el('div', 'section-title', 'Recently reviewed'));
        done.slice(0, 30).forEach((q) => view.appendChild(card(q, false)));
    }
}
load();
