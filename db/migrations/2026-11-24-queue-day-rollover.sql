-- =============================================================================
-- مكّن — إغلاق اليوم التشغيلي وإعادة الترقيم
-- يُطبَّق يدوياً على إنتاج Supabase بعد هجرات الطابور السابقة.
-- آمن لإعادة التشغيل. التذاكر بلا service_date تُشتق من first_arrived_at ثم booked_at
-- بتوقيت آسيا/الرياض. لا يُقفل هذا التدوير كل التذاكر المفتوحة: FOR UPDATE SKIP LOCKED
-- يقتصر على الصفوف التي ستُغلق أو التي بلا service_date، حتى يستطيع كاونتران
-- استدعاء تذكرتين مختلفتين في الوقت نفسه.
-- الخدمة (service_role) فقط تنفّذ الدوال.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_queue_runtime_open_tickets
  ON public.queue_runtime_records (tenant_slug, id)
  WHERE kind = 'ticket'
    AND payload->>'status' IN ('waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch', 'called', 'in_service');

CREATE OR REPLACE FUNCTION public.queue_hhmm_minutes(p_value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $queue_hhmm$
DECLARE
  v_h integer;
  v_m integer;
BEGIN
  IF p_value IS NULL OR p_value !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN NULL;
  END IF;
  v_h := split_part(p_value, ':', 1)::integer;
  v_m := split_part(p_value, ':', 2)::integer;
  RETURN v_h * 60 + v_m;
END;
$queue_hhmm$;

CREATE OR REPLACE FUNCTION public.queue_operating_period(
  p_settings jsonb,
  p_now timestamptz,
  p_extended_minutes integer
) RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $queue_period$
DECLARE
  v_settings jsonb := COALESCE(p_settings, '{}'::jsonb);
  v_mode text := COALESCE(v_settings->>'operating_mode', 'fixed_close');
  v_local timestamp;
  v_date date;
  v_minutes integer;
  v_close integer;
  v_reset integer := 4;
  v_extended integer := GREATEST(COALESCE(p_extended_minutes, 0), 0);
BEGIN
  IF v_mode IN ('always_open', '24h') THEN
    v_mode := 'always_open';
  ELSE
    v_mode := 'fixed_close';
  END IF;
  v_local := timezone('Asia/Riyadh', COALESCE(p_now, clock_timestamp()));
  v_date := v_local::date;
  v_minutes := (EXTRACT(HOUR FROM v_local))::integer * 60 + (EXTRACT(MINUTE FROM v_local))::integer;
  IF v_mode = 'always_open' THEN
    IF COALESCE(v_settings->>'reset_hour', '') ~ '^-?\d+$' THEN
      v_reset := (v_settings->>'reset_hour')::integer;
    END IF;
    IF v_reset < 0 OR v_reset > 23 THEN
      v_reset := 4;
    END IF;
    IF (EXTRACT(HOUR FROM v_local))::integer < v_reset THEN
      RETURN v_date - 1;
    END IF;
    RETURN v_date;
  END IF;
  v_close := public.queue_hhmm_minutes(COALESCE(NULLIF(v_settings->>'closing_time', ''), '00:00'));
  IF v_close IS NULL OR v_close = 0 THEN
    v_close := 24 * 60;
  END IF;
  v_close := v_close + v_extended;
  IF v_minutes >= v_close THEN
    RETURN v_date + 1;
  END IF;
  RETURN v_date;
END;
$queue_period$;

CREATE OR REPLACE FUNCTION public.queue_ticket_service_date(p_payload jsonb)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $queue_ticket_day$
DECLARE
  v_raw text;
  v_ts timestamptz;
BEGIN
  v_raw := NULLIF(p_payload->>'service_date', '');
  IF v_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN
    RETURN v_raw::date;
  END IF;
  v_raw := COALESCE(
    NULLIF(p_payload->>'first_arrived_at', ''),
    NULLIF(p_payload->>'booked_at', ''),
    NULLIF(p_payload->>'created_at', '')
  );
  IF v_raw IS NULL THEN
    RETURN DATE '1970-01-01';
  END IF;
  BEGIN
    v_ts := v_raw::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN DATE '1970-01-01';
  END;
  RETURN (timezone('Asia/Riyadh', v_ts))::date;
END;
$queue_ticket_day$;

CREATE OR REPLACE FUNCTION public.queue_ticket_sequence(p_payload jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $queue_ticket_seq$
  SELECT CASE
    WHEN COALESCE(p_payload->>'daily_sequence', '') ~ '^[0-9]+$'
      AND (p_payload->>'daily_sequence')::integer > 0
      THEN (p_payload->>'daily_sequence')::integer
    WHEN COALESCE(p_payload->>'ticket_number', '') ~ '[0-9]'
      THEN (regexp_match(p_payload->>'ticket_number', '([0-9]+)[[:space:]]*$'))[1]::integer
    ELSE NULL
  END;
$queue_ticket_seq$;

CREATE OR REPLACE FUNCTION public.queue_ticket_should_close(
  p_payload jsonb,
  p_settings jsonb,
  p_now timestamptz,
  p_extended_minutes integer
) RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $queue_should_close$
DECLARE
  v_status text := COALESCE(p_payload->>'status', '');
  v_settings jsonb := COALESCE(p_settings, '{}'::jsonb);
  v_mode text := COALESCE(v_settings->>'operating_mode', 'fixed_close');
  v_now timestamptz := COALESCE(p_now, clock_timestamp());
  v_anchor_raw text;
  v_anchor timestamptz;
  v_max numeric := 6;
  v_board text[] := ARRAY['waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch'];
  v_open text[] := ARRAY['waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch', 'called', 'in_service'];
BEGIN
  IF v_mode IN ('always_open', '24h') THEN
    v_mode := 'always_open';
  ELSE
    v_mode := 'fixed_close';
  END IF;
  IF NOT (v_status = ANY (v_open)) THEN
    RETURN NULL;
  END IF;
  IF v_mode = 'always_open' THEN
    IF NOT (v_status = ANY (v_board)) THEN
      RETURN NULL;
    END IF;
    IF COALESCE(v_settings->>'max_wait_hours', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
      v_max := (v_settings->>'max_wait_hours')::numeric;
    END IF;
    IF v_max <= 0 THEN
      v_max := 6;
    ELSIF v_max > 72 THEN
      v_max := 72;
    END IF;
    v_anchor_raw := COALESCE(
      NULLIF(p_payload->>'restored_at', ''),
      NULLIF(p_payload->>'first_arrived_at', ''),
      NULLIF(p_payload->>'booked_at', ''),
      NULLIF(p_payload->>'created_at', '')
    );
    IF v_anchor_raw IS NULL THEN
      RETURN 'تجاوز الحد الأقصى للانتظار';
    END IF;
    BEGIN
      v_anchor := v_anchor_raw::timestamptz;
    EXCEPTION WHEN others THEN
      RETURN 'تجاوز الحد الأقصى للانتظار';
    END;
    IF v_now > v_anchor + (v_max * INTERVAL '1 hour') THEN
      RETURN 'تجاوز الحد الأقصى للانتظار';
    END IF;
    RETURN NULL;
  END IF;
  IF public.queue_ticket_service_date(p_payload) < public.queue_operating_period(v_settings, v_now, p_extended_minutes) THEN
    RETURN 'انتهى اليوم التشغيلي';
  END IF;
  RETURN NULL;
END;
$queue_should_close$;

CREATE OR REPLACE FUNCTION public.queue_apply_day_rollover(p_tenant text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $queue_rollover$
DECLARE
  v_settings jsonb := '{}'::jsonb;
  v_override jsonb := '{}'::jsonb;
  v_norm jsonb;
  v_mode text;
  v_closing text;
  v_max numeric := 6;
  v_max_json jsonb;
  v_reset integer := 4;
  v_extended integer := 0;
  v_now timestamptz := clock_timestamp();
  v_period date;
  v_period_text text;
  v_expired integer := 0;
  v_counters integer := 0;
  v_reason text;
  v_audit_reason text;
  v_closed_ids text[] := ARRAY[]::text[];
  v_open text[] := ARRAY['waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch', 'called', 'in_service'];
  rec record;
  v_payload jsonb;
  v_stamp text;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' THEN
    RAISE EXCEPTION 'tenant is required';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(8675309);

  SELECT payload INTO v_settings
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':settings:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'settings';
  v_settings := COALESCE(v_settings, '{}'::jsonb);

  SELECT payload INTO v_override
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':override:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'override';
  BEGIN
    v_extended := COALESCE(NULLIF(COALESCE(v_override, '{}'::jsonb)->>'extended_closing_minutes', '')::integer, 0);
  EXCEPTION WHEN others THEN
    v_extended := 0;
  END;
  IF v_extended < 0 THEN
    v_extended := 0;
  END IF;

  v_mode := COALESCE(v_settings->>'operating_mode', 'fixed_close');
  IF v_mode IN ('always_open', '24h') THEN
    v_mode := 'always_open';
  ELSE
    v_mode := 'fixed_close';
  END IF;
  v_closing := COALESCE(NULLIF(btrim(v_settings->>'closing_time'), ''), '00:00');
  IF public.queue_hhmm_minutes(v_closing) IS NULL THEN
    v_closing := '00:00';
  ELSE
    v_closing := lpad(split_part(v_closing, ':', 1), 2, '0') || ':' || split_part(v_closing, ':', 2);
  END IF;
  IF COALESCE(v_settings->>'max_wait_hours', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN
    v_max := (v_settings->>'max_wait_hours')::numeric;
  END IF;
  IF v_max <= 0 THEN
    v_max := 6;
  ELSIF v_max > 72 THEN
    v_max := 72;
  END IF;
  IF v_max = trunc(v_max) THEN
    v_max_json := to_jsonb(trunc(v_max)::integer);
  ELSE
    v_max_json := to_jsonb(v_max);
  END IF;
  IF COALESCE(v_settings->>'reset_hour', '') ~ '^-?\d+$' THEN
    v_reset := (v_settings->>'reset_hour')::integer;
  END IF;
  IF v_reset < 0 OR v_reset > 23 THEN
    v_reset := 4;
  END IF;

  v_norm := v_settings || jsonb_build_object(
    'operating_mode', v_mode,
    'closing_time', v_closing,
    'reset_hour', v_reset,
    'timezone', 'Asia/Riyadh'
  );
  v_norm := jsonb_set(v_norm, '{max_wait_hours}', v_max_json, true);
  v_period := public.queue_operating_period(v_norm, v_now, v_extended);
  v_period_text := to_char(v_period, 'YYYY-MM-DD');

  IF COALESCE(v_settings->>'operating_mode', '') IS DISTINCT FROM v_mode
    OR COALESCE(v_settings->>'closing_time', '') IS DISTINCT FROM v_closing
    OR COALESCE(v_settings->>'timezone', '') IS DISTINCT FROM 'Asia/Riyadh'
    OR COALESCE(v_settings->>'reset_hour', '') IS DISTINCT FROM v_reset::text
    OR COALESCE(v_settings->>'max_wait_hours', '') IS DISTINCT FROM trim(both '"' FROM v_max_json::text)
  THEN
    UPDATE public.queue_runtime_records
    SET payload = v_norm, version = version + 1, updated_at = clock_timestamp()
    WHERE id = p_tenant || ':settings:singleton'
      AND tenant_slug = p_tenant
      AND kind = 'settings';
  END IF;

  FOR rec IN
    SELECT id, payload, version
    FROM public.queue_runtime_records
    WHERE tenant_slug = p_tenant
      AND kind = 'counter'
      AND COALESCE(payload->>'completed_today_service_date', '') IS DISTINCT FROM v_period_text
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.queue_runtime_records
    SET
      payload = payload || jsonb_build_object(
        'completed_today_count', 0,
        'completed_today_service_date', v_period_text
      ),
      version = version + 1,
      updated_at = clock_timestamp()
    WHERE id = rec.id
      AND version = rec.version;
    IF FOUND THEN
      v_counters := v_counters + 1;
    END IF;
  END LOOP;

  -- Lock only rows that will change. Live waiting tickets stay free for queue_call_next.
  FOR rec IN
    SELECT id, payload, version
    FROM public.queue_runtime_records
    WHERE tenant_slug = p_tenant
      AND kind = 'ticket'
      AND payload->>'status' = ANY (v_open)
      AND (
        public.queue_ticket_should_close(payload, v_norm, v_now, v_extended) IS NOT NULL
        OR COALESCE(payload->>'service_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      )
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    v_reason := public.queue_ticket_should_close(rec.payload, v_norm, v_now, v_extended);
    IF v_reason IS NOT NULL THEN
      v_stamp := to_char(public.queue_ticket_service_date(rec.payload), 'YYYY-MM-DD');
      v_payload := rec.payload || jsonb_build_object(
        'status', 'expired',
        'close_reason', v_reason,
        'auto_closed', true,
        'closed_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'service_date', v_stamp
      );
      UPDATE public.queue_runtime_records
      SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
      WHERE id = rec.id
        AND version = rec.version
        AND payload->>'status' = ANY (v_open);
      IF FOUND THEN
        v_expired := v_expired + 1;
        IF v_audit_reason IS NULL THEN
          v_audit_reason := v_reason;
        END IF;
        IF NULLIF(rec.payload->>'id', '') IS NOT NULL THEN
          v_closed_ids := array_append(v_closed_ids, rec.payload->>'id');
        END IF;
      END IF;
    ELSIF COALESCE(rec.payload->>'service_date', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_stamp := to_char(public.queue_ticket_service_date(rec.payload), 'YYYY-MM-DD');
      IF v_stamp IS NOT NULL AND v_stamp <> '1970-01-01' THEN
        UPDATE public.queue_runtime_records
        SET
          payload = jsonb_set(payload, '{service_date}', to_jsonb(v_stamp), true),
          version = version + 1,
          updated_at = clock_timestamp()
        WHERE id = rec.id
          AND version = rec.version
          AND payload->>'status' = ANY (v_open);
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_closed_ids, 1), 0) > 0 THEN
    FOR rec IN
      SELECT id, payload, version
      FROM public.queue_runtime_records
      WHERE tenant_slug = p_tenant
        AND kind = 'counter'
        AND payload->>'current_ticket_id' = ANY (v_closed_ids)
      ORDER BY id
      FOR UPDATE SKIP LOCKED
    LOOP
      UPDATE public.queue_runtime_records
      SET
        payload = jsonb_set(
          jsonb_set(
            jsonb_set(payload, '{current_ticket_id}', 'null'::jsonb, true),
            '{current_ticket_number}', 'null'::jsonb, true
          ),
          '{current_session_started_at}', 'null'::jsonb, true
        ),
        version = version + 1,
        updated_at = clock_timestamp()
      WHERE id = rec.id
        AND version = rec.version;
    END LOOP;

    INSERT INTO public.queue_runtime_records (
      id, tenant_slug, tenant_id, kind, payload, version, updated_at
    ) VALUES (
      p_tenant || ':audit:' || gen_random_uuid()::text,
      p_tenant,
      p_tenant,
      'audit',
      jsonb_build_object(
        'id', p_tenant || ':audit:day:' || v_period_text || ':' || v_expired::text,
        'tenant_slug', p_tenant,
        'action_type', 'QUEUE_DAY_CLOSE',
        'delta_value', v_expired,
        'reason', COALESCE(v_audit_reason, 'انتهى اليوم التشغيلي'),
        'ticket_ids', to_jsonb(v_closed_ids),
        'performed_by_user_id', 'system',
        'performed_by_name', 'النظام',
        'user_ip_address', 'system',
        'created_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ),
      1,
      clock_timestamp()
    );

    INSERT INTO public.queue_runtime_events (tenant_slug, tenant_id, event_name, payload)
    VALUES (
      p_tenant,
      p_tenant,
      'tickets_expired',
      jsonb_build_object('count', v_expired, 'period', v_period_text)
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'expired', v_expired,
    'counters_reset', v_counters,
    'period', v_period_text
  );
END;
$queue_rollover$;

CREATE OR REPLACE FUNCTION public.queue_rollover_all()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $queue_rollover_all$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT tenant_slug
    FROM public.queue_runtime_records
    WHERE tenant_slug IS NOT NULL AND btrim(tenant_slug) <> ''
    ORDER BY tenant_slug
  LOOP
    PERFORM public.queue_apply_day_rollover(r.tenant_slug);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'tenants', n);
END;
$queue_rollover_all$;

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
  v_settings jsonb := '{}'::jsonb;
  v_override jsonb := '{}'::jsonb;
  v_extended integer := 0;
  v_guard integer := 0;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' OR p_queue IS NULL OR btrim(p_queue) = '' THEN
    RAISE EXCEPTION 'tenant and queue are required';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(8675309);
  PERFORM public.queue_apply_day_rollover(p_tenant);

  SELECT payload INTO v_settings
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':settings:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'settings';
  v_settings := COALESCE(v_settings, '{}'::jsonb);
  SELECT payload INTO v_override
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':override:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'override';
  BEGIN
    v_extended := COALESCE(NULLIF(COALESCE(v_override, '{}'::jsonb)->>'extended_closing_minutes', '')::integer, 0);
  EXCEPTION WHEN others THEN
    v_extended := 0;
  END;

  v_prefix := COALESCE(NULLIF(btrim(p_prefix), ''), 'A');
  v_day := public.queue_operating_period(v_settings, clock_timestamp(), v_extended);

  INSERT INTO public.queue_daily_counters AS c (
    tenant_slug, tenant_id, queue_id, service_date, last_number
  ) VALUES (p_tenant, p_tenant, p_queue, v_day, 1)
  ON CONFLICT (tenant_slug, queue_id, service_date)
  DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_n;

  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 10000 THEN
      RAISE EXCEPTION 'queue number space exhausted';
    END IF;
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.queue_runtime_records t
      WHERE t.tenant_slug = p_tenant
        AND t.kind = 'ticket'
        AND t.payload->>'queue_id' = p_queue
        AND t.payload->>'status' IN ('waiting', 'bumped', 'snoozed', 'on_hold', 'sync_watch', 'called', 'in_service')
        AND public.queue_ticket_sequence(t.payload) = v_n
    );
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.queue_daily_counters
  SET last_number = v_n
  WHERE tenant_slug = p_tenant
    AND queue_id = p_queue
    AND service_date = v_day
    AND last_number IS DISTINCT FROM v_n;

  seq := v_n;
  ticket_number := v_prefix || '-' || lpad(v_n::text, 2, '0');
  RETURN NEXT;
END;
$queue_next$;

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
  v_settings jsonb := '{}'::jsonb;
  v_override jsonb := '{}'::jsonb;
  v_extended integer := 0;
  v_close_reason text;
BEGIN
  IF p_tenant IS NULL OR btrim(p_tenant) = '' OR p_counter_id IS NULL OR btrim(p_counter_id) = '' THEN
    RAISE EXCEPTION 'tenant and counter are required';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(8675309);
  PERFORM public.queue_apply_day_rollover(p_tenant);

  SELECT payload INTO v_settings
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':settings:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'settings';
  v_settings := COALESCE(v_settings, '{}'::jsonb);
  SELECT payload INTO v_override
  FROM public.queue_runtime_records
  WHERE id = p_tenant || ':override:singleton'
    AND tenant_slug = p_tenant
    AND kind = 'override';
  BEGIN
    v_extended := COALESCE(NULLIF(COALESCE(v_override, '{}'::jsonb)->>'extended_closing_minutes', '')::integer, 0);
  EXCEPTION WHEN others THEN
    v_extended := 0;
  END;

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

    v_close_reason := public.queue_ticket_should_close(v_ticket.payload, v_settings, clock_timestamp(), v_extended);
    IF v_close_reason IS NOT NULL OR COALESCE(v_ticket.payload->>'status', '') = 'expired' THEN
      IF COALESCE(v_ticket.payload->>'status', '') IS DISTINCT FROM 'expired' AND v_close_reason IS NOT NULL THEN
        v_payload := v_ticket.payload || jsonb_build_object(
          'status', 'expired',
          'close_reason', v_close_reason,
          'auto_closed', true,
          'closed_at', v_now,
          'service_date', to_char(public.queue_ticket_service_date(v_ticket.payload), 'YYYY-MM-DD')
        );
        UPDATE public.queue_runtime_records
        SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
        WHERE id = v_ticket.id;
      END IF;
      RETURN jsonb_build_object('ok', true, 'code', 'empty', 'ticket', NULL, 'counter', v_counter_payload);
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
      AND COALESCE(r.payload->>'status', '') <> 'expired'
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

    v_close_reason := public.queue_ticket_should_close(v_payload, v_settings, clock_timestamp(), v_extended);
    IF v_close_reason IS NOT NULL OR COALESCE(v_payload->>'status', '') = 'expired' THEN
      IF v_close_reason IS NOT NULL AND COALESCE(v_payload->>'status', '') IS DISTINCT FROM 'expired' THEN
        v_payload := v_payload || jsonb_build_object(
          'status', 'expired',
          'close_reason', v_close_reason,
          'auto_closed', true,
          'closed_at', v_now,
          'service_date', to_char(public.queue_ticket_service_date(v_payload), 'YYYY-MM-DD')
        );
        UPDATE public.queue_runtime_records
        SET payload = v_payload, version = version + 1, updated_at = clock_timestamp()
        WHERE id = v_ticket.id;
      END IF;
      CONTINUE;
    END IF;

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


REVOKE ALL ON FUNCTION public.queue_hhmm_minutes(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_operating_period(jsonb, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_ticket_service_date(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_ticket_sequence(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_ticket_should_close(jsonb, jsonb, timestamptz, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_apply_day_rollover(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_rollover_all() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_next_number(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM PUBLIC;

DO $day_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_hhmm_minutes(text) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_operating_period(jsonb, timestamptz, integer) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_service_date(jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_sequence(jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_should_close(jsonb, jsonb, timestamptz, integer) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_apply_day_rollover(text) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_rollover_all() FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_next_number(text, text, text) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_hhmm_minutes(text) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_operating_period(jsonb, timestamptz, integer) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_service_date(jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_sequence(jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_ticket_should_close(jsonb, jsonb, timestamptz, integer) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_apply_day_rollover(text) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_rollover_all() FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_next_number(text, text, text) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.queue_call_next(text, text, text, text[]) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_hhmm_minutes(text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_operating_period(jsonb, timestamptz, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_ticket_service_date(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_ticket_sequence(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_ticket_should_close(jsonb, jsonb, timestamptz, integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_apply_day_rollover(text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_rollover_all() TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_next_number(text, text, text) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.queue_call_next(text, text, text, text[]) TO service_role';
  END IF;
END
$day_grants$;
