-- =============================================================================
-- منصة مكّن — حزمة تفعيل سياسات الأمان والعزل التام للمستأجرين (E1: Strict RLS)
-- الامتثال: نظام حماية البيانات الشخصية (PDPL) وضوابط الهيئة الوطنية للأمن السيبراني (NCA)
-- =============================================================================

BEGIN;

-- 1. دالة استخراج معرف المستأجر الحالي من جلسة الـ JWT المشفرة بأمان
CREATE OR REPLACE FUNCTION public.current_tenant_slug()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_slug',
    current_setting('request.jwt.claim.tenant_slug', true),
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_slug'),
    NULL
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. دالة التحقق مما إذا كان المستخدم يملك صلاحية السوبر أدمن (Super Admin Bypass)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role') = 'super_admin' OR
    (current_setting('request.jwt.claims', true)::json->>'role') = 'service_role',
    false
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- 3. تفعيل RLS الصارم على جدول المواعيد (mken_appointments)
-- =============================================================================
ALTER TABLE IF EXISTS public.mken_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mken_appointments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select_appointments ON public.mken_appointments;
CREATE POLICY tenant_isolation_select_appointments ON public.mken_appointments
FOR SELECT USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
);

DROP POLICY IF EXISTS tenant_isolation_insert_appointments ON public.mken_appointments;
CREATE POLICY tenant_isolation_insert_appointments ON public.mken_appointments
FOR INSERT WITH CHECK (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug() OR
  -- السماح بالحجز العام من واجهة المتجر بشرط وجود tenant_slug صالح
  (public.current_tenant_slug() IS NULL AND tenant_slug IS NOT NULL)
);

DROP POLICY IF EXISTS tenant_isolation_update_appointments ON public.mken_appointments;
CREATE POLICY tenant_isolation_update_appointments ON public.mken_appointments
FOR UPDATE USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
) WITH CHECK (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
);

DROP POLICY IF EXISTS tenant_isolation_delete_appointments ON public.mken_appointments;
CREATE POLICY tenant_isolation_delete_appointments ON public.mken_appointments
FOR DELETE USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
);

-- =============================================================================
-- 4. تفعيل RLS الصارم على جدول الطلبات (mken_orders)
-- =============================================================================
ALTER TABLE IF EXISTS public.mken_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mken_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orders ON public.mken_orders;
CREATE POLICY tenant_isolation_orders ON public.mken_orders
FOR ALL USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
) WITH CHECK (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug() OR
  (public.current_tenant_slug() IS NULL AND tenant_slug IS NOT NULL)
);

-- =============================================================================
-- 5. تفعيل RLS الصارم على جدول الفواتير الضريبية (mken_saas_invoices)
-- =============================================================================
ALTER TABLE IF EXISTS public.mken_saas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mken_saas_invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_invoices ON public.mken_saas_invoices;
CREATE POLICY tenant_isolation_invoices ON public.mken_saas_invoices
FOR ALL USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
) WITH CHECK (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
);

-- =============================================================================
-- 6. تفعيل RLS الصارم على جدول رسائل وسجلات الواتساب (mken_whatsapp_logs)
-- =============================================================================
ALTER TABLE IF EXISTS public.mken_whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mken_whatsapp_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_whatsapp_logs ON public.mken_whatsapp_logs;
CREATE POLICY tenant_isolation_whatsapp_logs ON public.mken_whatsapp_logs
FOR ALL USING (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
) WITH CHECK (
  is_super_admin() OR 
  tenant_slug = public.current_tenant_slug()
);

COMMIT;
