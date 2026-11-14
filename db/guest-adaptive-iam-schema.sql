-- =============================================================================
-- منصة مكّن — معمارية الهوية التكيفية وعزل المستأجر للطلبات كضيف (Adaptive IAM & Guest Checkout)
-- الامتثال: نظام حماية البيانات الشخصية (PDPL) المادتان 3 و 10 (مبدأ تقليل جمع البيانات)
-- نظام التجارة الإلكترونية السعودي (المرسوم م/126) ولائحة الفوترة الإلكترونية (ZATCA)
-- ضوابط الأمن السيبراني للأنظمة السحابية (NCA CCC-2:2024 / ECC-2:2024)
-- =============================================================================

BEGIN;

-- 1. جدول تصنيف مخاطر واشتراطات الأنشطة (Activity Risk Profiles)
CREATE TABLE IF NOT EXISTS public.mken_activity_risk_profiles (
    activity_id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'RETAIL', 'SERVICES', 'HOSPITALITY', 'FINTECH', 'TELECOM'
    allow_guest_checkout BOOLEAN NOT NULL DEFAULT true,
    requires_national_id BOOLEAN NOT NULL DEFAULT false,
    requires_nafath_biometric BOOLEAN NOT NULL DEFAULT false,
    pdpl_retention_days INT NOT NULL DEFAULT 365,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- إدراج التصنيفات الافتراضية الممتثلة للأنظمة السعودية
INSERT INTO public.mken_activity_risk_profiles 
(activity_id, name_ar, category, allow_guest_checkout, requires_national_id, requires_nafath_biometric, pdpl_retention_days)
VALUES
('commerce', 'تجارة عامة وتجزئة', 'RETAIL', true, false, false, 730),
('retail', 'متاجر البضائع الاستهلاكية', 'RETAIL', true, false, false, 730),
('restaurant', 'المطاعم والمقاهي والأغذية', 'RETAIL', true, false, false, 365),
('services', 'الخدمات العامة والصيانة', 'SERVICES', true, false, false, 365),
('events', 'حجوزات الفعاليات والترفيه', 'SERVICES', true, false, false, 365),
('hotel', 'الفنادق ومرافق الإيواء السياحي', 'HOSPITALITY', false, true, true, 1825),
('telecom', 'شرائح واتصالات سحابية', 'TELECOM', false, true, true, 1825),
('fintech', 'التقسيط والخدمات المالية الميسرة', 'FINTECH', false, true, true, 3650)
ON CONFLICT (activity_id) DO UPDATE SET
    allow_guest_checkout = EXCLUDED.allow_guest_checkout,
    requires_national_id = EXCLUDED.requires_national_id,
    requires_nafath_biometric = EXCLUDED.requires_nafath_biometric,
    pdpl_retention_days = EXCLUDED.pdpl_retention_days;

-- =============================================================================
-- 2. دعم الحسابات الشبحية اللحظية للمستخدمين (Ephemeral & Registered Users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mken_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug VARCHAR(100) NOT NULL,
    phone_blind_index VARCHAR(64) NOT NULL, -- فهرس مشفر للبحث دون كشف رقم الهاتف
    encrypted_phone TEXT NOT NULL,         -- رقم الهاتف مشفر بمفتاح المنشأة
    full_name VARCHAR(150),
    user_type VARCHAR(20) NOT NULL DEFAULT 'GUEST', -- 'GUEST' أو 'REGISTERED' أو 'STAFF'
    national_id_hash VARCHAR(64),          -- مخصص للأنشطة المقيدة فقط
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT uk_tenant_user_phone UNIQUE (tenant_slug, phone_blind_index)
);

CREATE INDEX IF NOT EXISTS idx_mken_users_lookup 
ON public.mken_users (tenant_slug, phone_blind_index);

-- =============================================================================
-- 3. تحديث جدول الطلبات لدعم روابط التتبع المشفرة (Signed Capability Tokens)
-- =============================================================================
ALTER TABLE IF EXISTS public.mken_orders 
ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) DEFAULT 'STANDARD_GUEST',
ADD COLUMN IF NOT EXISTS tracking_token_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS tracking_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_guest_order BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_orders_tracking_hash 
ON public.mken_orders (tenant_slug, tracking_token_hash);

-- =============================================================================
-- 4. سياسات عزل المستأجر الصارمة (RLS) للجداول المحدثة
-- =============================================================================
ALTER TABLE public.mken_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_users ON public.mken_users;
CREATE POLICY tenant_isolation_users ON public.mken_users
FOR ALL USING (
    (SELECT public.is_super_admin()) OR 
    tenant_slug = public.current_tenant_slug()
) WITH CHECK (
    (SELECT public.is_super_admin()) OR 
    tenant_slug = public.current_tenant_slug() OR
    (public.current_tenant_slug() IS NULL AND tenant_slug IS NOT NULL)
);

-- =============================================================================
-- 5. دالة ذرية لترقية حساب الضيف ودمج طلباته السابقة (Atomic Promotion & Account Linking)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mken_fn_promote_guest_user(
    p_tenant_slug VARCHAR(100),
    p_phone_blind_index VARCHAR(64),
    p_full_name VARCHAR(150)
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_updated_orders INT;
BEGIN
    -- العثور على المستخدم أو إنشاؤه في حالة التسجيل الدائم
    INSERT INTO public.mken_users (tenant_slug, phone_blind_index, encrypted_phone, full_name, user_type)
    VALUES (p_tenant_slug, p_phone_blind_index, 'ENC_ON_REGISTER', p_full_name, 'REGISTERED')
    ON CONFLICT (tenant_slug, phone_blind_index) DO UPDATE
    SET user_type = 'REGISTERED',
        full_name = COALESCE(EXCLUDED.full_name, mken_users.full_name),
        updated_at = clock_timestamp()
    RETURNING * INTO v_user;

    -- وسم الطلبات السابقة المرتبطة برقم الهاتف بأنها أصبحت تابعة لمستخدم مسجل
    UPDATE public.mken_orders
    SET is_guest_order = false,
        updated_at = clock_timestamp()
    WHERE tenant_slug = p_tenant_slug 
      AND phone = v_user.phone_blind_index -- أو الحقل المطابق في منطق التطبيق
      AND is_guest_order = true;
    
    GET DIAGNOSTICS v_updated_orders = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'userId', v_user.id,
        'userType', v_user.user_type,
        'linkedOrdersCount', v_updated_orders
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
