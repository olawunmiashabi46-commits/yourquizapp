import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Paystack calls this address by itself whenever a payment succeeds, even if
// the student's phone died or they closed the page before it finished. It is
// the safety net behind the normal check in verify-payment.js.

const PLAN_AMOUNTS = {
  student_premium: 500000,
  educator_premium: 1000000,
  free_championship_entry: 200000
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ received: false });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !supabaseUrl || !serviceKey) {
    console.error('paystack-webhook: server is not configured');
    return res.status(500).json({ received: false });
  }

  const event = req.body || {};

  // Informational only: note it if the signature doesn't match. Every payment
  // is also confirmed directly with Paystack below, so a fake notice cannot
  // upgrade anyone.
  try {
    const expected = crypto.createHmac('sha512', secretKey).update(JSON.stringify(req.body)).digest('hex');
    if (expected !== req.headers['x-paystack-signature']) {
      console.warn('paystack-webhook: signature did not match, relying on direct verification');
    }
  } catch (err) {
    console.warn('paystack-webhook: could not check signature', err);
  }

  if (event.event !== 'charge.success') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const reference = event.data && event.data.reference;
  if (!reference) {
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    // Confirm the payment directly with Paystack; use ITS data, not the notice's.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });
    const verifyData = await verifyRes.json();
    const tx = verifyData && verifyData.data;

    if (!verifyRes.ok || !tx || tx.status !== 'success' || tx.currency !== 'NGN') {
      return res.status(200).json({ received: true, ignored: true });
    }

    const meta = tx.metadata || {};
    const planCode = meta.planCode || (meta.quizId ? 'free_championship_entry' : null);
    const accountId = planCode === 'educator_premium' ? meta.educatorId : meta.studentId;

    if (!planCode || !PLAN_AMOUNTS[planCode] || !accountId) {
      console.warn('paystack-webhook: payment', reference, 'is not one of ours, ignoring');
      return res.status(200).json({ received: true, ignored: true });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const isEntry = planCode === 'free_championship_entry';

    const { data, error } = await supabase.rpc('apply_payment', {
      p_reference: reference,
      p_plan_code: planCode,
      p_account_id: String(accountId),
      p_amount_kobo: tx.amount,
      p_quiz_id: isEntry ? Number(meta.quizId) : null,
      p_elective: isEntry && meta.chosenSubject ? String(meta.chosenSubject) : null
    });
    if (error) throw error;

    if (data && data.result === 'needs_review') {
      console.warn('paystack-webhook: payment', reference, 'needs a manual look (see payments table)');
    }
    return res.status(200).json({ received: true, result: data && data.result });
  } catch (err) {
    // A 500 makes Paystack try again later, so a temporary problem can't lose the payment.
    console.error('paystack-webhook error:', err);
    return res.status(500).json({ received: false });
  }
}
