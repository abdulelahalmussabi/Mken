-- =====================================================================
-- مكّن (Mken Platform) - نظام إدارة الطوابير المتقدم (Enterprise QMS)
-- ترقية المرحلة الثانية: تسجيل المواعيد الذاتي وأجهزة الكشك وتأمين الهوية
-- (Appointment Self Check-in, Kiosk Security & PDPL Zero-PII Compliance)
-- =====================================================================

-- 1. إضافة نوع الأولوية للمواعيد المجدولة (priority_type enum)
DO $$ BEGIN
  ALTER TYPE public.priority_type ADD VALUE IF NOT EXISTS 'scheduled_appointment' AFTER 'immediate_next';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN undefined_object THEN null;
END $$;

-- 2. تطوير جدول التذاكر (tickets) بحقول المواعيد والهوية المشفرة والقناة
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'appointment_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN appointment_id TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'scheduled_time'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN scheduled_time TIMESTAMPTZ NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'national_id_hash'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN national_id_hash TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'identity_last4'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN identity_last4 TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN device_id TEXT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'source_channel'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN source_channel TEXT DEFAULT 'web';
  END IF;
END $$;

-- فهارس التذاكر للبحث السريع ومنع التكرار
CREATE INDEX IF NOT EXISTS idx_tickets_appointment_lookup 
ON public.tickets (tenant_slug, appointment_id) 
WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_national_id_hash 
ON public.tickets (tenant_slug, national_id_hash) 
WHERE national_id_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_device_active 
ON public.tickets (tenant_slug, device_id, current_service_id, status);

-- 3. إنشاء جدول أجهزة الخدمة الذاتية (queue_kiosks)
CREATE TABLE IF NOT EXISTS public.queue_kiosks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    zone_id UUID NULL REFERENCES public.queue_zones(id) ON DELETE SET NULL,
    kiosk_code TEXT NOT NULL,                          -- رمز الكشك مثل KIOSK-REC01-A
    name TEXT NOT NULL,                                -- اسم الكشك مثل كشك استقبال الطوارئ 1
    token_hash TEXT NOT NULL,                          -- تجزئة SHA-256 للمصادقة الآمنة x-kiosk-token
    allowed_service_ids JSONB DEFAULT '[]'::jsonb,     -- العيادات والخدمات المسموحة للكشك
    is_active BOOLEAN DEFAULT TRUE,
    last_heartbeat_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT queue_kiosks_tenant_branch_code_key UNIQUE (tenant_slug, branch_id, kiosk_code)
);

CREATE INDEX IF NOT EXISTS idx_queue_kiosks_tenant_branch 
ON public.queue_kiosks (tenant_slug, branch_id);

CREATE INDEX IF NOT EXISTS idx_queue_kiosks_token_hash 
ON public.queue_kiosks (tenant_slug, token_hash);

-- سياسات الأمان وعزل البيانات على مستوى السجل (RLS) لجدول الكشك
ALTER TABLE IF EXISTS public.queue_kiosks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_kiosks FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.queue_kiosks FROM PUBLIC, anon;

DROP POLICY IF EXISTS queue_kiosks_tenant_isolation ON public.queue_kiosks;
CREATE POLICY queue_kiosks_tenant_isolation ON public.queue_kiosks
  FOR ALL TO authenticated
  USING (
    public.queue_is_tenant_staff(tenant_slug)
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
  )
  WITH CHECK (
    public.queue_is_tenant_staff(tenant_slug)
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
  );

-- 4. تحديث إجراء إخفاء الهوية الدوري لنظام حماية البيانات الشخصية (PDPL)
CREATE OR REPLACE FUNCTION public.anonymize_old_queue_records(
    p_tenant TEXT,
    p_retention_days INT DEFAULT 30
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected INT := 0;
    v_tickets_affected INT := 0;
BEGIN
    -- 1. إخفاء هوية سجلات ربط نقاط البيع القديمة
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'queue_ticket_pos_link') THEN
        UPDATE public.queue_ticket_pos_link
        SET order_summary = jsonb_set(
                jsonb_set(order_summary, '{customer_name}', '"***"'),
                '{phone}', '"***"'
            ),
            updated_at = NOW()
        WHERE tenant_slug = p_tenant
          AND ticket_date < (CURRENT_DATE - p_retention_days)
          AND link_status IN ('paid', 'served', 'cancelled');
        GET DIAGNOSTICS v_affected = ROW_COUNT;
    END IF;

    -- 2. إخفاء هوية سجلات التذاكر القديمة المكتملة أو الملغاة
    UPDATE public.tickets
    SET customer_name = '***',
        phone_number = '***',
        identity_last4 = NULL,
        device_id = NULL,
        national_id_hash = NULL
    WHERE tenant_slug = p_tenant
      AND created_at < (NOW() - (p_retention_days || ' days')::INTERVAL)
      AND status IN ('completed', 'cancelled', 'no_show');

    GET DIAGNOSTICS v_tickets_affected = ROW_COUNT;
    RETURN (v_affected + v_tickets_affected);
END;
$$;

COMMENT ON TABLE public.queue_kiosks IS 'أجهزة الخدمة الذاتية (Kiosks) في المجمعات والمستشفيات - نظام الطوابير مَكَن';
