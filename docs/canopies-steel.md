# نشاط المظلات والهناجر + مسار عرض السعر

## ما تم إضافته
- نشاط `canopies-steel` (8 خدمات)
- قالب محتوى `js/content-templates/canopies-steel.js`
- صفحة `quote.html` + `js/quote.js` لمسار طلب عرض السعر عبر واتساب
- تسجيل في signup + presets التجربة
- مستأجر جاهز: `data/tenants/almasabi.json`

## تجربة محلية لمستأجر المصعبي
```powershell
cd "C:\Users\B A R A\Desktop\Mken"
python -m http.server 8080
```
ثم افتح:
`http://localhost:8080/index.html?tenant=almasabi`

أو مباشرة:
`http://localhost:8080/quote.html?tenant=almasabi&activity=canopies-steel`

## تفعيل على الإنتاج
1. انشر التحديثات على Vercel
2. أنشئ/اربط مستأجراً بالـ slug: `almasabi` → `almasabi.mken.live`
3. ارفع إعدادات `data/tenants/almasabi.json` إلى قاعدة المستأجرين (Supabase) إن كان التشغيل يعتمد عليها بدل الملفات المحلية
4. من لوحة الإدارة (`admin.html?tenant=almasabi`):
   - تبويب المطوّر / Google Business: اربط الحساب واختر الفرع
   - انسخ رابط التقييم إلى إعدادات المنشأة
   - استخدم «قوالب سريعة» لتوليد منشورات خرائط أسبوعية (مظلات/هناجر)
5. اربط WhatsApp Business وفعّل قوالب التأكيد/طلب التقييم

## قوالب GBP الجاهزة
في لوحة الإدارة تظهر أزرار سريعة لـ:
مشروع منفذ · عرض · نصيحة · قبل/بعد · هناجر · منشور أسبوعي · طلب تقييم


## ملاحظات
- CTA الرئيسي لهذا النشاط يوجّه إلى `quote.html` وليس `book.html`
- إن فُتح `book.html?activity=canopies-steel` يتم التحويل تلقائياً لصفحة عرض السعر
