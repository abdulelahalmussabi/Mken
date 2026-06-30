const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../_lib/supabase-env');
const { handleCors } = require('../_lib/cors');

// Helper to determine step for login/register
function getStep(req) {
  var url = req.url || '';
  if (url.indexOf('verify') !== -1 || req.query.step === 'verify') return 'verify';
  return 'challenge';
}

// ─── LOGIN HANDLERS ───
async function handleLoginChallenge(req, res) {
  const { tenantSlug, phone } = req.body || {};
  if (!tenantSlug || !phone) {
    return res.status(400).json({ error: 'Missing tenant or phone number' });
  }

  const supabase = createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey());
  const { data: staff, error: staffErr } = await supabase
    .from('mken_staff')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .eq('phone', phone)
    .eq('status', 'active')
    .maybeSingle();

  if (staffErr) throw staffErr;
  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found or inactive' });
  }

  const { data: devices, error: devErr } = await supabase
    .from('mken_staff_devices')
    .select('credential_id')
    .eq('staff_id', staff.id);

  if (devErr) throw devErr;
  if (!devices || !devices.length) {
    return res.status(400).json({ error: 'No biometric credentials registered for this staff member' });
  }

  const challenge = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const secret = sbEnv.getSupabaseServiceKey();
  if (!secret) {
    return res.status(500).json({ error: 'Database service key is not configured' });
  }
  const hmac = crypto.createHmac('sha256', secret)
    .update(challenge + ':' + expiresAt + ':' + staff.id)
    .digest('hex');

  return res.status(200).json({
    challenge: challenge,
    expiresAt: expiresAt,
    challengeSignature: hmac,
    allowCredentials: devices.map(function (d) {
      return { type: 'public-key', id: d.credential_id };
    }),
  });
}

async function handleLoginVerify(req, res) {
  const {
    tenantSlug,
    phone,
    credentialId,
    clientDataJSON,
    authenticatorData,
    signature,
    challenge,
    expiresAt,
    challengeSignature,
  } = req.body || {};

  if (!tenantSlug || !phone || !credentialId || !clientDataJSON || !authenticatorData || !signature || !challenge || !expiresAt || !challengeSignature) {
    return res.status(400).json({ error: 'Missing verification fields' });
  }

  const supabase = createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey());
  const { data: staff, error: staffErr } = await supabase
    .from('mken_staff')
    .select('*')
    .eq('tenant_slug', tenantSlug)
    .eq('phone', phone)
    .eq('status', 'active')
    .maybeSingle();

  if (staffErr) throw staffErr;
  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found or inactive' });
  }

  const secret = sbEnv.getSupabaseServiceKey();
  if (!secret) {
    return res.status(500).json({ error: 'Database service key is not configured' });
  }
  const expectedHmac = crypto.createHmac('sha256', secret)
    .update(challenge + ':' + expiresAt + ':' + staff.id)
    .digest('hex');

  if (challengeSignature !== expectedHmac) {
    return res.status(400).json({ error: 'Invalid challenge signature' });
  }

  if (Date.now() > expiresAt) {
    return res.status(400).json({ error: 'Challenge expired' });
  }

  const { data: device, error: devErr } = await supabase
    .from('mken_staff_devices')
    .select('*')
    .eq('staff_id', staff.id)
    .eq('credential_id', credentialId)
    .maybeSingle();

  if (devErr) throw devErr;
  if (!device) {
    return res.status(400).json({ error: 'Credential not found for this staff member' });
  }

  const clientDataHash = crypto.createHash('sha256')
    .update(Buffer.from(clientDataJSON, 'base64'))
    .digest();

  const verifyData = Buffer.concat([
    Buffer.from(authenticatorData, 'base64'),
    clientDataHash,
  ]);

  const pem = '-----BEGIN PUBLIC KEY-----\n' + device.public_key + '\n-----END PUBLIC KEY-----';
  const verify = crypto.createVerify('SHA256');
  verify.update(verifyData);
  const isValid = verify.verify(pem, Buffer.from(signature, 'base64'));

  if (!isValid) {
    return res.status(400).json({ error: 'Biometric verification failed (invalid signature)' });
  }

  return res.status(200).json({
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      phone: staff.phone,
      tenantSlug: staff.tenant_slug,
    },
  });
}

// ─── REGISTER HANDLERS ───
async function handleRegisterChallenge(req, res) {
  const { staffId, staffPhone } = req.body || {};
  if (!staffId || !staffPhone) {
    return res.status(400).json({ error: 'Missing staff credentials' });
  }

  const challenge = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const secret = sbEnv.getSupabaseServiceKey();
  if (!secret) {
    return res.status(500).json({ error: 'Database service key is not configured' });
  }
  const hmac = crypto.createHmac('sha256', secret)
    .update(challenge + ':' + expiresAt + ':' + staffId)
    .digest('hex');

  return res.status(200).json({
    challenge: challenge,
    expiresAt: expiresAt,
    challengeSignature: hmac,
    rp: {
      name: 'منصة مكِّن (mken)',
      id: req.headers.host.split(':')[0],
    },
    user: {
      id: Buffer.from(staffId).toString('base64url'),
      name: staffPhone,
      displayName: staffPhone,
    },
  });
}

async function handleRegisterVerify(req, res) {
  const {
    staffId,
    deviceName,
    credentialId,
    publicKeyDer,
    challenge,
    expiresAt,
    challengeSignature,
  } = req.body || {};

  if (!staffId || !deviceName || !credentialId || !publicKeyDer || !challenge || !expiresAt || !challengeSignature) {
    return res.status(400).json({ error: 'Missing verification fields' });
  }

  const secret = sbEnv.getSupabaseServiceKey();
  if (!secret) {
    return res.status(500).json({ error: 'Database service key is not configured' });
  }
  const expectedHmac = crypto.createHmac('sha256', secret)
    .update(challenge + ':' + expiresAt + ':' + staffId)
    .digest('hex');

  if (challengeSignature !== expectedHmac) {
    return res.status(400).json({ error: 'Invalid challenge signature' });
  }

  if (Date.now() > expiresAt) {
    return res.status(400).json({ error: 'Challenge expired' });
  }

  const supabase = createClient(sbEnv.getSupabaseUrl(), sbEnv.getSupabaseServiceKey());
  const deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const { error } = await supabase
    .from('mken_staff_devices')
    .insert({
      id: deviceId,
      staff_id: staffId,
      device_name: deviceName,
      credential_id: credentialId,
      public_key: publicKeyDer,
    });

  if (error) throw error;
  return res.status(200).json({ success: true, deviceId: deviceId });
}

// ─── ADMIN LOGIN AND CLIENT OPERATIONS ───
async function handleAdminOperations(req, res) {
  const pin = (req.body && req.body.pin) || req.query.pin || req.headers['x-admin-pin'];
  const expectedPin = process.env.ADMIN_PIN;

  if (!expectedPin) {
    console.error('CRITICAL: ADMIN_PIN environment variable is not configured.');
    return res.status(500).json({ success: false, error: 'تكوين الخادم غير مكتمل: لم يتم إعداد رمز الدخول الرئيسي.' });
  }

  const crypto = require('crypto');
  const safeCompare = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aHash = crypto.createHash('sha256').update(a.trim()).digest();
    const bHash = crypto.createHash('sha256').update(b.trim()).digest();
    return crypto.timingSafeEqual(aHash, bHash);
  };

  const { isRateLimited } = require('../_lib/rate-limit');
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  const rateLimitKey = 'admin_login_failed:' + ip;

  const checkBlock = isRateLimited(rateLimitKey, 5, 60000, false);
  if (checkBlock.limited) {
    return res.status(429).json({ success: false, error: `تم تجاوز الحد الأقصى للمحاولات الخاطئة. الرجاء الانتظار ${checkBlock.retryAfterSec} ثانية.` });
  }

  if (!pin || !safeCompare(pin, expectedPin)) {
    isRateLimited(rateLimitKey, 5, 60000, true);
    return res.status(401).json({ success: false, error: 'رمز الدخول PIN غير صحيح أو غير متوفر' });
  }

  const action = (req.body && req.body.action) || req.query.action || 'login';

  if (action === 'login') {
    return res.status(200).json({ success: true });
  }

  // Intercept save-config if Supabase is not configured (local fallback)
  if (action === 'save-config') {
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseServiceKey) {
      const { configData, tenantSlug } = req.body || {};
      if (!configData || !tenantSlug) {
        return res.status(400).json({ error: 'Missing configData or tenantSlug' });
      }

      const slugClean = tenantSlug.trim().toLowerCase();
      try {
        const fs = require('fs');
        const path = require('path');
        const tenantFilePath = path.join(__dirname, '..', '..', 'data', 'tenants', `${slugClean}.json`);
        
        console.log(`Local fallback: Saving config to ${tenantFilePath}`);
        
        const dir = path.dirname(tenantFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(tenantFilePath, JSON.stringify(configData, null, 2), 'utf8');
        
        return res.status(200).json({ success: true, localSaved: true });
      } catch (fileErr) {
        console.error('Failed to save config locally:', fileErr.message);
        return res.status(500).json({ error: 'Failed to save config locally: ' + fileErr.message });
      }
    }
  }

  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase parameters are not configured in environment.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  if (action === 'list-clients') {
    let data;
    let databaseUpgradeRequired = false;

    const resQuery = await supabase
      .from('mken_saas_clients')
      .select('id, tenant_slug, business_name, email, phone, civil_registry_number, commercial_registry_number, tax_number, security_attachment, has_security_attachment, subscription_status, subscription_tier, subscription_start, subscription_end, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (resQuery.error) {
      const errMessage = resQuery.error.message || '';
      if (resQuery.error.code === '42703' || errMessage.includes('column') || errMessage.includes('does not exist')) {
        console.warn('Database columns missing, running fallback client list query...');
        databaseUpgradeRequired = true;

        const fallbackQuery = await supabase
          .from('mken_saas_clients')
          .select('id, tenant_slug, business_name, email, phone, subscription_status, subscription_end, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (fallbackQuery.error) throw fallbackQuery.error;
        
        data = (fallbackQuery.data || []).map(c => ({
          ...c,
          civil_registry_number: null,
          commercial_registry_number: null,
          tax_number: null,
          security_attachment: null,
          has_security_attachment: false,
          subscription_tier: 'basic',
          subscription_start: c.created_at
        }));
      } else {
        throw resQuery.error;
      }
    } else {
      data = resQuery.data;
    }

    return res.status(200).json({ success: true, clients: data, databaseUpgradeRequired });
  }

  if (action === 'save-config') {
    const { configData, tenantSlug } = req.body || {};
    if (!configData || !tenantSlug) {
      return res.status(400).json({ error: 'Missing configData or tenantSlug' });
    }

    const slugClean = tenantSlug.trim().toLowerCase();

    // Check if client exists
    const { data: clientData, error: clientErr } = await supabase
      .from('mken_saas_clients')
      .select('id')
      .eq('tenant_slug', slugClean)
      .maybeSingle();

    if (clientErr) throw clientErr;

    let result;
    if (!clientData) {
      // If client not found, try to insert
      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 1);
      const insertRes = await supabase
        .from('mken_saas_clients')
        .insert({
          tenant_slug: slugClean,
          business_name: (configData.brand && configData.brand.name) || 'منشأة جديدة',
          email: slugClean + '@mken.com',
          phone: configData.phone || '966543530333',
          subscription_end: oneYear.toISOString(),
          config_data: configData,
          subscription_status: 'active'
        });
      if (insertRes.error) throw insertRes.error;
      result = insertRes.data;
    } else {
      // Update existing client
      const updateRes = await supabase
        .from('mken_saas_clients')
        .update({
          config_data: configData,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', slugClean);
      if (updateRes.error) throw updateRes.error;
      result = updateRes.data;
    }

    return res.status(200).json({ success: true, data: result });
  }

  if (action === 'get-client-contract') {
    const { tenantSlug } = req.body || req.query || {};
    if (!tenantSlug) {
      return res.status(400).json({ error: 'مطلوب معرّف العميل (tenantSlug)' });
    }
    const slugClean = tenantSlug.trim().toLowerCase();
    let client;
    const resQuery = await supabase
      .from('mken_saas_clients')
      .select('id, tenant_slug, business_name, email, phone, civil_registry_number, commercial_registry_number, tax_number, security_attachment, has_security_attachment, subscription_status, subscription_tier, subscription_start, subscription_end, config_data, created_at, updated_at')
      .eq('tenant_slug', slugClean)
      .maybeSingle();

    if (resQuery.error) {
      const errMessage = resQuery.error.message || '';
      if (resQuery.error.code === '42703' || errMessage.includes('column') || errMessage.includes('does not exist')) {
        const fallbackQuery = await supabase
          .from('mken_saas_clients')
          .select('id, tenant_slug, business_name, email, phone, config_data, subscription_status, subscription_end, created_at, updated_at')
          .eq('tenant_slug', slugClean)
          .maybeSingle();

        if (fallbackQuery.error) throw fallbackQuery.error;

        client = fallbackQuery.data ? {
          ...fallbackQuery.data,
          civil_registry_number: null,
          commercial_registry_number: null,
          tax_number: null,
          security_attachment: null,
          has_security_attachment: false,
          subscription_tier: 'basic',
          subscription_start: fallbackQuery.data.created_at
        } : null;
      } else {
        throw resQuery.error;
      }
    } else {
      client = resQuery.data;
    }

    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    // Sanitize config_data if it exists to prevent credentials leakage
    if (client.config_data && typeof client.config_data === 'object') {
      const clean = JSON.parse(JSON.stringify(client.config_data));
      if (clean.whatsappApi && typeof clean.whatsappApi === 'object') {
        delete clean.whatsappApi.token;
        delete clean.whatsappApi.whatsappToken;
        delete clean.whatsappApi.apiKey;
        delete clean.whatsappApi.apiToken;
        delete clean.whatsappApi.secret;
        delete clean.whatsappApi.url;
      }
      if (clean.payment && typeof clean.payment === 'object') {
        delete clean.payment.secretKey;
        delete clean.payment.secret_key;
        delete clean.payment.secret;
        delete clean.payment.publishableKey;
        delete clean.payment.publishable;
      }
      if (clean.zatca && typeof clean.zatca === 'object') {
        delete clean.zatca.privateKey;
        delete clean.zatca.certificate;
        delete clean.zatca.secret;
      }
      client.config_data = clean;
    }

    return res.status(200).json({ success: true, client: client });
  }

  if (action === 'verify-coach-pin') {
    const { tenantSlug, pin, coachingType } = req.body || req.query || {};
    if (!tenantSlug || !pin || !coachingType) {
      return res.status(400).json({ error: 'Missing tenantSlug, pin, or coachingType' });
    }

    const { isRateLimited } = require('../_lib/rate-limit');
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
    const rateLimitKey = 'coach_login_failed:' + ip;

    const checkBlock = isRateLimited(rateLimitKey, 5, 60000, false);
    if (checkBlock.limited) {
      return res.status(429).json({ success: false, error: `تم تجاوز الحد الأقصى للمحاولات الخاطئة. الرجاء الانتظار ${checkBlock.retryAfterSec} ثانية.` });
    }

    const slugClean = tenantSlug.trim().toLowerCase();
    const { data: client, error } = await supabase
      .from('mken_saas_clients')
      .select('config_data')
      .eq('tenant_slug', slugClean)
      .maybeSingle();

    if (error) throw error;
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    const config = client.config_data || {};
    const coachingConfig = config[coachingType] || {};
    const expectedPin = String(coachingConfig.coachPin || '1234').trim();
    const cleanEnteredPin = String(pin).trim();

    const aHash = crypto.createHash('sha256').update(cleanEnteredPin).digest();
    const bHash = crypto.createHash('sha256').update(expectedPin).digest();
    const isMatch = crypto.timingSafeEqual(aHash, bHash);

    if (!isMatch) {
      isRateLimited(rateLimitKey, 5, 60000, true);
    }

    return res.status(200).json({ success: isMatch });
  }

  if (action === 'register-client') {
    const { 
      tenantSlug, businessName, email, password, phone, subscription_tier,
      enabledActivities, enabledServices, customFeatures,
      civilRegistryNumber, commercialRegistryNumber, taxNumber, securityAttachment
    } = req.body || {};
    if (!tenantSlug || !businessName || !email || !password || !phone || !civilRegistryNumber || !commercialRegistryNumber) {
      return res.status(400).json({ error: 'كافة الحقول الأساسية ورقم السجل المدني والتجاري مطلوبة لتسجيل العميل' });
    }

    const slugClean = tenantSlug.trim().toLowerCase();

    const { data: existing, error: checkErr } = await supabase
      .from('mken_saas_clients')
      .select('id')
      .eq('tenant_slug', slugClean)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existing) {
      return res.status(400).json({ error: 'معرّف الرابط (Tenant Slug) محجوز لعميل آخر، اختر اسماً آخر.' });
    }

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (authErr) throw authErr;
    const user = authData.user;

    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    const defaultTenantConfig = {
      enabledActivities: enabledActivities || ['tech-digital', 'it-support'],
      enabled: enabledServices || [
        'web-design', 'mobile-apps', 'landing-pages', 'seo',
        'whatsapp-crm', 'social-media', 'branding', 'ecommerce',
        'computer', 'laptop-repair',
      ],
      featuredActivity: (enabledActivities && enabledActivities[0]) || 'tech-digital',
      featured: (enabledServices && enabledServices[0]) || 'web-design',
      heroFocus: (enabledServices && enabledServices[0]) || 'web-design',
      theme: 'slate',
      phone: phone,
      brand: { name: businessName, tagline: 'مرحباً بك في موقعك الجديد', logo: '' },
      activities: {},
      services: {},
      booking: { enabled: !!(customFeatures ? customFeatures.hasBooking : true), mode: 'form', requirePayment: false },
      serviceArea: { enabled: false, city: 'الرياض', radiusKm: 15 },
      push: { enabled: false },
      supabase: { enabled: false },
      saas: { baseDomain: 'mken.live', useSubdomains: true },
      whatsappApi: { enabled: !!(customFeatures && customFeatures.hasWhatsApp) },
      payment: { enabled: false }
    };

    defaultTenantConfig.subscription = {
      tier: subscription_tier || 'basic',
      customFeatures: customFeatures || null
    };

    const insertObj = {
      tenant_slug: slugClean,
      owner_id: user.id,
      business_name: businessName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subscription_end: oneYear.toISOString(),
      config_data: defaultTenantConfig,
      subscription_status: 'active'
    };

    let clientData;
    const insertRes = await supabase
      .from('mken_saas_clients')
      .insert({
        ...insertObj,
        civil_registry_number: civilRegistryNumber.trim(),
        commercial_registry_number: commercialRegistryNumber.trim(),
        tax_number: taxNumber ? taxNumber.trim() : null,
        security_attachment: securityAttachment ? securityAttachment.trim() : null,
        has_security_attachment: !!securityAttachment,
        subscription_tier: subscription_tier || 'basic'
      })
      .select()
      .single();

    if (insertRes.error) {
      const errMessage = insertRes.error.message || '';
      if (insertRes.error.code === '42703' || errMessage.includes('column') || errMessage.includes('does not exist')) {
        console.warn('Database columns missing during registration, running fallback insert...');
        const fallbackInsert = await supabase
          .from('mken_saas_clients')
          .insert(insertObj)
          .select()
          .single();

        if (fallbackInsert.error) {
          await supabase.auth.admin.deleteUser(user.id);
          throw fallbackInsert.error;
        }
        clientData = fallbackInsert.data;
      } else {
        await supabase.auth.admin.deleteUser(user.id);
        throw insertRes.error;
      }
    } else {
      clientData = insertRes.data;
    }

    return res.status(200).json({ success: true, client: clientData });
  }

  if (action === 'extend-client') {
    const { tenantSlug, months } = req.body || {};
    if (!tenantSlug || !months) {
      return res.status(400).json({ error: 'مطلوب معرّف العميل وعدد الأشهر المراد إضافتها' });
    }

    let client;
    const resQuery = await supabase
      .from('mken_saas_clients')
      .select('subscription_end, phone, business_name, subscription_tier')
      .eq('tenant_slug', tenantSlug)
      .single();

    if (resQuery.error) {
      const errMessage = resQuery.error.message || '';
      if (resQuery.error.code === '42703' || errMessage.includes('column') || errMessage.includes('does not exist')) {
        const fallbackQuery = await supabase
          .from('mken_saas_clients')
          .select('subscription_end, phone, business_name')
          .eq('tenant_slug', tenantSlug)
          .single();

        if (fallbackQuery.error) throw fallbackQuery.error;
        client = fallbackQuery.data ? {
          ...fallbackQuery.data,
          subscription_tier: 'basic'
        } : null;
      } else {
        throw resQuery.error;
      }
    } else {
      client = resQuery.data;
    }

    let currentEnd = new Date(client.subscription_end);
    if (isNaN(currentEnd.getTime()) || currentEnd < new Date()) {
      currentEnd = new Date();
    }

    const mInt = parseInt(months, 10);
    currentEnd.setMonth(currentEnd.getMonth() + mInt);

    const getSaaSPrice = (m) => {
      if (m === 1) return 99;
      if (m === 3) return 249;
      if (m === 6) return 449;
      if (m === 12) return 799;
      return Math.ceil(m * 799 / 12);
    };
    const amount = getSaaSPrice(mInt);

    const { error: updateErr } = await supabase
      .from('mken_saas_clients')
      .update({
        subscription_end: currentEnd.toISOString(),
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('tenant_slug', tenantSlug);

    if (updateErr) throw updateErr;

    const invoiceId = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const { error: invoiceErr } = await supabase
      .from('mken_saas_invoices')
      .insert({
        id: invoiceId,
        tenant_slug: tenantSlug,
        amount: amount,
        months: mInt,
        status: 'paid',
        payment_id: 'manual_' + Date.now().toString(36),
        payment_method: 'manual',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (invoiceErr) console.error(invoiceErr);

    try {
      const { data: defaultTenant } = await supabase
        .from('mken_saas_clients')
        .select('config_data')
        .eq('tenant_slug', 'default')
        .maybeSingle();

      const masterConfig = defaultTenant ? defaultTenant.config_data : {};
      const waConfig = masterConfig.whatsappApi || {};

      if (waConfig.enabled && client.phone) {
        const cleanPhone = (p) => {
          let digits = (p || '').replace(/\D/g, '');
          if (!digits) return '';
          if (digits.indexOf('966') === 0) return digits;
          if (digits.indexOf('0') === 0) return '966' + digits.slice(1);
          if (digits.length === 9) return '966' + digits;
          return digits;
        };
        const phone = cleanPhone(client.phone);
        if (phone) {
          const formattedDate = currentEnd.toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
          const messageText = `فاتورة تجديد اشتراك منصة مكِّن 🧾\n\nشريكنا الموقر في (${client.business_name || tenantSlug})، تم إصدار وتأكيد فاتورة تمديد الاشتراك بنجاح:\n\n- رقم الفاتورة: ${invoiceId}\n- قيمة الفاتورة: ${amount} ريال سعودي\n- مدة التمديد: ${mInt} أشهر\n- تاريخ انتهاء الاشتراك الجديد: ${formattedDate}\n\nشكراً لثقتكم بنا شريكنا المتميز! 🎉`;

          if (waConfig.provider === 'ultramsg' && waConfig.instanceId) {
            const url = `https://api.ultramsg.com/${waConfig.instanceId}/messages/chat`;
            const params = new URLSearchParams();
            params.append('token', waConfig.token);
            params.append('to', phone);
            params.append('body', messageText);
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: params.toString()
            });
          }
        }
      }
    } catch (waErr) {
      console.error(waErr.message);
    }

    return res.status(200).json({ success: true, newEnd: currentEnd.toISOString(), invoiceId });
  }

  if (action === 'change-tier') {
    const { tenantSlug, tier } = req.body || {};
    if (!tenantSlug || !tier) {
      return res.status(400).json({ error: 'مطلوب معرّف العميل وباقة الاشتراك المطلوبة' });
    }

    const { error: updateErr } = await supabase
      .from('mken_saas_clients')
      .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
      .eq('tenant_slug', tenantSlug);

    if (updateErr) {
      const errMessage = updateErr.message || '';
      if (updateErr.code === '42703' || errMessage.includes('column') || errMessage.includes('does not exist')) {
        return res.status(400).json({ error: 'مطلوب ترقية قاعدة البيانات (SQL Upgrade) لتغيير الباقة.' });
      }
      throw updateErr;
    }
    return res.status(200).json({ success: true, tier: tier });
  }

  if (action === 'reset-client-password') {
    const { tenantSlug, newPassword } = req.body || {};
    if (!tenantSlug || !newPassword) {
      return res.status(400).json({ error: 'مطلوب معرّف العميل وكلمة المرور الجديدة' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const slugClean = tenantSlug.trim().toLowerCase();
    const { data: client, error: fetchErr } = await supabase
      .from('mken_saas_clients')
      .select('owner_id, email')
      .eq('tenant_slug', slugClean)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }

    // Existing auth user: update the password instantly (no email needed)
    if (client.owner_id) {
      const { error: updErr } = await supabase.auth.admin.updateUserById(client.owner_id, {
        password: String(newPassword),
      });
      if (updErr) throw updErr;
      return res.status(200).json({ success: true, email: client.email, created: false });
    }

    // Legacy client without a login account: create one and link it
    if (!client.email) {
      return res.status(400).json({ error: 'لا يوجد بريد إلكتروني مسجّل لهذا العميل لإنشاء حساب دخول.' });
    }
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: client.email,
      password: String(newPassword),
      email_confirm: true,
    });
    if (createErr) throw createErr;

    const { error: linkErr } = await supabase
      .from('mken_saas_clients')
      .update({ owner_id: created.user.id, updated_at: new Date().toISOString() })
      .eq('tenant_slug', slugClean);
    if (linkErr) throw linkErr;

    return res.status(200).json({ success: true, email: client.email, created: true });
  }

  if (action === 'delete-client') {
    const { tenantSlug } = req.body || {};
    if (!tenantSlug) {
      return res.status(400).json({ error: 'مطلوب معرّف العميل للحذف' });
    }

    const { data: client, error: fetchErr } = await supabase
      .from('mken_saas_clients')
      .select('owner_id')
      .eq('tenant_slug', tenantSlug)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    const { error: deleteErr } = await supabase
      .from('mken_saas_clients')
      .delete()
      .eq('tenant_slug', tenantSlug);

    if (deleteErr) throw deleteErr;

    if (client && client.owner_id) {
      await supabase.auth.admin.deleteUser(client.owner_id);
    }

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'العملية المطلوبة غير مدعومة' });
}

// ─── MAIN HANDLER ───
module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return;

  // Parse custom routing parameter "type"
  let type = (req.query && req.query.type) || '';
  if (!type) {
    const url = req.url || '';
    if (url.indexOf('supabase-config') !== -1) {
      type = 'supabase-config';
    } else if (url.indexOf('admin-login') !== -1) {
      type = 'admin-login';
    }
  }

  // Only enforce database environment configuration on routes that strictly require it
  if (type !== 'supabase-config' && type !== 'admin-login') {
    const supabaseUrl = sbEnv.getSupabaseUrl();
    const supabaseKey = sbEnv.getSupabaseServiceKey();
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }
  }

  try {
    if (type === 'supabase-config') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      return res.status(200).json({
        supabaseUrl: sbEnv.getSupabaseUrl(),
        supabaseKey: sbEnv.getSupabaseAnonKey(),
        enabled: sbEnv.hasSupabaseClientConfig(),
      });
    }

    if (type === 'admin-login') {
      if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }
      return await handleAdminOperations(req, res);
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (type === 'login') {
      if (getStep(req) === 'verify') {
        return await handleLoginVerify(req, res);
      }
      return await handleLoginChallenge(req, res);
    }

    if (type === 'register') {
      if (getStep(req) === 'verify') {
        return await handleRegisterVerify(req, res);
      }
      return await handleRegisterChallenge(req, res);
    }

    return res.status(400).json({ error: 'Unknown authentication type' });
  } catch (err) {
    console.error('Authentication process failed:', err.message);
    return res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};
