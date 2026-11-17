-- =============================================================================
-- مكّن — حفظ دلتا صفّي للطابور (يُطبَّق يدوياً على إنتاج Supabase)
-- بعد:
--   1) db/queue-management-schema.sql
--   2) db/migrations/2026-11-17-queue-tenant-rls.sql
--   3) db/migrations/2026-11-17-queue-postgres-runtime.sql
-- الملف آمن لإعادة التشغيل. لا يحذف تذاكر لم تُمرَّر معرّفاتها صراحة.
-- queue_commit_delta يحدّث الصفوف المتغيرة فقط ويفشل إذا تغيّر version.
-- queue_call_next يقفل التذكرة بـ FOR UPDATE SKIP LOCKED حتى لا يستدعي
-- كاونتران التذكرة نفسها.
-- الخدمة (service_role) فقط تنفّذ الدالتين. anon لا يقرأ الأسماء أو الجوال.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_queue_runtime_ticket_queue
  ON public.queue_runtime_records (tenant_slug, ((payload ->> 'queue_id')))
  WHERE kind = 'ticket';

CREATE OR REPLACE FUNCTION public.queue_commit_delta(
  p_tenant text,
  p_records jsonb,
  p_events jsonb,
  p_delete_ids text[]
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $queue_commit_delta$
DECLARE
  rec jsonb;
  ev jsonb;
  v_id text;
  v_expected integer;
  v_updated text;
  v_lock_ids text[];
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' THEN
    RAISE EXCEPTION 'tenant is required';
  END IF;

  -- Writers wait out a schema migration instead of deadlocking on AccessExclusiveLock.
  PERFORM pg_advisory_xact_lock_shared(8675309);

  SELECT COALESCE(array_agg(DISTINCT lock_id ORDER BY lock_id), ARRAY[]::text[])
  INTO v_lock_ids
  FROM (
    SELECT rec_row->>'id' AS lock_id
    FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb)) AS rec_row
    WHERE rec_row->>'id' IS NOT NULL
      AND rec_row ? 'expected_version'
      AND jsonb_typeof(rec_row->'expected_version') = 'number'
    UNION
    SELECT del_id
    FROM unnest(COALESCE(p_delete_ids, ARRAY[]::text[])) AS del_id
    WHERE del_id IS NOT NULL
  ) locks;

  -- ترتيب ثابت يمنع التبادل بين كاونتر وتذكرة.
  PERFORM 1
  FROM public.queue_runtime_records
  WHERE tenant_slug = p_tenant
    AND id = ANY(v_lock_ids)
  ORDER BY id
  FOR UPDATE;

  IF COALESCE(array_length(p_delete_ids, 1), 0) > 0 THEN
    DELETE FROM public.queue_runtime_records
    WHERE tenant_slug = p_tenant
      AND id = ANY(p_delete_ids);
  END IF;

  FOR rec IN SELECT value FROM jsonb_array_elements(COALESCE(p_records, '[]'::jsonb))
  LOOP
    v_id := rec->>'id';
    IF v_id IS NULL OR rec->>'kind' IS NULL THEN
      RAISE EXCEPTION 'record id and kind are required';
    END IF;

    IF rec ? 'expected_version' AND jsonb_typeof(rec->'expected_version') = 'number' THEN
      v_expected := (rec->>'expected_version')::integer;
      UPDATE public.queue_runtime_records
      SET
        kind = rec->>'kind',
        payload = COALESCE(rec->'payload', '{}'::jsonb),
        version = version + 1,
        updated_at = clock_timestamp()
      WHERE id = v_id
        AND tenant_slug = p_tenant
        AND version = v_expected
      RETURNING id INTO v_updated;

      IF v_updated IS NULL THEN
        RAISE EXCEPTION 'queue_version_conflict:%', v_id USING ERRCODE = '40001';
      END IF;
    ELSE
      INSERT INTO public.queue_runtime_records (
        id, tenant_slug, tenant_id, kind, payload, version, updated_at
      ) VALUES (
        v_id,
        p_tenant,
        p_tenant,
        rec->>'kind',
        COALESCE(rec->'payload', '{}'::jsonb),
        1,
        clock_timestamp()
      )
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind,
        payload = EXCLUDED.payload,
        version = public.queue_runtime_records.version + 1,
        updated_at = clock_timestamp()
      WHERE public.queue_runtime_records.tenant_slug = EXCLUDED.tenant_slug;
    END IF;
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
$queue_commit_delta$;

CREATE OR REPLACE FUNCTION public.queue_call_next(
  p_tenant text,
  p_counter_id text,
  p_ticket_id text DEFAULT NULL,
  p_statuses text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $queue_call_next$
DECLARE
  v_counter public.queue_runtime_records%ROWTYPE;
  v_ticket public.queue_runtime_records%ROWTYPE;
  v_payload jsonb;
  v_counter_payload jsonb;
  v_bumped jsonb := '[]'::jsonb;
  v_seen text[] := ARRAY[]::text[];
  v_statuses text[];
  v_queue_ids text[];
  v_phone text;
  v_token text;
  v_queue text;
  v_now text;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' OR p_counter_id IS NULL OR btrim(p_counter_id) = '' THEN
    RAISE EXCEPTION 'tenant and counter are required';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(8675309);

  v_statuses := COALESCE(p_statuses, ARRAY['waiting', 'bumped', 'sync_watch']::text[]);
  v_now := to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  SELECT *
  INTO v_counter
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':counter:' || p_counter_id
    AND tenant_slug = p_tenant
    AND kind = 'counter'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'counter_missing');
  END IF;

  v_counter_payload := v_counter.payload;
  IF v_counter_payload->>'status' = 'on_break' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'on_break', 'counter', v_counter_payload);
  END IF;

  SELECT COALESCE(array_agg(q.value), ARRAY[]::text[])
  INTO v_queue_ids
  FROM jsonb_array_elements_text(COALESCE(v_counter_payload->'assigned_queue_ids', '[]'::jsonb)) AS q(value);

  IF p_ticket_id IS NOT NULL AND btrim(p_ticket_id) <> '' THEN
    SELECT *
    INTO v_ticket
    FROM public.queue_runtime_records
    WHERE id = p_tenant || ':ticket:' || p_ticket_id
      AND tenant_slug = p_tenant
      AND kind = 'ticket'
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'missing');
    END IF;
    IF NOT ((v_ticket.payload->>'status') = ANY(v_statuses)) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'taken', 'ticket', v_ticket.payload);
    END IF;

    v_payload := v_ticket.payload || jsonb_build_object(
      'status', 'called',
      'counter_id', p_counter_id,
      'called_counter_number', v_counter_payload->'counter_number',
      'called_at', v_now
    );
    UPDATE public.queue_runtime_records
    SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
    WHERE id = v_ticket.id;

    v_counter_payload := jsonb_set(
      v_counter_payload || jsonb_build_object(
        'current_ticket_id', v_payload->>'id',
        'current_ticket_number', v_payload->>'ticket_number'
      ),
      '{current_session_started_at}',
      'null'::jsonb,
      true
    );
    UPDATE public.queue_runtime_records
    SET payload = v_counter_payload, version = version + 1, updated_at = clock_timestamp()
    WHERE id = v_counter.id;

    RETURN jsonb_build_object(
      'ok', true,
      'code', 'called',
      'ticket', v_payload,
      'counter', v_counter_payload,
      'bumped', v_bumped
    );
  END IF;

  LOOP
    SELECT r.*
    INTO v_ticket
    FROM public.queue_runtime_records r
    WHERE r.tenant_slug = p_tenant
      AND r.kind = 'ticket'
      AND r.payload->>'queue_id' = ANY(v_queue_ids)
      AND r.payload->>'status' = ANY(v_statuses)
      AND NOT (r.id = ANY(v_seen))
    ORDER BY
      CASE
        WHEN r.payload->>'priority_level' = 'immediate_next'
          OR r.payload->'is_immediate_next' = 'true'::jsonb
          OR r.payload->'is_bumped' = 'true'::jsonb
        THEN 0 ELSE 1
      END,
      CASE
        WHEN r.payload->>'priority_level' = 'immediate_next'
          OR r.payload->'is_immediate_next' = 'true'::jsonb
          OR r.payload->'is_bumped' = 'true'::jsonb
        THEN COALESCE(r.payload->>'transferred_at', r.payload->>'called_at', r.payload->>'booked_at')
        WHEN r.payload->>'priority_level' = 'fair_fifo' AND NULLIF(r.payload->>'first_arrived_at', '') IS NOT NULL
        THEN r.payload->>'first_arrived_at'
        ELSE COALESCE(r.payload->>'transferred_at', r.payload->>'booked_at')
      END,
      r.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
      IF jsonb_array_length(v_bumped) > 0 THEN
        RETURN jsonb_build_object(
          'ok', true,
          'code', 'bumped_only',
          'ticket', NULL,
          'bumped', v_bumped,
          'counter', v_counter_payload
        );
      END IF;
      RETURN jsonb_build_object('ok', true, 'code', 'empty', 'ticket', NULL, 'counter', v_counter_payload);
    END IF;

    v_payload := v_ticket.payload;
    v_phone := NULLIF(v_payload->>'customer_phone', '');
    v_token := NULLIF(v_payload->>'session_token', '');
    v_queue := v_payload->>'queue_id';
    v_seen := array_append(v_seen, v_ticket.id);

    IF (v_phone IS NOT NULL OR v_token IS NOT NULL) AND EXISTS (
      SELECT 1
      FROM public.queue_runtime_records o
      WHERE o.tenant_slug = p_tenant
        AND o.kind = 'ticket'
        AND o.id <> v_ticket.id
        AND o.payload->>'status' IN ('in_service', 'called')
        AND o.payload->>'queue_id' IS DISTINCT FROM v_queue
        AND (
          (v_token IS NOT NULL AND o.payload->>'session_token' = v_token)
          OR (v_phone IS NOT NULL AND o.payload->>'customer_phone' = v_phone)
        )
    ) THEN
      v_payload := v_payload || jsonb_build_object(
        'is_bumped', true,
        'bump_count', COALESCE((NULLIF(v_payload->>'bump_count', ''))::integer, 0) + 1,
        'status', 'bumped',
        'notes', 'تم تأمين موقعك ذكياً (+1 Bump)؛ نظراً لوجودك عند كاونتر الخدمة الأخرى.'
      );
      UPDATE public.queue_runtime_records
      SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
      WHERE id = v_ticket.id;
      v_bumped := v_bumped || jsonb_build_array(v_payload);
      CONTINUE;
    END IF;

    v_payload := v_payload || jsonb_build_object(
      'status', 'called',
      'counter_id', p_counter_id,
      'called_counter_number', v_counter_payload->'counter_number',
      'called_at', v_now
    );
    UPDATE public.queue_runtime_records
    SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
    WHERE id = v_ticket.id;

    v_counter_payload := jsonb_set(
      v_counter_payload || jsonb_build_object(
        'current_ticket_id', v_payload->>'id',
        'current_ticket_number', v_payload->>'ticket_number'
      ),
      '{current_session_started_at}',
      'null'::jsonb,
      true
    );

    UPDATE public.queue_runtime_records
    SET payload = v_counter_payload, version = version + 1, updated_at = clock_timestamp()
    WHERE id = v_counter.id;

    RETURN jsonb_build_object(
      'ok', true,
      'code', 'called',
      'ticket', v_payload,
      'counter', v_counter_payload,
      'bumped', v_bumped
    );
  END LOOP;
END;
$queue_call_next$;

REVOKE ALL ON FUNCTION public.queue_commit_delta(text, jsonb, jsonb, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM PUBLIC;

DO $delta_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_commit_delta(text, jsonb, jsonb, text[]) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_commit_delta(text, jsonb, jsonb, text[]) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_commit_delta(text, jsonb, jsonb, text[]) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_call_next(text, text, text, text[]) TO service_role';
  END IF;
END
$delta_grants$;
