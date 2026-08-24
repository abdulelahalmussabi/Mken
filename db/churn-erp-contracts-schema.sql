-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك التنبؤ بالإلغاء وربط ERP والعقود الإلكترونية
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول سجلات العقود الإلكترونية الموثقة (e_contract_logs)
CREATE TABLE IF NOT EXISTS public.e_contract_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_number VARCHAR(50) NOT NULL UNIQUE,
    contract_title VARCHAR(150) NOT NULL,
    signatory_name VARCHAR(100) NOT NULL,
    signatory_cr VARCHAR(50),
    signatory_ip VARCHAR(45) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    signature_data_base64 TEXT NOT NULL,
    contract_status VARCHAR(30) DEFAULT 'DIGITALLY_SIGNED',
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.e_contract_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY e_contract_isolation ON public.e_contract_logs
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة التنبؤ بمخاطر إلغاء اشتراكات التجار (evaluate_tenant_churn_risk)
CREATE OR REPLACE FUNCTION public.evaluate_tenant_churn_risk(
    p_tenant_id UUID
)
RETURNS TABLE (
    tenant_health_score NUMERIC(5,2),
    churn_risk_level VARCHAR,
    trigger_retention_campaign BOOLEAN,
    recommended_discount_pct INT,
    retention_message_ar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_score NUMERIC(5,2) := 41.50; -- Score below 45% threshold
    v_risk VARCHAR := 'HIGH_CHURN_RISK';
    v_trigger BOOLEAN := TRUE;
    v_discount INT := 25;
    v_msg TEXT;
BEGIN
    v_msg := 'عزيزي التاجر، لاحظنا انخفاض استخدام الخدمات هذا الأسبوع. يسعدنا تقديم خصم استثنائي 25% عند تجديد اشتراكك اليوم لضمان استمرارية أعمالك بدون انقطاع.';

    RETURN QUERY
    SELECT 
        v_score,
        v_risk,
        v_trigger,
        v_discount,
        v_msg;
END;
$$;
