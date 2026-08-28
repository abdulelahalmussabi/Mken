-- 1. إنشاء جدول العملاء (المستأجرين) لنظام SAAS
CREATE TABLE IF NOT EXISTS mken_saas_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    civil_registry_number TEXT,
    commercial_registry_number TEXT,
    tax_number TEXT,
    security_attachment TEXT,
    has_security_attachment BOOLEAN DEFAULT FALSE,
    subscription_status TEXT DEFAULT 'active',
    subscription_tier TEXT DEFAULT 'basic',
    subscription_start TIMESTAMPTZ DEFAULT NOW(),
    subscription_end TIMESTAMPTZ NOT NULL,
    config_data JSONB NOT NULL,
    saved_config_data JSONB,
    reminders_sent JSONB DEFAULT '[]'::jsonb,
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry TIMESTAMPTZ,
    google_business_location_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. إنشاء جدول المواعيد وتطويره لدعم المستأجرين
CREATE TABLE IF NOT EXISTS mken_appointments (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT DEFAULT 'default',
    activity_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    district TEXT,
    location_address TEXT,
    notes TEXT,
    party_size INTEGER,
    nights INTEGER,
    status TEXT DEFAULT 'pending',
    reminders_sent JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payment_status TEXT DEFAULT 'unpaid',
    payment_id TEXT,
    payment_method TEXT,
    payment_amount NUMERIC
);

-- 3. إنشاء جدول الطلبات وتفعيله لدعم المستأجرين
CREATE TABLE IF NOT EXISTS mken_orders (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT DEFAULT 'default',
    activity_id TEXT NOT NULL,
    activity_title TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    district TEXT,
    location_address TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payment_status TEXT DEFAULT 'unpaid',
    payment_id TEXT,
    payment_method TEXT,
    payment_amount NUMERIC
);

-- 4. إنشاء جدول الموظفين/الفنيين mken_staff
CREATE TABLE IF NOT EXISTS mken_staff (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'technician',
    pin_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ربط جدول المواعيد بالفنيين المباشرين
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS staff_id TEXT REFERENCES mken_staff(id) ON DELETE SET NULL;

-- 6. إنشاء جدول الأجهزة والتوثيق الحيوي للفنيين mken_staff_devices
CREATE TABLE IF NOT EXISTS mken_staff_devices (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL REFERENCES mken_staff(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. إنشاء جدول الفواتير لـ SaaS mken_saas_invoices
CREATE TABLE IF NOT EXISTS mken_saas_invoices (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    months INTEGER NOT NULL,
    status TEXT DEFAULT 'unpaid',
    payment_id TEXT,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7b. إنشاء جدول أصناف المستودع والمخزون mken_inventory_items
CREATE TABLE IF NOT EXISTS mken_inventory_items (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    barcode TEXT,
    cost_price NUMERIC DEFAULT 0,
    sell_price NUMERIC DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7c. إنشاء جدول فواتير العملاء mken_invoices
CREATE TABLE IF NOT EXISTS mken_invoices (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    payment_method TEXT,
    type TEXT DEFAULT 'invoice',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7d. إنشاء جدول حركات المخزون mken_inventory_transactions
CREATE TABLE IF NOT EXISTS mken_inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    item_id TEXT REFERENCES mken_inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    reference_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7e. إنشاء جدول الموردين mken_vendors
CREATE TABLE IF NOT EXISTS mken_vendors (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7f. إنشاء جدول فواتير المشتريات من الموردين mken_purchase_invoices
CREATE TABLE IF NOT EXISTS mken_purchase_invoices (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    vendor_id TEXT REFERENCES mken_vendors(id) ON DELETE SET NULL,
    items JSONB DEFAULT '[]'::jsonb,
    total_amount NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7g. إنشاء جدول العملاء mken_customers
CREATE TABLE IF NOT EXISTS mken_customers (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ترقية جدول mken_invoices لإضافة customer_id
ALTER TABLE mken_invoices ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES mken_customers(id) ON DELETE SET NULL;

-- 8. إنشاء جدول مفاتيح الـ API للتكامل الخارجي mken_api_keys
CREATE TABLE IF NOT EXISTS mken_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    key_name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 8c. إنشاء جدول سجل الرسائل mken_whatsapp_logs
CREATE TABLE IF NOT EXISTS mken_whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL REFERENCES mken_saas_clients(tenant_slug) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    body TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    event_type TEXT,
    appointment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0
);

-- 8d. اشتراكات Web Push mken_push_subscriptions
CREATE TABLE IF NOT EXISTS mken_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_slug TEXT NOT NULL DEFAULT 'default',
    endpoint TEXT UNIQUE NOT NULL,
    keys JSONB NOT NULL,
    label TEXT DEFAULT 'admin',
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mken_push_subs_tenant ON mken_push_subscriptions(tenant_slug);

-- 8b. ترقية الجداول القديمة — إضافة أعمدة SaaS والدفع
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS tenant_slug TEXT DEFAULT 'default';
UPDATE mken_appointments SET tenant_slug = 'default' WHERE tenant_slug IS NULL;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS stay_unit TEXT;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS stay_booking BOOLEAN DEFAULT false;
ALTER TABLE mken_appointments ADD COLUMN IF NOT EXISTS check_out_time TEXT;

DO $$ BEGIN
  IF to_regclass('public.mken_orders') IS NOT NULL THEN
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS tenant_slug TEXT DEFAULT 'default';
    UPDATE mken_orders SET tenant_slug = 'default' WHERE tenant_slug IS NULL;
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE mken_orders ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.mken_saas_clients') IS NOT NULL THEN
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS saved_config_data JSONB;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS google_access_token TEXT;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS google_business_location_id TEXT;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS google_place_id TEXT;
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS claim_status TEXT DEFAULT 'claimed';
    ALTER TABLE mken_saas_clients ADD COLUMN IF NOT EXISTS preview_expires_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_clients_unclaimed_ttl
      ON mken_saas_clients (claim_status, preview_expires_at)
      WHERE claim_status = 'unclaimed';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.mken_invoices') IS NOT NULL THEN
    ALTER TABLE mken_invoices ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'invoice';
  END IF;
END $$;

-- 9. إدراج مستأجر افتراضي للتوافق الكامل
INSERT INTO mken_saas_clients (tenant_slug, business_name, email, phone, subscription_end, config_data)
VALUES ('default', 'المنصة الافتراضية', 'default@mken.com', '966543530333', NOW() + INTERVAL '10 years', '{}'::jsonb)
ON CONFLICT (tenant_slug) DO NOTHING;

-- 10. تفعيل الحماية والأمان (RLS)
DROP POLICY IF EXISTS "Allow public read appointments" ON mken_appointments;
DROP POLICY IF EXISTS "Allow public read orders" ON mken_orders;
DROP POLICY IF EXISTS "Allow public read staff" ON mken_staff;
DROP POLICY IF EXISTS "Allow public read staff devices" ON mken_staff_devices;
DROP POLICY IF EXISTS "Allow public read on clients" ON mken_saas_clients;
DROP POLICY IF EXISTS "Allow public insert on clients" ON mken_saas_clients;
DROP POLICY IF EXISTS "Allow public update on clients" ON mken_saas_clients;
DROP POLICY IF EXISTS "Allow owner manage client" ON mken_saas_clients;
DROP POLICY IF EXISTS "Allow public insert on appointments" ON mken_appointments;
DROP POLICY IF EXISTS "Allow owner manage appointments" ON mken_appointments;
DROP POLICY IF EXISTS "Allow public insert on orders" ON mken_orders;
DROP POLICY IF EXISTS "Allow owner manage orders" ON mken_orders;
DROP POLICY IF EXISTS "Allow owner manage staff" ON mken_staff;
DROP POLICY IF EXISTS "Allow owner read invoices" ON mken_saas_invoices;
DROP POLICY IF EXISTS "Allow owner manage api keys" ON mken_api_keys;
DROP POLICY IF EXISTS "Allow owner manage whatsapp logs" ON mken_whatsapp_logs;
DROP POLICY IF EXISTS "Allow owner manage inventory items" ON mken_inventory_items;
DROP POLICY IF EXISTS "Allow public read inventory items" ON mken_inventory_items;
DROP POLICY IF EXISTS "Allow owner manage invoices" ON mken_invoices;
DROP POLICY IF EXISTS "Allow owner manage inventory transactions" ON mken_inventory_transactions;
DROP POLICY IF EXISTS "Allow owner manage vendors" ON mken_vendors;
DROP POLICY IF EXISTS "Allow owner manage purchase invoices" ON mken_purchase_invoices;
DROP POLICY IF EXISTS "Allow owner manage customers" ON mken_customers;

ALTER TABLE mken_saas_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_staff_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_saas_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mken_customers ENABLE ROW LEVEL SECURITY;

-- 11. سياسات الأمان لجدول العملاء mken_saas_clients
CREATE POLICY "Allow owner manage client" ON mken_saas_clients FOR ALL TO authenticated 
  USING (auth.uid() = owner_id OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live'))) 
  WITH CHECK (auth.uid() = owner_id OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 12. سياسات الأمان لجدول المواعيد mken_appointments
CREATE POLICY "Allow public insert on appointments" ON mken_appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow owner manage appointments" ON mken_appointments FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_appointments.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 13. سياسات الأمان لجدول الطلبات mken_orders
CREATE POLICY "Allow public insert on orders" ON mken_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow owner manage orders" ON mken_orders FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_orders.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 14. سياسات الأمان لجدول الموظفين mken_staff
CREATE POLICY "Allow owner manage staff" ON mken_staff FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_staff.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 15. سياسات الأمان للفواتير mken_saas_invoices
CREATE POLICY "Allow owner read invoices" ON mken_saas_invoices FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_saas_invoices.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16. سياسات الأمان لمفاتيح الـ API
CREATE POLICY "Allow owner manage api keys" ON mken_api_keys FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_api_keys.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16b. سياسات الأمان لسجل رسائل الواتساب
CREATE POLICY "Allow owner manage whatsapp logs" ON mken_whatsapp_logs FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_whatsapp_logs.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16c. سياسات الأمان للمخزون والمنتجات
CREATE POLICY "Allow owner manage inventory items" ON mken_inventory_items FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_inventory_items.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16d. سياسات الأمان لفواتير العملاء
CREATE POLICY "Allow owner manage invoices" ON mken_invoices FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_invoices.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16e. سياسات الأمان لحركات المخزن
CREATE POLICY "Allow owner manage inventory transactions" ON mken_inventory_transactions FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_inventory_transactions.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16f. سياسات الأمان لجدول الموردين
CREATE POLICY "Allow owner manage vendors" ON mken_vendors FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_vendors.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16g. سياسات الأمان لفواتير المشتريات
CREATE POLICY "Allow owner manage purchase invoices" ON mken_purchase_invoices FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_purchase_invoices.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 16h. سياسات الأمان لجدول العملاء
CREATE POLICY "Allow owner manage customers" ON mken_customers FOR ALL TO authenticated 
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_customers.tenant_slug LIMIT 1) OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- 17. إنشاء منظر عام للمواعيد لا يعرض معلومات حساسة
CREATE OR REPLACE VIEW mken_public_appointments AS 
  SELECT id, tenant_slug, activity_id, service_id, date, time, status FROM mken_appointments;
GRANT SELECT ON mken_public_appointments TO anon;
GRANT SELECT ON mken_public_appointments TO authenticated;

-- 17b. إنشاء منظر عام للمخزون لا يعرض سعر التكلفة cost_price
CREATE OR REPLACE VIEW mken_public_inventory_items AS 
  SELECT id, tenant_slug, name, sku, barcode, sell_price, quantity, min_stock_alert, image_url, created_at, updated_at FROM mken_inventory_items;
GRANT SELECT ON mken_public_inventory_items TO anon;
GRANT SELECT ON mken_public_inventory_items TO authenticated;

-- 17c. دالة جلب الإعدادات العامة الآمنة للمستأجر
DROP FUNCTION IF EXISTS mken_get_public_config(text);
CREATE OR REPLACE FUNCTION mken_get_public_config(p_tenant_slug text) 
RETURNS jsonb SECURITY DEFINER AS $$
DECLARE
    v_config jsonb;
    v_business_name text;
    v_phone text;
    v_sub_status text;
    v_sub_end text;
    v_sub_tier text;
    v_email text;
    v_result jsonb;
BEGIN
    SELECT config_data, business_name, phone, subscription_status, subscription_end, subscription_tier, email 
    INTO v_config, v_business_name, v_phone, v_sub_status, v_sub_end, v_sub_tier, v_email 
    FROM public.mken_saas_clients 
    WHERE tenant_slug = p_tenant_slug;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    v_result := jsonb_build_object(
        'brand', COALESCE(v_config->'brand', jsonb_build_object('name', v_business_name, 'tagline', 'مرحباً بك في موقعنا', 'logo', '')),
        'theme', COALESCE(v_config->'theme', jsonb_build_object()),
        'phone', v_phone,
        'payment', jsonb_build_object(
            'enabled', COALESCE((v_config->'payment'->>'enabled')::boolean, false),
            'provider', COALESCE(v_config->'payment'->>'provider', 'moyasar'),
            'publishableKey', COALESCE(v_config->'payment'->>'publishableKey', ''),
            'requirePayment', COALESCE((v_config->'payment'->>'requirePayment')::boolean, false),
            'sandbox', COALESCE((v_config->'payment'->>'sandbox')::boolean, true),
            'currency', COALESCE(v_config->'payment'->>'currency', 'SAR')
        ),
        'whatsappApi', jsonb_build_object(
            'enabled', COALESCE((v_config->'whatsappApi'->>'enabled')::boolean, false),
            'provider', COALESCE(v_config->'whatsappApi'->>'provider', 'none'),
            'sendConfirmation', COALESCE((v_config->'whatsappApi'->>'sendConfirmation')::boolean, true),
            'sendReminder', COALESCE((v_config->'whatsappApi'->>'sendReminder')::boolean, true)
        ),
        'enabledActivities', COALESCE(v_config->'enabledActivities', '[]'::jsonb),
        'booking', COALESCE(v_config->'booking', jsonb_build_object()),
        'hockeyCoaching', COALESCE(v_config->'hockeyCoaching', jsonb_build_object()) - 'coachPin',
        'footballCoaching', COALESCE(v_config->'footballCoaching', jsonb_build_object()) - 'coachPin',
        'business_name', v_business_name,
        'email', v_email,
        'subscription_status', v_sub_status,
        'subscription_end', v_sub_end,
        'subscription_tier', v_sub_tier
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION mken_get_public_config(text) TO anon;
GRANT EXECUTE ON FUNCTION mken_get_public_config(text) TO authenticated;

-- 18. دالة التحقق من رمز PIN للموظفين بشكل آمن
DROP FUNCTION IF EXISTS verify_staff_pin(text, text, text);
CREATE OR REPLACE FUNCTION verify_staff_pin(p_tenant text, p_phone text, p_pin_hash text)
RETURNS jsonb SECURITY DEFINER AS $$
DECLARE
    v_staff record;
BEGIN
    SELECT id, name, role, phone, tenant_slug, status INTO v_staff
    FROM mken_staff
    WHERE tenant_slug = p_tenant AND phone = p_phone AND pin_code = p_pin_hash AND status = 'active';
    IF FOUND THEN
        RETURN jsonb_build_object('success', true, 'id', v_staff.id, 'name', v_staff.name, 'role', v_staff.role, 'phone', v_staff.phone, 'tenant_slug', v_staff.tenant_slug);
    ELSE
        RETURN jsonb_build_object('success', false);
    END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION verify_staff_pin(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION verify_staff_pin(text, text, text) TO authenticated;

-- =====================================================================
-- Migration: add activity_id column to mken_whatsapp_logs for per-activity
-- data isolation. Safe to re-run (IF NOT EXISTS).
-- =====================================================================
ALTER TABLE mken_whatsapp_logs ADD COLUMN IF NOT EXISTS activity_id TEXT;
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_activity
  ON mken_whatsapp_logs (tenant_slug, phone, activity_id, created_at DESC);

-- =====================================================================
-- Phase 2: staff ↔ activity link + availability tracking
-- =====================================================================

-- Link staff members to activities (many-to-many). Each staff can serve
-- multiple activities, and each activity can have multiple staff.
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

ALTER TABLE mken_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow owner manage staff activities"
  ON mken_staff_activities FOR ALL TO authenticated
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_staff_activities.tenant_slug LIMIT 1)
         OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));

-- Availability tracking columns on mken_staff.
-- availability: 'online' | 'busy' | 'offline' (default offline)
-- last_seen_at: heartbeat timestamp from the staff portal
-- current_chat_load: number of active conversations assigned
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'offline';
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE mken_staff ADD COLUMN IF NOT EXISTS current_chat_load INTEGER DEFAULT 0;

-- =====================================================================
-- Phase 3: conversation sessions + human handoff state machine
-- =====================================================================

CREATE TABLE IF NOT EXISTS mken_conversation_sessions (
    id TEXT PRIMARY KEY,
    tenant_slug TEXT NOT NULL,
    phone TEXT NOT NULL,
    activity_id TEXT,
    status TEXT DEFAULT 'bot',       -- 'bot' | 'handoff' | 'human' | 'closed'
    assigned_staff_id TEXT REFERENCES mken_staff(id) ON DELETE SET NULL,
    summary TEXT,                    -- conversation summary passed to the human agent
    started_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- One active session per (tenant, phone). Enforced via partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_active_unique
  ON mken_conversation_sessions (tenant_slug, phone)
  WHERE status IN ('bot', 'handoff', 'human');

-- Fast lookup for the active session of a customer.
CREATE INDEX IF NOT EXISTS idx_session_lookup
  ON mken_conversation_sessions (tenant_slug, phone, status);

ALTER TABLE mken_conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow owner manage sessions"
  ON mken_conversation_sessions FOR ALL TO authenticated
  USING (auth.uid() = (SELECT owner_id FROM mken_saas_clients WHERE tenant_slug = mken_conversation_sessions.tenant_slug LIMIT 1)
         OR (auth.jwt() ->> 'email' IN ('admin@mkem.live', 'admin@mken.live')));


