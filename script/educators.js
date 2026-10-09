import { supabase } from './supabase.js';

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) window.location.href = 'login.html';

function isActivePremium(student) {
    if (!student || student.plan !== 'premium') return false;
    if (!student.planExpiresAt) return true;
    return new Date(student.planExpiresAt) > new Date();
}

const view = document.getElementById('view');
const pageTitle = document.getElementById('page-title');
const backLink = document.getElementById('back-link');
const educatorId = new URLSearchParams(window.location.search).get('id');

function icons() { if (window.lucide) lucide.createIcons(); }

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// A star drawn inline (so it never depends on icons loading in time).
const STAR_POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';
function starSvg(filled) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', filled ? '#f59e0b' : 'none');
    svg.setAttribute('stroke', filled ? '#f59e0b' : '#cbd5e1');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linejoin', 'round');
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', STAR_POINTS);
    svg.appendChild(poly);
    return svg;
}
function starsRow(rating) {
    const wrap = el('span', 'stars');
    for (let i = 1; i <= 5; i++) wrap.appendChild(starSvg(i <= Math.round(rating)));
    return wrap;
}
function ratingLine(avg, count) {
    const line = el('div', 'rating-line');
    if (!count) {
        line.textContent = 'No reviews yet';
        return line;
    }
    line.appendChild(starsRow(avg));
    line.appendChild(el('span', '', Number(avg).toFixed(1) + ' (' + count + (count === 1 ? ' review)' : ' reviews)')));
    return line;
}

function showLocked() {
    view.innerHTML = '';
    const box = el('div', 'locked');
    box.appendChild(el('p', '', 'Educator reviews are a Premium feature.'));
    const link = el('a', 'btn primary', 'Upgrade to unlock');
    link.href = 'upgrade.html';
    box.appendChild(link);
    view.appendChild(box);
}

function friendly(error) {
    const msg = (error && error.message) || '';
    if (msg.toLowerCase().includes('premium')) return msg;
    return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------
// LIST OF EDUCATORS
// ---------------------------------------------------------------
async function showList() {
    pageTitle.textContent = 'Educators';
    backLink.href = 'dashboard.html';

    const { data, error } = await supabase.rpc('list_educators_for_premium');
    view.innerHTML = '';

    if (error) {
        view.appendChild(el('p', 'hint', friendly(error)));
        return;
    }
    if (!data || data.length === 0) {
        view.appendChild(el('p', 'hint', 'No educators have joined yet.'));
        return;
    }

    data.forEach((e) => {
        const card = el('a', 'card');
        card.href = 'educators.html?id=' + encodeURIComponent(e.educator_id);
        card.appendChild(el('div', 'card-name', e.educator_name));
        if (e.educator_subjects) card.appendChild(el('div', 'card-sub', e.educator_subjects));
        card.appendChild(ratingLine(e.avg_rating, Number(e.review_count)));
        view.appendChild(card);
    });
}

// ---------------------------------------------------------------
// ONE EDUCATOR: details, your review, everyone's reviews
// ---------------------------------------------------------------
async function showEducator(id) {
    backLink.href = 'educators.html';

    const [listRes, reviewsRes] = await Promise.all([
        supabase.rpc('list_educators_for_premium'),
        supabase.rpc('get_educator_reviews', { p_educator_id: id })
    ]);

    view.innerHTML = '';

    if (listRes.error || reviewsRes.error) {
        view.appendChild(el('p', 'hint', friendly(listRes.error || reviewsRes.error)));
        return;
    }

    const educator = (listRes.data || []).find((e) => String(e.educator_id) === String(id));
    if (!educator) {
        view.appendChild(el('p', 'hint', 'This educator could not be found.'));
        return;
    }
    pageTitle.textContent = educator.educator_name;

    const reviews = reviewsRes.data || [];
    const mine = reviews.find((r) => String(r.author_id) === String(loggedInStudent.id));

    // ----- header card -----
    const head = el('div', 'card');
    head.appendChild(el('div', 'card-name', educator.educator_name));
    if (educator.educator_subjects) head.appendChild(el('div', 'card-sub', educator.educator_subjects));
    if (educator.educator_bio) head.appendChild(el('div', 'card-bio', educator.educator_bio));
    head.appendChild(ratingLine(educator.avg_rating, Number(educator.review_count)));
    view.appendChild(head);

    // ----- your review -----
    view.appendChild(el('div', 'section-title', mine ? 'Your review' : 'Leave a review'));
    const form = el('div', 'card');

    let chosen = mine ? mine.rating : 0;
    const starInput = el('div', 'star-input');
    function drawStarInput() {
        starInput.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const b = el('button');
            b.type = 'button';
            b.setAttribute('aria-label', i + ' star' + (i > 1 ? 's' : ''));
            b.appendChild(starSvg(i <= chosen));
            b.addEventListener('click', () => { chosen = i; drawStarInput(); });
            starInput.appendChild(b);
        }
    }
    drawStarInput();
    form.appendChild(starInput);

    const textarea = el('textarea', 'review-text');
    textarea.maxLength = 500;
    textarea.placeholder = 'Share how this educator helped you (optional)';
    textarea.value = mine && mine.comment ? mine.comment : '';
    form.appendChild(textarea);

    const submitBtn = el('button', 'btn primary', mine ? 'Update review' : 'Submit review');
    submitBtn.type = 'button';
    submitBtn.style.marginTop = '12px';
    const formMsg = el('div', 'msg');

    submitBtn.addEventListener('click', async () => {
        if (!chosen) {
            formMsg.className = 'msg error';
            formMsg.textContent = 'Please pick a star rating first.';
            return;
        }
        submitBtn.disabled = true;
        formMsg.textContent = '';
        const { error } = await supabase.rpc('submit_review', {
            p_educator_id: id, p_rating: chosen, p_comment: textarea.value
        });
        if (error) {
            formMsg.className = 'msg error';
            formMsg.textContent = friendly(error);
            submitBtn.disabled = false;
            return;
        }
        showEducator(id);
    });

    form.appendChild(submitBtn);
    form.appendChild(formMsg);
    view.appendChild(form);

    // ----- everyone's reviews -----
    view.appendChild(el('div', 'section-title', 'Reviews (' + reviews.length + ')'));
    if (reviews.length === 0) {
        view.appendChild(el('p', 'hint', 'No reviews yet. Be the first!'));
    }

    reviews.forEach((r) => {
        const isMine = String(r.author_id) === String(loggedInStudent.id);
        const card = el('div', 'card');

        const top = el('div', 'review-head');
        top.appendChild(el('div', 'card-name', isMine ? r.author_name + ' (you)' : r.author_name));
        top.appendChild(starsRow(r.rating));
        card.appendChild(top);

        card.appendChild(el('div', 'review-meta', new Date(r.created_at).toLocaleDateString()));
        if (r.comment) card.appendChild(el('div', 'review-comment', r.comment));

        if (!isMine) {
            const reportBtn = el('button', 'report-link', 'Report this review');
            reportBtn.type = 'button';
            const box = el('div', 'report-box');
            const reason = el('input', 'report-reason');
            reason.type = 'text';
            reason.maxLength = 300;
            reason.placeholder = 'Why are you reporting it?';
            const send = el('button', 'btn small danger', 'Send report');
            send.type = 'button';
            const cancel = el('button', 'btn small', 'Cancel');
            cancel.type = 'button';
            const note = el('div', 'msg');

            reportBtn.addEventListener('click', () => { box.classList.add('open'); reportBtn.style.display = 'none'; reason.focus(); });
            cancel.addEventListener('click', () => { box.classList.remove('open'); reportBtn.style.display = ''; });
            send.addEventListener('click', async () => {
                if (reason.value.trim().length < 3) {
                    note.className = 'msg error';
                    note.textContent = 'Please say briefly why (at least a few letters).';
                    return;
                }
                send.disabled = true;
                const { error } = await supabase.rpc('report_review', { p_review_id: r.review_id, p_reason: reason.value });
                if (error) {
                    note.className = 'msg error';
                    note.textContent = friendly(error);
                    send.disabled = false;
                    return;
                }
                box.remove();
                note.className = 'msg ok';
                note.textContent = 'Thanks, your report was sent to the admin.';
            });

            box.appendChild(reason);
            box.appendChild(send);
            box.appendChild(cancel);
            card.appendChild(reportBtn);
            card.appendChild(box);
            card.appendChild(note);
        }

        view.appendChild(card);
    });
    icons();
}

// ---------------------------------------------------------------
if (!isActivePremium(loggedInStudent)) {
    showLocked();
} else if (educatorId) {
    showEducator(educatorId);
} else {
    showList();
}
