'use strict';

/**
 * Seed / reset Super Admin (admin@mken.live)
 * Run from repo root:
 *   node scripts/seed-admin.cjs
 *   node scripts/seed-admin.cjs --url=https://xxxx.supabase.co --key=SERVICE_ROLE_KEY
 *
 * Note: scripts/package.json has "type":"module" — this file must stay .cjs for require().
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Fallback search sequence for environment files to get Supabase credentials
const envFiles = [
  '.env.production.local',
  '.env.local',
  '.env.vercel.production.new.pull',
  '.env.vercel.production.pull',
  '.env.vercel.new.pull',
  '.env.vercel.pull',
  '.env.development.local',
  '.env'
];

let supabaseUrl = process.env.SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Custom env file parser to avoid dependency issues
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {};
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      result[key] = value;
    }
  }
  return result;
}

// Search across all env files
for (const file of envFiles) {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const parsed = parseEnvFile(fullPath);
    if (!supabaseUrl && parsed.SUPABASE_URL) {
      supabaseUrl = parsed.SUPABASE_URL;
      console.log(`Found SUPABASE_URL in ${file}`);
    }
    if (!serviceKey && parsed.SUPABASE_SERVICE_ROLE_KEY) {
      serviceKey = parsed.SUPABASE_SERVICE_ROLE_KEY;
      console.log(`Found SUPABASE_SERVICE_ROLE_KEY in ${file}`);
    }
  }
}

// Check command line arguments as fallback
const args = process.argv.slice(2);
for (const arg of args) {
  if (arg.startsWith('--url=')) {
    supabaseUrl = arg.split('=')[1];
  }
  if (arg.startsWith('--key=')) {
    serviceKey = arg.split('=')[1];
  }
}

if (!supabaseUrl || !serviceKey) {
  console.error('\n❌ خطأ: لم يتم العثور على SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY في ملفات البيئة المحلية.');
  console.log('يرجى تمرير المعاملات كالتالي:');
  console.log('node scripts/seed-admin.cjs --url=https://xxxx.supabase.co --key=your-service-role-key\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const email = process.env.MKEN_ADMIN_EMAIL || 'admin@mken.live';
const password = process.env.MKEN_ADMIN_PASSWORD || 'Aa#321321';
const LEGACY_ADMIN_EMAIL = 'admin@mkem.live';

async function seedAdmin() {
  console.log(`\n⏳ بدء عملية تسجيل حساب المشرف الرئيسي: ${email}...`);

  // 1. Check if client record exists in mken_saas_clients
  const { data: existingClient, error: clientErr } = await supabase
    .from('mken_saas_clients')
    .select('owner_id')
    .eq('tenant_slug', 'admin')
    .maybeSingle();

  if (clientErr) {
    console.error('❌ فشل الاستعلام عن العميل من جدول mken_saas_clients:', clientErr.message);
    throw clientErr;
  }

  let userId;
  if (existingClient && existingClient.owner_id) {
    userId = existingClient.owner_id;
    console.log(`ℹ️ تم العثور على سجل مسبق للمستأجر "admin" بمعرّف المستخدم: ${userId}`);

    // Attempt updating password
    console.log('⏳ جاري تحديث الرمز السري للمستخدم في Supabase Auth...');
    const { error: updateAuthErr } = await supabase.auth.admin.updateUserById(userId, {
      email: email,
      password: password,
      email_confirm: true
    });

    if (updateAuthErr) {
      console.warn('⚠️ فشل تحديث المستخدم (ربما تم حذفه من Auth). جاري محاولة إعادة إنشائه...');
      const { data: newAuthData, error: newAuthErr } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
      });
      if (newAuthErr) throw newAuthErr;
      userId = newAuthData.user.id;

      console.log(`✅ تم إنشاء الحساب مجدداً بمعرّف: ${userId}`);
      await supabase
        .from('mken_saas_clients')
        .update({ owner_id: userId, email: email, updated_at: new Date().toISOString() })
        .eq('tenant_slug', 'admin');
    } else {
      console.log('✅ تم تحديث الرمز السري بنجاح.');
      await supabase
        .from('mken_saas_clients')
        .update({ email: email, updated_at: new Date().toISOString() })
        .eq('tenant_slug', 'admin');
    }
  } else {
    // Create new Auth User
    console.log('⏳ جاري إنشاء مستخدم جديد في Supabase Auth...');
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (authErr) {
      if (authErr.message && authErr.message.includes('already registered')) {
        console.warn('⚠️ البريد مسجّل مسبقاً في Auth. جاري البحث عن المستخدم وربطه...');
        let foundId = null;
        let page = 1;
        for (let i = 0; i < 10 && !foundId; i++) {
          const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: page, perPage: 200 });
          if (listErr) throw listErr;
          const hit = (listed.users || []).find(function (u) {
            var e = (u.email || '').toLowerCase();
            return e === email.toLowerCase() || e === LEGACY_ADMIN_EMAIL;
          });
          if (hit) foundId = hit.id;
          if (!listed.users || listed.users.length < 200) break;
          page += 1;
        }
        if (!foundId) {
          console.error('❌ تعذر إيجاد المستخدم في Auth رغم أنه مسجّل.');
          process.exit(1);
        }
        userId = foundId;
        await supabase.auth.admin.updateUserById(userId, {
          email: email,
          password: password,
          email_confirm: true,
        });
        console.log(`✅ تم تحديث المستخدم الموجود: ${userId}`);
      } else {
        throw authErr;
      }
    } else {
      userId = authData.user.id;
      console.log(`✅ تم إنشاء المستخدم بنجاح. UUID: ${userId}`);
    }

    // Insert or update client record
    console.log('⏳ جاري ضمان سجل المستأجر "admin" في جدول mken_saas_clients...');
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 10);

    const defaultTenantConfig = {
      enabledActivities: ['tech-digital', 'it-support', 'legal'],
      enabled: [
        'web-design', 'mobile-apps', 'landing-pages', 'seo',
        'whatsapp-crm', 'social-media', 'branding', 'ecommerce',
        'computer', 'laptop-repair',
      ],
      featuredActivity: 'tech-digital',
      featured: 'web-design',
      heroFocus: 'web-design',
      theme: 'slate',
      phone: '966543530333',
      brand: { name: 'لوحة التحكم العامة', tagline: 'إدارة منصة مكن', logo: '' },
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

    if (existingClient) {
      const { error: updErr } = await supabase
        .from('mken_saas_clients')
        .update({
          owner_id: userId,
          email: email,
          business_name: 'الإدارة العامة (Super Admin)',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_slug', 'admin');
      if (updErr) throw updErr;
      console.log('✅ تم ربط المستأجر "admin" بحساب السوبر أدمن.');
    } else {
      const { error: insertErr } = await supabase
        .from('mken_saas_clients')
        .insert({
          tenant_slug: 'admin',
          owner_id: userId,
          business_name: 'الإدارة العامة (Super Admin)',
          email: email,
          phone: '966543530333',
          subscription_end: oneYear.toISOString(),
          config_data: defaultTenantConfig,
          subscription_status: 'active',
          subscription_tier: 'enterprise'
        });

      if (insertErr) {
        console.error('❌ فشل إنشاء سجل المستأجر في قاعدة البيانات:', insertErr.message);
        throw insertErr;
      }
      console.log('✅ تم إنشاء سجل المستأجر بنجاح.');
    }
  }

  console.log('\n======================================================');
  console.log('🎉 تم تأسيس حساب المشرف الرئيسي وتحديث الصلاحيات بنجاح!');
  console.log(`البريد الإلكتروني: ${email}`);
  console.log(`الرمز السري: ${password}`);
  console.log('======================================================\n');
}

seedAdmin().catch(err => {
  console.error('\n❌ حدث خطأ غير متوقع أثناء التشغيل:', err.message);
  process.exit(1);
});
