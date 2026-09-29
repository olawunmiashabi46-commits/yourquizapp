import { createClient } from '@supabase/supabase-js';

// Prices are decided here on the server, never trusted from the browser.
const PLANS = {
  student_premium: { table: 'students', amountKobo: 500000, days: 60 },
  educator_premium: { table: 'educators', amountKobo: 1000000, days: 180 }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { reference, planCode, accountId } = req.body || {};
  if (!reference || !planCode || !accountId) {
    return res.status(400).json({ success: false, message: 'Missing details.' });
  }

  const plan = PLANS[planCode];
  if (!plan) {
    return res.status(400).json({ success: false, message: 'Unknown plan.' });
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

    // 2. Stop the same payment being used twice.
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('reference', reference)
      .maybeSingle();

    if (existing && existing.status === 'verified') {
      return res.status(200).json({ success: true, message: 'Already activated.' });
    }

    // 3. Record the payment.
    await supabase.from('payments').upsert({
      reference,
      account_type: planCode.startsWith('student') ? 'student' : 'educator',
      account_id: String(accountId),
      plan_code: planCode,
      amount_kobo: plan.amountKobo,
      status: 'verified',
      verified_at: new Date().toISOString()
    });

    // 4. Activate premium. The service role key bypasses the trigger that
    //    blocks students/educators from changing their own plan.
    const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from(plan.table)
      .update({ plan: 'premium', plan_expires_at: expiresAt })
      .eq('id', accountId);

    if (updateErr) throw updateErr;

    return res.status(200).json({ success: true, planExpiresAt: expiresAt });
  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong verifying payment.' });
  }
}
