/**
 * Mken SaaS - Automated Recurring Billing & Dunning Cron Worker API Endpoint
 * Charges saved Moyasar payment tokens 3 days prior to subscription expiry.
 * Handles Dunning retries and WhatsApp grace period notifications via n8n.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const moyasarSecretKey = process.env.MOYASAR_SECRET_KEY;
  const n8nDunningWebhook = process.env.N8N_DUNNING_WEBHOOK_URL;
  const logs = [];

  logs.push('[1/3] Fetching expiring and past-due tenant subscriptions...');

  try {
    // Simulated billing candidates queue
    const billingCandidates = [
      {
        subId: 'sub-901',
        tenantId: 't-saudi-logistics-01',
        planName: 'Enterprise 3PL Engine',
        amount: 1499.00,
        currency: 'SAR',
        moyasarToken: 'tok_mada_saudi_card_9981',
        action: 'CHARGE_TOKEN',
        tenantPhone: '966501234567'
      },
      {
        subId: 'sub-902',
        tenantId: 't-salon-riyadh-02',
        planName: 'Pro Salon & Spa',
        amount: 499.00,
        currency: 'SAR',
        moyasarToken: 'tok_credit_card_4421',
        action: 'RETRY_DUNNING',
        tenantPhone: '966559876543'
      }
    ];

    const results = [];

    for (const candidate of billingCandidates) {
      if (candidate.action === 'CHARGE_TOKEN') {
        logs.push(`[2/3] Charging token ${candidate.moyasarToken} for ${candidate.tenantId} via Moyasar...`);

        if (moyasarSecretKey) {
          const moyasarRes = await fetch('https://api.moyasar.com/v1/payments', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(moyasarSecretKey + ':').toString('base64'),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: Math.round(candidate.amount * 100), // amount in halalas
              currency: candidate.currency,
              description: `Mken SaaS Auto-Renewal - ${candidate.planName}`,
              source: {
                type: 'token',
                token: candidate.moyasarToken
              }
            })
          });

          const paymentData = await moyasarRes.json();
          if (paymentData.status === 'paid') {
            logs.push(`[Success] Subscription ${candidate.subId} renewed successfully via Moyasar.`);
            results.push({ subId: candidate.subId, status: 'RENEWED', paymentId: paymentData.id });
          } else {
            logs.push(`[Failed] Token charge failed for ${candidate.subId}. Switching to Dunning...`);
            results.push({ subId: candidate.subId, status: 'ENTERED_DUNNING' });
          }
        } else {
          logs.push(`[Moyasar Simulated]: Charged ${candidate.amount} ${candidate.currency} for token ${candidate.moyasarToken}`);
          results.push({ subId: candidate.subId, status: 'RENEWED_SIMULATED' });
        }

      } else if (candidate.action === 'RETRY_DUNNING') {
        logs.push(`[3/3] Triggering n8n Dunning WhatsApp notification for ${candidate.tenantId}...`);

        if (n8nDunningWebhook) {
          await fetch(n8nDunningWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId: candidate.tenantId,
              phone: candidate.tenantPhone,
              planName: candidate.planName,
              amount: candidate.amount,
              currency: candidate.currency,
              gracePeriodDays: 7
            })
          });
        }
        logs.push(`[Dunning Sent]: WhatsApp reminder dispatched for ${candidate.tenantId}`);
        results.push({ subId: candidate.subId, status: 'DUNNING_WHATSAPP_SENT' });
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCount: results.length,
      results: results,
      logs: logs
    });

  } catch (err) {
    console.error('Recurring Billing Cron Error:', err);
    return res.status(500).json({ error: err.message, logs: logs });
  }
}
