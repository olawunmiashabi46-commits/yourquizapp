// ======================================
// AUTO-LOGIN CHECK
// ======================================
const existingStudent = localStorage.getItem('loggedInStudent');
if (existingStudent) {
    window.location.href = 'dashboard.html';
}

// ======================================
// IMPORT SUPABASE
// ======================================
import { supabase } from './supabase.js';

// ======================================
// GET HTML ELEMENTS & INITIALIZE TOGGLES
// ======================================
const fullNameInput = document.getElementById('full-name');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const registerButton = document.getElementById('register-button');
const loginButton = document.getElementById('login-button');
const errorMessage = document.getElementById('error-message');

function setupPasswordToggle(inputId, buttonId) {
    const pInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(buttonId);

    if (pInput && toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            const isPassword = pInput.type === 'password';
            pInput.type = isPassword ? 'text' : 'password';
            toggleBtn.textContent = isPassword ? '🙈' : '👁️';
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupPasswordToggle('password', 'toggle-password');
    setupPasswordToggle('confirm-password', 'toggle-confirm-password');
});

// ======================================
// REGISTER HANDLER
// ======================================
registerButton.addEventListener('click', async function () {
    const fullName = fullNameInput.value.trim();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();

    errorMessage.textContent = '';

    if (fullName === '' || username === '' || password === '' || confirmPassword === '') {
        errorMessage.textContent = 'Please fill in all fields.';
        return;
    }

    if (password.length < 6) {
        errorMessage.textContent = 'Password must be at least 6 characters.';
        return;
    }

    if (password !== confirmPassword) {
        errorMessage.textContent = 'Passwords do not match.';
        return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Creating account...';

    try {
        const { data: existingStudentData, error: findError } = await supabase
            .from('students')
            .select('id, username')
            .ilike('username', username)
            .maybeSingle();

        if (findError) throw new Error(findError.message);

        if (existingStudentData) {
            throw new Error('This username is already taken.');
        }

        const { data: newStudent, error: insertError } = await supabase
            .from('students')
            .insert({
                name: fullName,
                username: username,
                category: ''
            })
            .select()
            .single();

        if (insertError) throw new Error(insertError.message);

        const loggedInStudentData = {
            id: newStudent.id,
            name: newStudent.name,
            username: newStudent.username,
            category: newStudent.category,
            password: password
        };

        localStorage.setItem('loggedInStudent', JSON.stringify(loggedInStudentData));

        const accounts = JSON.parse(localStorage.getItem('studentAccounts')) || [];
        const existingIndex = accounts.findIndex(acc => (acc.username || '').toLowerCase() === username);

        if (existingIndex !== -1) {
            accounts[existingIndex] = loggedInStudentData;
        } else {
            accounts.push(loggedInStudentData);
        }

        localStorage.setItem('studentAccounts', JSON.stringify(accounts));
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Registration error:', error);
        errorMessage.textContent = error.message;
        registerButton.disabled = false;
        registerButton.textContent = 'Create Account';
    }
});

loginButton.addEventListener('click', function () {
    window.location.href = 'login.html';
});