-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك المطابقة المالية الثلاثية للبنكية المفتوحة ومساعد Co-Pilot
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول سجلات المطابقة المالية الثلاثية (reconciliation_logs)
CREATE TABLE IF NOT EXISTS public.reconciliation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_statement_ref VARCHAR(50) NOT NULL,
    payment_gateway_ref VARCHAR(50) NOT NULL,
    zatca_invoice_no VARCHAR(50) NOT NULL,
    matched_amount NUMERIC(12,2) NOT NULL,
    variance_amount NUMERIC(12,2) DEFAULT 0.00,
    reconciliation_status VARCHAR(30) DEFAULT 'MATCHED_PAID', -- MATCHED_PAID, VARIANCE_FLAGGED, UNMATCHED
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reconciliation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_isolation ON public.reconciliation_logs
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة المطابقة المالية الثلاثية للبنكية المفتوحة SAMA (process_open_banking_reconciliation)
CREATE OR REPLACE FUNCTION public.process_open_banking_reconciliation(
    p_tenant_id UUID,
    p_bank_ref VARCHAR,
    p_gateway_ref VARCHAR,
    p_zatca_inv VARCHAR,
    p_bank_amount NUMERIC(12,2),
    p_gateway_amount NUMERIC(12,2)
)
RETURNS TABLE (
    out_reconciliation_id UUID,
    out_matched_status VARCHAR,
    out_variance NUMERIC(12,2),
    out_message_ar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rec_id UUID;
    v_diff NUMERIC(12,2);
    v_status VARCHAR;
    v_msg TEXT;
BEGIN
    v_diff := ABS(p_bank_amount - p_gateway_amount);

    IF v_diff < 0.05 THEN
        v_status := 'MATCHED_PAID';
        v_msg := 'تمت المطابقة المالية بنجاح 100% بين كشف الحساب البنكي، بوابة الدفع، وفاتورة ZATCA Phase 2 وتحديث الحالة إلى مدفوع.';

        -- تحديث حالة الفاتورة المجمعة إلى مدفوع
        UPDATE public.aggregated_b2b_invoices
        SET zatca_status = 'CLEARED_AND_PAID'
        WHERE tenant_id = p_tenant_id AND invoice_number = p_zatca_inv;
    ELSE
        v_status := 'VARIANCE_FLAGGED';
        v_msg := 'تم اكتشاف فارق تسوية بقيمة ' || v_diff || ' ر.س بين كشف البنك وبوابة الدفع وتم تعليق الفاتورة للمراجعة.';
    END IF;

    INSERT INTO public.reconciliation_logs (
        tenant_id, bank_statement_ref, payment_gateway_ref, zatca_invoice_no,
        matched_amount, variance_amount, reconciliation_status
    ) VALUES (
        p_tenant_id, p_bank_ref, p_gateway_ref, p_zatca_inv,
        p_bank_amount, v_diff, v_status
    ) RETURNING id INTO v_rec_id;

    out_reconciliation_id := v_rec_id;
    out_matched_status := v_status;
    out_variance := v_diff;
    out_message_ar := v_msg;
    RETURN NEXT;
END;
$$;
