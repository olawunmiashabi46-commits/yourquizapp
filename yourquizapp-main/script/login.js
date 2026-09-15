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
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const createAccountButton = document.getElementById('create-account-button');
const errorMessage = document.getElementById('error-message');

// Eye Icon Toggle Functionality
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
});

// ======================================
// LOGIN HANDLER
// ======================================
loginButton.addEventListener('click', async function () {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    errorMessage.textContent = '';

    if (username === '' || password === '') {
        errorMessage.textContent = 'Please enter your username and password.';
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = '⏳ Logging in...';

    try {
        // First check local accounts on this device
        const localAccounts = JSON.parse(localStorage.getItem('studentAccounts')) || [];
        let matchedAccount = localAccounts.find(function (student) {
            const storedUsername = (student.username || '').trim().toLowerCase();
            const storedPassword = (student.password || '').trim();
            return storedUsername === username.toLowerCase() && storedPassword === password;
        });

        // 1. Fetch student directly from Supabase DB
        const { data: student, error: findError } = await supabase
            .from('students')
            .select('*')
            .ilike('username', username)
            .maybeSingle();

        if (findError) throw findError;

        if (!student) {
            errorMessage.textContent = 'Account not found. Please create an account first.';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }

        // 2. Build session data
        const loggedInStudentData = {
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            category: student.category || '',
            password: matchedAccount ? matchedAccount.password : password
        };

        // 3. Save session on this device
        localStorage.setItem('loggedInStudent', JSON.stringify(loggedInStudentData));

        // 4. Update localAccounts cache on this device
        if (!matchedAccount) {
            localAccounts.push(loggedInStudentData);
            localStorage.setItem('studentAccounts', JSON.stringify(localAccounts));
        }

        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'Unable to connect to server. Please check your network and try again.';
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
    }
});

createAccountButton.addEventListener('click', function () {
    window.location.href = 'register.html';
});