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

function lessonCard(l, state) {
    const card = el('div', 'card');
    const row = el('div', 'lesson-row');

    const thumbId = l.lesson_youtube_id || l.lesson_source_video_id;
    if (thumbId) {
        const thumb = el('img', 'lesson-thumb');
        thumb.src = 'https://img.youtube.com/vi/' + encodeURIComponent(thumbId) + '/mqdefault.jpg';
        thumb.loading = 'lazy';
        thumb.decoding = 'async';
        thumb.alt = '';
        row.appendChild(thumb);
    } else {
        row.appendChild(el('div', 'lesson-thumb'));   // grey box until a video is attached
    }

    const info = el('div', 'lesson-info');
    info.appendChild(el('div', 'card-name', l.lesson_title));
    info.appendChild(el('div', 'card-sub', l.lesson_subject + ' · ' + l.lesson_topic));
    info.appendChild(el('div', 'card-sub', 'By ' + l.educator_name));
    row.appendChild(info);
    card.appendChild(row);

    if (l.lesson_description) card.appendChild(el('div', 'card-bio', l.lesson_description));

    // Upload the video to the JAMB QUIZ APP channel, then paste YOUR channel's link here.
    // Students only ever watch your channel's copy, never the educator's original.
    let linkInput = null;
    if (state !== 'approved') {
        linkInput = el('input', 'report-reason');
        linkInput.type = 'url';
        linkInput.placeholder = l.lesson_youtube_id
            ? 'A channel link is already attached. Paste a new one only to replace it.'
            : 'After uploading to JAMB QUIZ APP, paste your channel link here';
        linkInput.style.marginTop = '10px';
        card.appendChild(linkInput);
    }

    // Buttons sit in equal-width columns, all the same height and lined up.
    const actions = el('div');
    actions.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; margin-top:12px;';

    if (l.lesson_source_video_id && !l.lesson_youtube_id) {
        const own = el('a', 'btn small', "Open educator's video");
        own.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(l.lesson_source_video_id);
        own.target = '_blank';
        own.rel = 'noopener noreferrer';
        actions.appendChild(own);
    }
    if (l.lesson_youtube_id) {
        const watch = el('a', 'btn small', 'Watch on YouTube');
        watch.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(l.lesson_youtube_id);
        watch.target = '_blank';
        watch.rel = 'noopener noreferrer';
        actions.appendChild(watch);
    }

    function approveButton() {
        const b = el('button', 'btn small primary', 'Approve');
        b.type = 'button';
        b.addEventListener('click', async () => {
            const pasted = linkInput ? linkInput.value.trim() : '';
            if (!pasted && !l.lesson_youtube_id) {
                alert('Upload the video to the channel first, then paste its YouTube link in the box before approving.');
                if (linkInput) linkInput.focus();
                return;
            }
            b.disabled = true;

            if (pasted) {
                const { error: linkError } = await supabase.rpc('admin_set_lesson_video',
                    { p_lesson_id: l.lesson_id, p_youtube_url: pasted });
                if (linkError) { alert('Could not attach the video: ' + linkError.message); b.disabled = false; return; }
            }

            const { error } = await supabase.rpc('admin_review_lesson',
                { p_lesson_id: l.lesson_id, p_approve: true, p_reason: null });
            if (error) { alert('Could not approve: ' + error.message); b.disabled = false; return; }
            load();
        });
        return b;
    }

    function rejectButton(label) {
        const b = el('button', 'btn small danger', label);
        b.type = 'button';
        b.addEventListener('click', async () => {
            const reason = prompt('Why is this lesson not being approved? (the educator will see this)');
            if (reason === null) return;
            b.disabled = true;
            const { error } = await supabase.rpc('admin_review_lesson',
                { p_lesson_id: l.lesson_id, p_approve: false, p_reason: reason });
            if (error) { alert('Could not update: ' + error.message); b.disabled = false; return; }
            load();
        });
        return b;
    }

    function removeButton() {
        const b = el('button', 'btn small danger', 'Remove');
        b.type = 'button';
        b.addEventListener('click', async () => {
            if (!confirm('Remove this lesson permanently? This cannot be undone.')) return;
            b.disabled = true;
            const { error } = await supabase.rpc('admin_delete_lesson', { p_lesson_id: l.lesson_id });
            if (error) { alert('Could not remove: ' + error.message); b.disabled = false; return; }
            load();
        });
        return b;
    }

    if (state === 'pending') {
        actions.appendChild(approveButton());
        actions.appendChild(rejectButton('Reject'));
    } else if (state === 'approved') {
        actions.appendChild(rejectButton('Disapprove'));
        actions.appendChild(removeButton());
    } else {
        actions.appendChild(approveButton());
        actions.appendChild(removeButton());
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
    const rejected = (data || []).filter((l) => l.lesson_status === 'rejected');

    view.appendChild(el('div', 'section-title', 'Inbox: waiting for you (' + pending.length + ')'));
    if (pending.length === 0) view.appendChild(el('p', 'hint', 'Nothing waiting. All caught up.'));
    pending.forEach((l) => view.appendChild(lessonCard(l, 'pending')));

    view.appendChild(el('div', 'section-title', 'Live lessons (' + approved.length + ')'));
    if (approved.length === 0) view.appendChild(el('p', 'hint', 'No live lessons yet.'));
    approved.forEach((l) => view.appendChild(lessonCard(l, 'approved')));

    if (rejected.length > 0) {
        view.appendChild(el('div', 'section-title', 'Not approved (' + rejected.length + ')'));
        rejected.forEach((l) => view.appendChild(lessonCard(l, 'rejected')));
    }
    icons();
}

load();
