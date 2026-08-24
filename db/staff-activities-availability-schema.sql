-- ربط الموظفين بالأنشطة + أعمدة التوفر + عزل محادثات واتساب حسب النشاط
-- شغّل في: Supabase Dashboard → SQL Editor → Run

-- جدول ربط الموظفين بالأنشطة
CREATE TABLE IF NOT EXISTS mken_staff_activities (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES mken_staff(id) ON DELETE CASCADE,
    tenant_slug TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, staff_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_activities_lookup
  ON mken_staff_activities (tenant_slug, activity_id);

ALTER TABLE mken_staff_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow owner manage staff activities" ON mken_staff_activities;
CREATE POLICY "Allow owner manage staff activities"
  ON mken_staff_activities FOR ALL TO authenticated
  USING (
    auth.uid() = (
      SELECT owner_id FROM mken_saas_clients
      WHERE tenant_slug = mken_staff_activities.tenant_slug
      LIMIT 1
    )
    OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live'))
  )
  WITH CHECK (
    auth.uid() = (
      SELECT owner_id FROM mken_saas_clients
      WHERE tenant_slug = mken_staff_activities.tenant_slug
      LIMIT 1
    )
    OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live'))
  );

-- أعمدة التوفر
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'offline';
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS current_chat_load INTEGER DEFAULT 0;

-- عزل المحادثات حسب النشاط
ALTER TABLE mken_whatsapp_logs ADD COLUMN IF NOT EXISTS activity_id TEXT;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_activity
  ON mken_whatsapp_logs (tenant_slug, phone, activity_id, created_at DESC);
