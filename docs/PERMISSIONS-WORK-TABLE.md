# جدول عمل صلاحيات وثيمات مكّن (mkn-theme)

> تاريخ: 2026-08-23
> الحالة: T-03j مكتمل — رد CRM في Next؛ حذف admin.html محظور
> المصدر: قراءة الملفات على القرص، وليس خطة الوكيل السابق

لا تحذف `admin.html` / `js/admin.js` في هذه المرحلة. الموقع الثابت على Vercel ما زال يعتمد عليهما لمسارات غير mkn-theme (مثل `license.mken.live`)، ومهارة مكّن تفضّل توسيع اللوحة القديمة لا كسرها.

---

## ما هو مبني فعلاً (قبل هذا الدور)

| عنصر | الواقع |
|------|--------|
| صفحة `/themes` العامة | غير موجودة أصلاً (`src/app/themes/` غائب) |
| حفظ ثيم المناسبة للتينانت | موجود: `config_data.occasionPack.forceId` عبر `PUT /api/clients/[slug]` |
| لوحة ألوان الموقع القديم | منفصلة: `js/themes-catalog.js` → `config_data.theme` (ocean/terracotta/…) — لا تُمس |
| زر الثيم العائم | كان مخفياً لغير الأدمن مسبقاً |
| جلسة الإدارة | HMAC cookie `mkn_admin_session` في `lib/auth/session.ts` |
| Next.js 16 | الملف الفعّال هو `src/proxy.ts` وليس `middleware.ts` |

---

## ما أُصلح في هذا الدور

### T-01 / T-05 — إغلاق أدوات الثيم عن الزائر
- حذف رابط `/themes` من `Navbar`
- `OccasionThemeSelector` و`OccasionShowcaseModal` للأدمن فقط
- تحويل `/themes` و`/dashboard/themes` إلى `/` و`/admin`
- إزالة بند الثيمات من سايدبار `/dashboard`

### T-02 — الزائر يقرأ الثيم المحفوظ
- `OccasionContext` يجلب `GET /api/clients/[slug]` ويطبّق `client.theme`
- لم يعد `localStorage.mkn_occasion` مصدر الحقيقة للزائر
- الأدمن ما زال يحفظ عبر `setClientTheme` → `occasionPack.forceId`

### T-04 — بوابة `/admin` في `proxy.ts`
- **كان**: `proxy.ts` يحوّل `/admin` دائماً إلى `/admin/login` (لوحة الإدارة لا تُفتح)
- **صار**: `/admin.html` فقط يذهب لتسجيل الدخول؛ `/admin` و`/api/admin/*` يتطلبان وجود الكوكي؛ `/admin/login` مفتوح
- حُذف `middleware.ts` (مهجور في Next 16 عند وجود `proxy.ts`)

### P-02 — `/dashboard/themes`
- أي مستخدم Supabase لم يعد يغيّر ثيم المتجر من لوحة العميل
- التحويل إلى `/admin/client#theme` أو `/admin#clients`

### P-09 — إغلاق دليل المنشآت
- `GET /api/clients` يتطلب جلسة أدمن؛ السوبر يرى الكل، أدمن العميل يرى منشأته فقط
- `GET /api/clients/[slug]` عام ويعيد `storefrontClient` فقط (بدون `adminEmail`)
- الواجهة العامة (`/subscriber/[slug]`) تقرأ المنشأة من هذا المسار لا من قائمة الأدمن
- أُزيل تخزين `mkn_admin_clients` في localStorage

### P-01 — عزل أدمن العميل عن لوحة السوبر
- `/admin` يحوّل `role=client` إلى `/admin/client`
- `/admin/client/[slug]` يرفض أي slug غير منشأة الأدمن
- شعار اللوحة يشير إلى `/admin/client` لأدمن العميل

### T-02b — الثيم العالمي في Supabase
- صف محجوز `_mken_platform` في `mken_saas_clients` (`occasionPack.forceId`)
- مخفي من دليل العملاء ومن `GET /api/clients/[slug]`
- `GET/PUT /api/platform/theme` — القراءة عامة، الكتابة سوبر أدمن فقط

### P-03 — حد محاولات الدخول
- `/api/admin/login`: 5 محاولات فاشلة / دقيقة لكل IP ثم 429

### P-04 — بوابة الموظف في mkn-theme
- `/staff/login` و`/staff` مع كوكي HttpOnly `mkn_staff_session`
- دخول PIN أو WebAuthn (`POST /api/staff/login` بـ `step=pin|passkey-challenge|passkey-verify`)
- المهام من `GET /api/staff/me/appointments` مفلترة بـ `staff_id` ثم `enabledActivities`
- تسجيل البصمة لأول مرة من `/staff` عبر `POST /api/staff/me/passkey` (جلسة `mkn_staff_session` إلزامية)

### P-08 — ثيم التينانت على `/` و`/book`
- `OccasionProvider` يستخرج الـ slug من المسار (`/subscriber/` `/store/`)، أو `?tenant|store|client`، أو النطاق الفرعي `*.mken.live` (نفس قائمة الاستثناء في `proxy.ts`)
- الصفحة الرئيسية على نطاق التينانت تبقى `/` في المتصفح بعد إعادة الكتابة، لذلك الاعتماد على الـ hostname ضروري
- `/book?tenant=` يطبّق ثيم المنشأة ويعرض اسمها من `GET /api/clients/[slug]` بدل افتراض المحروسة
- الثيم `none` يرث ثيم المنصة

### P-05 — باقات SaaS في Next
- نفس درجات `js/services-store.js`: basic / growth / unlimited / custom
- بلا `config.subscription` أو سوبر أدمن = كل الميزات (مثل اللوحة القديمة)
- واتساب: growth+ · تجارة: growth+ · فواتير ومخزون: unlimited
- APIs: `/api/invoices*` `/api/inventory*` `/api/whatsapp-logs*` تعيد 403 لأدمن العميل خارج باقته
- السايدبار يخفي الروابط؛ الكتالوج يقفل نشاط `commerce`

### A-01 — الأسرار في Vercel فقط
- `.env.example` بلا قيم؛ `.env.local` و`.env*` في gitignore مع استثناء `.env.example`
- الإنتاج: Vercel → Environment Variables ثم Redeploy
- لا مفتاح ZATCA احتياطي في الكود؛ يتطلب `ZATCA_ENCRYPTION_KEY`
- عميل Supabase العام يفشل في الإنتاج إن نقص `NEXT_PUBLIC_SUPABASE_*` بدل مفاتيح وهمية

### P-07 — نظاما الهوية (لا يُدمجان)
ثلاثة مسارات منفصلة عن عمد:

| الهوية | الدخول | إثبات الجلسة | الحماية | الجمهور |
|--------|--------|--------------|---------|---------|
| أدمن منشأة / سوبر | `/admin/login` → `/api/admin/login` | كوكي HttpOnly `mkn_admin_session` (HMAC، `ADMIN_SESSION_SECRET`، 8 ساعات) | `proxy.ts` على `/admin` و`/api/admin/*` | مشغّل التينانت |
| موظف | `/staff/login` | كوكي `mkn_staff_session` (نفس السر، `kind=staff`) | `proxy.ts` على `/staff` و`/api/staff/me/*` | موظفو المنشأة |
| عميل لوحة `/dashboard` | `/login` `/register` `/auth` | اليوم: `localStorage.mkn_user` عبر `loginMockUser` — عميل `lib/supabase` غير مستخدم في الصفحات | لا HMAC؛ تحويل واجهة فقط إن لم يوجد `user` | مشتري خدمات SEO (مستقبل: Supabase Auth) |

لا تُصدِر جلسة أدمن من `/login`، ولا تطلب `mkn_admin_session` على `/dashboard`. حساب Auth.users ليس صف `mken_saas_clients`.

### P-06 — تخطيط الإدارة المشترك
- `src/app/admin/layout.tsx` يلفّ `AdminLayout`
- `/admin/login` يخرج من الهيكل (بدون سايدبار ولا تحويل حلقي)
- صفحات الإدارة وملفات `loading` لم تعد تستورد `AdminLayout`

### A-03 — TypeScript strict + typed routes
- `tsconfig.json`: `"strict": true` (كان مفعّلاً)
- `next.config.ts`: `typedRoutes: true` و`typescript.ignoreBuildErrors: false`
- روابط `Link` ذات المسارات الديناميكية/الهاش/الاستعلام تُصاغ `as Route` من `next`
- `npx tsc --noEmit` نظيف

### A-04 — SEO metadata
- الجذر: `metadataBase`، قالب العنوان، Open Graph، Twitter، canonical
- واجهة المنشأة: `generateMetadata` + JSON-LD `LocalBusiness` من صف التينانت (أو DEFAULT_CLIENTS)
- `/book`: عنوان ثابت «حجز موعد»؛ `/admin`: `noindex`
- `robots.ts` يمنع `/admin` `/dashboard` `/staff` `/api`؛ `sitemap.ts` يدرج `/` و`/book` ومتاجر التينانت
- الأصل من `NEXT_PUBLIC_SITE_URL` أو نطاق Vercel ثم `https://mken.live`

### T-03b — ربط Google Business في Next
- `/admin/settings`: حالة الربط + زر ربط/فك (بدون توكنات في المتصفح)
- `GET/POST /api/google-business` بجلسة أدمن؛ رابط OAuth من `GOOGLE_CLIENT_ID` + `GOOGLE_REDIRECT_URI`
- تبادل الرمز يبقى في `api/google-business.js` (نفس `GOOGLE_REDIRECT_URI`)
- `admin-redirect.html` يمرّر `google_connect` إلى `/admin/settings`؛ `proxy.ts` يحفظ الاستعلام عند التحويل لتسجيل الدخول

### T-03c — إعداد واتساب في Next
- `/admin/messages`: تفعيل المزود (Cloud / UltraMsg / Twilio) وحفظ `config_data.whatsappApi` بنفس شكل `js/services-store.js`
- التوكن لا يُعاد للمتصفح (`tokenSet` فقط)؛ الحقل الفارغ يُبقي القيمة الحالية
- `POST /api/whatsapp-logs` يرسل تجريبياً ويكتب في `mken_whatsapp_logs`
- n8n و inbound webhook يبقيان على `api/whatsapp-webhook.js`

### T-03d — تراخيص Next + روابط الموقع الثابت
- سوبر أدمن: `/admin/licenses` على نفس `mken_licenses` (إصدار / إيقاف / استئناف / إلغاء)
- `license.mken.live/admin` يبقى `license-admin.html` (تفعيل أجهزة Mken Lite عبر `/api/license`)
- `vercel.json`: `/admin` على mken.live والنطاقات الفرعية → `admin-redirect.html` (بعد قواعد الترخيص)
- روابط الموقع الثابت والتسجيل وإشعارات الدفع تشير إلى `/admin` لا `admin.html`

### T-03e — فروع Google Business في Next
- `/admin/settings`: قائمة الفروع بعد الربط، حفظ `google_business_location_id`، ومزامنة `websiteUri` إلى `https://{slug}.mken.live/`
- `GET /api/google-business?action=locations` و`POST { action: "select-location" }` بجلسة أدمن
- تجديد التوكن عبر `GOOGLE_CLIENT_SECRET` على الخادم؛ لا تُعاد التوكنات للمتصفح
- منشورات NAP والمنافسين وgenerate-post في نفس الصفحة عبر `GbpSeoPanel`

### T-03f — n8n / Webhook في Next
- `/admin/messages`: مزود `custom` يحفظ رابط webhook الصادر + بوابة الإرسال الفعلية (UltraMsg/Twilio) في `config_data.whatsappApi` بنفس شكل اللوحة القديمة
- رابط الوارد المعروض: `https://mken.live/api/whatsapp-webhook?tenant={slug}` (الملف يبقى `api/whatsapp-webhook.js` على مشروع Vercel الجذر)
- التوكنات لا تُعاد للمتصفح؛ الإرسال التجريبي يPOST إلى webhook n8n
- ملفات `data/n8n-whatsapp-*.json` تُستورد في n8n كما هي — ليست داخل Next

### T-03g — NAP والمنشورات والمنافسون في Next
- `/admin/settings` بعد اختيار الفرع: فحص NAP، مزامنة الاسم/الهاتف/الموقع إلى جوجل، توليد منشور، رد على تقييم، جلب منافسين
- لقطة الموقع من `config_data` (الاسم، الهاتف، المدينة، ساعات الحجز) لا من المتصفح
- Gemini عبر `GEMINI_API_KEY`؛ المنافسون عبر `GOOGLE_MAPS_API_KEY` ثم Gemini ثم قائمة احتياطية

### T-03h — نشر المنشور ومزامنة الخدمات
- `/admin/settings`: مزامنة الخدمات المفعّلة من كتالوج التينانت إلى `serviceItems` على جوجل (لا تُقبل قائمة من المتصفح)
- نشر المنشور المولَّد عبر Google My Business `localPosts` مع زر نسخ وتعديل النص قبل النشر
- اختيار خدمة مستهدفة عند التوليد من `GET /api/services`

### T-03i — حملات واتساب في Next
- `/admin/messages`: إطلاق حملة إلى أرقام فريدة من الحجوزات و/أو الطلبات (`{customerName}` `{brandName}`)
- الحد 40 مستلماً لكل طلب حتى لا يتجاوز مهلة السيرفر؛ التوكنات لا تُعاد للمتصفح
- السجل يُكتب كـ `marketing_campaign` في `mken_whatsapp_logs`

### T-03j — رد CRM مباشر في Next
- `/admin/messages`: زر «رد» يملأ الرقم من السجل، والإرسال يُحفظ كـ `crm_reply`
- نفس بوابة الإرسال المحفوظة على الخادم؛ لا توكنات في المتصفح

### T-03 — جرد مسارات Vercel (الحذف محظور)
`admin.html` و`js/admin.js` **لا يُحذفان**. مشروع Vercel الجذر ما زال هو الواجهة الثابتة؛ mkn-theme تطبيق منفصل (محلياً `localhost:3113` عبر `mken_theme_origin`).

| مسار الإنتاج | الواقع | في mkn-theme؟ |
|--------------|--------|----------------|
| `/admin.html` | rewrite → `admin-redirect.html` → `/admin` أو `/admin/settings` إن وُجد `google_connect` | جسر؛ الملف الأصلي مطلوب |
| `/admin` على `mken.live` | rewrite → `admin-redirect.html` → Next `/admin` | نعم |
| `/admin` على `license.mken.live` / `licenses.mken.live` | → `license-admin.html` | سوبر أدمن أيضاً عبر `/admin/licenses` |
| `*.mken.live/admin.html` | نفس الجسر؛ التسجيل يعيد `…/admin` | نعم |
| Google OAuth callback | `api/google-business.js` → `/admin.html?google_connect=` → `/admin/settings` | ربط/فك/فروع/NAP/نشر/خدمات في `/admin/settings`؛ التبادل يبقى في API الجذر |
| إشعارات الدفع | افتراضي `/admin` | نعم |
| روابط الموقع الثابت | `landing` `index` `book` `order` … تشير إلى `/admin` | نعم — عبر الجسر |
| واتساب / n8n / PIN / لوحة الألوان | سجل + n8n + حملة + رد CRM في `/admin/messages` | inbound يبقى `api/whatsapp-webhook.js` |
| تسجيل بصمة الموظف | كان `staff.html` فقط | `/staff` + `/api/staff/me/passkey` |

---

## المشاكل المتبقية (مرتبة)

| # | المهمة | أولوية | ملاحظة |
|---|--------|--------|--------|
| T-03b | ربط GBP في إعدادات Next | تم | OAuth start/status في `/admin/settings` |
| T-03c | إعداد واتساب + إرسال تجريبي | تم | التوكن على الخادم؛ n8n في T-03f |
| T-03d | تراخيص Next + روابط `/admin` | تم | license.mken.live لم يُمس |
| T-03e | فروع GBP + مزامنة الموقع | تم | NAP/المنشورات في T-03g |
| T-03f | n8n / Webhook في الرسائل | تم | inbound يبقى على المشروع الجذر |
| T-03g | NAP + منشورات + منافسون | تم | التوليد في Next |
| T-03h | نشر المنشور + مزامنة الخدمات | تم | localPosts + serviceItems من الكتالوج |
| T-03i | حملات واتساب | تم | حتى 40 مستلماً لكل إطلاق |
| T-03j | رد CRM مباشر | تم | crm_reply من سجل الرسائل |
| T-03 / A-02 | حذف `admin.html` | محظور | جسر OAuth وrecovery hash و`js/admin.js` |
| A-03 | TypeScript strict + typedRoutes | تم | `tsc --noEmit` نظيف |
| A-04 | SEO metadata | تم | OG + robots/sitemap + JSON-LD للمتجر |
| P-04b | تسجيل بصمة الموظف في Next | تم | جلسة موظف + `mken_staff_devices` |

---

## خريطة الوصول بعد هذا الدور

```
زائر
  /  /store/[slug]  /subscriber/[slug]  /book  /login  /register
  /orders/[id]  /auth  /forgot-password
  ✗ /themes  (تحويل إلى /)
  يرى ثيم المناسبة المحفوظ للمتجر — بلا أدوات تغيير

مستخدم لوحة `/dashboard` (اليوم mock في localStorage؛ ليس جلسة أدمن)
  نظرة عامة، الطلبات، الرسائل، الملف
  ✗ تغيير الثيم
  ✗ لا يمر عبر `mkn_admin_session`

Client admin (cookie mkn_admin_session, role=client)
  /admin/client  /admin/services  /admin/orders  …
  يغيّر ثيم منشأته فقط عبر PUT /api/clients/[slug]

Super admin (role=super)
  /admin  إدارة العملاء + ثيم كل منشأة
  الثيم العالمي: PUT /api/platform/theme → config_data.occasionPack.forceId

Staff (cookie mkn_staff_session)
  /staff/login  PIN أو WebAuthn
  /staff  مهام مسندة مفلترة بالأنشطة + تفعيل البصمة على الجهاز
```

---

## نظاما الثيمات (يُبقيان منفصلين عن عمد)

```
ألوان الموقع القديم (لا تُخلط):
  js/themes-catalog.js → config_data.theme
  ocean | terracotta | forest | midnight | desert | slate

مناسبات mkn-theme:
  OccasionContext → config_data.occasionPack.forceId
  ramadan | eid_fitr | eid_adha | national_day | founding_day | …
```

---

## الخطوة التالية المقترحة

لا بنود تنفيذ متبقية في هذا الجدول. `admin.html` يبقى عمداً:

1. جسر OAuth (`google_connect`) وrecovery hash
2. inbound واتساب يبقى `api/whatsapp-webhook.js` على المشروع الجذر
3. `license.mken.live` يستخدم `license-admin.html` لا هذه اللوحة
