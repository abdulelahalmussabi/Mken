-- ============================================================================
-- مكن - معمارية انضمام الكادر بالباركود وقفل الكاونترات والصلاحيات الموحدة
-- MKN Zero-Friction Staff Onboarding, Counter Mutex & Master Admin Hub
-- ============================================================================

-- 1. تحديث الحالات والأدوار
DO $$ BEGIN
    CREATE TYPE staff_onboarding_status AS ENUM ('pending_approval', 'active', 'rejected', 'off_duty');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. تحديث جدول المستخدمين العام / طاقم العمل
ALTER TABLE IF EXISTS users 
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS onboarding_status staff_onboarding_status DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS pairing_code VARCHAR(6),
    ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS session_token UUID DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS assigned_desk_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS assigned_service_id VARCHAR(64);

-- تحديث جدول طاقم العمل الخاص بمكن (mken_staff)
ALTER TABLE IF EXISTS mken_staff
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(32) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS pairing_code VARCHAR(6),
    ADD COLUMN IF NOT EXISTS pairing_code_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS session_token VARCHAR(64),
    ADD COLUMN IF NOT EXISTS assigned_desk_name VARCHAR(50),
    ADD COLUMN IF NOT EXISTS assigned_service_id VARCHAR(64);

-- 3. قيد أمان: ضمان عدم تكرار تسجيل نفس رقم الجوال بحالة معلقة
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_staff_phone 
ON users (branch_id, phone_number) 
WHERE onboarding_status = 'pending_approval';

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mken_pending_staff_phone 
ON mken_staff (tenant_slug, phone) 
WHERE onboarding_status = 'pending_approval';

-- 4. جدول قفل الكاونترات ومنع التصادم (Counter Mutex & Takeover)
CREATE TABLE IF NOT EXISTS counter_locks (
    tenant_slug VARCHAR(64) NOT NULL,
    desk_name VARCHAR(50) NOT NULL,
    service_id VARCHAR(64) NOT NULL,
    assigned_staff_id VARCHAR(64) NOT NULL,
    assigned_staff_name VARCHAR(120),
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_slug, desk_name)
);

CREATE INDEX IF NOT EXISTS idx_counter_locks_tenant ON counter_locks (tenant_slug);

-- 5. جدول الخدمات والطوابير المخصصة المنشأة ديناميكياً
CREATE TABLE IF NOT EXISTS tenant_custom_queues (
    id VARCHAR(64) NOT NULL,
    tenant_slug VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    prefix VARCHAR(8) NOT NULL DEFAULT 'A',
    avg_service_time_minutes INT NOT NULL DEFAULT 15,
    max_daily_capacity INT NOT NULL DEFAULT 100,
    max_active_waiting_limit INT NOT NULL DEFAULT 20,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_admin VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_slug, id)
);
