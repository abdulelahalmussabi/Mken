-- =============================================================================
-- مكّن — مصدر الحقيقة لتشغيل الطابور (لا تُنفَّذ على الإنتاج من طلب السحب)
-- طبّقها يدوياً في محرر SQL في Supabase بعد:
--   1) db/queue-management-schema.sql
--   2) db/migrations/2026-11-17-queue-tenant-rls.sql
-- الخدمة (service_role) تتجاوز RLS. المفتاح العام anon لا يقرأ الأسماء أو الجوال.
-- المحرك الحي يصدر معرّفات نصية (q-cs-… / tkt_…) وحالات مثل bumped و sync_watch
-- ليست في ENUM الجداول الكلاسيكية، لذلك أُضيفت جداول تشغيل منفصلة مع tenant_id
-- على كل صف. الجداول الكلاسيكية تُكمَّل بعمود tenant_id إن كانت موجودة.
-- الترقيم اليومي ذري حسب Asia/Riyadh عبر queue_next_number.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_slug()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_slug',
    current_setting('request.jwt.claim.tenant_slug', true),
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_slug'),
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role') IN ('super_admin', 'service_role', 'super'),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_is_tenant_staff(target_tenant text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;
  IF target_tenant IS NULL OR to_regclass('public.users') IS NULL THEN
    RETURN false;
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.tenant_slug = target_tenant
      AND u.role::text IN ('admin', 'receptionist', 'counter_agent')
  )
  AND (
    public.current_tenant_slug() IS NULL
    OR public.current_tenant_slug() = target_tenant
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.queue_daily_counters (
  tenant_slug text NOT NULL,
  tenant_id text NOT NULL,
  queue_id text NOT NULL,
  service_date date NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_slug, queue_id, service_date),
  CONSTRAINT queue_daily_counters_tenant_id_matches CHECK (tenant_id = tenant_slug)
);

CREATE TABLE IF NOT EXISTS public.queue_runtime_records (
  id text PRIMARY KEY,
  tenant_slug text NOT NULL,
  tenant_id text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT queue_runtime_records_tenant_id_matches CHECK (tenant_id = tenant_slug)
);

CREATE INDEX IF NOT EXISTS idx_queue_runtime_records_tenant_kind
  ON public.queue_runtime_records (tenant_slug, kind);

CREATE TABLE IF NOT EXISTS public.queue_runtime_events (
  id bigserial PRIMARY KEY,
  tenant_slug text NOT NULL,
  tenant_id text NOT NULL,
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT queue_runtime_events_tenant_id_matches CHECK (tenant_id = tenant_slug)
);

CREATE INDEX IF NOT EXISTS idx_queue_runtime_events_tenant
  ON public.queue_runtime_events (tenant_slug, id);

-- رقم تذكرة واحد لكل منشأة/طابور/يوم الرياض. التحديث صفّي فلا يتكرر الرقم بين النسخ.
CREATE OR REPLACE FUNCTION public.queue_next_number(
  p_tenant text,
  p_queue text,
  p_prefix text
) RETURNS TABLE(seq integer, ticket_number text)
LANGUAGE plpgsql
SET search_path = public
AS $queue_next$
DECLARE
  v_day date;
  v_n integer;
  v_prefix text;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' OR p_queue IS NULL OR btrim(p_queue) = '' THEN
    RAISE EXCEPTION 'tenant and queue are required';
  END IF;
  v_prefix := COALESCE(NULLIF(btrim(p_prefix), ''), 'A');
  v_day := (timezone('Asia/Riyadh', clock_timestamp()))::date;

  INSERT INTO public.queue_daily_counters AS c (
    tenant_slug, tenant_id, queue_id, service_date, last_number
  ) VALUES (p_tenant, p_tenant, p_queue, v_day, 1)
  ON CONFLICT (tenant_slug, queue_id, service_date)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_n;

  seq := v_n;
  ticket_number := v_prefix || '-' || lpad(v_n::text, 2, '0');
  RETURN NEXT;
END;
$queue_next$;

-- حفظ حالة الطلب والأحداث في معاملة واحدة. الحذف يقتصر على معرّفات هذه المنشأة.
CREATE OR REPLACE FUNCTION public.queue_commit(
  p_tenant text,
  p_records jsonb,
  p_events jsonb,
  p_delete_ids text[]
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $queue_commit$
DECLARE
  rec jsonb;
  ev jsonb;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' THEN
    RAISE EXCEPTION 'tenant is required';
  END IF;

  DELETE FROM public.queue_runtime_records
  WHERE tenant_slug = p_tenant
    AND id = ANY(COALESCE(p_delete_ids, ARRAY[]::text[]));

  FOR rec IN SELECT value FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb))
  LOOP
    IF rec->>'id' IS NULL OR rec->>'kind' IS NULL THEN
      RAISE EXCEPTION 'record id and kind are required';
    END IF;
    INSERT INTO public.queue_runtime_records (
      id, tenant_slug, tenant_id, kind, payload, version, updated_at
    ) VALUES (
      rec->>'id',
      p_tenant,
      p_tenant,
      rec->>'kind',
      COALESCE(rec->'payload', '{}'::jsonb),
      1,
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      kind = EXCLUDED.kind,
      payload = EXCLUDED.payload,
      version = public.queue_runtime_records.version + 1,
      updated_at = now()
    WHERE public.queue_runtime_records.tenant_slug = EXCLUDED.tenant_slug;
  END LOOP;

  FOR ev IN SELECT value FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb))
  LOOP
    INSERT INTO public.queue_runtime_events (tenant_slug, tenant_id, event_name, payload)
    VALUES (
      p_tenant,
      p_tenant,
      COALESCE(ev->>'name', 'notice'),
      COALESCE(ev->'payload', '{}'::jsonb)
    );
  END LOOP;
END;
$queue_commit$;

ALTER TABLE public.queue_daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_runtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_runtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_daily_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.queue_runtime_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.queue_runtime_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.queue_daily_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.queue_runtime_records FROM PUBLIC;
REVOKE ALL ON TABLE public.queue_runtime_events FROM PUBLIC;

DO $policies$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public.queue_daily_counters FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.queue_runtime_records FROM anon';
    EXECUTE 'REVOKE ALL ON TABLE public.queue_runtime_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'DROP POLICY IF EXISTS queue_daily_counters_staff ON public.queue_daily_counters';
    EXECUTE 'CREATE POLICY queue_daily_counters_staff ON public.queue_daily_counters FOR ALL TO authenticated USING (public.queue_is_tenant_staff(tenant_slug)) WITH CHECK (public.queue_is_tenant_staff(tenant_slug))';
    EXECUTE 'DROP POLICY IF EXISTS queue_runtime_records_staff ON public.queue_runtime_records';
    EXECUTE 'CREATE POLICY queue_runtime_records_staff ON public.queue_runtime_records FOR ALL TO authenticated USING (public.queue_is_tenant_staff(tenant_slug)) WITH CHECK (public.queue_is_tenant_staff(tenant_slug))';
    EXECUTE 'DROP POLICY IF EXISTS queue_runtime_events_staff ON public.queue_runtime_events';
    EXECUTE 'CREATE POLICY queue_runtime_events_staff ON public.queue_runtime_events FOR ALL TO authenticated USING (public.queue_is_tenant_staff(tenant_slug)) WITH CHECK (public.queue_is_tenant_staff(tenant_slug))';
  END IF;
END
$policies$;

REVOKE ALL ON FUNCTION public.queue_next_number(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_commit(text, jsonb, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_is_tenant_staff(text) FROM PUBLIC;

DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.queue_is_tenant_staff(text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.queue_next_number(text, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.queue_commit(text, jsonb, jsonb, text[]) TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.queue_daily_counters TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.queue_runtime_records TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.queue_runtime_events TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE public.queue_runtime_events_id_seq TO service_role;
  END IF;
END
$grants$;

-- لوحة عامة: رقم وحالة وكاونتر فقط.
CREATE OR REPLACE VIEW public.queue_runtime_public_board
WITH (security_invoker = true) AS
SELECT
  tenant_slug,
  tenant_id,
  payload->>'ticket_number' AS ticket_number,
  payload->>'status' AS status,
  payload->>'called_counter_number' AS counter
FROM public.queue_runtime_records
WHERE kind = 'ticket';

REVOKE ALL ON public.queue_runtime_public_board FROM PUBLIC;
DO $view_revoke$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON public.queue_runtime_public_board FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON public.queue_runtime_public_board FROM authenticated';
  END IF;
END
$view_revoke$;

-- إكمال الجداول الكلاسيكية إن وُجدت (بعد ترحيل العزل). لا يُنشئها هذا الملف.
ALTER TABLE IF EXISTS public.branches ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.services ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.counters ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.tickets ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.ticket_logs ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.counter_sessions ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.agent_breaks ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.reception_handovers ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.queue_configs ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE IF EXISTS public.queue_audit_logs ADD COLUMN IF NOT EXISTS tenant_id text;

DO $backfill$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY[
    'branches', 'users', 'services', 'counters', 'tickets', 'ticket_logs',
    'counter_sessions', 'agent_breaks', 'reception_handovers', 'queue_configs', 'queue_audit_logs'
  ]
  LOOP
    IF to_regclass('public.' || rel) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = rel AND column_name = 'tenant_slug'
       ) THEN
      EXECUTE format(
        'UPDATE public.%I SET tenant_id = tenant_slug WHERE tenant_id IS NULL AND tenant_slug IS NOT NULL',
        rel
      );
    END IF;
  END LOOP;
END
$backfill$;

-- الاسم والجوال اختياريان في تذكرة الانضمام. القيمة الفارغة أو NULL لا تُرفض.
DO $optional_ticket_identity$
BEGIN
  IF to_regclass('public.tickets') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'customer_name'
     ) THEN
    EXECUTE 'ALTER TABLE public.tickets ALTER COLUMN customer_name DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.tickets ALTER COLUMN customer_name DROP DEFAULT';
  END IF;
  IF to_regclass('public.tickets') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'phone_number'
     ) THEN
    EXECUTE 'ALTER TABLE public.tickets ALTER COLUMN phone_number DROP NOT NULL';
  END IF;
END
$optional_ticket_identity$;
