-- مكّن — منظومة النمو المحلي والإعلانات (مرحلة 1)
-- نفّذ في Supabase SQL Editor.
-- المفتاح الفعلي للمستأجر هو tenant_slug على mken_saas_clients (ليس جدول tenants).
-- APIs في mkn-theme تستخدم service role بعد جلسة الإدارة؛ RLS يغلق الوصول المجهول.

CREATE TABLE IF NOT EXISTS public.mken_ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('meta_ctwa', 'google_ads', 'snapchat', 'tiktok')),
  external_campaign_id TEXT,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'MESSAGES',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED')),
  daily_budget_halalas BIGINT NOT NULL CHECK (daily_budget_halalas >= 1500),
  spent_halalas BIGINT NOT NULL DEFAULT 0,
  radius_km NUMERIC(4, 2) NOT NULL DEFAULT 5.0,
  service_name TEXT,
  metrics JSONB NOT NULL DEFAULT '{"impressions":0,"clicks":0,"conversations":0,"bookings":0}'::jsonb,
  ad_creative JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE,
  end_date DATE,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_ad_campaigns_tenant
  ON public.mken_ad_campaigns (tenant_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mken_local_rank_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  grid_size TEXT NOT NULL DEFAULT '3x3' CHECK (grid_size IN ('3x3', '5x5', '7x7')),
  radius_km NUMERIC(4, 2) NOT NULL DEFAULT 5.0,
  center_lat NUMERIC(10, 7) NOT NULL,
  center_lng NUMERIC(10, 7) NOT NULL,
  average_rank NUMERIC(4, 2),
  top3_percentage NUMERIC(5, 2),
  raw_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scan_day DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mken_local_rank_scans
  ADD COLUMN IF NOT EXISTS scan_day DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_mken_rank_scans_tenant
  ON public.mken_local_rank_scans (tenant_slug, scanned_at DESC);

-- كاش يومي بدون ::date داخل تعريف الفهرس (غير صالح في قائمة أعمدة CREATE INDEX)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mken_rank_scans_daily_cache
  ON public.mken_local_rank_scans (
    tenant_slug,
    lower(keyword),
    grid_size,
    radius_km,
    scan_day
  );

CREATE TABLE IF NOT EXISTS public.mken_competitor_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  competitors JSONB NOT NULL DEFAULT '[]'::jsonb,
  benchmarks JSONB NOT NULL DEFAULT '{}'::jsonb,
  mcs JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_competitor_audits_tenant
  ON public.mken_competitor_audits (tenant_slug, audited_at DESC);

CREATE TABLE IF NOT EXISTS public.mken_gbp_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  call_to_action TEXT NOT NULL DEFAULT 'BOOK',
  cta_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  publish_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_gbp_posts_due
  ON public.mken_gbp_scheduled_posts (status, publish_at)
  WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS public.mken_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  appointment_id TEXT,
  phone TEXT NOT NULL,
  customer_name TEXT,
  stars INTEGER CHECK (stars IS NULL OR (stars >= 1 AND stars <= 5)),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'RATED_GOOGLE', 'RATED_INTERNAL', 'FAILED', 'SKIPPED')),
  google_review_url TEXT,
  internal_note TEXT,
  sent_at TIMESTAMPTZ,
  rated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mken_review_requests_appointment
  ON public.mken_review_requests (tenant_slug, appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mken_review_requests_pending_phone
  ON public.mken_review_requests (tenant_slug, phone, status);

ALTER TABLE public.mken_ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_local_rank_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_competitor_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_gbp_scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mken_review_requests ENABLE ROW LEVEL SECURITY;

-- ربط إعلانات جوجل لكل منشأة (OAuth). التوكنات لا تُعرض في الواجهة.
ALTER TABLE public.mken_saas_clients ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT;
ALTER TABLE public.mken_saas_clients ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT;
ALTER TABLE public.mken_saas_clients ADD COLUMN IF NOT EXISTS google_ads_token_expiry TIMESTAMPTZ;
ALTER TABLE public.mken_saas_clients ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE public.mken_saas_clients ADD COLUMN IF NOT EXISTS google_ads_login_customer_id TEXT;
