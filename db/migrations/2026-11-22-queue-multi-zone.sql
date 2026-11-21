-- =====================================================================
-- مكّن (Mken Platform) - نظام إدارة الطوابير المتقدم (Enterprise QMS)
-- ترقية معمارية تعدد المناطق ومكاتب الاستقبال (Multi-Zone / Multi-Reception)
-- متوافق بالكامل مع المنشآت الكبرى (المستشفيات، المجمعات الطبية، الوزارات)
-- وتوافق عكسي تام (100% Backward Compatible) للمنشآت الفردية
-- =====================================================================

-- 1. جدول مناطق ومكاتب الاستقبال (Queue Zones / Receptions)
CREATE TABLE IF NOT EXISTS public.queue_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                          -- رمز الاستقبال مثال: REC-01, ZONE-CLINICS
    name TEXT NOT NULL,                          -- الاسم مثال: استقبال العيادات الباطنية
    floor_or_building TEXT NULL,                 -- الدور / المبنى مثال: البرج الطبي - الدور الثاني
    settings JSONB DEFAULT '{}'::jsonb,          -- إعدادات مخصصة للمنطقة (أصوات، شاشات، سعات)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT queue_zones_tenant_branch_code_key UNIQUE (tenant_slug, branch_id, code)
);

-- فهارس جدول المناطق
CREATE INDEX IF NOT EXISTS idx_queue_zones_tenant_branch 
ON public.queue_zones (tenant_slug, branch_id);

CREATE INDEX IF NOT EXISTS idx_queue_zones_active 
ON public.queue_zones (tenant_slug, is_active);

-- 2. ربط الجداول الأساسية بالمناطق (Zone Foreign Keys)
-- إضافة zone_id للأقسام والخدمات (Services / Queues)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE public.services 
      ADD COLUMN zone_id UUID NULL REFERENCES public.queue_zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- إضافة zone_id لنقاط الخدمة والكاونترات (Counters)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'counters' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE public.counters 
      ADD COLUMN zone_id UUID NULL REFERENCES public.queue_zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- إضافة zone_id للتذاكر (Tickets) لسرعة التصفية والفرز اللحظي
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE public.tickets 
      ADD COLUMN zone_id UUID NULL REFERENCES public.queue_zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- إضافة zone_id للمستخدمين والموظفين (Users & Staff)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE public.users 
      ADD COLUMN zone_id UUID NULL REFERENCES public.queue_zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. فهارس مركبة للأداء العالي (High-Throughput Composite Indexes)
-- تسريع استعلام تذاكر المنطقة وفق الحالة (لشاشات العرض ولوحات تحكم الاستقبال)
CREATE INDEX IF NOT EXISTS idx_tickets_zone_status 
ON public.tickets (tenant_slug, branch_id, zone_id, status);

-- تسريع استعلام كاونترات المنطقة
CREATE INDEX IF NOT EXISTS idx_counters_zone 
ON public.counters (tenant_slug, branch_id, zone_id);

-- تسريع استعلام خدمات وأقسام المنطقة
CREATE INDEX IF NOT EXISTS idx_services_zone 
ON public.services (tenant_slug, branch_id, zone_id);

-- 4. سياسات الأمان وعزل البيانات على مستوى السجل (RLS) لجدول المناطق
ALTER TABLE IF EXISTS public.queue_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_zones FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.queue_zones FROM PUBLIC, anon;

-- سياسة وصول موظفي المنشأة لجدول المناطق
DROP POLICY IF EXISTS queue_zones_tenant_isolation ON public.queue_zones;
CREATE POLICY queue_zones_tenant_isolation ON public.queue_zones
  FOR ALL TO authenticated
  USING (
    public.queue_is_tenant_staff(tenant_slug)
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
  )
  WITH CHECK (
    public.queue_is_tenant_staff(tenant_slug)
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tenant_slug)
  );

COMMENT ON TABLE public.queue_zones IS 'مناطق ومكاتب الاستقبال في المنشآت الكبرى - نظام إدارة الطوابير مَكَن';
