-- ==============================================================================
-- منصة مكّن (Mken SaaS) - محرك إدارة وحذف الترويج والإعلانات المتعدد القنوات
-- Multi-Channel Ad Syndication, Saudi Compliance & Remote Kill-Switch Schema
-- ==============================================================================

-- 1. ترقية جدول الحملات الإعلانية mken_ad_campaigns
ALTER TABLE IF EXISTS public.mken_ad_campaigns
    ADD COLUMN IF NOT EXISTS mawthoog_license_no VARCHAR(60),
    ADD COLUMN IF NOT EXISTS freelance_cert_no VARCHAR(60),
    ADD COLUMN IF NOT EXISTS cr_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS national_id_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_content_locked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS allocated_total_halalas INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refunded_halalas INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS zatca_invoice_uuid UUID,
    ADD COLUMN IF NOT EXISTS zatca_invoice_hash VARCHAR(128);

-- 2. طابور القتل الخارجي المتزامن والأحداث (Ad Kill Queue)
-- يضمن إيقاف الإعلانات في قوقل وميتا حتى في حال انقطاع الشبكة أو انتهاء مهلة الـ API
CREATE TABLE IF NOT EXISTS public.mken_ad_kill_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.mken_ad_campaigns(id) ON DELETE CASCADE,
    tenant_slug VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'google_ads', 'meta_ctwa', 'instagram'
    external_campaign_id VARCHAR(100) NOT NULL,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    status VARCHAR(30) DEFAULT 'QUEUED', -- 'QUEUED', 'PROCESSING', 'TERMINATED', 'FAILED'
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

ALTER TABLE public.mken_ad_kill_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY kill_queue_tenant_isolation ON public.mken_ad_kill_queue
    FOR ALL USING (tenant_slug = current_setting('request.jwt.claim.tenant_slug', true));

CREATE INDEX IF NOT EXISTS idx_ad_kill_queue_pending 
    ON public.mken_ad_kill_queue (status, attempts) 
    WHERE status IN ('QUEUED', 'PROCESSING');

-- 3. دفتر أستاذ حركة الترويج والفوترة الضريبية (ZATCA Compliant Promotion Ledger)
CREATE TABLE IF NOT EXISTS public.mken_promotion_billing_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.mken_ad_campaigns(id) ON DELETE CASCADE,
    tenant_slug VARCHAR(100) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL, -- 'CHARGE_PREPAID', 'REFUND_UNUSED'
    gross_amount NUMERIC(10, 2) NOT NULL,
    vat_amount NUMERIC(10, 2) NOT NULL,    -- 15% ضريبة القيمة المضافة
    net_amount NUMERIC(10, 2) NOT NULL,
    zatca_invoice_uuid UUID NOT NULL,
    zatca_qr_code TEXT,
    zatca_hash VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mken_promotion_billing_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_ledger_tenant_isolation ON public.mken_promotion_billing_ledger
    FOR ALL USING (tenant_slug = current_setting('request.jwt.claim.tenant_slug', true));

CREATE INDEX IF NOT EXISTS idx_promo_ledger_campaign 
    ON public.mken_promotion_billing_ledger (campaign_id, tenant_slug);
