import { supabase } from './supabase.js';

if (sessionStorage.getItem('adminAuthenticated') !== 'true') {
    window.location.href = 'admin-login.html';
}

const view = document.getElementById('view');

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starsRow(rating) {
    const ns = 'http://www.w3.org/2000/svg';
    const wrap = el('span', 'stars');
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating;
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', filled ? '#f59e0b' : 'none');
        svg.setAttribute('stroke', filled ? '#f59e0b' : '#cbd5e1');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linejoin', 'round');
        const poly = document.createElementNS(ns, 'polygon');
        poly.setAttribute('points', STAR_POINTS);
        svg.appendChild(poly);
        wrap.appendChild(svg);
    }
    return wrap;
}

async function loadReports() {
    view.innerHTML = '<p class="hint">Loading...</p>';
    const { data, error } = await supabase.rpc('admin_list_reports');
    view.innerHTML = '';

    if (error) {
        const msg = (error.message || '').includes('Admins only')
            ? 'This screen only works while you are logged in to your own (admin) student account. Log in with it, then open this page again.'
            : 'Could not load reports right now. Please try again.';
        view.appendChild(el('p', 'hint', msg));
        return;
    }

    if (!data || data.length === 0) {
        view.appendChild(el('p', 'hint', 'No open reports. Everything is clear.'));
        return;
    }

    data.forEach((r) => {
        const card = el('div', 'card');

        const top = el('div', 'review-head');
        top.appendChild(el('div', 'card-name', 'Review of ' + r.educator_name));
        if (Number(r.open_reports) > 1) top.appendChild(el('span', 'badge-count', r.open_reports + ' reports'));
        card.appendChild(top);

        const author = el('div', 'review-meta', 'Written by ' + r.review_author);
        card.appendChild(author);

        const reviewBox = el('div', 'quote');
        reviewBox.appendChild(starsRow(r.review_rating));
        reviewBox.appendChild(el('div', 'review-comment', r.review_comment || '(no written comment)'));
        card.appendChild(reviewBox);

        const reasonLine = el('div', 'review-comment');
        const label = el('b', '', 'Reason given: ');
        reasonLine.appendChild(label);
        reasonLine.appendChild(document.createTextNode(r.reason));
        card.appendChild(reasonLine);
        card.appendChild(el('div', 'review-meta', 'Reported ' + new Date(r.reported_at).toLocaleString()));

        const actions = el('div');
        actions.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;';

        const dismiss = el('button', 'btn small', 'Dismiss report');
        dismiss.type = 'button';
        dismiss.addEventListener('click', async () => {
            dismiss.disabled = true;
            const { error: err } = await supabase.rpc('admin_dismiss_report', { p_report_id: r.report_id });
            if (err) { alert('Could not dismiss: ' + err.message); dismiss.disabled = false; return; }
            loadReports();
        });

        const remove = el('button', 'btn small danger', 'Remove review');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
            if (!confirm('Remove this review permanently? All reports about it will be cleared too.')) return;
            remove.disabled = true;
            const { error: err } = await supabase.rpc('admin_remove_review', { p_review_id: r.reported_review_id });
            if (err) { alert('Could not remove: ' + err.message); remove.disabled = false; return; }
            loadReports();
        });

        actions.appendChild(dismiss);
        actions.appendChild(remove);
        card.appendChild(actions);
        view.appendChild(card);
    });
}

loadReports();
