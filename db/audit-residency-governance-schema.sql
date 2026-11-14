-- =============================================================================
-- منصة مكّن (mken.live) — حوكمة توطين البيانات وسجلات الوصول والتدقيق
-- الامتثال: ضوابط الهيئة الوطنية للأمن السيبراني (NCA ECC-1:2018 - الضابط 2-3)،
-- ونظام حماية البيانات الشخصية (PDPL) التابع لسدايا، ولوائح ZATCA
-- =============================================================================

-- 1. جدول سجلات التدقيق المحصنة تشفيرياً (Immutable Audit Ledger)
-- صُمم ليكون غير قابل للتعديل أو الحذف نهائياً (Append-Only)
CREATE TABLE IF NOT EXISTS public.mken_immutable_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    actor_id TEXT NOT NULL,
    actor_email TEXT,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- PII_EXPORT, PII_ACCESS, ANONYMIZE_REQUEST, ROLE_CHANGE, CONFIG_UPDATE, AUTH_LOGIN
    resource_type VARCHAR(50) NOT NULL, -- customer, order, appointment, invoice, settings, staff
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, FAILURE, BLOCKED
    details JSONB DEFAULT '{}'::jsonb,
    prev_record_hash TEXT NOT NULL,
    record_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس الاستعلام السريع للتدقيق الأمني
CREATE INDEX IF NOT EXISTS idx_mken_audit_tenant_time 
    ON public.mken_immutable_audit_logs(tenant_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mken_audit_actor 
    ON public.mken_immutable_audit_logs(actor_id, action);
CREATE INDEX IF NOT EXISTS idx_mken_audit_resource 
    ON public.mken_immutable_audit_logs(resource_type, resource_id);

-- 2. مشغل قاعدة البيانات الصارم لمنع أي تعديل أو حذف (Immutability Trigger)
-- يلزم الهيئة الوطنية للأمن السيبراني NCA بعدم إمكانية مسح السجلات حتى للمسؤولين
CREATE OR REPLACE FUNCTION public.mken_fn_prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'مرفوض قطعياً: سجلات التدقيق محصنة تشفيرياً وغير قابلة للتعديل أو المسح وفق ضوابط الهيئة الوطنية للأمن السيبراني (NCA ECC-1:2018)';
END;
$$;

DROP TRIGGER IF EXISTS trg_mken_audit_immutable ON public.mken_immutable_audit_logs;
CREATE TRIGGER trg_mken_audit_immutable
BEFORE UPDATE OR DELETE ON public.mken_immutable_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.mken_fn_prevent_audit_log_mutation();

-- 3. جدول طلبات التعمية وحق النسيان النظامي (Data Erasure Requests)
-- يوثق طلبات المستهلكين استناداً إلى المادة 5 من نظام حماية البيانات الشخصية
CREATE TABLE IF NOT EXISTS public.mken_data_erasure_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    customer_phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    request_reason TEXT DEFAULT 'ممارسة حق النسيان بموجب نظام حماية البيانات الشخصية',
    anonymized_alias TEXT NOT NULL,
    financial_records_retained INT NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'executed', -- pending, executed, rejected
    executed_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mken_erasure_tenant_phone 
    ON public.mken_data_erasure_requests(tenant_slug, customer_phone);

-- 4. سجل حوكمة وتصنيف البيانات الوطنية (NDMO Data Classification)
CREATE TABLE IF NOT EXISTS public.mken_data_classification_registry (
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    classification VARCHAR(30) NOT NULL, -- Top Secret, Secret, Restricted, Public
    retention_period_months INT NOT NULL DEFAULT 12,
    cross_border_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_required BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (table_name, column_name)
);

-- إدراج التصنيفات الافتراضية المعتمدة
INSERT INTO public.mken_data_classification_registry (table_name, column_name, classification, retention_period_months, cross_border_allowed, encryption_required)
VALUES
('mken_saas_clients', 'vat_number', 'Restricted', 72, false, true),
('mken_saas_clients', 'cr_number', 'Restricted', 72, false, true),
('mken_saas_clients', 'config_data', 'Secret', 72, false, true),
('mken_invoices', 'zatca_qr_code', 'Restricted', 72, false, false),
('mken_orders', 'customer_name', 'Restricted', 24, false, true),
('mken_orders', 'phone', 'Restricted', 24, false, true),
('mken_appointments', 'customer_name', 'Restricted', 24, false, true),
('mken_appointments', 'phone', 'Restricted', 24, false, true),
('mken_field_tasks', 'customer_lat', 'Secret', 12, false, true),
('mken_field_tasks', 'customer_lng', 'Secret', 12, false, true),
('mken_immutable_audit_logs', 'record_hash', 'Restricted', 36, false, true)
ON CONFLICT (table_name, column_name) DO NOTHING;
