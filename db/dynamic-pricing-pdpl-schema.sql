-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك التسعير الديناميكي والامتثال لنظام PDPL (سدايا)
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول سجلات موافقات نظام حماية البيانات الشخصية (pdpl_consent_logs)
CREATE TABLE IF NOT EXISTS public.pdpl_consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id),
    user_phone VARCHAR(20) NOT NULL,
    consent_type VARCHAR(50) NOT NULL, -- MARKETING, LOGISTICS_TRACKING, DATA_PROCESSING
    consent_status VARCHAR(20) NOT NULL DEFAULT 'GRANTED', -- GRANTED, REVOKED
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pdpl_consent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdpl_consent_isolation ON public.pdpl_consent_logs
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة التسعير الديناميكي المرن مع ضوابط وزارة التجارة (calculate_dynamic_pricing)
CREATE OR REPLACE FUNCTION public.calculate_dynamic_pricing(
    p_tenant_id UUID,
    p_base_price NUMERIC(10,2),
    p_occupancy_pct NUMERIC(5,2)
)
RETURNS TABLE (
    base_price NUMERIC(10,2),
    multiplier NUMERIC(4,2),
    final_price NUMERIC(10,2),
    pricing_tier VARCHAR,
    zatca_vat_amount NUMERIC(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mult NUMERIC(4,2) := 1.00;
    v_tier VARCHAR := 'STANDARD';
    v_final NUMERIC(10,2);
    v_vat NUMERIC(10,2);
BEGIN
    -- تطبيق ضوابط وزارة التجارة بالمملكة (حد أقصى +30% للذروة و -15% لغير الذروة)
    IF p_occupancy_pct >= 90.0 THEN
        v_mult := 1.30; -- +30% Max Surge
        v_tier := 'PEAK_SURGE_MAX';
    ELSIF p_occupancy_pct >= 75.0 THEN
        v_mult := 1.15; -- +15% Surge
        v_tier := 'HIGH_DEMAND';
    ELSIF p_occupancy_pct <= 30.0 THEN
        v_mult := 0.85; -- -15% Max Off-Peak Discount
        v_tier := 'OFF_PEAK_DISCOUNT';
    ELSE
        v_mult := 1.00;
        v_tier := 'STANDARD';
    END IF;

    v_final := ROUND((p_base_price * v_mult)::NUMERIC, 2);
    v_vat := ROUND((v_final * 0.15)::NUMERIC, 2);

    base_price := p_base_price;
    multiplier := v_mult;
    final_price := v_final;
    pricing_tier := v_tier;
    zatca_vat_amount := v_vat;
    RETURN NEXT;
END;
$$;
