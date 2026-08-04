# 🚀 منصة "مكّن" - Local SEO Platform

منصة ويب متكاملة ومصممة خصيصاً لأصحاب المحلات التجارية والأنشطة المحلية في المملكة العربية السعودية 🇸🇦 لطلب خدمات تحسين محركات البحث المحلية (Local SEO)، التواجد على خرائط Google، ومتابعة حالات الطلبات والمراسلة المباشرة.

---

## 🌟 ميزات المنصة الرئيسية

- **واجهة عربية متكاملة (RTL)**: دعم كامل للغة العربية والاتجاه من اليمين إلى اليسار وتصميم متجاوب على جميع قياسات الشاشات (375px / 768px / 1440px).
- **الهوية البصرية**: أزرق داكن فخم مع لون تمييز برتقالي وجاذبية بصرية عالية.
- **إدارة الطلبات المتقدمة**: لوحة تحكم للعميل تعرض قائمة طلبات المحلات بحالاتها الملونة (`قيد الانتظار` | `قيد التنفيذ` | `مكتمل` | `ملغى`).
- **المراسلة المباشرة**: نظام محادثة لحظي لكل طلب يربط صاحب المحل بمدير الطلب وفريق العمل.
- **التحقق من البيانات**: استخدام `React Hook Form` و `Zod` مع رسائل خطأ وإشعارات عربية تفاعلية.
- **فحص رابط خرائط Google**: فحص تلقائي لصحة روابط خرائط Google المستهدفة.
- **الربط الحقيقي مع Supabase**: هيكل قاعدة بيانات Postgres وسياسات أمان RLS محكمة مع إمكانية العمل التفاعلي المحلي (Mock Fallback).

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **الإطار البرمجي**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **لغة البرمجة**: [TypeScript](https://www.typescriptlang.org/)
- **التنسيق والواجهات**: [Tailwind CSS v4](https://tailwindcss.com/) + [Lucide React Icons](https://lucide.dev/)
- **النماذج والتحقق**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) + `@hookform/resolvers`
- **قاعدة البيانات والمصادقة**: [@supabase/supabase-js](https://supabase.com/docs/reference/javascript/introduction) و `@supabase/ssr`

---

## 📁 هيكل المشروع (Project Structure)

```text
src/
├── app/
│   ├── page.tsx               # الصفحة الرئيسية ونموذج التواصل
│   ├── login/                 # صفحة تسجيل الدخول المستقلة
│   ├── register/              # صفحة إنشاء حساب جديد
│   ├── forgot-password/       # صفحة استعادة كلمة المرور
│   ├── dashboard/             # لوحة تحكم العميل والنظرة العامة
│   │   ├── requests/          # قائمة وطلب محلات جديدة
│   │   ├── messages/          # مركز المحادثات المباشرة
│   │   └── profile/           # الملف الشخصي وتغيير كلمة المرور
│   ├── orders/[id]/           # تفاصيل الطلب وشاشة المراسلة
│   ├── layout.tsx             # التخطيط الرئيسي والخط العربي Cairo
│   └── globals.css            # متغيرات الألوان والإتاحة
├── components/
│   ├── Navbar.tsx             # شريط التنقل المتجاوب
│   ├── Footer.tsx             # تذييل الموقع
│   ├── DashboardLayout.tsx    # تخطيط اللوحة والشريط الجانبي للجوال
│   ├── NewOrderModal.tsx      # مودال تقديم طلب جديد
│   ├── ServiceDetailModal.tsx # مودال تفاصيل الخدمة
│   ├── Toast.tsx              # نظام الإشعارات التفاعلي
│   └── Skeleton.tsx           # الهياكل العظمية لانتظار التحميل
├── context/
│   └── AppContext.tsx         # موفر سياق التطبيق والحالة المحلية
├── lib/
│   └── supabase/              # عملاء Supabase للمتصفح والخادم
└── types/
    └── database.ts            # أنواع البيانات البرمجية
```

---

## ⚙️ التشغيل المحلي (Getting Started)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. إعداد المتغيرات البيئية (Environment Variables)
قم بإنشاء ملف `.env.local` في المجلد الرئيسي (مع الاستفادة من `.env.example`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. تشغيل خادم التطوير (Run Dev Server)
```bash
npm run dev
```
افتح المتصفح على **[http://localhost:3000](http://localhost:3000)**.

### 4. فحص الأخطاء والبناء (Lint & Build)
```bash
# فحص ESLint
npm run lint

# بناء نسخة الإنتاج
npm run build
```

---

## 🗄️ مخطط قاعدة البيانات وسياسات الأمان (Supabase SQL Schema)

أنشئ الجداول وسياسات RLS التالية في **Supabase SQL Editor**:

```sql
-- 1. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  maps_url TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. MESSAGES TABLE
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACT MESSAGES TABLE
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert/update own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view messages for their orders" ON public.messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users can insert messages to their orders" ON public.messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id = messages.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Anyone can send contact message" ON public.contact_messages FOR INSERT WITH CHECK (true);
```

---

## 📜 الترخيص (License)
تم تطوير هذا المشروع كمنصة ويب سعودية متكاملة لـ Local SEO. جميع الحقوق محفوظة © 2026 منصة مكّن.
