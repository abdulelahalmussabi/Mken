-- ==============================================================================
-- MKN SaaS: Tenant Custom Domains Schema & Setup (Resilient & Universal)
-- Execute this script in Supabase SQL Editor
-- ==============================================================================

-- 1. Create mken_tenant_domains table
CREATE TABLE IF NOT EXISTS public.mken_tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    verified BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending_dns' CHECK (status IN ('active', 'pending_dns', 'verifying', 'error', 'disabled')),
    dns_verification_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create index on domain and tenant_slug for fast routing lookups
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON public.mken_tenant_domains (lower(domain));
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_slug ON public.mken_tenant_domains (lower(tenant_slug));

-- 3. Ensure custom_domain column exists on mken_saas_clients if the table is present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mken_saas_clients') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mken_saas_clients' AND column_name = 'custom_domain') THEN
            ALTER TABLE public.mken_saas_clients ADD COLUMN custom_domain TEXT;
        END IF;
    END IF;
END $$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.mken_tenant_domains ENABLE ROW LEVEL SECURITY;

-- 5. Policies for mken_tenant_domains
DROP POLICY IF EXISTS "Public read access for domain routing" ON public.mken_tenant_domains;
CREATE POLICY "Public read access for domain routing"
    ON public.mken_tenant_domains
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role & admin full access" ON public.mken_tenant_domains;
CREATE POLICY "Service role & admin full access"
    ON public.mken_tenant_domains
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 6. Trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at_custom_domains()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_mken_tenant_domains_updated_at ON public.mken_tenant_domains;
CREATE TRIGGER tr_mken_tenant_domains_updated_at
    BEFORE UPDATE ON public.mken_tenant_domains
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_custom_domains();

-- 7. Seed / Upsert Rewa Care Domain
INSERT INTO public.mken_tenant_domains (tenant_slug, domain, verified, status)
VALUES ('rewa', 'rewa.care', true, 'active')
ON CONFLICT (domain) 
DO UPDATE SET 
    tenant_slug = 'rewa',
    verified = true,
    status = 'active',
    updated_at = timezone('utc'::text, now());

-- 8. Safely update custom_domain in mken_saas_clients if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mken_saas_clients' AND column_name = 'custom_domain') THEN
        UPDATE public.mken_saas_clients 
        SET custom_domain = 'rewa.care' 
        WHERE tenant_slug = 'rewa';
    END IF;
END $$;
