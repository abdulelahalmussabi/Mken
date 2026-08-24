-- ==============================================================================
-- منصة مكِّن — جداول تشغيل Trust Engine / Authentica OTP
-- يعتمد على: db/device-trust-auth-schema.sql
-- نفّذ بعد مخطط الأجهزة الموثوقة
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) ربط الهاتف (هاش) ↔ auth.users — بدون تخزين E.164 خام
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_phone_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug     TEXT NOT NULL
                    REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    phone_hash      VARCHAR(64) NOT NULL,
    user_id         UUID NOT NULL
                    REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT auth_phone_identities_hash_hex CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT auth_phone_identities_unique UNIQUE (tenant_slug, phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_auth_phone_user
    ON public.auth_phone_identities (user_id);

ALTER TABLE public.auth_phone_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_phone_identities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_select_own ON public.auth_phone_identities;
DROP POLICY IF EXISTS api_service_all ON public.auth_phone_identities;

CREATE POLICY api_select_own ON public.auth_phone_identities
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY api_service_all ON public.auth_phone_identities
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT SELECT ON public.auth_phone_identities TO authenticated;
GRANT ALL ON public.auth_phone_identities TO service_role;

-- -----------------------------------------------------------------------------
-- 2) تحديات OTP الجارية (idempotent challenge)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_challenges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug         TEXT NOT NULL
                        REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    phone_hash          VARCHAR(64) NOT NULL,
    challenge_nonce     VARCHAR(64) NOT NULL,
    device_fp_hash      VARCHAR(64) NOT NULL,
    channel             TEXT NOT NULL DEFAULT 'whatsapp',
    status              TEXT NOT NULL DEFAULT 'pending',
    turnstile_ok        BOOLEAN NOT NULL DEFAULT false,
    remember_device     BOOLEAN NOT NULL DEFAULT true,
    fallback_email_hash VARCHAR(64),
    ip_hash             VARCHAR(64),
    ip_subnet_hash      VARCHAR(64),
    fail_count          INTEGER NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    wa_sent_at          TIMESTAMPTZ,
    sms_sent_at         TIMESTAMPTZ,
    email_sent_at       TIMESTAMPTZ,
    verified_at         TIMESTAMPTZ,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT otp_challenges_phone_hex CHECK (phone_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_challenges_nonce_hex CHECK (challenge_nonce ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_challenges_fp_hex CHECK (device_fp_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT otp_challenges_channel CHECK (channel IN ('whatsapp', 'sms', 'email')),
    CONSTRAINT otp_challenges_status CHECK (status IN (
        'pending', 'fallback_sms', 'fallback_email', 'verified', 'expired', 'locked'
    ))
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_lookup
    ON public.otp_challenges (tenant_slug, phone_hash, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_nonce
    ON public.otp_challenges (challenge_nonce)
    WHERE status IN ('pending', 'fallback_sms', 'fallback_email');

CREATE INDEX IF NOT EXISTS idx_otp_challenges_expires
    ON public.otp_challenges (expires_at)
    WHERE status IN ('pending', 'fallback_sms', 'fallback_email');

ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otp_challenges_deny_all ON public.otp_challenges;
DROP POLICY IF EXISTS otp_challenges_service_all ON public.otp_challenges;

-- لا وصول مباشر من العميل — Edge فقط
CREATE POLICY otp_challenges_deny_all ON public.otp_challenges
    FOR ALL TO authenticated
    USING (false) WITH CHECK (false);

CREATE POLICY otp_challenges_service_all ON public.otp_challenges
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

GRANT ALL ON public.otp_challenges TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Sliding-window rate limit موزّع (بديل عن in-memory Map)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_rate_buckets (
    bucket_key      TEXT PRIMARY KEY,
    window_start    TIMESTAMPTZ NOT NULL,
    hit_count       INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.otp_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_buckets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otp_rate_deny ON public.otp_rate_buckets;
DROP POLICY IF EXISTS otp_rate_service ON public.otp_rate_buckets;

CREATE POLICY otp_rate_deny ON public.otp_rate_buckets
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY otp_rate_service ON public.otp_rate_buckets
    FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON public.otp_rate_buckets TO service_role;

CREATE OR REPLACE FUNCTION public.otp_rate_limit_hit(
    p_key TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (limited BOOLEAN, retry_after_sec INTEGER, hit_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_row public.otp_rate_buckets%ROWTYPE;
    v_window INTERVAL := make_interval(secs => GREATEST(p_window_seconds, 1));
BEGIN
    SELECT * INTO v_row FROM public.otp_rate_buckets WHERE bucket_key = p_key FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.otp_rate_buckets (bucket_key, window_start, hit_count, updated_at)
        VALUES (p_key, v_now, 1, v_now)
        RETURNING * INTO v_row;

        limited := false;
        retry_after_sec := 0;
        hit_count := 1;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_now - v_row.window_start >= v_window THEN
        UPDATE public.otp_rate_buckets
        SET window_start = v_now, hit_count = 1, updated_at = v_now
        WHERE bucket_key = p_key
        RETURNING * INTO v_row;

        limited := false;
        retry_after_sec := 0;
        hit_count := 1;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_row.hit_count >= p_limit THEN
        limited := true;
        retry_after_sec := GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (v_row.window_start + v_window - v_now)))::INTEGER
        );
        hit_count := v_row.hit_count;
        RETURN NEXT;
        RETURN;
    END IF;

    UPDATE public.otp_rate_buckets
    SET hit_count = hit_count + 1, updated_at = v_now
    WHERE bucket_key = p_key
    RETURNING * INTO v_row;

    limited := false;
    retry_after_sec := 0;
    hit_count := v_row.hit_count;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.otp_rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.otp_rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON TABLE public.otp_challenges IS 'Pending Authentica OTP challenges for Trust Engine (service_role only).';
COMMENT ON TABLE public.otp_rate_buckets IS 'Distributed sliding-window counters for SMS pumping defense.';
