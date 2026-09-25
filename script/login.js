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

        // 2. VERIFY PASSWORD
        //    Legacy accounts created before password support was added to the
        //    database will have an empty/null password on their Supabase row.
        //    For those, fall back to this device's local cache once, then
        //    backfill the password to Supabase so future logins (on any
        //    device) are properly verified.
        if (student.password) {
            if (student.password !== password) {
                errorMessage.textContent = 'Incorrect password. Please try again.';
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
                return;
            }
        } else if (matchedAccount && matchedAccount.password === password) {
            // Legacy account: backfill password to Supabase for this student.
            const { error: backfillError } = await supabase
                .from('students')
                .update({ password: password })
                .eq('id', student.id);

            if (backfillError) {
                console.error('Password backfill error:', backfillError);
            }
        } else {
            errorMessage.textContent = 'Incorrect password. Please try again.';
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
            return;
        }

        // 3. Build session data
        const loggedInStudentData = {
            id: student.id,
            name: student.name || student.username,
            username: student.username,
            category: student.category || '',
            password: password
        };

        // 4. Save session on this device
        localStorage.setItem('loggedInStudent', JSON.stringify(loggedInStudentData));

        // 5. Update localAccounts cache on this device
        const cacheIndex = localAccounts.findIndex(function (student) {
            return (student.username || '').toLowerCase() === username.toLowerCase();
        });

        if (cacheIndex !== -1) {
            localAccounts[cacheIndex] = loggedInStudentData;
        } else {
            localAccounts.push(loggedInStudentData);
        }
        localStorage.setItem('studentAccounts', JSON.stringify(localAccounts));

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