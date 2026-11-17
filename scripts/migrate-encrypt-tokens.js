'use strict';

/**
 * scripts/migrate-encrypt-tokens.js
 * سكريبت ترحيل وتشفير توكنات Google OAuth القديمة (Legacy Plaintext Tokens Migration)
 * الامتثال: ضوابط الهيئة الوطنية للأمن السيبراني (NCA) ونظام حماية البيانات الشخصية (PDPL)
 */

const { getSupabaseAdmin } = require('../mkn-theme/src/server/platform/_lib/google-auth-helper');
const { encryptToken, isEncrypted } = require('../mkn-theme/src/server/platform/_lib/token-crypto');

async function migrateTokens() {
  console.log('--- بدء فحص وترحيل توكنات Google OAuth إلى التشفير المعياري (AES-256-GCM) ---');
  const supabase = getSupabaseAdmin();

  const { data: clients, error } = await supabase
    .from('mken_saas_clients')
    .select('tenant_slug, google_access_token, google_refresh_token');

  if (error) {
    console.error('فشل جلب بيانات المستأجرين من Supabase:', error.message);
    process.exit(1);
  }

  if (!clients || clients.length === 0) {
    console.log('لا يوجد مستأجرون مسجلون في قاعدة البيانات.');
    return;
  }

  let inspected = 0;
  let migrated = 0;
  let alreadyEncrypted = 0;

  for (const client of clients) {
    inspected++;
    const { tenant_slug, google_access_token, google_refresh_token } = client;

    const hasAccess = Boolean(google_access_token);
    const hasRefresh = Boolean(google_refresh_token);

    if (!hasAccess && !hasRefresh) {
      continue;
    }

    const accessNeedsEnc = hasAccess && !isEncrypted(google_access_token);
    const refreshNeedsEnc = hasRefresh && !isEncrypted(google_refresh_token);

    if (!accessNeedsEnc && !refreshNeedsEnc) {
      alreadyEncrypted++;
      continue;
    }

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (accessNeedsEnc) {
      updatePayload.google_access_token = encryptToken(google_access_token);
    }
    if (refreshNeedsEnc) {
      updatePayload.google_refresh_token = encryptToken(google_refresh_token);
    }

    const { error: updateError } = await supabase
      .from('mken_saas_clients')
      .update(updatePayload)
      .eq('tenant_slug', tenant_slug);

    if (updateError) {
      console.error(`خطأ أثناء ترحيل المستأجر [${tenant_slug}]:`, updateError.message);
    } else {
      migrated++;
      console.log(`[نجاح] تم تشفير توكنات المستأجر: ${tenant_slug}`);
    }
  }

  console.log('--------------------------------------------------');
  console.log(`اكتمل الفحص: إجمالي المنشآت المفحوصة: ${inspected}`);
  console.log(`تم تشفير وترحيل: ${migrated} منشأة`);
  console.log(`كانت مشفرة مسبقاً: ${alreadyEncrypted} منشأة`);
  console.log('--------------------------------------------------');
}

if (require.main === module) {
  migrateTokens()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('خطأ غير متوقع:', err);
      process.exit(1);
    });
}

module.exports = { migrateTokens };
