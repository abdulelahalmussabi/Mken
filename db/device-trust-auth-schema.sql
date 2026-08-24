-- ==============================================================================
-- منصة مكِّن (Mken Platform) — Trust Engine Schema
-- user_trusted_devices + auth_security_events + RLS
-- Zero-Trust Device Fingerprinting | PDPL / NCA aligned
-- نفّذ في: Supabase Dashboard → SQL Editor → Run
-- ==============================================================================
-- قواعد أمنية ملزمة:
--   1) لا تُخزَّن device_token أو البصمة الخام أو رقم الهاتف أو IP الخام في هذه الجداول.
--   2) device_token_hash = SHA-256(token)  |  device_fp_hash = SHA-256(signals || SERVER_PEPPER)
--   3) الكتابة (INSERT/تحديث الثقة) عبر service_role من Edge Functions فقط.
--   4) المستخدم المصادق: SELECT أجهزته + Revoke عبر الدالة أدناه فقط.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 0) أنواع الأحداث الأمنية (نص مقيّد عبر CHECK — بدون ENUM لتسهيل الهجرة)
-- -----------------------------------------------------------------------------
-- TOKEN_BOUND | TOKEN_REPLAY | FP_MISMATCH | IP_SUBNET_DRIFT | ASN_DRIFT
-- OTP_SENT | OTP_VERIFIED | OTP_FAILED | OTP_LOCKOUT
-- RATE_LIMITED | TURNSTILE_FAIL | DEVICE_REVOKED | DEVICE_EXPIRED
-- TRUST_SKIP_OK | STEP_UP_REQUIRED | SECURITY_INCIDENT

-- -----------------------------------------------------------------------------
-- 1) الأجهزة الموثوقة — user_trusted_devices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- عزل متعدد المستأجرين (نموذج مكّن الإنتاجي)
    tenant_slug           TEXT NOT NULL
                          REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,

    -- مالك الجهاز (Supabase Auth)
    user_id               UUID NOT NULL
                          REFERENCES auth.users(id) ON DELETE CASCADE,

    -- أسرار مشتقة فقط (hex SHA-256 = 64 حرفاً) — VARCHAR لتجنب padding في CHAR
    device_token_hash     VARCHAR(64) NOT NULL,
    device_fp_hash        VARCHAR(64) NOT NULL,

    -- توقيع خادمي اختياري للتتبع/التدقيق (HMAC-SHA256 hex)
    -- التحقق الحي يتم في Edge Function بمفتاح SERVER_HMAC_SECRET
    trust_hmac            VARCHAR(64),

    -- عرض لوحة المستخدم (بدون PII حساس)
    device_label          TEXT NOT NULL DEFAULT 'جهاز موثوق',
    browser_family        TEXT,
    os_family             TEXT,
    approx_city           TEXT,                 -- مدينة تقريبية فقط (مثل: الرياض)

    -- إشارات مخاطر مشفّرة أحادياً (لا IP خام)
    last_ip_hash          VARCHAR(64),          -- SHA-256(CF-Connecting-IP || pepper)
    last_ip_subnet_hash   VARCHAR(64),          -- SHA-256(/24 أو IPv6 /64 || pepper)
    last_asn              INTEGER,              -- ASN رقمي — ليس معرّف شخصي

    -- دورة حياة الثقة
    expires_at            TIMESTAMPTZ NOT NULL,
    revoked_at            TIMESTAMPTZ,
    revoke_reason         TEXT,
    last_seen_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- PDPL: وقت تسجيل موافقة «تذكّر هذا الجهاز»
    consent_recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_trusted_devices_token_hash_hex
        CHECK (device_token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_trusted_devices_fp_hash_hex
        CHECK (device_fp_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_trusted_devices_trust_hmac_hex
        CHECK (trust_hmac IS NULL OR trust_hmac ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_trusted_devices_ip_hash_hex
        CHECK (last_ip_hash IS NULL OR last_ip_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_trusted_devices_subnet_hash_hex
        CHECK (last_ip_subnet_hash IS NULL OR last_ip_subnet_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT user_trusted_devices_expires_after_create
        CHECK (expires_at > created_at),
    CONSTRAINT user_trusted_devices_revoke_reason_len
        CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 200),

    CONSTRAINT user_trusted_devices_token_unique
        UNIQUE (tenant_slug, user_id, device_token_hash)
);

COMMENT ON TABLE public.user_trusted_devices IS
    'Mken Trust Engine: hashed device tokens + fingerprint hashes. No raw tokens/PII. PDPL aligned.';
COMMENT ON COLUMN public.user_trusted_devices.device_token_hash IS
    'SHA-256 hex of opaque CSPRNG device_token. Raw token only in HttpOnly cookie.';
COMMENT ON COLUMN public.user_trusted_devices.device_fp_hash IS
    'SHA-256 hex of canonical client signals + SERVER_PEPPER. Zero raw hardware identifiers.';
COMMENT ON COLUMN public.user_trusted_devices.last_ip_hash IS
    'One-way hash of trusted edge IP (CF-Connecting-IP). Never store plaintext IP here.';

-- فهارس B-Tree للبحث التشغيلي
CREATE INDEX IF NOT EXISTS idx_utd_user_active
    ON public.user_trusted_devices (user_id, tenant_slug)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_utd_token_hash
    ON public.user_trusted_devices (device_token_hash)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_utd_fp_hash
    ON public.user_trusted_devices (device_fp_hash)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_utd_expires
    ON public.user_trusted_devices (expires_at)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_utd_tenant_created
    ON public.user_trusted_devices (tenant_slug, created_at DESC);

-- Hash index لمطابقة token السريعة (equality فقط)
CREATE INDEX IF NOT EXISTS idx_utd_token_hash_hash
    ON public.user_trusted_devices USING HASH (device_token_hash);

-- -----------------------------------------------------------------------------
-- 2) سجل الأحداث الأمنية — auth_security_events (append-only للمستخدم)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_slug     TEXT
                    REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE SET NULL,

    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    device_id       UUID REFERENCES public.user_trusted_devices(id) ON DELETE SET NULL,

    event_type      TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'INFO',
    -- detail: JSON بدون PII خام (هاشات، أكواد أخطاء، أعلام boolean فقط)
    detail          JSONB NOT NULL DEFAULT '{}'::JSONB,

    ip_hash         VARCHAR(64),
    user_agent_hash VARCHAR(64),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT auth_security_events_type_known CHECK (event_type IN (
        'TOKEN_BOUND',
        'TOKEN_REPLAY',
        'FP_MISMATCH',
        'IP_SUBNET_DRIFT',
        'ASN_DRIFT',
        'OTP_SENT',
        'OTP_VERIFIED',
        'OTP_FAILED',
        'OTP_LOCKOUT',
        'RATE_LIMITED',
        'TURNSTILE_FAIL',
        'DEVICE_REVOKED',
        'DEVICE_EXPIRED',
        'TRUST_SKIP_OK',
        'STEP_UP_REQUIRED',
        'SECURITY_INCIDENT'
    )),
    CONSTRAINT auth_security_events_severity_known CHECK (severity IN (
        'INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    )),
    CONSTRAINT auth_security_events_ip_hash_hex
        CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT auth_security_events_ua_hash_hex
        CHECK (user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT auth_security_events_detail_object
        CHECK (jsonb_typeof(detail) = 'object')
);

COMMENT ON TABLE public.auth_security_events IS
    'Append-oriented security audit log for Trust Engine / Authentica OTP. No raw PII in detail.';

CREATE INDEX IF NOT EXISTS idx_ase_user_created
    ON public.auth_security_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ase_tenant_created
    ON public.auth_security_events (tenant_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ase_type_created
    ON public.auth_security_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ase_severity_created
    ON public.auth_security_events (severity, created_at DESC)
    WHERE severity IN ('HIGH', 'CRITICAL');

CREATE INDEX IF NOT EXISTS idx_ase_device
    ON public.auth_security_events (device_id, created_at DESC)
    WHERE device_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.utd_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_trusted_devices_updated_at ON public.user_trusted_devices;
CREATE TRIGGER trg_user_trusted_devices_updated_at
    BEFORE UPDATE ON public.user_trusted_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.utd_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) دوال SECURITY DEFINER — Revoke + تسجيل حدث (مسار لوحة المستخدم الآمن)
-- -----------------------------------------------------------------------------

-- إلغاء توثيق جهاز فوراً (المالك فقط)
CREATE OR REPLACE FUNCTION public.revoke_trusted_device(
    p_device_id UUID,
    p_reason TEXT DEFAULT 'user_revoked'
)
RETURNS public.user_trusted_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.user_trusted_devices;
    v_reason TEXT := left(coalesce(nullif(trim(p_reason), ''), 'user_revoked'), 200);
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    UPDATE public.user_trusted_devices d
    SET
        revoked_at = NOW(),
        revoke_reason = v_reason,
        updated_at = NOW()
    WHERE d.id = p_device_id
      AND d.user_id = v_uid
      AND d.revoked_at IS NULL
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'device_not_found_or_already_revoked' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.auth_security_events (
        tenant_slug, user_id, device_id, event_type, severity, detail
    ) VALUES (
        v_row.tenant_slug,
        v_uid,
        v_row.id,
        'DEVICE_REVOKED',
        'MEDIUM',
        jsonb_build_object(
            'reason', v_reason,
            'source', 'user_dashboard',
            'device_label', v_row.device_label
        )
    );

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_trusted_device(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_trusted_device(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_trusted_device(UUID, TEXT) TO service_role;

-- تسجيل حدث أمني من الخادم فقط (Edge Function / service_role)
CREATE OR REPLACE FUNCTION public.log_auth_security_event(
    p_tenant_slug TEXT,
    p_user_id UUID,
    p_device_id UUID,
    p_event_type TEXT,
    p_severity TEXT DEFAULT 'INFO',
    p_detail JSONB DEFAULT '{}'::JSONB,
    p_ip_hash VARCHAR(64) DEFAULT NULL,
    p_user_agent_hash VARCHAR(64) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- يُستدعى عبر service_role؛ منع استدعاء العملاء العاديين عبر RLS grants أدناه
    INSERT INTO public.auth_security_events (
        tenant_slug, user_id, device_id, event_type, severity,
        detail, ip_hash, user_agent_hash
    ) VALUES (
        nullif(trim(p_tenant_slug), ''),
        p_user_id,
        p_device_id,
        p_event_type,
        coalesce(nullif(trim(p_severity), ''), 'INFO'),
        coalesce(p_detail, '{}'::JSONB),
        p_ip_hash,
        p_user_agent_hash
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_auth_security_event(
    TEXT, UUID, UUID, TEXT, TEXT, JSONB, VARCHAR, VARCHAR
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_auth_security_event(
    TEXT, UUID, UUID, TEXT, TEXT, JSONB, VARCHAR, VARCHAR
) TO service_role;

-- تنظيف الأجهزة المنتهية (يُستدعى من cron / Edge)
CREATE OR REPLACE FUNCTION public.expire_stale_trusted_devices(
    p_limit INTEGER DEFAULT 500
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    WITH expired AS (
        SELECT id
        FROM public.user_trusted_devices
        WHERE revoked_at IS NULL
          AND expires_at <= NOW()
        ORDER BY expires_at ASC
        LIMIT GREATEST(1, LEAST(coalesce(p_limit, 500), 5000))
        FOR UPDATE SKIP LOCKED
    ),
    upd AS (
        UPDATE public.user_trusted_devices d
        SET
            revoked_at = NOW(),
            revoke_reason = 'expired',
            updated_at = NOW()
        FROM expired e
        WHERE d.id = e.id
        RETURNING d.id, d.tenant_slug, d.user_id
    )
    INSERT INTO public.auth_security_events (
        tenant_slug, user_id, device_id, event_type, severity, detail
    )
    SELECT
        u.tenant_slug,
        u.user_id,
        u.id,
        'DEVICE_EXPIRED',
        'LOW',
        jsonb_build_object('source', 'expire_job')
    FROM upd u;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_trusted_devices(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_trusted_devices(INTEGER) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_security_events ENABLE ROW LEVEL SECURITY;

-- فرض RLS حتى لمالك الجدول في سياقات API
ALTER TABLE public.user_trusted_devices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_security_events FORCE ROW LEVEL SECURITY;

-- تنظيف سياسات سابقة إن وُجدت
DROP POLICY IF EXISTS utd_select_own ON public.user_trusted_devices;
DROP POLICY IF EXISTS utd_no_direct_insert ON public.user_trusted_devices;
DROP POLICY IF EXISTS utd_no_direct_update ON public.user_trusted_devices;
DROP POLICY IF EXISTS utd_no_direct_delete ON public.user_trusted_devices;
DROP POLICY IF EXISTS utd_service_all ON public.user_trusted_devices;

DROP POLICY IF EXISTS ase_select_own ON public.auth_security_events;
DROP POLICY IF EXISTS ase_no_direct_insert ON public.auth_security_events;
DROP POLICY IF EXISTS ase_no_direct_update ON public.auth_security_events;
DROP POLICY IF EXISTS ase_no_direct_delete ON public.auth_security_events;
DROP POLICY IF EXISTS ase_service_all ON public.auth_security_events;

-- ----- user_trusted_devices -----
-- المالك يقرأ أجهزته فقط (النشطة والملغاة للعرض في لوحة التحكم)
CREATE POLICY utd_select_own
    ON public.user_trusted_devices
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- منع INSERT/UPDATE/DELETE المباشر من العميل
-- (الكتابة عبر service_role؛ الإلغاء عبر revoke_trusted_device)
CREATE POLICY utd_no_direct_insert
    ON public.user_trusted_devices
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY utd_no_direct_update
    ON public.user_trusted_devices
    FOR UPDATE
    TO authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY utd_no_direct_delete
    ON public.user_trusted_devices
    FOR DELETE
    TO authenticated
    USING (false);

-- service_role يتجاوز RLS افتراضياً في Supabase؛ سياسة صريحة للتوثيق المحلي/الأدوات
CREATE POLICY utd_service_all
    ON public.user_trusted_devices
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ----- auth_security_events -----
CREATE POLICY ase_select_own
    ON public.auth_security_events
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY ase_no_direct_insert
    ON public.auth_security_events
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY ase_no_direct_update
    ON public.auth_security_events
    FOR UPDATE
    TO authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY ase_no_direct_delete
    ON public.auth_security_events
    FOR DELETE
    TO authenticated
    USING (false);

CREATE POLICY ase_service_all
    ON public.auth_security_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6) Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.user_trusted_devices TO authenticated;
GRANT SELECT ON public.auth_security_events TO authenticated;

GRANT ALL ON public.user_trusted_devices TO service_role;
GRANT ALL ON public.auth_security_events TO service_role;

-- -----------------------------------------------------------------------------
-- 7) View آمنة للوحة المستخدم (إخفاء الهاشات الحساسة)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_my_trusted_devices
WITH (security_invoker = true)
AS
SELECT
    id,
    tenant_slug,
    device_label,
    browser_family,
    os_family,
    approx_city,
    last_asn,
    expires_at,
    revoked_at,
    revoke_reason,
    last_seen_at,
    created_at,
    consent_recorded_at,
    (revoked_at IS NULL AND expires_at > NOW()) AS is_active
FROM public.user_trusted_devices
WHERE user_id = (SELECT auth.uid());

COMMENT ON VIEW public.v_my_trusted_devices IS
    'User-facing trusted devices without token/fingerprint/IP hashes.';

GRANT SELECT ON public.v_my_trusted_devices TO authenticated;

-- ==============================================================================
-- ملاحظات تشغيل:
-- 1) Edge Function يُنشئ device_token (32 بايت)، يخزّن SHA-256 hex، يضع الخام في Cookie.
-- 2) استعلام الثقة: WHERE device_token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
--    AND expires_at > NOW() ثم مقارنة device_fp_hash + فحص subnet drift.
-- 3) Revoke من الواجهة: SELECT public.revoke_trusted_device('<uuid>'::uuid, 'user_revoked');
-- 4) Cron مقترح: SELECT public.expire_stale_trusted_devices(500);
-- ==============================================================================
