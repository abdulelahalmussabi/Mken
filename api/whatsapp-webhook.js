const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('./_lib/supabase-env');
const aiAgent = require('./_lib/whatsapp-ai-agent');
const cannedReplies = require('./_lib/whatsapp-canned-replies');
const activityRouter = require('./_lib/activity-router');
const handoffEngine = require('./_lib/handoff-engine');
const reviewFunnel = require('./_lib/review-funnel');

function getSupabase() {
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Constant-time comparison to avoid timing attacks on signatures/tokens
function safeEqual(a, b) {
  const crypto = require('crypto');
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyTwilioSignature(req, authToken) {
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  const crypto = require('crypto');
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  
  // Twilio signature uses the request URL as seen by the server
  // Wait: req.url might have a leading slash, check how it is constructed
  const fullUrl = protocol + '://' + host + req.url;

  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  let dataStr = fullUrl;
  for (const key of sortedKeys) {
    dataStr += key + params[key];
  }

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(dataStr)
    .digest('base64');

  return safeEqual(signature, expectedSignature);
}

function verifyMetaSignature(req, appSecret) {
  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) return false;

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') return false;

  const signature = parts[1];
  const crypto = require('crypto');

  const rawBodyBuf = req.rawBody || Buffer.alloc(0);
  const rawBody = rawBodyBuf.toString('utf8');
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  return safeEqual(signature, expectedSignature);
}

module.exports = async function handler(req, res) {
  // Read raw body since we disabled bodyParser.
  // Resolve to an empty buffer on error/abort so the handler never hangs.
  const rawBodyBuffer = await new Promise((resolve) => {
    const chunks = [];
    let done = false;
    const finish = (buf) => { if (!done) { done = true; resolve(buf); } };
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => finish(Buffer.concat(chunks)));
    req.on('error', () => finish(Buffer.alloc(0)));
    req.on('aborted', () => finish(Buffer.concat(chunks)));
  });
  req.rawBody = rawBodyBuffer;

  const rawBodyString = rawBodyBuffer.toString('utf8');
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/json')) {
    try {
      req.body = JSON.parse(rawBodyString);
    } catch (e) {
      req.body = {};
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const querystring = require('querystring');
    req.body = querystring.parse(rawBodyString);
  } else {
    req.body = {};
  }

  // 1. Meta / Facebook Webhook GET Verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const tenantSlug = req.query.tenant || req.query.slug || 'default';

    // Browser visit without Meta hub.* params — not a verification attempt
    if (!mode && !token) {
      return res.status(200).json({
        ok: true,
        service: 'mken-whatsapp-webhook',
        tenant: tenantSlug,
        message: 'Webhook endpoint is live. Meta will call this URL with hub.mode=subscribe during verification.',
        verifyTokenHint: 'Use the same value as WHATSAPP_VERIFY_TOKEN on the server (default: mken_verify_token_2026).',
        note: 'Phone Number ID and Access Token are saved in admin settings — they are separate from the Webhook Verify Token.'
      });
    }

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mken_verify_token_2026';
    if (mode === 'subscribe' && safeEqual(token, verifyToken)) {
      console.log('Webhook verified successfully!');
      return res.status(200).send(challenge);
    }
    console.warn('Webhook verify failed', { mode, tokenMatch: !!token && token === verifyToken, hasEnv: !!process.env.WHATSAPP_VERIFY_TOKEN });
    return res.status(403).send('Forbidden: Token mismatch');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tenantSlug = req.query.tenant || req.query.slug || 'default';
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials missing' });
  }

  // Fetch Tenant Configuration early to authenticate the signature
  let clientRow;
  try {
    const { data } = await supabase
      .from('mken_saas_clients')
      .select('config_data')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle();
    clientRow = data;
  } catch (dbErr) {
    console.error('Database error fetching tenant config:', dbErr);
  }

  if (!clientRow || !clientRow.config_data) {
    return res.status(200).json({ status: 'ignored', message: 'Tenant config not found' });
  }

  const config = clientRow.config_data;
  const wa = config.whatsappApi || {};

  if (!wa.enabled || wa.provider === 'none') {
    return res.status(200).json({ status: 'ignored', message: 'WhatsApp API not enabled for tenant' });
  }

  // Enforce Signature Verification based on provider
  if (wa.provider === 'twilio') {
    const twilioAuthToken = wa.token;
    if (twilioAuthToken) {
      if (!verifyTwilioSignature(req, twilioAuthToken)) {
        console.warn(`Twilio signature verification failed for tenant ${tenantSlug}`);
        return res.status(403).json({ error: 'Forbidden: Invalid Twilio signature' });
      }
    } else {
      console.warn(`Twilio Auth Token not configured for tenant ${tenantSlug}, bypassing signature check`);
    }
  } else if (wa.provider === 'whatsapp_business') {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      if (!verifyMetaSignature(req, appSecret)) {
        console.warn(`Meta signature verification failed for tenant ${tenantSlug}`);
        return res.status(403).json({ error: 'Forbidden: Invalid Meta signature' });
      }
    } else {
      console.warn(`WHATSAPP_APP_SECRET environment variable not configured on server, bypassing signature check`);
    }
  }

  try {
    let phone = '';
    let bodyText = '';
    let provider = 'unknown';

    // Parse incoming webhook based on payload signature
    // A. Twilio (x-www-form-urlencoded)
    if (req.body.From && req.body.Body) {
      phone = req.body.From.replace('whatsapp:', '').replace('+', '').trim();
      bodyText = req.body.Body.trim();
      provider = 'twilio';
    }
    // B. UltraMsg (JSON)
    else if (req.body.data && req.body.data.from && req.body.data.body) {
      phone = req.body.data.from.split('@')[0].replace('+', '').trim();
      bodyText = req.body.data.body.trim();
      provider = 'ultramsg';
    }
    // C. WhatsApp Cloud API (JSON)
    else if (req.body.object === 'whatsapp_business_account' && req.body.entry) {
      provider = 'whatsapp_business';
      try {
        const changes = req.body.entry[0].changes[0].value;
        if (changes.messages && changes.messages[0]) {
          const message = changes.messages[0];
          phone = message.from.replace('+', '').trim();
          if (message.type === 'text') {
            bodyText = message.text.body.trim();
          } else {
            bodyText = '[غير مقروء - ميديا/مستند/تفاعل]';
          }
        }
      } catch (e) {
        console.error('Failed to parse WhatsApp Business Cloud API webhook:', e);
      }
    }

    if (!phone || !bodyText) {
      // Silent success return for message status updates/delivery reports
      return res.status(200).json({ status: 'ignored', message: 'No message contents found' });
    }

    const cleanPhoneStr = cleanPhone(phone);
    if (!cleanPhoneStr) {
      return res.status(200).json({ status: 'ignored', message: 'Invalid phone number format' });
    }

    // === ACTIVITY DETECTION (Phase 1: keyword rules) ===
    // Determine which business activity this conversation is about, so we can
    // isolate context + memory per activity (Strict Data Isolation).
    const enabledActivities = (config.enabledActivities || null);
    let detectedActivity = null;
    let previousActivityId = null;
    try {
      // Peek at the previous activity for this customer (continuity)
      const { data: prevLog } = await supabase
        .from('mken_whatsapp_logs')
        .select('activity_id')
        .eq('tenant_slug', tenantSlug)
        .eq('phone', cleanPhoneStr)
        .not('activity_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prevLog && prevLog.activity_id) {
        previousActivityId = prevLog.activity_id;
      }
    } catch (e) {
      // activity_id column may not exist yet — non-fatal
    }

    try {
      detectedActivity = activityRouter.detectActivity(bodyText, enabledActivities, previousActivityId);
    } catch (e) {
      // Non-fatal — treat as general conversation
    }
    const activityId = detectedActivity ? detectedActivity.activity_id : null;

    // Log Inbound Message to CRM Log History (with activity_id when known)
    try {
      await supabase.from('mken_whatsapp_logs').insert({
        tenant_slug: tenantSlug,
        phone: cleanPhoneStr,
        body: bodyText,
        provider: provider,
        status: 'received',
        event_type: 'inbound',
        activity_id: activityId,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // activity_id column may be missing on older DBs — retry without it
      try {
        await supabase.from('mken_whatsapp_logs').insert({
          tenant_slug: tenantSlug,
          phone: cleanPhoneStr,
          body: bodyText,
          provider: provider,
          status: 'received',
          event_type: 'inbound',
          created_at: new Date().toISOString()
        });
      } catch (e2) {
        // Logging is best-effort; never block the reply on it
      }
    }

    // Fetch recent conversation history for this customer (memory),
    // SCOPED to the same activity when one was detected (isolation).
    let conversationHistory = [];
    try {
      let query = supabase
        .from('mken_whatsapp_logs')
        .select('event_type, body, activity_id, created_at')
        .eq('tenant_slug', tenantSlug)
        .eq('phone', cleanPhoneStr)
        .order('created_at', { ascending: false })
        .limit(8);

      // If we have an activity, prefer messages from that activity; otherwise
      // fall back to all recent messages.
      if (activityId) {
        query = query.eq('activity_id', activityId);
      }

      const { data: recentLogs, error } = await query;
      if (!error && recentLogs && recentLogs.length > 0) {
        // If activity-scoping returned too few, supplement with recent general
        let logsToUse = recentLogs;
        if (activityId && recentLogs.length < 3) {
          const { data: extra } = await supabase
            .from('mken_whatsapp_logs')
            .select('event_type, body, activity_id, created_at')
            .eq('tenant_slug', tenantSlug)
            .eq('phone', cleanPhoneStr)
            .order('created_at', { ascending: false })
            .limit(8);
          if (extra) {
            logsToUse = extra;
          }
        }
        conversationHistory = logsToUse
          .reverse()
          .slice(0, -1) // drop the just-inserted current message
          .map(r => ({
            role: r.event_type === 'inbound' ? 'customer' : 'agent',
            text: r.body
          }))
          .filter(t => t.text && t.text.trim());
      }
    } catch (e) {
      // Non-fatal — agent works without memory
    }

    // 4. Conversation Session State Machine (Phase 3: human handoff)
    //    Load or create the active session for this customer.
    let session = null;
    try {
      session = await handoffEngine.getOrCreateSession(supabase, tenantSlug, cleanPhoneStr, activityId);
    } catch (e) {
      console.warn('SESSION_DIAG: getOrCreateSession failed:', e.message);
    }

    // If the session is already transferred to a human, the BOT DOES NOT REPLY.
    // The message is logged (done above) and routed to the human agent only.
    if (session && session.status === 'human') {
      // Optionally notify the assigned staff (could be push notification later)
      // For now, just acknowledge silently — the human handles it.
      return res.status(200).json({ status: 'success', message: 'Routed to human agent', sessionId: session.id });
    }

    try {
      const reviewReply = await reviewFunnel.handleRatingReply(supabase, tenantSlug, cleanPhoneStr, bodyText);
      if (reviewReply) {
        await sendServerWhatsAppReply(cleanPhoneStr, reviewReply, wa, supabase, tenantSlug);
        return res.status(200).json({ status: 'success', message: 'Review funnel handled' });
      }
    } catch (e) {
      // Table may not exist yet — continue to the normal reply engine
    }

    // 5. Smart Reply Engine
    //    Critical booking operations are handled locally (fast, reliable).
    //    Everything else goes to the AI sales agent (Gemini).
    const cleanedMsg = bodyText.toLowerCase().trim();
    let replyText = '';

    const brandName = (config.brand && config.brand.name) || 'مكِّن';
    const siteDomain = aiAgent.resolveSiteDomain(config);

    // Check for explicit human handoff request ("I want a human agent")
    const wantsHuman = handoffEngine.isHandoffRequested(bodyText);
    console.log('HANDOFF_DIAG: wantsHuman=' + wantsHuman + ' hasSession=' + !!session + ' activityId=' + activityId);
    if (wantsHuman) {
      // Ensure we have a session even if getOrCreateSession failed earlier
      if (!session) {
        try {
          session = await handoffEngine.getOrCreateSession(supabase, tenantSlug, cleanPhoneStr, activityId);
        } catch (e) {
          console.warn('HANDOFF_DIAG: session creation retry failed:', e.message);
        }
      }
      if (session) {
        const result = await handoffEngine.attemptHandoff(supabase, session);
        console.log('HANDOFF_DIAG: result=', JSON.stringify({ success: result.success, reason: result.reason, staffName: result.staff ? result.staff.name : null }));
        if (result.success && result.staff) {
          replyText = handoffEngine.buildHandoffSuccessMessage(result.staff.name, brandName);
        } else {
          replyText = handoffEngine.buildHandoffFailMessage(result.reason);
        }
      } else {
        // No session table — respond with graceful fallback
        replyText = handoffEngine.buildHandoffFailMessage('no_session_table');
      }
      // Skip the rest of the reply engine — handoff is the response
      if (replyText) {
        await sendServerWhatsAppReply(cleanPhoneStr, replyText, wa, supabase, tenantSlug);
      }
      return res.status(200).json({ status: 'success', message: 'Handoff processed', handoff: !!(session) });
    }

    // Detect explicit cancel command (must run locally — it mutates the DB)
    const isCancel = (cleanedMsg.includes('إلغاء') || cleanedMsg.includes('الغاء') || cleanedMsg.includes('ألغ') || cleanedMsg.includes('الغ'))
      && (cleanedMsg.includes('موعد') || cleanedMsg.includes('حجز'));

    if (isCancel) {
      // Cancel Appointment Command (local, no AI)
      const { data: apts } = await supabase
        .from('mken_appointments')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .eq('phone', cleanPhoneStr)
        .in('status', ['confirmed', 'pending'])
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(1);

      if (apts && apts.length > 0) {
        const apt = apts[0];
        await supabase
          .from('mken_appointments')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', apt.id);

        replyText = `تم إلغاء موعدك القادم بنجاح.\nالخدمة: ${apt.service_id}\nالتاريخ: ${formatDateArabic(apt.date)} - الوقت: ${formatTimeArabic(apt.time)}\n\nنشكرك لتفهمك!`;
      } else {
        replyText = 'عذراً، لم نجد أي موعد نشط ومسجل برقم جوالك حالياً لإلغائه.';
      }
    } else {
      // STRICT ISOLATION GATE: detect requests for activities NOT enabled for
      // this tenant. If the customer asks for something we don't offer, refuse
      // politely and locally — never send it to the AI model.
      let outOfScope = null;
      try {
        outOfScope = activityRouter.detectOutOfScopeActivity(bodyText, enabledActivities);
      } catch (e) {}

      if (outOfScope) {
        // Build a list of enabled activity titles to offer instead
        let availableTitles = [];
        try {
          availableTitles = (enabledActivities || [])
            .filter(function (id) { return activityRouter.KEYWORDS[id]; })
            .map(function (id) { return activityRouter.KEYWORDS[id].title; });
        } catch (e) {}

        let scopeReply = 'عذراً، خدمة "' + outOfScope.title + '" غير متوفرة لدينا حالياً. 🙏\n\n';
        if (availableTitles.length > 0) {
          scopeReply += 'نقدم حالياً الخدمات التالية فقط:\n';
          availableTitles.forEach(function (t) { scopeReply += '• ' + t + '\n'; });
          scopeReply += '\nسعداء بخدمتك في أي منها! أيها يهمك؟ 😊\n';
          scopeReply += '🌐 للحجز: https://' + siteDomain + '/book.html';
        } else {
          scopeReply += 'تكرم، تواصل معنا لنرشدك للخدمات المتاحة 💚';
        }
        replyText = scopeReply;
      } else {
      // Everything else → AI Sales Agent
      // Pre-fetch the customer's appointments so the agent can answer accurately
      let appointmentsInfo = null;
      try {
        const { data: apts } = await supabase
          .from('mken_appointments')
          .select('service_id,date,time,status')
          .eq('tenant_slug', tenantSlug)
          .eq('phone', cleanPhoneStr)
          .in('status', ['confirmed', 'pending'])
          .order('date', { ascending: true })
          .order('time', { ascending: true })
          .limit(3);

        if (apts && apts.length > 0) {
          appointmentsInfo = apts.map((apt, i) =>
            (i + 1) + '. ' + apt.service_id + ' — ' + formatDateArabic(apt.date) + ' ' + formatTimeArabic(apt.time)
            + ' (' + (apt.status === 'confirmed' ? 'مؤكد' : 'قيد الانتظار') + ')'
          ).join('\n');
        } else {
          appointmentsInfo = 'لا توجد مواعيد قادمة مسجلة لهذا العميل.';
        }
      } catch (e) {
        // Non-fatal — agent can still reply without appointment context
      }

      // HYBRID REPLY ENGINE:
      // 1) Try a high-quality canned reply first (fast, reliable, persuasive)
      // 2) If no canned match, fall through to the AI agent
      // 3) If AI also fails, use a safe static fallback
      let cannedReply = null;
      try {
        cannedReply = cannedReplies.matchCannedReply(bodyText, config, { conversationHistory, appointmentsInfo });
      } catch (e) {
        // Non-fatal — proceed to AI
      }

      if (cannedReply && cannedReply.trim()) {
        replyText = cannedReply.trim();
      } else {
        // No canned match → AI agent (with activity-scoped context)
        let aiReply = await aiAgent.generateAIReply(bodyText, config, tenantSlug, cleanPhoneStr, appointmentsInfo, conversationHistory, activityId);

        if (aiReply && aiReply.trim()) {
          replyText = aiReply.trim();
        } else {
          // Safe fallback if Gemini is unavailable or failed.
          // Always use "مكّن لايف" brand name (not config brand which may be wrong for admin tenant).
          replyText = `مرحباً بك في مكّن لايف! 🌟\nسعداء بتواصلك معنا! فريقنا جاهز لمساعدتك.\n\nيمكنك الحجز والدفع المباشر عبر:\n🌐 https://${siteDomain}/book.html\n\nأو أرسل لنا استفسارك وسنرد قريباً 💚`;
        }
      }
      } // end out-of-scope else (in-scope → hybrid engine)
    }

    // 5. Send Chatbot Response
    if (replyText) {
      await sendServerWhatsAppReply(cleanPhoneStr, replyText, wa, supabase, tenantSlug);
    }

    return res.status(200).json({ status: 'success', message: 'Inbound message processed' });
  } catch (err) {
    console.error('Error handling whatsapp webhook:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

async function sendServerWhatsAppReply(phone, messageText, wa, supabase, tenantSlug) {
  const provider = wa.provider;
  let promise;

  if (provider === 'ultramsg' && wa.instanceId) {
    const url = `https://api.ultramsg.com/${wa.instanceId}/messages/chat`;
    const params = new URLSearchParams();
    params.append('token', wa.token);
    params.append('to', phone);
    params.append('body', messageText);

    promise = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    }).then(r => r.ok ? r.json() : Promise.reject(new Error(`UltraMsg status ${r.status}`)));
  } else if (provider === 'twilio' && wa.accountSid && wa.fromNumber) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${wa.accountSid}/Messages.json`;
    const params = new URLSearchParams();
    params.append('Body', messageText);
    params.append('From', 'whatsapp:' + wa.fromNumber.replace(/^\+?/, '+'));
    params.append('To', 'whatsapp:+' + phone);

    promise = fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(wa.accountSid + ':' + wa.token).toString('base64')
      },
      body: params.toString()
    }).then(r => r.ok ? r.json() : Promise.reject(new Error(`Twilio status ${r.status}`)));
  } else if (provider === 'custom' && wa.url) {
    const headers = { 'Content-Type': 'application/json' };
    if (wa.token) headers['Authorization'] = 'Bearer ' + wa.token;

    promise = fetch(wa.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        to: phone,
        body: messageText,
        event: 'chatbot_reply'
      })
    }).then(r => r.ok ? r.text() : Promise.reject(new Error(`Custom Webhook status ${r.status}`)));
  } else if (provider === 'whatsapp_business' && wa.phoneNumberId) {
    const url = `https://graph.facebook.com/v18.0/${wa.phoneNumberId}/messages`;
    const headers = {
      'Authorization': 'Bearer ' + wa.token,
      'Content-Type': 'application/json'
    };

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: {
        body: messageText
      }
    };

    promise = fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    }).then(async r => {
      if (r.ok) return r.json();
      let errorMsg = `WhatsApp Business status ${r.status}`;
      try {
        const errData = await r.json();
        if (errData && errData.error && errData.error.message) {
          errorMsg = errData.error.message;
        }
      } catch (e) {}
      throw new Error(errorMsg);
    });
  } else {
    return;
  }

  try {
    await promise;
    await supabase.from('mken_whatsapp_logs').insert({
      tenant_slug: tenantSlug,
      phone: phone,
      body: messageText,
      provider: provider,
      status: 'success',
      event_type: 'chatbot_reply',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to send chatbot reply:', err.message);
    await supabase.from('mken_whatsapp_logs').insert({
      tenant_slug: tenantSlug,
      phone: phone,
      body: messageText,
      provider: provider,
      status: 'failed',
      error_message: err.message,
      event_type: 'chatbot_reply',
      created_at: new Date().toISOString()
    });
  }
}

function cleanPhone(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('966') === 0) return digits;
  if (digits.indexOf('0') === 0) return '966' + digits.slice(1);
  if (digits.length === 9) return '966' + digits;
  return digits;
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const AR_DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

function parseDateISO(str) {
  return new Date(str + 'T12:00:00');
}

function formatDateArabic(dateStr) {
  try {
    const d = parseDateISO(dateStr);
    return AR_DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + AR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  } catch (e) {
    return dateStr;
  }
}

function formatTimeArabic(time) {
  try {
    const parts = time.split(':');
    const h = parseInt(parts[0], 10);
    const suffix = h < 12 ? 'صباحاً' : 'مساءً';
    const display = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return display + ':' + parts[1] + ' ' + suffix;
  } catch (e) {
    return time;
  }
}

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
