-- Organic Instagram (and optional Facebook Page) publisher.
-- Run in Supabase SQL editor. Service role bypasses RLS; anon has no policies.

CREATE TABLE IF NOT EXISTS public.mken_instagram_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug TEXT NOT NULL REFERENCES public.mken_saas_clients(tenant_slug) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  also_facebook BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED')),
  publish_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  ig_media_id TEXT,
  fb_post_id TEXT,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_ig_posts_due
  ON public.mken_instagram_scheduled_posts (status, publish_at)
  WHERE status IN ('PENDING', 'PUBLISHING');

CREATE INDEX IF NOT EXISTS idx_mken_ig_posts_tenant
  ON public.mken_instagram_scheduled_posts (tenant_slug, publish_at DESC);

ALTER TABLE public.mken_instagram_scheduled_posts ENABLE ROW LEVEL SECURITY;
