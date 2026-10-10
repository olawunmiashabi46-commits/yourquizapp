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
function icons() { if (window.lucide) lucide.createIcons(); }

function lessonCard(l, isPending) {
    const card = el('div', 'card');
    const row = el('div', 'lesson-row');

    const thumb = el('img', 'lesson-thumb');
    thumb.src = 'https://img.youtube.com/vi/' + encodeURIComponent(l.lesson_youtube_id) + '/mqdefault.jpg';
    thumb.alt = '';
    row.appendChild(thumb);

    const info = el('div', 'lesson-info');
    info.appendChild(el('div', 'card-name', l.lesson_title));
    info.appendChild(el('div', 'card-sub', l.lesson_subject + ' · ' + l.lesson_topic));
    info.appendChild(el('div', 'card-sub', 'By ' + l.educator_name));
    row.appendChild(info);
    card.appendChild(row);

    if (l.lesson_description) card.appendChild(el('div', 'card-bio', l.lesson_description));

    const watch = el('a', 'btn small', 'Watch on YouTube');
    watch.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(l.lesson_youtube_id);
    watch.target = '_blank';
    watch.rel = 'noopener noreferrer';
    watch.style.marginTop = '10px';

    const actions = el('div');
    actions.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;';
    actions.appendChild(watch);

    if (isPending) {
        const approve = el('button', 'btn small primary', 'Approve');
        approve.type = 'button';
        approve.addEventListener('click', async () => {
            approve.disabled = true;
            const { error } = await supabase.rpc('admin_review_lesson',
                { p_lesson_id: l.lesson_id, p_approve: true, p_reason: null });
            if (error) { alert('Could not approve: ' + error.message); approve.disabled = false; return; }
            load();
        });

        const reject = el('button', 'btn small danger', 'Reject');
        reject.type = 'button';
        reject.addEventListener('click', async () => {
            const reason = prompt('Why is this lesson being rejected? (the educator will see this)');
            if (reason === null) return;
            reject.disabled = true;
            const { error } = await supabase.rpc('admin_review_lesson',
                { p_lesson_id: l.lesson_id, p_approve: false, p_reason: reason });
            if (error) { alert('Could not reject: ' + error.message); reject.disabled = false; return; }
            load();
        });
        actions.appendChild(approve);
        actions.appendChild(reject);
    } else {
        const remove = el('button', 'btn small danger', 'Remove');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
            if (!confirm('Remove this live lesson permanently?')) return;
            remove.disabled = true;
            const { error } = await supabase.rpc('admin_delete_lesson', { p_lesson_id: l.lesson_id });
            if (error) { alert('Could not remove: ' + error.message); remove.disabled = false; return; }
            load();
        });
        actions.appendChild(remove);
    }
    card.appendChild(actions);
    return card;
}

async function load() {
    view.innerHTML = '<p class="hint">Loading...</p>';
    const { data, error } = await supabase.rpc('admin_list_lessons');
    view.innerHTML = '';

    if (error) {
        const msg = (error.message || '').includes('Admins only')
            ? 'This screen only works while you are logged in to your own (admin) student account. Log in with it, then open this page again.'
            : 'Could not load lessons right now. Please try again.';
        view.appendChild(el('p', 'hint', msg));
        return;
    }

    const pending = (data || []).filter((l) => l.lesson_status === 'pending');
    const approved = (data || []).filter((l) => l.lesson_status === 'approved');

    view.appendChild(el('div', 'section-title', 'Waiting for approval (' + pending.length + ')'));
    if (pending.length === 0) view.appendChild(el('p', 'hint', 'Nothing waiting. All caught up.'));
    pending.forEach((l) => view.appendChild(lessonCard(l, true)));

    view.appendChild(el('div', 'section-title', 'Live lessons (' + approved.length + ')'));
    if (approved.length === 0) view.appendChild(el('p', 'hint', 'No live lessons yet.'));
    approved.forEach((l) => view.appendChild(lessonCard(l, false)));
    icons();
}

load();
