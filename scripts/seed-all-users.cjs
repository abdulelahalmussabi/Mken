'use strict';

/**
 * Seed / Reset All Platform Admin Users in Supabase
 * - admin@mken.live (Super Admin, tenant: admin)
 * - almahrusa@mken.live (tenant: almahrusa)
 * - almasabi@mken.live (tenant: almasabi)
 * - demo@mken.live (tenant: demo)
 *
 * Password for all: Aa#321321
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const siteUrl = 'https://mken.live';

async function seedAllUsers() {
  console.log('📡 Fetching Supabase credentials via API endpoint or env...');
  let supabaseUrl = process.env.SUPABASE_URL;
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Try fetching anon key from site to get URL, service role key requires env
    const envFiles = [
      '.env.production.local',
      '.env.local',
      '.env.vercel.production.new.pull',
      '.env.vercel.production.pull',
      '.env'
    ];
    for (const file of envFiles) {
      const fullPath = path.join(process.cwd(), file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.trim().split('=');
          if (parts.length >= 2) {
            const k = parts[0].trim();
            const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
            if (!supabaseUrl && k === 'SUPABASE_URL') supabaseUrl = v;
            if (!serviceKey && k === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = v;
          }
        }
      }
    }
  }

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Could not find SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally.');
    return false;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const defaultPassword = 'Aa#321321';
  const targetUsers = [
    { email: 'admin@mken.live', slug: 'admin', name: 'الإدارة العامة (Super Admin)' },
    { email: 'almahrusa@mken.live', slug: 'almahrusa', name: 'مجموعة المحروسة' },
    { email: 'almasabi@mken.live', slug: 'almasabi', name: 'مؤسسة المصعبي للتجارة' },
    { email: 'demo@mken.live', slug: 'demo', name: 'صالون النخبة' }
  ];

  console.log('\n======================================================');
  console.log('⏳ بدء تهيئة كافة حسابات المديرين في Supabase...');
  console.log('======================================================\n');

  for (const userConfig of targetUsers) {
    console.log(`\n🔹 معالجة الحساب: ${userConfig.email} (${userConfig.slug})...`);
    
    // 1. Find or create user in Supabase Auth
    let userId = null;
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      console.error(`❌ فشل استعلام المستخدمين في Auth:`, listErr.message);
      continue;
    }

    const existingUser = (usersData.users || []).find(u => 
      (u.email || '').toLowerCase() === userConfig.email.toLowerCase()
    );

    if (existingUser) {
      userId = existingUser.id;
      console.log(`  ℹ️ المستخدم موجود في Auth (UUID: ${userId})، جاري تحديث كلمة المرور والتأكيد...`);
      const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
        password: defaultPassword,
        email_confirm: true
      });
      if (updErr) {
        console.error(`  ❌ فشل تحديث كلمة المرور:`, updErr.message);
      } else {
        console.log(`  ✅ تم تحديث كلمة المرور بنجاح إلى "${defaultPassword}".`);
      }
    } else {
      console.log(`  ⏳ إنشاء مستخدم جديد في Auth...`);
      const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
        email: userConfig.email,
        password: defaultPassword,
        email_confirm: true
      });
      if (createErr) {
        console.error(`  ❌ فشل إنشاء المستخدم:`, createErr.message);
        continue;
      }
      userId = newAuth.user.id;
      console.log(`  ✅ تم إنشاء المستخدم بنجاح (UUID: ${userId}).`);
    }

    // 2. Ensure record in mken_saas_clients
    const { data: existingClient, error: clientErr } = await supabase
      .from('mken_saas_clients')
      .select('id')
      .eq('tenant_slug', userConfig.slug)
      .maybeSingle();

    if (clientErr) {
      console.error(`  ❌ فشل فحص جدول mken_saas_clients:`, clientErr.message);
      continue;
    }

    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 10);

    if (existingClient) {
      const { error: updClientErr } = await supabase
        .from('mken_saas_clients')
        .update({
          owner_id: userId,
          email: userConfig.email,
          business_name: userConfig.name,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_slug', userConfig.slug);

      if (updClientErr) {
        console.error(`  ❌ فشل تحديث سجل mken_saas_clients:`, updClientErr.message);
      } else {
        console.log(`  ✅ تم ربط سجل المستأجر "${userConfig.slug}" بمعرّف المستخدم ${userId}.`);
      }
    } else {
      const insertObj = {
        tenant_slug: userConfig.slug,
        owner_id: userId,
        business_name: userConfig.name,
        email: userConfig.email,
        phone: '966543530333',
        subscription_end: oneYear.toISOString(),
        config_data: { brand: { name: userConfig.name } },
        subscription_status: 'active'
      };
      const { error: insClientErr } = await supabase
        .from('mken_saas_clients')
        .insert(insertObj);

      if (insClientErr) {
        console.error(`  ❌ فشل إنشاء سجل mken_saas_clients:`, insClientErr.message);
      } else {
        console.log(`  ✅ تم إدراج سجل المستأجر "${userConfig.slug}" بنجاح.`);
      }
    }
  }

  console.log('\n======================================================');
  console.log('🎉 اكتملت تهيئة كافة الحسابات بنجاح!');
  console.log('======================================================\n');
  return true;
}

seedAllUsers().catch(console.error);
