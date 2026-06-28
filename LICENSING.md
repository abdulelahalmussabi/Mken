# مكن — خادم التراخيص والتوقيع الرقمي (Mken Lite)

نظام إصدار/تفعيل تراخيص **Mken Lite** مع توقيع رقمي (ECDSA P-256) لمنع التزوير، ولوحة إدارة على دومين فرعي.

## المكوّنات

| الملف | الوظيفة |
|------|---------|
| `api/_lib/license-sign.js` | توقيع/تحقق ECDSA P-256 (ES256) + توليد المفاتيح والمفتاح البشري |
| `api/_lib/license-issue.js` | التسعير وإصدار الترخيص (مشترك: الإدارة + الدفع) |
| `api/license.js` | خادم التفعيل والإدارة (activate/verify/deactivate/issue/list/revoke/suspend/resume) |
| `api/license-checkout.js` | بوابة الدفع العامة (config/status) |
| `api/moyasar-webhook.js` | إصدار الترخيص آلياً بعد الدفع (نوع `mken_lite_license`) |
| `api/lite-sync.js` | المزامنة السحابية الاختيارية (push/pull) — المرحلة 5 |
| `db/license-schema.sql` | جداول Supabase (التراخيص/الأجهزة/الأحداث) |
| `db/lite-sync-schema.sql` | جدول المزامنة السحابية (`mken_lite_records`) |
| `pricing.html` + `js/pricing.js` | صفحة التسعير والاشتراك العامة (Moyasar) |
| `license-success.html` | صفحة تأكيد الدفع وعرض المفتاح |
| `license-admin.html` + `js/license-admin.js` | لوحة إدارة الاشتراكات |
| `scripts/generate-license-keys.cjs` | توليد زوج مفاتيح التوقيع (مرة واحدة) |
| `scripts/test-license-sign.cjs` | اختبار دورة التوقيع/التحقق |

## خطوات الإعداد

### 1) قاعدة البيانات
نفّذ `db/license-schema.sql` في Supabase SQL Editor.

### 2) توليد مفاتيح التوقيع (مرة واحدة)
```bash
node scripts/generate-license-keys.cjs
```
ثم أضِف في متغيرات بيئة Vercel:
- `LICENSE_PRIVATE_KEY` (سرّي — الخادم فقط)
- `LICENSE_PUBLIC_KEY` (عام)
- `LICENSE_ADMIN_TOKEN` (رمز قوي لحماية لوحة الإدارة)
- `MOYASAR_PUBLISHABLE_KEY` (المفتاح المنشور لبوابة الدفع)
- (موجودة مسبقاً) `MOYASAR_SECRET_KEY` و `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY`

وانسخ **المفتاح العام (SPKI)** إلى عميل Mken Lite في `js/license-config.js` (الحقل `PUBLIC_KEY_PEM`) ليتم التحقق أوف لاين.

### 3) الدومين الفرعي
أضِف `license.mken.live` (أو `licenses.mken.live`) في إعدادات الدومين بـ Vercel.
- جذر الدومين `/` → **صفحة التسعير العامة** `pricing.html`.
- `/admin` → **لوحة إدارة التراخيص** `license-admin.html`.
- الـ API على `/api/license` و `/api/license-checkout`.

### 4) بوابة الدفع (Moyasar)
في لوحة Moyasar، اضبط **Webhook URL** إلى:
```
https://mken.live/api/moyasar-webhook
```
عند نجاح الدفع لاشتراك Mken Lite (metadata.type = `mken_lite_license`)، يتحقق الـ webhook من الدفعة عبر Moyasar API، يتأكد من المبلغ، **يُصدر الترخيص آلياً**، ويرسل المفتاح للعميل عبر واتساب. صفحة `license-success.html` تستعلم عن `status` لعرض المفتاح فوراً.

> الأسعار معرّفة مركزياً في `api/_lib/license-issue.js` (`PLANS`)، ويُستخدم نفس المصدر للتحقق من المبلغ ومنع التلاعب.

## واجهات الـ API

### عامة (لعميل Mken Lite)
```
POST /api/license/activate    { licenseKey, machineId, hostname }
  → { token (موقّع), plan, expiresAt, maxDevices }
POST /api/license/verify      { licenseKey, machineId }   → { valid, status, token }
POST /api/license/deactivate  { licenseKey, machineId }   → { success }
```

### إدارية (هيدر `X-Admin-Token: <LICENSE_ADMIN_TOKEN>`)
```
POST /api/license/issue    { plan, customerName, phone, email, months, maxDevices, billingCycle, notes }
GET  /api/license/list     [?status=&q=]
POST /api/license/revoke   { licenseKey }
POST /api/license/suspend  { licenseKey }
POST /api/license/resume   { licenseKey }
```

## آلية الحماية
1. **الإصدار:** الأدمن يصدر مفتاحاً (`MKEN-XXXX-...`) ويُخزَّن مع الباقة/المدة/عدد الأجهزة.
2. **التفعيل:** العميل يرسل المفتاح + بصمة الجهاز → الخادم يربط الجهاز (يرفض تجاوز `max_devices`) ويعيد **توكناً موقّعاً رقمياً** يحوي بصمة الجهاز وتاريخ الانتهاء.
3. **التحقق أوف لاين:** العميل يتحقق من توقيع التوكن بالمفتاح العام المضمّن + مطابقة بصمة الجهاز + الانتهاء — دون إنترنت. أي عبث/نقل لجهاز آخر = غير صالح.
4. **heartbeat اختياري:** تحقق دوري عند الاتصال لكشف الإلغاء/الإيقاف عن بُعد.

> التوقيع بصيغة IEEE P-1363 (r||s) ليكون متوافقاً مع Web Crypto في العميل.

## المزامنة السحابية الاختيارية (المرحلة 5)

مزامنة **اختيارية** بين أجهزة/فروع العميل عبر مكن. التطبيق يبقى أوف لاين أولاً؛ المزامنة تعمل فقط عند توفر الإنترنت وبترخيص مفعّل.

### الإعداد
1. نفّذ `db/lite-sync-schema.sql` في Supabase (ينشئ `mken_lite_records`).
2. في عميل Mken Lite (`js/license-config.js`) اضبط `SYNC_URL` (افتراضياً `https://license.mken.live/api/lite-sync`) و`SYNC_INTERVAL_MIN`.
3. المستخدم يفعّل المزامنة من **الإعدادات → المزامنة السحابية**.

### الواجهات
```
POST /api/lite-sync/push  { licenseKey, machineId, changes:[{store,id,updatedAt,data,deleted}] }
  → { success, upserted, serverTime }
POST /api/lite-sync/pull  { licenseKey, machineId, since, limit }
  → { records:[{store,id,updatedAt,data,deleted}], serverTime, hasMore, cursor }
```

### الآلية
- **الحساب = مفتاح الترخيص**؛ كل سجل مرتبط بـ `license_key` ومحميّ بالتحقق من ربط الجهاز (يجب تفعيل الترخيص أولاً).
- المخازن المتزامنة: `branches | products | customers | invoices | shifts` (الفواتير append-only؛ الباقي **آخر تعديل يفوز** عبر `updatedAt`).
- العميل (`js/sync.js`) يجمع التغييرات منذ آخر مزامنة ويرفعها، ثم يسحب تغييرات الأجهزة الأخرى ويطبّقها محلياً. مزامنة تلقائية دورية + عند عودة الإنترنت + زر يدوي.
- لا تتم المزامنة في الوضع التجريبي (بدون مفتاح ترخيص).

## الاختبار
```bash
node scripts/test-license-sign.cjs
```
