-- سياسة صالة الطابور + مناسبات رسمية + ربط مكان جوجل (مصدر حقيقة Postgres)
-- البوابة لا تستدعي Google؛ الاعتماد بعد مسودة المشرف فقط.

CREATE TABLE IF NOT EXISTS branch_queue_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL,
    branch_id VARCHAR(100) NOT NULL DEFAULT 'default',
    timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    city VARCHAR(80) NOT NULL DEFAULT 'Riyadh',
    weekly_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    ramadan_mode BOOLEAN NOT NULL DEFAULT FALSE,
    ramadan_hours JSONB,
    daily_issue_cap INT CHECK (daily_issue_cap IS NULL OR daily_issue_cap >= 0),
    max_waiting INT CHECK (max_waiting IS NULL OR max_waiting >= 0),
    messages JSONB NOT NULL DEFAULT '{}'::jsonb,
    prayer_source VARCHAR(20) NOT NULL DEFAULT 'umm_al_qura',
    prayer_manual JSONB,
    prayer_lead_minutes INT NOT NULL DEFAULT 10 CHECK (prayer_lead_minutes BETWEEN 3 AND 30),
    friday_prayer_extra_minutes INT NOT NULL DEFAULT 25 CHECK (friday_prayer_extra_minutes BETWEEN 0 AND 90),
    announce_prayer_on_display BOOLEAN NOT NULL DEFAULT TRUE,
    pause_new_issues_during_prayer BOOLEAN NOT NULL DEFAULT FALSE,
    pause_calls_on_prayer_soon BOOLEAN NOT NULL DEFAULT FALSE,
    apply_national_holidays BOOLEAN NOT NULL DEFAULT TRUE,
    google_place_id TEXT,
    gbp_location_id TEXT,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    maps_url TEXT,
    hours_source VARCHAR(20),
    suggested_weekly_hours JSONB,
    suggested_special_closes JSONB,
    hours_imported_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_user_id TEXT,
    UNIQUE (tenant_slug, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_queue_policies_tenant
  ON branch_queue_policies (tenant_slug, branch_id);

CREATE TABLE IF NOT EXISTS ksa_official_holidays (
    date DATE PRIMARY KEY,
    name_ar VARCHAR(120) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'national'
);

INSERT INTO ksa_official_holidays (date, name_ar, type) VALUES
  ('2026-02-22', 'يوم التأسيس', 'national'),
  ('2026-03-20', 'عيد الفطر', 'eid'),
  ('2026-03-21', 'عيد الفطر', 'eid'),
  ('2026-03-22', 'عيد الفطر', 'eid'),
  ('2026-05-27', 'عيد الأضحى', 'eid'),
  ('2026-05-28', 'عيد الأضحى', 'eid'),
  ('2026-05-29', 'عيد الأضحى', 'eid'),
  ('2026-09-23', 'اليوم الوطني', 'national'),
  ('2027-02-22', 'يوم التأسيس', 'national'),
  ('2027-09-23', 'اليوم الوطني', 'national')
ON CONFLICT (date) DO UPDATE SET name_ar = EXCLUDED.name_ar, type = EXCLUDED.type;

ALTER TABLE branch_queue_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY branch_queue_policies_service ON branch_queue_policies
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
