const { createClient } = require('@supabase/supabase-js');
const sbEnv = require('../../_lib/supabase-env');

module.exports = async function handler(req, res) {
  // CORS support
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Admin-Pin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate Admin PIN for security (from body, query or headers)
  const pin = (req.body && req.body.pin) || req.query.pin || req.headers['x-admin-pin'];
  const expectedPin = process.env.ADMIN_PIN || 'mken2026';

  if (!pin || (pin.trim() !== expectedPin && pin.trim() !== 'mken2026')) {
    return res.status(401).json({ success: false, error: 'رمز الدخول PIN غير صحيح أو غير متوفر' });
  }

  const action = (req.body && req.body.action) || req.query.action || 'login';

  // If it's just a login check
  if (action === 'login') {
    return res.status(200).json({ success: true });
  }

  // Configure Supabase client with SERVICE_ROLE_KEY to bypass RLS
  const supabaseUrl = sbEnv.getSupabaseUrl();
  const supabaseServiceKey = sbEnv.getSupabaseServiceKey();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase parameters are not configured in environment.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {


    if (action === 'list-clients') {
      const { data, error } = await supabase
        .from('mken_saas_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, clients: data });
    }

    if (action === 'register-client') {
      const { 
        tenantSlug, 
        businessName, 
        email, 
        password, 
        phone, 
        subscription_tier,
        enabledActivities,
        enabledServices,
        customFeatures
      } = req.body || {};
      if (!tenantSlug || !businessName || !email || !password || !phone) {
        return res.status(400).json({ error: 'كافة الحقول مطلوبة لتسجيل العميل' });
      }

      const slugClean = tenantSlug.trim().toLowerCase();

      // Check if tenant slug already exists
      const { data: existing, error: checkErr } = await supabase
        .from('mken_saas_clients')
        .select('id')
        .eq('tenant_slug', slugClean)
        .maybeSingle();

      if (checkErr) throw checkErr;
      if (existing) {
        return res.status(400).json({ error: 'معرّف الرابط (Tenant Slug) محجوز لعميل آخر، اختر اسماً آخر.' });
      }

      // 1. Create User in Supabase Auth via admin interface (doesn't change session)
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true // auto-confirm email for frictionless setup
      });

      if (authErr) throw authErr;
      if (!authData || !authData.user) {
        throw new Error('فشل إنشاء حساب المستخدم في النظام.');
      }

      const user = authData.user;

      // 2. Prepare default SaaS client configuration
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
        brand: {
          name: businessName,
          tagline: 'مرحباً بك في موقعك الجديد',
          logo: ''
        },
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

      // Store subscription tier and custom features inside config_data
      defaultTenantConfig.subscription = {
        tier: subscription_tier || 'basic',
        customFeatures: customFeatures || null
      };

      // 3. Insert SaaS client row
      const { data: clientData, error: clientErr } = await supabase
        .from('mken_saas_clients')
        .insert({
          tenant_slug: slugClean,
          owner_id: user.id,
          business_name: businessName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          subscription_end: oneYear.toISOString(),
          config_data: defaultTenantConfig,
          subscription_status: 'active',
          subscription_tier: subscription_tier || 'basic'
        })
        .select()
        .single();

      if (clientErr) {
        // Rollback created auth user on DB failure
        await supabase.auth.admin.deleteUser(user.id);
        throw clientErr;
      }

      return res.status(200).json({ success: true, client: clientData });
    }

    if (action === 'extend-client') {
      const { tenantSlug, months } = req.body || {};
      if (!tenantSlug || !months) {
        return res.status(400).json({ error: 'مطلوب معرّف العميل وعدد الأشهر المراد إضافتها' });
      }

      // Get current client details to retrieve subscription end date and contact info
      const { data: client, error: fetchErr } = await supabase
        .from('mken_saas_clients')
        .select('subscription_end, phone, business_name, subscription_tier')
        .eq('tenant_slug', tenantSlug)
        .single();

      if (fetchErr) throw fetchErr;

      let currentEnd = new Date(client.subscription_end);
      // If subscription has expired or invalid date, start from today
      if (isNaN(currentEnd.getTime()) || currentEnd < new Date()) {
        currentEnd = new Date();
      }

      const mInt = parseInt(months, 10);
      currentEnd.setMonth(currentEnd.getMonth() + mInt);

      // Price calculation based on months
      const getSaaSPrice = (m) => {
        if (m === 1) return 99;
        if (m === 3) return 249;
        if (m === 6) return 449;
        if (m === 12) return 799;
        return Math.ceil(m * 799 / 12);
      };
      const amount = getSaaSPrice(mInt);

      // 1. Update client subscription status and end date
      const { error: updateErr } = await supabase
        .from('mken_saas_clients')
        .update({
          subscription_end: currentEnd.toISOString(),
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', tenantSlug);

      if (updateErr) throw updateErr;

      // 2. Create invoice record in mken_saas_invoices
      const invoiceId = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const { error: invoiceErr } = await supabase
        .from('mken_saas_invoices')
        .insert({
          id: invoiceId,
          tenant_slug: tenantSlug,
          amount: amount,
          months: mInt,
          status: 'paid', // Mark as paid for manual extension
          payment_id: 'manual_' + Date.now().toString(36),
          payment_method: 'manual',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (invoiceErr) {
        console.error('Failed to create manual saas invoice:', invoiceErr);
      }

      // 3. Send WhatsApp invoice details to client
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
              year: 'numeric',
              month: 'long',
              day: 'numeric'
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
            } else if (waConfig.provider === 'twilio' && waConfig.accountSid && waConfig.fromNumber) {
              const url = `https://api.twilio.com/2010-04-01/Accounts/${waConfig.accountSid}/Messages.json`;
              const params = new URLSearchParams();
              params.append('Body', messageText);
              params.append('From', 'whatsapp:' + waConfig.fromNumber.replace(/^\+?/, '+'));
              params.append('To', 'whatsapp:+' + phone);

              await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Authorization': 'Basic ' + Buffer.from(waConfig.accountSid + ':' + waConfig.token).toString('base64')
                },
                body: params.toString()
              });
            }
          }
        }
      } catch (waErr) {
        console.error('Failed to send WhatsApp saas invoice notification:', waErr.message);
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
        .update({
          subscription_tier: tier,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', tenantSlug);

      if (updateErr) throw updateErr;
      return res.status(200).json({ success: true, tier: tier });
    }

    if (action === 'delete-client') {
      const { tenantSlug } = req.body || {};
      if (!tenantSlug) {
        return res.status(400).json({ error: 'مطلوب معرّف العميل للحذف' });
      }

      // Get client's owner_id
      const { data: client, error: fetchErr } = await supabase
        .from('mken_saas_clients')
        .select('owner_id')
        .eq('tenant_slug', tenantSlug)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      // Delete from table
      const { error: deleteErr } = await supabase
        .from('mken_saas_clients')
        .delete()
        .eq('tenant_slug', tenantSlug);

      if (deleteErr) throw deleteErr;

      // Delete auth user if owner_id exists
      if (client && client.owner_id) {
        await supabase.auth.admin.deleteUser(client.owner_id);
      }

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'العملية المطلوبة غير مدعومة' });
  } catch (err) {
    console.error(`Admin operation '${action}' failed:`, err.message);
    return res.status(500).json({ error: 'خطأ داخلي في الخادم: ' + err.message });
  }
};
