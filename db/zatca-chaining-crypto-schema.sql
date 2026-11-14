-- =============================================================================
-- منصة مكّن (mken.live) — موديول E4.1: التشفير والتسلسل الفاتوري لـ ZATCA
-- متوافق مع: قرار مجلس إدارة هيئة الزكاة والضريبة والجمارك رقم 32400
-- اللائحة التنفيذية لضوابط الفوترة الإلكترونية (المرحلة الثانية - الربط والتكامل)
-- =============================================================================

-- 1. جدول السلسلة الفاتورية التشفيرية لكل مستأجر (Immutable Invoice Chain)
CREATE TABLE IF NOT EXISTS public.mken_zatca_chains (
    tenant_slug TEXT PRIMARY KEY,
    last_icv BIGINT NOT NULL DEFAULT 0,
    last_invoice_hash TEXT NOT NULL DEFAULT 'NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc=', -- Base64 SHA256 of "0"
    device_egs_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_zatca_chains_tenant ON public.mken_zatca_chains(tenant_slug);

-- 2. ترقية جدول فواتير العملاء mken_invoices لإضافة حقول الفوترة التشفيرية
DO $$ BEGIN
    IF to_regclass('public.mken_invoices') IS NOT NULL THEN
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid();
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS icv BIGINT;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS pih TEXT;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS invoice_hash TEXT;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS digital_signature TEXT;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS zatca_qr_code TEXT;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS zatca_reporting_status VARCHAR(30) DEFAULT 'pending'; -- pending, reported, failed
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS zatca_reported_at TIMESTAMPTZ;
        ALTER TABLE public.mken_invoices ADD COLUMN IF NOT EXISTS zatca_response JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. دالة الحجز الذري للسلسلة التشفيرية ومنع الـ Race Conditions (Row Lock)
CREATE OR REPLACE FUNCTION public.mken_fn_next_zatca_sequence(
    p_tenant_slug TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_next_icv BIGINT;
    v_pih TEXT;
    v_initial_pih TEXT := 'NWZlY2I3YjY4ZDRkNDQ1NzhlYzcyMDc1ODNhN2RhNDc=';
BEGIN
    -- قفل الصف الخاص بالمستأجر ذرياً لمنع انقسام السلسلة (Chain Forking)
    SELECT * INTO v_record
    FROM public.mken_zatca_chains
    WHERE tenant_slug = p_tenant_slug
    FOR UPDATE;

    IF NOT FOUND THEN
        -- تهيئة السلسلة للمستأجر لأول مرة
        INSERT INTO public.mken_zatca_chains (tenant_slug, last_icv, last_invoice_hash)
        VALUES (p_tenant_slug, 1, v_initial_pih)
        RETURNING last_icv, last_invoice_hash INTO v_next_icv, v_pih;

        RETURN jsonb_build_object(
            'icv', 1,
            'pih', v_initial_pih
        );
    ELSE
        v_next_icv := v_record.last_icv + 1;
        v_pih := v_record.last_invoice_hash;

        RETURN jsonb_build_object(
            'icv', v_next_icv,
            'pih', v_pih
        );
    END IF;
END;
$$;

-- 4. دالة تأكيد وتثبيت الهاش الجديد بعد اكتمال التوقيع الرقمي بنجاح
CREATE OR REPLACE FUNCTION public.mken_fn_commit_zatca_invoice(
    p_tenant_slug TEXT,
    p_icv BIGINT,
    p_new_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.mken_zatca_chains
    SET last_icv = p_icv,
        last_invoice_hash = p_new_hash,
        updated_at = NOW()
    WHERE tenant_slug = p_tenant_slug;

    RETURN TRUE;
END;
$$;
