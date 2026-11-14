-- ====================================================================
-- مَكَن (Mken Platform) - نظام إدارة الطوابير المتقدم (Smart Queue Management)
-- معمارية مصفوفة الصلاحيات الهرمية (RBAC) ومحرك تحويل التذاكر الذكي
-- المصادق عليها في قاعة العمليات
-- ====================================================================

-- تفعيل إضافة لتوليد معرّفات UUID فريدة وعشوائية
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. الأنواع المعرفة (Custom ENUMs)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'receptionist', 'counter_agent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE counter_status AS ENUM ('active', 'on_break', 'offline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('waiting', 'in_service', 'on_hold', 'transferred', 'completed', 'no_show', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE priority_type AS ENUM ('standard', 'fair_fifo', 'immediate_next');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE log_action AS ENUM ('created', 'called', 'started', 'held', 'transferred', 'completed', 'no_show', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE break_reason AS ENUM ('prayer', 'lunch', 'rest', 'emergency');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =========================================================
-- 2. الفروع (Branches)
-- =========================================================
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20) NOT NULL, -- مثال: JED-01, MED-01
    settings JSONB DEFAULT '{"outlier_threshold_sigma": 2, "buffer_ratio": 1.15, "snooze_minutes": 5}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches (tenant_slug, is_active);

-- =========================================================
-- 3. المستخدمون وطاقم العمل (Users & Staff)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'counter_agent',
    pin_code VARCHAR(10) DEFAULT '1234', -- رمز الدخول والتبديل السريع للورديات (4 أرقام)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, email)
);

CREATE INDEX IF NOT EXISTS idx_users_branch ON users (branch_id, role);

-- =========================================================
-- 4. الأقسام والخدمات / الطوابير (Services / Queues)
-- =========================================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- مثال: قسم العقود، الفحص الأولي، الاستقبال
    code VARCHAR(10) NOT NULL,            -- مثال: A, B, C لتنسيق التذكرة (A-101)
    target_service_time_sec INT DEFAULT 300, -- الوقت المستهدف (5 دقائق)
    current_avg_service_time_sec INT DEFAULT 300, -- قيمة الـ EWMA الحالية
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, code)
);

CREATE INDEX IF NOT EXISTS idx_services_tenant ON services (tenant_slug, is_active);

-- =========================================================
-- 5. الكاونترات ونقاط الخدمة (Counters)
-- =========================================================
CREATE TABLE IF NOT EXISTS counters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    counter_number VARCHAR(20) NOT NULL,  -- كاونتر 1، مكتب 3
    name VARCHAR(100) NOT NULL DEFAULT 'كاونتر خدمة',
    current_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status counter_status NOT NULL DEFAULT 'offline',
    assigned_service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    assigned_queue_ids JSONB DEFAULT '[]'::JSONB, -- دعم الطابور الموحد (Pooled)
    current_ticket_id UUID,
    current_session_started_at TIMESTAMPTZ,
    ewma_service_seconds NUMERIC(10, 2) DEFAULT 300,
    last_status_change TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_slug, counter_number)
);

CREATE INDEX IF NOT EXISTS idx_counters_tenant ON counters (tenant_slug, status);

-- =========================================================
-- 6. التذاكر الذكية (Tickets)
-- =========================================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    current_service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    
    -- بيانات التذكرة والتعريف الفريد
    ticket_number VARCHAR(30) NOT NULL,   -- مثال: A-105
    session_token UUID NOT NULL DEFAULT uuid_generate_v4(), -- رابط العميل الحي الفريد (State Recovery)
    customer_name VARCHAR(120) NOT NULL DEFAULT 'عميل مَكَن',
    phone_number VARCHAR(20),             -- للتنبيهات وإشعارات الواتساب
    
    -- حالة الخدمة والأولوية
    status ticket_status NOT NULL DEFAULT 'waiting',
    priority_level priority_type NOT NULL DEFAULT 'standard',
    first_arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- وقت الوصول الأصلي لحساب FIFO العادل
    transferred_at TIMESTAMPTZ,                          -- وقت التحويل للقسم الحالي
    
    -- ارتباط الكاونتر والموظف الحالي
    served_by_counter_id UUID REFERENCES counters(id) ON DELETE SET NULL,
    served_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    called_counter_number VARCHAR(20),
    
    -- التوقيت الزمني
    called_at TIMESTAMPTZ,
    service_started_at TIMESTAMPTZ,
    service_ended_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    
    -- ملاحظات الانتقال وسياق العميل بين الموظفين
    transfer_notes TEXT,
    last_service_name VARCHAR(100),
    
    -- حقول الإشعارات والمزامنة
    push_subscription JSONB,
    concurrent_ticket_ids JSONB DEFAULT '[]'::JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- 7. سجل حركات التذكرة والتحويلات (Ticket Logs & Audit)
-- =========================================================
CREATE TABLE IF NOT EXISTS ticket_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_service_id UUID REFERENCES services(id),
    to_service_id UUID REFERENCES services(id),
    performed_by_user_id UUID REFERENCES users(id),
    counter_id UUID REFERENCES counters(id),
    action log_action NOT NULL,
    duration_seconds INT,                 -- زمن المعاملة الفعلي في هذه الخطوة
    notes TEXT,                           -- سبب التحويل أو تعليق إضافي
    is_outlier BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- 8. الفهارس الموجهة للأداء اللحظي (Indexes)
-- =========================================================
-- 1. تسريع استعلام طابور الانتظار بحسب الخدمة والأولوية والوقت
CREATE INDEX IF NOT EXISTS idx_tickets_active_queue 
ON tickets (current_service_id, status, priority_level, first_arrived_at)
WHERE status IN ('waiting', 'on_hold');

-- 2. استرجاع جلسة العميل فوراً عبر المتصفح باستخدام التوكن الفريد
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_session_token 
ON tickets (session_token);

-- 3. فهرسة السجلات التاريخية لحساب متوسط الـ EWMA دون فحص كامل الجدول
CREATE INDEX IF NOT EXISTS idx_ticket_logs_ewma 
ON ticket_logs (to_service_id, action, created_at)
WHERE action = 'completed';

-- =========================================================
-- 9. سياسات الأمان وصلاحيات الصفوف (Row Level Security - RLS)
-- =========================================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;

-- موظف الاستقبال والمشرف: رؤية وتعديل كامل تذاكر المنشأة
DO $$ BEGIN
  CREATE POLICY reception_all_access ON tickets
  FOR ALL
  TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
            AND users.tenant_slug = tickets.tenant_slug 
            AND users.role IN ('admin', 'receptionist')
      )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- موظف الكاونتر: رؤية طابوره الحالي فقط، والتعديل فقط على العميل المسند لكاونتره
DO $$ BEGIN
  CREATE POLICY counter_scoped_select ON tickets
  FOR SELECT
  TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM users u
          JOIN counters c ON c.current_user_id = u.id
          WHERE u.id = auth.uid() 
            AND u.role = 'counter_agent'
            AND (tickets.current_service_id = c.assigned_service_id OR tickets.served_by_counter_id = c.id)
      )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY counter_scoped_update ON tickets
  FOR UPDATE
  TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM users u
          JOIN counters c ON c.current_user_id = u.id
          WHERE u.id = auth.uid() 
            AND u.role = 'counter_agent'
            AND (tickets.served_by_user_id = u.id OR tickets.served_by_counter_id = c.id)
      )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- =========================================================
-- 10. إدارة الورديات وتبديل الموظفين (24/7 Shifts & Sessions)
-- =========================================================
-- جدول جلسات الكاونترات (تسجيل دخول وخروج الموظف على كاونتر محدد)
CREATE TABLE IF NOT EXISTS counter_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    counter_id UUID NOT NULL REFERENCES counters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- توقيت المناوبة
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- إحصائيات سريعة تُغلق مع نهاية الجلسة
    total_served_tickets INT DEFAULT 0,
    session_status VARCHAR(20) DEFAULT 'active', -- active, closed, forced_closed
    closed_by_user_id UUID REFERENCES users(id),  -- لمعرفة هل أغلقها بنفسه أم أغلقها الاستقبال
    handover_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_sessions_active 
ON counter_sessions (counter_id, session_status) 
WHERE session_status = 'active';

CREATE INDEX IF NOT EXISTS idx_counter_sessions_user 
ON counter_sessions (user_id, started_at);

-- جدول فترات الاستراحة (Breaks Log)
CREATE TABLE IF NOT EXISTS agent_breaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    counter_session_id UUID NOT NULL REFERENCES counter_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counter_id UUID REFERENCES counters(id) ON DELETE CASCADE,
    reason break_reason NOT NULL DEFAULT 'rest',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_breaks_session 
ON agent_breaks (counter_session_id, started_at);

-- جدول تسليم ورديات الاستقبال ومكتب القيادة (Reception Shift Handovers)
CREATE TABLE IF NOT EXISTS reception_handovers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    outgoing_user_id UUID NOT NULL REFERENCES users(id),
    incoming_user_id UUID NOT NULL REFERENCES users(id),
    waiting_tickets_count INT DEFAULT 0,
    overdue_tickets_count INT DEFAULT 0,
    served_today_count INT DEFAULT 0,
    handover_notes TEXT,
    handover_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- سياسات الأمان لجلسات الكاونترات والاستراحات
ALTER TABLE counter_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reception_handovers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sessions_admin_reception_all ON counter_sessions
  FOR ALL TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
            AND users.tenant_slug = counter_sessions.tenant_slug 
            AND users.role IN ('admin', 'receptionist')
      )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY breaks_admin_reception_all ON agent_breaks
  FOR ALL TO authenticated
  USING (
      EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
            AND users.tenant_slug = agent_breaks.tenant_slug 
            AND users.role IN ('admin', 'receptionist')
      )
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

