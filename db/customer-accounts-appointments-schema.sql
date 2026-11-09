-- ==============================================================================
-- منصة مكِّن (Mken Platform) — مخطط حسابات العملاء وإدارة المواعيد المتقدمة
-- Customer Accounts, Social Auth Linking, Appointment Modification & RLS Policies
-- نفّذ في: Supabase Dashboard → SQL Editor → Run
-- ==============================================================================

-- 1. إضافة الأعمدة اللازمة لجدول المواعيد mken_appointments
ALTER TABLE public.mken_appointments 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS rescheduled_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_rescheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_date DATE,
ADD COLUMN IF NOT EXISTS original_time TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. فهرسة الحقول للأداء العالي وسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_mken_appointments_user_lookup 
ON public.mken_appointments(tenant_slug, user_id, date, status);

CREATE INDEX IF NOT EXISTS idx_mken_appointments_phone_lookup 
ON public.mken_appointments(tenant_slug, phone, date, status);

-- 3. جدول ملفات العملاء mken_customers (تحديث أو إنشاء)
CREATE TABLE IF NOT EXISTS public.mken_customers (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    auth_provider TEXT DEFAULT 'phone', -- 'google', 'apple', 'phone', 'email'
    district TEXT,
    location_address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_customers_user_id 
ON public.mken_customers(tenant_slug, user_id);

CREATE INDEX IF NOT EXISTS idx_mken_customers_phone 
ON public.mken_customers(tenant_slug, phone);

-- 4. تفعيل سياسات الأمان على مستوى السجل (Row Level Security - RLS)
ALTER TABLE public.mken_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_customers ENABLE ROW LEVEL SECURITY;

-- حذف السياسات القديمة إن وجدت لتجنب التكرار
DROP POLICY IF EXISTS "Public and guests can insert appointments" ON public.mken_appointments;
DROP POLICY IF EXISTS "Customers can view their own appointments" ON public.mken_appointments;
DROP POLICY IF EXISTS "Customers can update their own active appointments" ON public.mken_appointments;
DROP POLICY IF EXISTS "Tenants and service role have full access to appointments" ON public.mken_appointments;

-- سياسة 1: السماح لجميع الزوار والعملاء بإنشاء مواعيد جديدة (الحجز المباشر)
CREATE POLICY "Public and guests can insert appointments"
ON public.mken_appointments
FOR INSERT
TO public
WITH CHECK (true);

-- سياسة 2: العميل المسجل يستعرض مواعيده فقط الخاصة به
CREATE POLICY "Customers can view their own appointments"
ON public.mken_appointments
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() 
    OR phone = (auth.jwt() ->> 'phone')
    OR customer_email = (auth.jwt() ->> 'email')
);

-- سياسة 3: العميل المسجل يمكنه تعديل أو إعادة جدولة مواعيده القادمة
CREATE POLICY "Customers can update their own active appointments"
ON public.mken_appointments
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    AND status != 'completed'
)
WITH CHECK (
    user_id = auth.uid()
);

-- سياسة 4: الموظفون والإدارة ومفتاح الخدمة لديهم الصلاحيات الكاملة
CREATE POLICY "Tenants and service role have full access to appointments"
ON public.mken_appointments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- سياسات RLS لجدول mken_customers
DROP POLICY IF EXISTS "Customers can view own profile" ON public.mken_customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.mken_customers;
DROP POLICY IF EXISTS "Service role full access to customers" ON public.mken_customers;

CREATE POLICY "Customers can view own profile"
ON public.mken_customers
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR phone = (auth.jwt() ->> 'phone')
);

CREATE POLICY "Customers can update own profile"
ON public.mken_customers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to customers"
ON public.mken_customers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. دالة لإعادة جدولة الموعد بأمان مع حفظ السجل القديم
CREATE OR REPLACE FUNCTION public.mken_reschedule_appointment(
    p_appointment_id TEXT,
    p_new_date DATE,
    p_new_time TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_apt RECORD;
BEGIN
    SELECT * INTO v_apt 
    FROM public.mken_appointments 
    WHERE id = p_appointment_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'الموعد غير موجود');
    END IF;

    IF v_apt.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إعادة جدولة موعد ملغي');
    END IF;

    UPDATE public.mken_appointments
    SET 
        original_date = COALESCE(original_date, date),
        original_time = COALESCE(original_time, time),
        date = p_new_date,
        time = p_new_time,
        rescheduled_count = COALESCE(rescheduled_count, 0) + 1,
        last_rescheduled_at = NOW(),
        reminders_sent = '[]'::jsonb, -- إعادة تصفير التذكيرات للموعد الجديد
        updated_at = NOW()
    WHERE id = p_appointment_id;

    RETURN jsonb_build_object(
        'success', true, 
        'appointment_id', p_appointment_id,
        'new_date', p_new_date,
        'new_time', p_new_time
    );
END;
$$;
