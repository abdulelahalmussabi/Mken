-- ==============================================================================
-- MKN SaaS: Multi-Page Engine & Quota Schema
-- Execute this script in Supabase SQL Editor
-- ==============================================================================

-- 1. Create mken_pages table
CREATE TABLE IF NOT EXISTS public.mken_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_home BOOLEAN NOT NULL DEFAULT false,
    is_published BOOLEAN NOT NULL DEFAULT true,
    seo_metadata JSONB NOT NULL DEFAULT '{"meta_title": "", "meta_description": "", "keywords": []}'::jsonb,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_tenant_slug_page UNIQUE (tenant_slug, slug)
);

-- 2. Indexes for fast lookup on Edge & Server Components
CREATE INDEX IF NOT EXISTS idx_mken_pages_lookup ON public.mken_pages (lower(tenant_slug), lower(slug));
CREATE INDEX IF NOT EXISTS idx_mken_pages_tenant ON public.mken_pages (lower(tenant_slug));

-- 3. Enable RLS
ALTER TABLE public.mken_pages ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Public read published pages" ON public.mken_pages;
CREATE POLICY "Public read published pages" ON public.mken_pages
    FOR SELECT
    USING (is_published = true);

DROP POLICY IF EXISTS "Service role full access on pages" ON public.mken_pages;
CREATE POLICY "Service role full access on pages" ON public.mken_pages
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Seed default 5 multi-pages for Rewa Care
INSERT INTO public.mken_pages (tenant_slug, title, slug, is_home, is_published, order_index, blocks)
VALUES 
  ('rewa', 'الرئيسية', 'home', true, true, 0, '[
    {"type": "hero", "title": "مرحباً بكم في رِواء كير", "subtitle": "البوابة الذكية لخدمات العناية والحلاقة الراقية", "ctaText": "احجز الآن", "ctaLink": "/book"},
    {"type": "services", "title": "خدماتنا المميزة", "subtitle": "اختر من بين باقاتنا الحصرية"}
  ]'::jsonb),
  ('rewa', 'خدماتنا', 'services', false, true, 1, '[
    {"type": "hero", "title": "قائمة الخدمات والأسعار", "subtitle": "عناية متكاملة تليق بك"}
  ]'::jsonb),
  ('rewa', 'من نحن', 'about', false, true, 2, '[
    {"type": "content", "title": "عن رِواء", "body": "نحن رواد العناية الشخصية الراقية، نقدم تجربة استثنائية تجمع بين الحرفية والراحة."}
  ]'::jsonb),
  ('rewa', 'الأسعار والباقات', 'pricing', false, true, 3, '[
    {"type": "pricing", "title": "باقات العضوية الحصرية", "subtitle": "استمتع بخصومات شهرية دائمة"}
  ]'::jsonb),
  ('rewa', 'تواصل معنا', 'contact', false, true, 4, '[
    {"type": "contact", "title": "يسعدنا تواصلكم", "phone": "0500000000", "location": "الرياض - المملكة العربية السعودية"}
  ]'::jsonb)
ON CONFLICT (tenant_slug, slug) DO NOTHING;
