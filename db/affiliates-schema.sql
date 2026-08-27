-- ==============================================================================
-- MKN SaaS: Viral Loops & Affiliate Engine Schema
-- Execute this script in Supabase SQL Editor
-- ==============================================================================

-- 1. Create mken_affiliates table
CREATE TABLE IF NOT EXISTS public.mken_affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL UNIQUE,
    affiliate_code TEXT NOT NULL UNIQUE,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00, -- 20% commission on referrals
    total_clicks INT NOT NULL DEFAULT 0,
    total_signups INT NOT NULL DEFAULT 0,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    pending_payout NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create mken_referral_events table
CREATE TABLE IF NOT EXISTS public.mken_referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_slug TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('click', 'signup', 'subscription')),
    referred_slug TEXT,
    plan_tier TEXT,
    amount NUMERIC(10,2) DEFAULT 0.00,
    commission_earned NUMERIC(10,2) DEFAULT 0.00,
    ip_hash TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_tenant ON public.mken_affiliates (lower(tenant_slug));
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.mken_affiliates (lower(affiliate_code));
CREATE INDEX IF NOT EXISTS idx_referral_events_slug ON public.mken_referral_events (lower(affiliate_slug));

-- 4. Enable RLS
ALTER TABLE public.mken_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_referral_events ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Public read affiliates" ON public.mken_affiliates;
CREATE POLICY "Public read affiliates" ON public.mken_affiliates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Full access for service role on affiliates" ON public.mken_affiliates;
CREATE POLICY "Full access for service role on affiliates" ON public.mken_affiliates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access for service role on events" ON public.mken_referral_events;
CREATE POLICY "Full access for service role on events" ON public.mken_referral_events FOR ALL USING (true) WITH CHECK (true);
