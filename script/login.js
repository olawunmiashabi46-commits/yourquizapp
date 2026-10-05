// LOGIN (Supabase Auth) - students and educators, plus one-time upgrade for old accounts
import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);
const identifierInput = $('username');
const passwordInput = $('password');
const loginButton = $('login-button');
const errorMessage = $('error-message');
const upgradePanel = $('upgrade-panel');
const upgradeButton = $('upgrade-button');

const LOGIN_FIELD_IDS = ['username', 'password'];
const UPGRADE_FIELD_IDS = ['upgrade-email', 'upgrade-phone'];

function clearAllFieldErrors(ids) {
    ids.forEach((id) => {
        const errEl = $(id + '-error');
        const inputEl = $(id);
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
        if (inputEl) inputEl.classList.remove('has-error');
    });
}

// Only for things like "please fill this in" — never for "wrong credentials",
// which stays a general message on purpose (not hinting which part is wrong).
function fieldFail(fieldId, msg) {
    clearAllFieldErrors(LOGIN_FIELD_IDS);
    clearAllFieldErrors(UPGRADE_FIELD_IDS);
    errorMessage.textContent = '';
    const errEl = $(fieldId + '-error');
    const inputEl = $(fieldId);
    if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
    if (inputEl) { inputEl.classList.add('has-error'); inputEl.focus(); }
    resetLoginButton();
}

let pendingLegacy = null; // { username, password }

// Old versions saved plain-text passwords on the device - remove them
localStorage.removeItem('studentAccounts');

function resetLoginButton() {
    loginButton.disabled = false;
    loginButton.textContent = 'Login';
}
function fail(msg) {
    clearAllFieldErrors(LOGIN_FIELD_IDS);
    clearAllFieldErrors(UPGRADE_FIELD_IDS);
    errorMessage.textContent = msg;
    resetLoginButton();
}

// Already signed in? Go straight in. Old-style sessions (no real login) are cleared.
(async function autoLogin() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        if (localStorage.getItem('loggedInStudent')) return (window.location.href = 'dashboard.html');
        if (localStorage.getItem('loggedInEducator')) return (window.location.href = 'educator-dashboard.html');
        try { await finishLogin(); } catch (e) { console.error(e); }
    } else {
        localStorage.removeItem('loggedInStudent');
        localStorage.removeItem('loggedInEducator');
    }
})();

function setupPasswordToggle(inputId, buttonId) {
    const input = $(inputId), btn = $(buttonId);
    if (!input || !btn) return;
    btn.addEventListener('click', () => {
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.textContent = hidden ? '🙈' : '👁️';
    });
}
setupPasswordToggle('password', 'toggle-password');

// After a successful sign-in: find the profile, save session info, redirect
async function finishLogin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No session');

    const { data: student } = await supabase.from('students').select('*').eq('auth_id', user.id).maybeSingle();
    if (student) {
        localStorage.setItem('loggedInStudent', JSON.stringify({
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            category: student.category || '',
            email: student.email || '',
            plan: student.plan || 'free',
            planExpiresAt: student.plan_expires_at || null
        }));
        localStorage.removeItem('loggedInEducator');
        window.location.href = 'dashboard.html';
        return;
    }

    const { data: educator } = await supabase.from('educators').select('*').eq('auth_id', user.id).maybeSingle();
    if (educator) {
        localStorage.setItem('loggedInEducator', JSON.stringify({
            id: educator.id,
            name: educator.full_name,
            email: educator.email,
            plan: educator.plan || 'free',
            planExpiresAt: educator.plan_expires_at || null
        }));
        localStorage.removeItem('loggedInStudent');
        window.location.href = 'educator-dashboard.html';
        return;
    }

    await supabase.auth.signOut();
    throw new Error('No profile found for this account.');
}

loginButton.addEventListener('click', async () => {
    const identifier = identifierInput.value.trim();
    const password = passwordInput.value;
    errorMessage.textContent = '';

    if (!identifier) return fieldFail('username', 'Please enter your username or email.');
    if (!password) return fieldFail('password', 'Please enter your password.');

    loginButton.disabled = true;
    loginButton.textContent = '⏳ Logging in...';

    try {
        let email = identifier.toLowerCase();

        if (!identifier.includes('@')) {
            // Old account that has not been upgraded yet?
            const { data: isLegacy, error: legacyErr } = await supabase.rpc('legacy_check', {
                p_username: identifier, p_password: password
            });
            if (legacyErr) throw legacyErr;
            if (isLegacy) {
                pendingLegacy = { username: identifier, password };
                upgradePanel.style.display = 'block';
                loginButton.style.display = 'none';
                errorMessage.textContent = '';
                return;
            }

            const { data: foundEmail, error: emailErr } = await supabase.rpc('login_email_for', { p_username: identifier });
            if (emailErr) throw emailErr;
            if (!foundEmail) return fail('Incorrect username or password.');
            email = foundEmail;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return fail('Incorrect username/email or password.');

        await finishLogin();
    } catch (err) {
        console.error('Login error:', err);
        fail('Unable to log in right now. Please check your network and try again.');
    }
});

// One-time upgrade for accounts created before email logins existed
upgradeButton.addEventListener('click', async () => {
    const email = $('upgrade-email').value.trim().toLowerCase();
    const phone = $('upgrade-phone').value.trim();
    errorMessage.textContent = '';

    clearAllFieldErrors(UPGRADE_FIELD_IDS);
    if (!email) return fieldFail('upgrade-email', 'Please enter your email.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fieldFail('upgrade-email', 'Please enter a valid email address.');
    if (!phone) return fieldFail('upgrade-phone', 'Please enter your phone number.');
    if (!/^[0-9+\s-]{10,15}$/.test(phone)) return fieldFail('upgrade-phone', 'Please enter a valid phone number.');
    if (!pendingLegacy) return;

    upgradeButton.disabled = true;
    upgradeButton.textContent = 'Upgrading...';

    try {
        const { data: auth, error: signUpErr } = await supabase.auth.signUp({ email, password: pendingLegacy.password });
        if (signUpErr) throw signUpErr;
        if (!auth.session) throw new Error('Email confirmation is switched on in Supabase. Ask the site owner to turn it off.');

        const { error: claimErr } = await supabase.rpc('claim_legacy_student', {
            p_username: pendingLegacy.username,
            p_password: pendingLegacy.password,
            p_email: email,
            p_phone: phone
        });
        if (claimErr) throw claimErr;

        await finishLogin();
    } catch (err) {
        console.error('Upgrade error:', err);
        const m = (err.message || '').toLowerCase();
        if (m.includes('already registered')) {
            const errEl = $('upgrade-email-error');
            if (errEl) { errEl.textContent = 'That email is already used by another account.'; errEl.classList.add('visible'); }
            $('upgrade-email').classList.add('has-error');
        } else {
            errorMessage.textContent = err.message || 'Upgrade failed. Please try again.';
        }
        upgradeButton.disabled = false;
        upgradeButton.textContent = 'Upgrade my account';
    }
});

$('create-account-button').addEventListener('click', () => { window.location.href = 'register.html'; });
