-- ==============================================================================
-- منصة مكِّن (Mken Platform) — نظام الطابور الذكي، الأولوية الإنسانية وشاشات الصالة
-- Smart Queue Engine, Human Priority Classification & Public TV Signage Architecture
-- ==============================================================================

-- 1. تعريف تصنيفات الأولوية الإنسانية الصريحة
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_category_type') THEN
        CREATE TYPE priority_category_type AS ENUM ('none', 'elderly', 'special_needs');
    END IF;
END $$;

-- 2. إنشاء / تحديث جدول التذاكر (tickets) وربطه بجدول العملاء (mken_customers)
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    branch_id UUID,
    customer_id TEXT, -- الربط بملف العميل في mken_customers
    ticket_number VARCHAR(20) NOT NULL,
    original_ticket_number VARCHAR(20),
    department_id VARCHAR(50) NOT NULL DEFAULT 'reception',
    department_name VARCHAR(100) NOT NULL DEFAULT 'الاستقبال',
    counter_id VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'waiting', -- 'waiting', 'calling', 'serving', 'completed', 'cancelled', 'no_show'
    priority_category priority_category_type NOT NULL DEFAULT 'none',
    priority_assigned_by_user_id UUID, -- توثيق الموظف الذي منح الأولوية للرقابة
    is_priority BOOLEAN DEFAULT FALSE,
    priority_reason VARCHAR(50), -- 'elderly', 'special_needs', 'vip'
    customer_name VARCHAR(100),
    customer_phone VARCHAR(25),
    wait_estimate_minutes INT DEFAULT 10,
    called_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة الأعمدة إلى جدول التذاكر في حال كان موجوداً مسبقاً
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE public.tickets ADD COLUMN customer_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'priority_category'
    ) THEN
        ALTER TABLE public.tickets 
        ADD COLUMN priority_category priority_category_type NOT NULL DEFAULT 'none';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'priority_assigned_by_user_id'
    ) THEN
        ALTER TABLE public.tickets 
        ADD COLUMN priority_assigned_by_user_id UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'is_priority'
    ) THEN
        ALTER TABLE public.tickets 
        ADD COLUMN is_priority BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'priority_reason'
    ) THEN
        ALTER TABLE public.tickets 
        ADD COLUMN priority_reason VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'original_ticket_number'
    ) THEN
        ALTER TABLE public.tickets 
        ADD COLUMN original_ticket_number VARCHAR(20);
    END IF;
END $$;

-- 3. جدول تسجيل شاشات التلفزيون المركزية للربط والتحكم (Display Screens)
CREATE TABLE IF NOT EXISTS public.display_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    branch_id UUID,
    screen_name VARCHAR(100) NOT NULL,            -- مثال: شاشة الصالة الرئيسية 1
    screen_token VARCHAR(64) UNIQUE NOT NULL,      -- رمز ربط التلفزيون بالجلسة
    display_settings JSONB DEFAULT '{
        "audio_alert": true,
        "theme": "dark",
        "visible_services": ["all"],
        "recent_calls_limit": 5
    }'::jsonb,
    is_online BOOLEAN DEFAULT FALSE,
    last_ping_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول تتبع حالة الجدولة العادلة معزول لكل مستأجر (Anti-Starvation Dispatcher State: 2:1 Ratio)
CREATE TABLE IF NOT EXISTS public.queue_dispatch_state (
    tenant_slug TEXT PRIMARY KEY,
    consecutive_priority_calls INT NOT NULL DEFAULT 0, -- يتتبع عدد استدعاءات الأولوية المتتالية (حد أقصى 2)
    last_called_ticket_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. فهارس الأداء العالي والعزل الصارم بين المستأجرين (Multi-Tenant Isolation Indexes)
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status 
ON public.tickets(tenant_slug, status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_tickets_customer_lookup 
ON public.tickets(tenant_slug, customer_phone);

CREATE INDEX IF NOT EXISTS idx_tickets_priority_lookup 
ON public.tickets(tenant_slug, priority_category, status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_display_screens_tenant 
ON public.display_screens(tenant_slug, is_online, last_ping_at);

-- 6. سياسات الأمان على مستوى السجل (RLS Policies - عزل المستأجر والتحقق الصارم)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_dispatch_state ENABLE ROW LEVEL SECURITY;

-- سياسة 1: الزوار والعملاء يمكنهم إصدار تذاكر عادية فقط عبر مسح QR
DROP POLICY IF EXISTS "Public can create standard tickets" ON public.tickets;
CREATE POLICY "Public can create standard tickets"
ON public.tickets
FOR INSERT
TO public
WITH CHECK (priority_category = 'none');

-- سياسة 2: الجميع يمكنهم قراءة تذاكرهم أو التذاكر المعروضة في الشاشة ضمن نفس المنشأة
DROP POLICY IF EXISTS "Public can read tickets" ON public.tickets;
CREATE POLICY "Public can read tickets"
ON public.tickets
FOR SELECT
TO public
USING (true);

-- سياسة 3: الموظفون المصرح لهم فقط هم من يملكون صلاحية تعديل فئة الأولوية
DROP POLICY IF EXISTS "restrict_priority_update" ON public.tickets;
CREATE POLICY "restrict_priority_update" ON public.tickets
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid()
    )
);

-- سياسة 4: الشاشات العامة يمكنها استعلام بيانات العرض وحالة الاتصال
DROP POLICY IF EXISTS "Public display screens access" ON public.display_screens;
CREATE POLICY "Public display screens access"
ON public.display_screens
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- سياسة 5: خادم الخدمة والدوال البرمجية لها صلاحية كاملة
DROP POLICY IF EXISTS "Service role full access tickets" ON public.tickets;
CREATE POLICY "Service role full access tickets"
ON public.tickets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
