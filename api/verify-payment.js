import { createClient } from '@supabase/supabase-js';

// Prices are decided here on the server, never trusted from the browser.
// (The database repeats this check, so it is enforced twice.)
const PLANS = {
  student_premium: { amountKobo: 500000 },
  educator_premium: { amountKobo: 1000000 },
  // Not an account upgrade, a one-time paid entry into ONE Free championship.
  free_championship_entry: { amountKobo: 200000, oneTimeEntry: true }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { reference, planCode, accountId, quizId, electiveSubject } = req.body || {};
  if (!reference || !planCode || !accountId) {
    return res.status(400).json({ success: false, message: 'Missing details.' });
  }

  const plan = PLANS[planCode];
  if (!plan) {
    return res.status(400).json({ success: false, message: 'Unknown plan.' });
  }

  if (plan.oneTimeEntry && (!quizId || !electiveSubject)) {
    return res.status(400).json({ success: false, message: 'Missing championship or subject details.' });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey || !supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, message: 'Payment is not configured on the server yet.' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Ask Paystack directly whether this payment really succeeded.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const verifyData = await verifyRes.json();
    const tx = verifyData && verifyData.data;

    if (!verifyRes.ok || !tx || tx.status !== 'success') {
      return res.status(400).json({ success: false, message: 'Payment was not successful.' });
    }
    if (tx.currency !== 'NGN' || tx.amount !== plan.amountKobo) {
      return res.status(400).json({ success: false, message: 'Payment amount does not match this plan.' });
    }

    // The account named when the payment started must match the account asking.
    const meta = tx.metadata || {};
    if (meta.studentId && String(meta.studentId) !== String(accountId)) {
      return res.status(400).json({ success: false, message: 'This payment belongs to a different account.' });
    }

    // 2. Record and apply it in one step (safe to run more than once).
    const { data, error } = await supabase.rpc('apply_payment', {
      p_reference: reference,
      p_plan_code: planCode,
      p_account_id: String(accountId),
      p_amount_kobo: tx.amount,
      p_quiz_id: plan.oneTimeEntry ? Number(quizId) : null,
      p_elective: plan.oneTimeEntry ? String(electiveSubject) : null
    });
    if (error) throw error;

    if (data && data.result === 'needs_review') {
      return res.status(400).json({
        success: false,
        message: 'We received your payment but could not apply it automatically. Please contact support and quote this reference: ' + reference
      });
    }

    return res.status(200).json({ success: true, planExpiresAt: (data && data.expires_at) || null });
  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong verifying payment.' });
  }
}
