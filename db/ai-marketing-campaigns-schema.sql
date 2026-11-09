-- ============================================================================
-- Mken Platform - AI Ad & Marketing Campaigns Engine Schema
-- Reference: MKN-ARCH-AI-ADV-2026-v1
-- PDPL & SDAIA Compliant Multi-Tenant Schema with Supabase RLS
-- ============================================================================

-- 1. جدول ملف الهوية التسويقية للنشاط التجاري (Brand Profiles)
CREATE TABLE IF NOT EXISTS public.tenant_brand_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    sector_type VARCHAR(50) NOT NULL, -- e.g., 'SALON', 'CLINIC', 'FIELD_SERVICE', 'RESTAURANT', 'COMMERCE'
    brand_voice VARCHAR(50) DEFAULT 'WARM_LOCAL', -- 'WARM_LOCAL', 'PREMIUM_LUXURY', 'DIRECT_OFFER', 'CORPORATE'
    preferred_dialects TEXT[] DEFAULT ARRAY['SAUDI_GENERAL', 'SAUDI_NAJDI'],
    brand_colors JSONB DEFAULT '{"primary": "#0F172A", "secondary": "#10B981", "accent": "#F59E0B"}'::jsonb,
    logo_url TEXT,
    slogan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tenant_brand UNIQUE (tenant_id)
);

-- 2. جدول وظائف توليد الإعلانات وحالات المعالجة (Ad Generation Jobs)
CREATE TABLE IF NOT EXISTS public.ad_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    trigger_type VARCHAR(50) NOT NULL, -- 'ABANDONED_CART', 'DORMANT_RETENTION', 'MANUAL_PROMO', 'SEASONAL_OFFER'
    target_audience_segment JSONB, -- المعايير المستهدفة (مثال: عملاء لم يحجزوا منذ 45 يوماً)
    channel_targets TEXT[] DEFAULT ARRAY['WHATSAPP', 'INSTAGRAM_STORY'],
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول الحملات التسويقية الناتجة (Generated Marketing Campaigns)
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.mken_saas_clients(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.ad_generation_jobs(id) ON DELETE SET NULL,
    campaign_title VARCHAR(255) NOT NULL,
    copy_variations JSONB NOT NULL, -- نصوص الإعلانات المولدة (WhatsApp text, Short SMS, Social caption)
    asset_urls JSONB, -- روابط التصاميم والصور المولدة
    discount_code VARCHAR(100),
    approval_status VARCHAR(30) DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'APPROVED', 'DISMISSED'
    sent_at TIMESTAMPTZ,
    analytics JSONB DEFAULT '{"sent": 0, "clicks": 0, "conversions": 0}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- الفهارس لتحسين أداء الاستعلامات وعزل المستأجرين
CREATE INDEX IF NOT EXISTS idx_tenant_brand_profiles_tenant_id ON public.tenant_brand_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_generation_jobs_tenant_id ON public.ad_generation_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ad_generation_jobs_status ON public.ad_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant_id ON public.marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_approval ON public.marketing_campaigns(approval_status);

-- تفعيل سياسات الأمان RLS (Row Level Security)
ALTER TABLE public.tenant_brand_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- سياسات عزل المستأجر لضمان السيادة الرقمية والامتثال لـ PDPL
DROP POLICY IF EXISTS tenant_isolation_brand_profiles ON public.tenant_brand_profiles;
CREATE POLICY tenant_isolation_brand_profiles ON public.tenant_brand_profiles
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation_ad_jobs ON public.ad_generation_jobs;
CREATE POLICY tenant_isolation_ad_jobs ON public.ad_generation_jobs
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS tenant_isolation_campaigns ON public.marketing_campaigns;
CREATE POLICY tenant_isolation_campaigns ON public.marketing_campaigns
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Trigger لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_brand_profiles ON public.tenant_brand_profiles;
CREATE TRIGGER set_timestamp_brand_profiles
    BEFORE UPDATE ON public.tenant_brand_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_timestamp_ad_jobs ON public.ad_generation_jobs;
CREATE TRIGGER set_timestamp_ad_jobs
    BEFORE UPDATE ON public.ad_generation_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
