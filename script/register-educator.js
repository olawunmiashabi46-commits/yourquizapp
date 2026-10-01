// EDUCATOR REGISTRATION (Supabase Auth)
import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);
const errorMessage = $('error-message');
const registerButton = $('register-button');

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

function fail(msg) {
    errorMessage.textContent = msg;
    registerButton.disabled = false;
    registerButton.textContent = 'Create Account';
}

registerButton.addEventListener('click', async () => {
    const fullName = $('full-name').value.trim();
    const email = $('email').value.trim().toLowerCase();
    const phone = $('phone').value.trim();
    const subjects = $('subjects').value.trim();
    const bio = $('bio').value.trim();
    const password = $('password').value;
    const confirmPassword = $('confirm-password').value;

    errorMessage.textContent = '';

    if (!fullName || !email || !phone || !subjects || !password || !confirmPassword) {
        return fail('Please fill in all fields (bio is optional).');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Please enter a valid email address.');
    if (!/^[0-9+\s-]{10,15}$/.test(phone)) return fail('Please enter a valid phone number.');
    if (password.length < 8) return fail('Password must be at least 8 characters.');
    if (!/[a-z]/.test(password)) return fail('Password must include at least one lowercase letter.');
    if (!/[A-Z]/.test(password)) return fail('Password must include at least one uppercase letter.');
    if (!/[0-9]/.test(password)) return fail('Password must include at least one number.');
    if (password !== confirmPassword) return fail('Passwords do not match.');

    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';

    try {
        const { data: auth, error: signUpErr } = await supabase.auth.signUp({ email, password });
        if (signUpErr) throw signUpErr;
        if (!auth.session) {
            return fail('Email confirmation is still switched on in Supabase. Ask the site owner to turn it off.');
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
        fail(m.includes('already registered') || m.includes('already been registered')
            ? 'This email is already registered. Please login instead.'
            : (err.message || 'Something went wrong. Please try again.'));
    }
});

$('login-button').addEventListener('click', () => { window.location.href = 'login.html'; });
