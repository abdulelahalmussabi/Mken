-- ==============================================================================
-- منصة مكِّن (Mken SaaS) - محرك الولاء والحوالات البنكية المباشرة ISO 20022
-- Supabase / PostgreSQL RLS Schema
-- ==============================================================================

-- 1. جدول نقاط الولاء ومكافآت العملاء (customer_loyalty_balances)
CREATE TABLE IF NOT EXISTS public.customer_loyalty_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100),
    total_spend_amount NUMERIC(12,2) DEFAULT 0.00,
    loyalty_points INT DEFAULT 0,
    tier_level VARCHAR(30) DEFAULT 'BRONZE', -- BRONZE, SILVER, GOLD, PLATINUM
    reward_vouchers_count INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, customer_phone)
);

ALTER TABLE public.customer_loyalty_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_isolation ON public.customer_loyalty_balances
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 2. دالة حساب نقاط الولاء والترقية التلقائية للفئات (process_customer_loyalty_points)
CREATE OR REPLACE FUNCTION public.process_customer_loyalty_points(
    p_tenant_id UUID,
    p_customer_phone VARCHAR,
    p_customer_name VARCHAR,
    p_spend_amount NUMERIC(12,2)
)
RETURNS TABLE (
    out_total_points INT,
    out_tier_level VARCHAR,
    out_reward_earned BOOLEAN,
    out_discount_code VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    v_add_points INT;
    v_new_points INT;
    v_new_spend NUMERIC(12,2);
    v_new_tier VARCHAR;
    v_reward BOOLEAN := FALSE;
    v_code VARCHAR := '';
BEGIN
    v_add_points := FLOOR(p_spend_amount / 10.0); -- 1 point per 10 SAR

    SELECT * INTO rec FROM public.customer_loyalty_balances
    WHERE tenant_id = p_tenant_id AND customer_phone = p_customer_phone;

    IF NOT FOUND THEN
        v_new_points := v_add_points;
        v_new_spend := p_spend_amount;
    ELSE
        v_new_points := rec.loyalty_points + v_add_points;
        v_new_spend := rec.total_spend_amount + p_spend_amount;
    END IF;

    -- تحديد مستوى الفئة
    IF v_new_points >= 1000 THEN v_new_tier := 'PLATINUM';
    ELSIF v_new_points >= 500 THEN v_new_tier := 'GOLD';
    ELSIF v_new_points >= 200 THEN v_new_tier := 'SILVER';
    ELSE v_new_tier := 'BRONZE';
    END IF;

    IF v_new_points >= 200 THEN
        v_reward := TRUE;
        v_code := 'REWARD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    END IF;

    INSERT INTO public.customer_loyalty_balances (
        tenant_id, customer_phone, customer_name, total_spend_amount, loyalty_points, tier_level
    ) VALUES (
        p_tenant_id, p_customer_phone, p_customer_name, v_new_spend, v_new_points, v_new_tier
    ) ON CONFLICT (tenant_id, customer_phone) DO UPDATE SET
        total_spend_amount = EXCLUDED.total_spend_amount,
        loyalty_points = EXCLUDED.loyalty_points,
        tier_level = EXCLUDED.tier_level,
        updated_at = NOW();

    out_total_points := v_new_points;
    out_tier_level := v_new_tier;
    out_reward_earned := v_reward;
    out_discount_code := v_code;
    RETURN NEXT;
END;
$$;

-- 3. جدول تسويات الحوالات البنكية المباشرة (supplier_bank_payouts)
CREATE TABLE IF NOT EXISTS public.supplier_bank_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    settlement_reference VARCHAR(50) NOT NULL UNIQUE,
    supplier_name VARCHAR(150) NOT NULL,
    supplier_iban VARCHAR(34) NOT NULL, -- SAxxxxxxxxxxxxxxxxxxxxxx
    bank_bic VARCHAR(11) DEFAULT 'RJBSSA22',
    payout_amount NUMERIC(12,2) NOT NULL,
    iso_msg_id VARCHAR(50) NOT NULL,
    payout_status VARCHAR(30) DEFAULT 'PAIN_001_GENERATED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.supplier_bank_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_payouts_isolation ON public.supplier_bank_payouts
    FOR ALL USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);

-- 4. دالة معالجة الحوالات البنكية المباشرة ISO 20022 (process_iso20022_bank_payouts)
CREATE OR REPLACE FUNCTION public.process_iso20022_bank_payouts(
    p_tenant_id UUID,
    p_supplier_name VARCHAR,
    p_supplier_iban VARCHAR,
    p_amount NUMERIC(12,2)
)
RETURNS TABLE (
    out_settlement_ref VARCHAR,
    out_msg_id VARCHAR,
    out_status VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ref VARCHAR;
    v_msg_id VARCHAR;
BEGIN
    v_ref := 'SETTLE-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    v_msg_id := 'SAMA-PAIN001-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

    INSERT INTO public.supplier_bank_payouts (
        tenant_id, settlement_reference, supplier_name, supplier_iban, payout_amount, iso_msg_id
    ) VALUES (
        p_tenant_id, v_ref, p_supplier_name, p_supplier_iban, p_amount, v_msg_id
    );

    out_settlement_ref := v_ref;
    out_msg_id := v_msg_id;
    out_status := 'PAIN_001_GENERATED';
    RETURN NEXT;
END;
$$;
