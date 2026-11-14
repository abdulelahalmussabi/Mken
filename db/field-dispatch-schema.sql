-- =============================================================================
-- منصة مكّن (mken.live) — موديول E6: الإسناد الميداني وتتبع الفنيين
-- الامتثال: نظام حماية البيانات الشخصية (PDPL) لسدايا، ضوابط النقل التابعة لـ TGA،
-- واشتراطات الأمن السيبراني NCA لمنع تسريب الإحداثيات الجغرافية
-- =============================================================================

-- 1. جدول الفنيين وسائقي الخدمة الميدانية (Field Technicians)
CREATE TABLE IF NOT EXISTS public.mken_field_technicians (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    activity_id TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'available', -- available, on_job, break, off_duty
    current_lat NUMERIC(10, 7),
    current_lng NUMERIC(10, 7),
    last_heartbeat TIMESTAMPTZ,
    current_task_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_tech_tenant_status 
    ON public.mken_field_technicians(tenant_slug, status);

-- 2. جدول المهام الميدانية وجدولة العمل (Field Tasks)
CREATE TABLE IF NOT EXISTS public.mken_field_tasks (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    appointment_id TEXT,
    order_id TEXT,
    technician_id TEXT REFERENCES public.mken_field_technicians(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_lat NUMERIC(10, 7) NOT NULL,
    customer_lng NUMERIC(10, 7) NOT NULL,
    customer_address TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'unassigned', -- unassigned, assigned, en_route, arrived, in_progress, completed, cancelled
    completion_otp VARCHAR(6) NOT NULL,
    otp_verified_at TIMESTAMPTZ,
    customer_signature TEXT,
    tracking_token TEXT,
    tracking_expires_at TIMESTAMPTZ,
    distance_at_arrival_meters NUMERIC(8, 2),
    assigned_at TIMESTAMPTZ,
    en_route_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_field_tasks_lookup 
    ON public.mken_field_tasks(tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_mken_field_tasks_tech 
    ON public.mken_field_tasks(technician_id, status);

-- 3. سجل مسار الحركة اللحظي للمهمة (Transient Location Breadcrumbs)
-- يُسجل فقط أثناء المهمة النشطة (en_route) لحماية خصوصية الفني والعميل
CREATE TABLE IF NOT EXISTS public.mken_field_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    task_id TEXT NOT NULL,
    technician_id TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    speed NUMERIC(6, 2) DEFAULT 0.00,
    heading NUMERIC(6, 2) DEFAULT 0.00,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mken_location_history_task 
    ON public.mken_field_location_history(task_id, recorded_at DESC);

-- 4. دالة التحقق الذري من السياج الجغرافي وحساب المسافة (Haversine Formula in PostgreSQL)
CREATE OR REPLACE FUNCTION public.mken_fn_haversine_distance(
    lat1 NUMERIC, lon1 NUMERIC,
    lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT NUMERIC := 6371000; -- نصف قطر الأرض بالأمتار
    d_lat NUMERIC;
    d_lon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    d_lat := radians(lat2 - lat1);
    d_lon := radians(lon2 - lon1);

    a := sin(d_lat / 2.0) ^ 2 + 
         cos(radians(lat1)) * cos(radians(lat2)) * (sin(d_lon / 2.0) ^ 2);

    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

    RETURN ROUND(r * c, 2); -- المسافة بالأمتار بدقة سنتيمترية
END;
$$;
