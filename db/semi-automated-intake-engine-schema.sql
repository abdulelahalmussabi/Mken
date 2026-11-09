-- ==============================================================================
-- منصة مكِّن (Mken Platform) — محرك الإغلاق النصف آلي لمنظومة الطابور
-- Semi-Automated Intake Engine Architecture (Schedules, Dynamic Capacity & Overrides)
-- ==============================================================================

-- 1. جدول جداول العمل الأسبوعية للخدمات والأقسام (Service Schedules)
CREATE TABLE IF NOT EXISTS public.service_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    service_id VARCHAR(50) NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0: الأحد، 6: السبت
    opening_time TIME NOT NULL DEFAULT '08:00:00',                 -- مثال: 08:00:00
    closing_time TIME NOT NULL DEFAULT '16:00:00',                 -- مثال: 16:00:00
    is_working_day BOOLEAN DEFAULT TRUE,
    avg_service_time_minutes INT DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, service_id, day_of_week)
);

-- 2. جدول الخدمات / تكوين الاستقبال النصف آلي (Services & Intake Config)
CREATE TABLE IF NOT EXISTS public.services (
    id VARCHAR(50) PRIMARY KEY,
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    name VARCHAR(100) NOT NULL,
    department_id VARCHAR(50) NOT NULL DEFAULT 'reception',
    max_daily_capacity INT DEFAULT 100,            -- سقف التذاكر اليومي
    max_active_waiting_limit INT DEFAULT 25,       -- الحد الأقصى للمنتظرين في الصالة بنفس اللحظة
    avg_service_time_minutes INT DEFAULT 15,       -- متوسط وقت الخدمة المقدر
    auto_intake_enabled BOOLEAN DEFAULT TRUE,      -- تفعيل/تعطيل الأتمتة
    manual_override_active BOOLEAN DEFAULT FALSE,  -- هل هناك تدخل يدوي حالي؟
    manual_override_expires_at TIMESTAMPTZ,        -- متى ينتهي التدخل اليدوي ويعود النظام للجدول
    manual_override_type VARCHAR(50),              -- 'extend_time', 'add_capacity', 'pause', 'emergency_close'
    manual_override_reason VARCHAR(100),
    is_intake_open BOOLEAN DEFAULT TRUE,
    closed_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة الحقول إلى جدول services إذا كان موجوداً مسبقاً
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'max_daily_capacity') THEN
        ALTER TABLE public.services ADD COLUMN max_daily_capacity INT DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'max_active_waiting_limit') THEN
        ALTER TABLE public.services ADD COLUMN max_active_waiting_limit INT DEFAULT 25;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'avg_service_time_minutes') THEN
        ALTER TABLE public.services ADD COLUMN avg_service_time_minutes INT DEFAULT 15;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'auto_intake_enabled') THEN
        ALTER TABLE public.services ADD COLUMN auto_intake_enabled BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'manual_override_active') THEN
        ALTER TABLE public.services ADD COLUMN manual_override_active BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'manual_override_expires_at') THEN
        ALTER TABLE public.services ADD COLUMN manual_override_expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'manual_override_type') THEN
        ALTER TABLE public.services ADD COLUMN manual_override_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'manual_override_reason') THEN
        ALTER TABLE public.services ADD COLUMN manual_override_reason VARCHAR(100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'is_intake_open') THEN
        ALTER TABLE public.services ADD COLUMN is_intake_open BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'closed_reason') THEN
        ALTER TABLE public.services ADD COLUMN closed_reason VARCHAR(255);
    END IF;
END $$;

-- 3. دالة التحقق النصف آلي اللحظية (Heartbeat / Semi-Automated Intake Evaluator)
CREATE OR REPLACE FUNCTION evaluate_service_intake_status(
    p_service_id VARCHAR,
    p_tenant_slug TEXT DEFAULT 'default'
)
RETURNS TABLE (
    is_open BOOLEAN,
    close_reason VARCHAR,
    close_type VARCHAR,
    active_waiting INT,
    today_active_tickets INT,
    daily_capacity INT,
    predictive_cutoff_time TIME,
    manual_override BOOLEAN
) AS $$
DECLARE
    v_service public.services%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_today_day INT := EXTRACT(DOW FROM v_now);
    v_current_time TIME := v_now::time;
    v_schedule public.service_schedules%ROWTYPE;
    v_today_tickets_count INT := 0;
    v_current_waiting_count INT := 0;
    v_should_be_open BOOLEAN := TRUE;
    v_close_reason VARCHAR(255) := NULL;
    v_close_type VARCHAR(50) := 'none';
    v_estimated_serving_minutes INT := 0;
    v_effective_closing TIME;
    v_cutoff_time TIME;
BEGIN
    SELECT * INTO v_service 
    FROM public.services 
    WHERE id = p_service_id AND tenant_slug = p_tenant_slug;

    -- إذا لم يتم تكوين الخدمة، أنشئ التكوين الافتراضي
    IF NOT FOUND THEN
        INSERT INTO public.services (id, tenant_slug, name, max_daily_capacity, max_active_waiting_limit, avg_service_time_minutes)
        VALUES (p_service_id, p_tenant_slug, p_service_id, 100, 25, 15)
        RETURNING * INTO v_service;
    END IF;

    -- أولاً: فحص التجاوز البشري الفوري (Manual Override with Expiry)
    IF v_service.manual_override_active THEN
        IF v_now < v_service.manual_override_expires_at THEN
            RETURN QUERY SELECT 
                v_service.is_intake_open,
                v_service.closed_reason,
                COALESCE(v_service.manual_override_type, 'manual_override'),
                0, 0, v_service.max_daily_capacity, NULL::TIME, TRUE;
            RETURN;
        ELSE
            -- انتهاء وقت التجاوز اليدوي والعودة للتقييم الآلي
            UPDATE public.services 
            SET manual_override_active = FALSE,
                manual_override_expires_at = NULL,
                manual_override_type = NULL,
                manual_override_reason = NULL
            WHERE id = p_service_id AND tenant_slug = p_tenant_slug;
            v_service.manual_override_active := FALSE;
        END IF;
    END IF;

    -- إذا كانت الأتمتة معطلة، يتم الالتزام بالحالة المسجلة يدوياً
    IF NOT v_service.auto_intake_enabled THEN
        RETURN QUERY SELECT 
            v_service.is_intake_open,
            v_service.closed_reason,
            'manual_disabled'::VARCHAR,
            0, 0, v_service.max_daily_capacity, NULL::TIME, FALSE;
        RETURN;
    END IF;

    -- ثانياً: فحص ساعات العمل واليوم (Operating Hours)
    SELECT * INTO v_schedule 
    FROM public.service_schedules 
    WHERE service_id = p_service_id 
      AND tenant_slug = p_tenant_slug 
      AND day_of_week = v_today_day;

    IF FOUND THEN
        v_effective_closing := v_schedule.closing_time;
        IF NOT v_schedule.is_working_day OR (v_current_time < v_schedule.opening_time OR v_current_time >= v_effective_closing) THEN
            v_should_be_open := FALSE;
            v_close_reason := 'خارج ساعات العمل الرسمية';
            v_close_type := 'schedule';
        END IF;
    ELSE
        -- جدول افتراضي (من الأحد للخميس: 08:00 إلى 16:00)
        v_effective_closing := '16:00:00'::TIME;
        IF v_today_day IN (5, 6) OR (v_current_time < '08:00:00'::TIME OR v_current_time >= '16:00:00'::TIME) THEN
            v_should_be_open := FALSE;
            v_close_reason := 'خارج ساعات العمل الرسمية';
            v_close_type := 'schedule';
        END IF;
    END IF;

    -- إحصاء المنتظرين الحاليين في الصالة
    SELECT COUNT(*) INTO v_current_waiting_count
    FROM public.tickets
    WHERE tenant_slug = p_tenant_slug
      AND department_id = p_service_id
      AND status = 'waiting';

    -- إحصاء التذاكر اليومية النشطة (مع استبعاد وتدوير الملغي والغائب Capacity Recycling)
    SELECT COUNT(*) INTO v_today_tickets_count
    FROM public.tickets
    WHERE tenant_slug = p_tenant_slug
      AND department_id = p_service_id
      AND created_at >= CURRENT_DATE
      AND status NOT IN ('cancelled', 'no_show');

    -- ثالثاً: الإغلاق العكسي التنبؤي (Predictive EOD Cut-off)
    -- Cut-off Time = Shift End Time - (Waiting Tickets × Average Service Time)
    IF v_should_be_open THEN
        v_estimated_serving_minutes := v_current_waiting_count * COALESCE(v_service.avg_service_time_minutes, 15);
        v_cutoff_time := v_effective_closing - (v_estimated_serving_minutes || ' minutes')::INTERVAL;

        IF v_current_time >= v_cutoff_time THEN
            v_should_be_open := FALSE;
            v_close_reason := 'اقتراب نهاية الدوام الرسمي وتراكم وقت الانتظار';
            v_close_type := 'predictive_cutoff';
        END IF;
    END IF;

    -- رابعاً: فحص سقف الطاقة الاستيعابية اليومية (Dynamic Capacity)
    IF v_should_be_open AND v_service.max_daily_capacity IS NOT NULL THEN
        IF v_today_tickets_count >= v_service.max_daily_capacity THEN
            v_should_be_open := FALSE;
            v_close_reason := 'اكتملت الطاقة الاستيعابية المتاحة لهذا اليوم';
            v_close_type := 'capacity';
        END IF;
    END IF;

    -- خامساً: فحص الازدحام اللحظي في الصالة (Buffer Limit)
    IF v_should_be_open AND v_service.max_active_waiting_limit IS NOT NULL THEN
        IF v_current_waiting_count >= v_service.max_active_waiting_limit THEN
            v_should_be_open := FALSE;
            v_close_reason := 'ضغط مرتفع في صالة الانتظار حالياً، جاري تخفيف الازدحام';
            v_close_type := 'buffer';
        END IF;
    END IF;

    -- تحديث جدول الخدمة فورياً إذا طرأ تغيير
    UPDATE public.services 
    SET is_intake_open = v_should_be_open,
        closed_reason = v_close_reason,
        updated_at = v_now
    WHERE id = p_service_id AND tenant_slug = p_tenant_slug;

    RETURN QUERY SELECT 
        v_should_be_open,
        v_close_reason,
        v_close_type,
        v_current_waiting_count,
        v_today_tickets_count,
        v_service.max_daily_capacity,
        v_cutoff_time,
        FALSE;
END;
$$ LANGUAGE plpgsql;
