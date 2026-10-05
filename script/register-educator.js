// EDUCATOR REGISTRATION (Supabase Auth)
import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);
const errorMessage = $('error-message');
const registerButton = $('register-button');

const FIELD_IDS = ['full-name', 'email', 'phone', 'subjects', 'password', 'confirm-password'];

function clearFieldErrors() {
    FIELD_IDS.forEach((id) => {
        const errEl = $(id + '-error');
        const inputEl = $(id);
        if (errEl) { errEl.textContent = ''; errEl.classList.remove('visible'); }
        if (inputEl) inputEl.classList.remove('has-error');
    });
    errorMessage.textContent = '';
}

function fieldFail(fieldId, msg) {
    clearFieldErrors();
    const errEl = $(fieldId + '-error');
    const inputEl = $(fieldId);
    if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
    if (inputEl) {
        inputEl.classList.add('has-error');
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        inputEl.focus();
    }
    registerButton.disabled = false;
    registerButton.textContent = 'Create Account';
}

function generalFail(msg) {
    clearFieldErrors();
    errorMessage.textContent = msg;
    registerButton.disabled = false;
    registerButton.textContent = 'Create Account';
}

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
setupPasswordToggle('confirm-password', 'toggle-confirm-password');

registerButton.addEventListener('click', async () => {
    const fullName = $('full-name').value.trim();
    const email = $('email').value.trim().toLowerCase();
    const phone = $('phone').value.trim();
    const subjects = $('subjects').value.trim();
    const bio = $('bio').value.trim();
    const password = $('password').value;
    const confirmPassword = $('confirm-password').value;

    clearFieldErrors();

    if (!fullName) return fieldFail('full-name', 'Please enter your full name.');
    if (!email) return fieldFail('email', 'Please enter your email.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return fieldFail('email', 'Please enter a valid email address.');
    if (!phone) return fieldFail('phone', 'Please enter your phone number.');
    if (!/^[0-9+\s-]{10,15}$/.test(phone)) return fieldFail('phone', 'Please enter a valid phone number.');
    if (!subjects) return fieldFail('subjects', 'Please enter at least one subject you teach.');
    if (!password) return fieldFail('password', 'Please create a password.');
    if (password.length < 8) return fieldFail('password', 'Password must be at least 8 characters.');
    if (!/[a-z]/.test(password)) return fieldFail('password', 'Password must include at least one lowercase letter.');
    if (!/[A-Z]/.test(password)) return fieldFail('password', 'Password must include at least one uppercase letter.');
    if (!/[0-9]/.test(password)) return fieldFail('password', 'Password must include at least one number.');
    if (!confirmPassword) return fieldFail('confirm-password', 'Please confirm your password.');
    if (password !== confirmPassword) return fieldFail('confirm-password', 'Passwords do not match.');

    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';

    try {
        const { data: auth, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        if (!auth.session) {
            return generalFail('Email confirmation is still switched on in Supabase. Ask the site owner to turn it off.');
        }

        const { error: insertErr } = await supabase.from('educators').insert({
            auth_id: auth.user.id,
            full_name: fullName,
            email,
            phone,
            subjects,
            bio
        });
        if (insertErr) throw insertErr;

        await supabase.auth.signOut();
        alert('Registration successful! Please login with your new account.');
        window.location.href = 'login.html';
    } catch (err) {
        console.error('Educator registration error:', err);
        const m = (err.message || '').toLowerCase();
        if (m.includes('already registered') || m.includes('already been registered')) {
            fieldFail('email', 'This email is already registered. Please login instead.');
        } else {
            generalFail(err.message || 'Something went wrong. Please try again.');
        }
    }
});

$('login-button').addEventListener('click', () => { window.location.href = 'login.html'; });
