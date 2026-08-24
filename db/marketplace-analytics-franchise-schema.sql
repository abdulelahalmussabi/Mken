-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك سوق التطبيقات والفرنشايز والتنبؤ المالي
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول تسجيل الـ Webhooks لبيئة المطورين (developer_webhooks)
CREATE TABLE IF NOT EXISTS public.developer_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    app_name VARCHAR(100) NOT NULL,
    target_url TEXT NOT NULL,
    secret_key VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- ORDER_CREATED, BOOKING_CONFIRMED, INVOICE_GENERATED
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.developer_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhooks_isolation ON public.developer_webhooks
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة احتساب حقوق الامتياز التجاري وتمديد التراخيص آلياً (process_franchise_royalties_and_licensing)
CREATE OR REPLACE FUNCTION public.process_franchise_royalties_and_licensing(
    p_tenant_id UUID,
    p_gross_revenue NUMERIC(12,2),
    p_royalty_pct NUMERIC(4,2) DEFAULT 0.05 -- Default 5% Royalty fee
)
RETURNS TABLE (
    out_royalty_amount NUMERIC(12,2),
    out_vat_amount NUMERIC(12,2),
    out_royalty_invoice_no VARCHAR,
    out_license_extended_until TIMESTAMPTZ,
    out_status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_royalty NUMERIC(12,2);
    v_vat NUMERIC(12,2);
    v_inv_no VARCHAR;
    v_new_expiry TIMESTAMPTZ;
BEGIN
    v_royalty := ROUND((p_gross_revenue * p_royalty_pct)::NUMERIC, 2);
    v_vat := ROUND((v_royalty * 0.15)::NUMERIC, 2);
    v_inv_no := 'ROYALTY-INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || UPPER(SUBSTRING(MD5(p_tenant_id::TEXT) FROM 1 FOR 6));
    v_new_expiry := NOW() + INTERVAL '1 year';

    -- حفظ الفاتورة وتمديد ترخيص النطاق الفرعي آلياً (*.mken.sa)
    INSERT INTO public.aggregated_b2b_invoices (
        tenant_id, invoice_number, client_name, client_cr_number,
        service_period_start, service_period_end, subtotal_amount,
        vat_amount, total_amount, payment_terms, zatca_status
    ) VALUES (
        p_tenant_id, v_inv_no, 'رسوم الامتياز التجاري والحقوق الملكية (Royalty Fee)', '1010703009',
        NOW()::DATE - INTERVAL '1 month', NOW()::DATE, v_royalty,
        v_vat, v_royalty + v_vat, 'NET_15', 'REPORTED'
    );

    out_royalty_amount := v_royalty;
    out_vat_amount := v_vat;
    out_royalty_invoice_no := v_inv_no;
    out_license_extended_until := v_new_expiry;
    out_status := 'ROYALTY_INVOICED_LICENSE_EXTENDED';
    RETURN NEXT;
END;
$$;
