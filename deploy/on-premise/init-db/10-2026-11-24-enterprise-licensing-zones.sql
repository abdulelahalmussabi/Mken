-- =====================================================================
-- مكّن (Mken Platform) - نظام إدارة الطوابير المتقدم (Enterprise QMS)
-- ترقية إدارة التراخيص ومكاتب الاستقبال الإضافية وحزمة التشغيل المحلي
-- (Enterprise Licensing, Per-Reception Add-on Billing & On-Premise Docker)
-- =====================================================================

-- 1. جدول صلاحيات وحدود اشتراك المنشأة (tenant_entitlements)
CREATE TABLE IF NOT EXISTS public.tenant_entitlements (
    tenant_slug TEXT PRIMARY KEY,
    plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro', 'enterprise')),
    included_zones_quota INT NOT NULL DEFAULT 1,
    extra_zones_purchased INT NOT NULL DEFAULT 0,
    extra_zone_unit_price_sar NUMERIC(10,2) NOT NULL DEFAULT 149.00,
    on_premise_addon_enabled BOOLEAN NOT NULL DEFAULT false,
    on_premise_license_key TEXT NULL,
    license_expires_at TIMESTAMPTZ NULL,
    hardware_fingerprint TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس الأداء لجدول الصلاحيات
CREATE INDEX IF NOT EXISTS idx_tenant_entitlements_tier 
    ON public.tenant_entitlements(plan_tier);

-- 2. جدول فواتير وترقيات الميزات الإضافية (enterprise_addon_invoices)
CREATE TABLE IF NOT EXISTS public.enterprise_addon_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    addon_type TEXT NOT NULL CHECK (addon_type IN ('extra_zone', 'on_premise_package', 'license_renewal')),
    description TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_sar NUMERIC(10,2) NOT NULL,
    subtotal_sar NUMERIC(10,2) NOT NULL,
    tax_rate NUMERIC(4,2) NOT NULL DEFAULT 0.15,
    tax_sar NUMERIC(10,2) NOT NULL,
    total_sar NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
    zatca_tax_rate NUMERIC(4,2) NOT NULL DEFAULT 0.15,
    zatca_qr_payload TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس الأداء لفواتير الإضافات
CREATE INDEX IF NOT EXISTS idx_addon_invoices_tenant_date 
    ON public.enterprise_addon_invoices(tenant_slug, created_at DESC);

-- 3. تفعيل سياسات الأمان والعزل التام للمستأجرين (Row Level Security - RLS)
ALTER TABLE public.tenant_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_addon_invoices ENABLE ROW LEVEL SECURITY;

-- سياسة الأمان لجدول الصلاحيات tenant_entitlements
DROP POLICY IF EXISTS tenant_entitlements_isolation ON public.tenant_entitlements;
CREATE POLICY tenant_entitlements_isolation ON public.tenant_entitlements
    FOR ALL TO authenticated
    USING (
        public.queue_is_tenant_staff(tenant_slug)
        AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
    )
    WITH CHECK (
        public.queue_is_tenant_staff(tenant_slug)
        AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
    );

-- سياسة الأمان لجدول الفواتير enterprise_addon_invoices
DROP POLICY IF EXISTS enterprise_addon_invoices_isolation ON public.enterprise_addon_invoices;
CREATE POLICY enterprise_addon_invoices_isolation ON public.enterprise_addon_invoices
    FOR ALL TO authenticated
    USING (
        public.queue_is_tenant_staff(tenant_slug)
        AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
    )
    WITH CHECK (
        public.queue_is_tenant_staff(tenant_slug)
        AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
    );

-- 4. إدراج القيم الافتراضية للمستأجرين الحاليين إن لم تكن مسجلة
INSERT INTO public.tenant_entitlements (tenant_slug, plan_tier, included_zones_quota, extra_zones_purchased, extra_zone_unit_price_sar, on_premise_addon_enabled)
SELECT DISTINCT tenant_slug, 'starter', 1, 0, 149.00, false
FROM public.queue_zones
ON CONFLICT (tenant_slug) DO NOTHING;

COMMENT ON TABLE public.tenant_entitlements IS 'صلاحيات وحدود اشتراك المنشأة ومكاتب الاستقبال المسموحة والتشغيل المحلي - منصة مَكَن';
COMMENT ON TABLE public.enterprise_addon_invoices IS 'سجل فواتير الخدمات الإضافية وترقيات الاستقبالات والتشغيل المحلي مع ضريبة 15% ZATCA';
