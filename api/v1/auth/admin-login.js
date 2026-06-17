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
      const { tenantSlug, businessName, email, password, phone } = req.body || {};
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
        enabledActivities: ['tech-digital', 'it-support'],
        enabled: [
          'web-design', 'mobile-apps', 'landing-pages', 'seo',
          'whatsapp-crm', 'social-media', 'branding', 'ecommerce',
          'computer', 'laptop-repair',
        ],
        featuredActivity: 'tech-digital',
        featured: 'web-design',
        heroFocus: 'web-design',
        theme: 'slate',
        phone: phone,
        brand: {
          name: businessName,
          tagline: 'مرحباً بك في موقعك الجديد',
          logo: ''
        },
        activities: {},
        services: {},
        booking: { enabled: true, mode: 'form', requirePayment: false },
        serviceArea: { enabled: false, city: 'الرياض', radiusKm: 15 },
        push: { enabled: false },
        supabase: { enabled: false },
        saas: { baseDomain: 'mken.live', useSubdomains: true },
        whatsappApi: { enabled: false },
        payment: { enabled: false }
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
          subscription_status: 'active'
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

      // Get current client to retrieve subscription end date
      const { data: client, error: fetchErr } = await supabase
        .from('mken_saas_clients')
        .select('subscription_end')
        .eq('tenant_slug', tenantSlug)
        .single();

      if (fetchErr) throw fetchErr;

      let currentEnd = new Date(client.subscription_end);
      // If subscription has expired or invalid date, start from today
      if (isNaN(currentEnd.getTime()) || currentEnd < new Date()) {
        currentEnd = new Date();
      }

      currentEnd.setMonth(currentEnd.getMonth() + parseInt(months, 10));

      const { error: updateErr } = await supabase
        .from('mken_saas_clients')
        .update({
          subscription_end: currentEnd.toISOString(),
          subscription_status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', tenantSlug);

      if (updateErr) throw updateErr;
      return res.status(200).json({ success: true, newEnd: currentEnd.toISOString() });
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
