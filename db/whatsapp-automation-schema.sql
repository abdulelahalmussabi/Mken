-- =============================================================================
-- منصة مكّن (mken.live) — موديول E5: أتمتة الواتساب والإشعارات السحابية
-- الامتثال: نظام حماية البيانات الشخصية (PDPL)، ضوابط هيئة الاتصالات (CST Anti-Spam)،
-- وسياسات نافذة الـ 24 ساعة لـ Meta WhatsApp Cloud API
-- =============================================================================

-- 1. جدول قفل عدم التكرار للرسائل الواردة (Inbound Webhook Deduplication)
CREATE TABLE IF NOT EXISTS public.mken_whatsapp_inbound_dedup (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'whatsapp_business',
    message_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mken_inbound_provider_msg UNIQUE (provider, message_id)
);

CREATE INDEX IF NOT EXISTS idx_mken_inbound_dedup_time 
    ON public.mken_whatsapp_inbound_dedup(received_at DESC);

-- 2. جدول قائمة عدم الاتصال وحظر الإزعاج (Do Not Contact - Suppression List)
-- وفق المادة 26 من نظام حماية البيانات الشخصية الصادر من سدايا
CREATE TABLE IF NOT EXISTS public.mken_dnc_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    reason VARCHAR(100) NOT NULL DEFAULT 'customer_opt_out', -- customer_opt_out, manual_admin_block, complaint
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'whatsapp_inbound',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_mken_dnc_phone_tenant UNIQUE (phone, tenant_slug)
);

CREATE INDEX IF NOT EXISTS idx_mken_dnc_lookup 
    ON public.mken_dnc_list(tenant_slug, phone, is_active);

-- 3. طابور الإشعارات والرسائل السحابية المؤجلة (Transactional Outbox Queue)
-- لترحيل الرسائل المجدولة خارج ساعات الحظر الليلي لهيئة الاتصالات CST (21:00 - 09:00)
CREATE TABLE IF NOT EXISTS public.mken_whatsapp_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    phone TEXT NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- appointment_reminder, order_status, subscription_alert
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    template_name TEXT,
    template_params JSONB DEFAULT '{}'::jsonb,
    body TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'queued', -- queued, holding_cst_window, sent, failed, cancelled_opt_out
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_outbox_process 
    ON public.mken_whatsapp_outbox(status, scheduled_for)
    WHERE status IN ('queued', 'holding_cst_window');

-- 4. دوال الفحص الذري السريع
CREATE OR REPLACE FUNCTION public.mken_fn_register_inbound_message(
    p_provider TEXT,
    p_message_id TEXT,
    p_phone TEXT,
    p_tenant_slug TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.mken_whatsapp_inbound_dedup (provider, message_id, phone, tenant_slug)
    VALUES (p_provider, p_message_id, p_phone, p_tenant_slug)
    ON CONFLICT (provider, message_id) DO NOTHING;

    RETURN FOUND; -- يعود بـ TRUE إذا تم الإدراج (رسالة جديدة)، و FALSE إذا كانت مكررة
END;
$$;

CREATE OR REPLACE FUNCTION public.mken_fn_is_phone_opted_out(
    p_phone TEXT,
    p_tenant_slug TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_opted_out BOOLEAN;
BEGIN
    SELECT is_active INTO v_opted_out
    FROM public.mken_dnc_list
    WHERE phone = p_phone AND tenant_slug = p_tenant_slug;

    RETURN COALESCE(v_opted_out, FALSE);
END;
$$;
