-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك الائتمان B2B والتجميع المالي للكيانات المتعددة
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول حسابات الائتمان والدفع الآجل B2B (b2b_credit_accounts)
CREATE TABLE IF NOT EXISTS public.b2b_credit_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    client_cr_number VARCHAR(50) NOT NULL,
    client_name VARCHAR(150) NOT NULL,
    allocated_credit_limit NUMERIC(12,2) NOT NULL DEFAULT 100000.00, -- 100k SAR default limit
    current_outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    payment_terms VARCHAR(30) DEFAULT 'NET_30', -- NET_15, NET_30, NET_60
    account_status VARCHAR(30) DEFAULT 'ACTIVE', -- ACTIVE, BLOCKED_LIMIT_EXCEEDED, SUSPENDED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, client_cr_number)
);

ALTER TABLE public.b2b_credit_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY b2b_credit_isolation ON public.b2b_credit_accounts
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة معالجة سقف التسهيلات والتحقق من تجاوز الحد الائتماني (process_b2b_credit_transaction)
CREATE OR REPLACE FUNCTION public.process_b2b_credit_transaction(
    p_tenant_id UUID,
    p_client_cr VARCHAR,
    p_client_name VARCHAR,
    p_transaction_amount NUMERIC(12,2),
    p_terms VARCHAR DEFAULT 'NET_30'
)
RETURNS TABLE (
    out_status VARCHAR,
    out_credit_limit NUMERIC(12,2),
    out_new_balance NUMERIC(12,2),
    out_available_credit NUMERIC(12,2),
    out_message_ar TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    v_new_bal NUMERIC(12,2);
    v_avail NUMERIC(12,2);
BEGIN
    -- 1. استعلام أو إنشاء حساب التسهيلات
    SELECT * INTO rec
    FROM public.b2b_credit_accounts
    WHERE tenant_id = p_tenant_id AND client_cr_number = p_client_cr;

    IF NOT FOUND THEN
        INSERT INTO public.b2b_credit_accounts (
            tenant_id, client_cr_number, client_name, allocated_credit_limit,
            current_outstanding_balance, payment_terms
        ) VALUES (
            p_tenant_id, p_client_cr, p_client_name, 150000.00,
            0.00, p_terms
        ) RETURNING * INTO rec;
    END IF;

    v_new_bal := rec.current_outstanding_balance + p_transaction_amount;
    v_avail := rec.allocated_credit_limit - v_new_bal;

    -- 2. فحص تجاوز الحد الائتماني المسموح به
    IF v_new_bal > rec.allocated_credit_limit THEN
        UPDATE public.b2b_credit_accounts
        SET account_status = 'BLOCKED_LIMIT_EXCEEDED'
        WHERE id = rec.id;

        out_status := 'REJECTED_CREDIT_LIMIT_EXCEEDED';
        out_credit_limit := rec.allocated_credit_limit;
        out_new_balance := rec.current_outstanding_balance;
        out_available_credit := rec.allocated_credit_limit - rec.current_outstanding_balance;
        out_message_ar := 'عذراً، تم رفض الطلب آلياً لتجاوز سقف التسهيلات الائتمانية المحددة (' || rec.allocated_credit_limit || ' ر.س).';
        RETURN NEXT;
        RETURN;
    END IF;

    -- 3. تجميع الرصيد وتأكيد معاملة التسهيلات
    UPDATE public.b2b_credit_accounts
    SET current_outstanding_balance = v_new_bal,
        payment_terms = p_terms,
        updated_at = NOW()
    WHERE id = rec.id;

    out_status := 'APPROVED_CREDIT_TRANSACTION';
    out_credit_limit := rec.allocated_credit_limit;
    out_new_balance := v_new_bal;
    out_available_credit := v_avail;
    out_message_ar := 'تم اعتماد المعاملة الائتمانية بنجاح تحت شروط سداد ' || p_terms || '.';
    RETURN NEXT;
END;
$$;
