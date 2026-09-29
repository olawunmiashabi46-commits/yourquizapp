import { supabase } from './supabase.js';

const PAYSTACK_PUBLIC_KEY = 'pk_test_e520b25bb406a3135afb4ebbb7ebe3c0cb157005';
const PLAN_CODE = 'student_premium';
const AMOUNT_KOBO = 500000; // must match api/verify-payment.js

const loggedInStudent = JSON.parse(localStorage.getItem('loggedInStudent'));
if (!loggedInStudent) {
    window.location.href = 'login.html';
}

const planView = document.getElementById('plan-view');
const alreadyView = document.getElementById('already-premium-view');
const expiryNote = document.getElementById('expiry-note');
const payButton = document.getElementById('pay-button');
const statusMessage = document.getElementById('status-message');

function setStatus(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = type || '';
}

function isActivePremium(student) {
    if (student.plan !== 'premium') return false;
    if (!student.plan_expires_at) return true;
    return new Date(student.plan_expires_at) > new Date();
}

(async function init() {
    const { data: student, error } = await supabase
        .from('students')
        .select('id, email, plan, plan_expires_at')
        .eq('id', loggedInStudent.id)
        .maybeSingle();

    if (error || !student) {
        setStatus('Could not load your account. Please try again.', 'error');
        return;
    }

    if (isActivePremium(student)) {
        planView.style.display = 'none';
        alreadyView.style.display = 'block';
        expiryNote.textContent = 'Renews / expires on ' +
            new Date(student.plan_expires_at).toLocaleDateString();
        return;
    }

    payButton.addEventListener('click', () => startPayment(student.email));
})();

function startPayment(email) {
    if (!email) {
        setStatus('Your account has no email on file. Please contact support.', 'error');
        return;
    }
    if (typeof PaystackPop === 'undefined') {
        setStatus('Payment could not load. Check your connection and try again.', 'error');
        return;
    }

    payButton.disabled = true;
    setStatus('Opening secure payment window...', '');

    const popup = new PaystackPop();
    popup.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: AMOUNT_KOBO,
        currency: 'NGN',
        metadata: { studentId: loggedInStudent.id, planCode: PLAN_CODE },
        onSuccess: (transaction) => verifyOnServer(transaction.reference),
        onCancel: () => {
            payButton.disabled = false;
            setStatus('Payment was cancelled.', '');
        }
    });
}

async function verifyOnServer(reference) {
    setStatus('Confirming your payment...', '');
    try {
        const res = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference, planCode: PLAN_CODE, accountId: loggedInStudent.id })
        });
        const data = await res.json();

        if (!data.success) {
            setStatus(data.message || 'We could not confirm this payment.', 'error');
            payButton.disabled = false;
            return;
        }

        loggedInStudent.plan = 'premium';
        loggedInStudent.planExpiresAt = data.planExpiresAt || null;
        localStorage.setItem('loggedInStudent', JSON.stringify(loggedInStudent));

        setStatus('Payment confirmed! You are now Premium 🎉', 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } catch (err) {
        console.error('verify-payment fetch error:', err);
        setStatus('Network error while confirming payment. If money left your account, contact support with your reference: ' + reference, 'error');
        payButton.disabled = false;
    }
}
