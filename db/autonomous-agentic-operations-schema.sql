-- ============================================================================
-- منصة مكِّن (Mken Multi-Tenant SaaS)
-- المخطط الهندسي لنموذج "المنشأة ذاتية الإدارة" (Autonomous Operations Framework)
-- التوافق: PostgreSQL 15+ / Supabase RLS / PDPL & ZATCA Compliant
-- ============================================================================

-- 1. جدول تكوين الوكلاء الأذكياء لكل مستأجر (Tenant Agent Configs)
CREATE TABLE IF NOT EXISTS public.tenant_agent_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sector_profile VARCHAR(50) NOT NULL CHECK (sector_profile IN ('appointment', 'field_service', 'project', 'commerce', 'omni')),
    agent_role VARCHAR(100) NOT NULL, -- e.g., 'dispatch_agent', 'booking_concierge', 'inventory_autopilot', 'finance_arbiter'
    autonomy_level INT DEFAULT 2 CHECK (autonomy_level BETWEEN 1 AND 4), 
    -- 1: Suggestion (اقتراحي فقط)
    -- 2: Supervised (إشرافي - يتطلب موافقة)
    -- 3: Autonomous with HITL (ذاتي مع عتبات تدخل بشري)
    -- 4: Full Auto (ذاتي بالكامل ضمن المحددات الصارمة)
    escalation_thresholds JSONB NOT NULL DEFAULT '{
        "max_discount_pct": 15,
        "refund_limit_sar": 0,
        "sentiment_alert_threshold": -0.5,
        "geo_dispatch_max_km": 15,
        "zatca_auto_retry_max": 2
    }'::jsonb,
    system_prompt_overrides TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. جدول عزل سياق الذاكرة لكل مستأجر (Tenant Context & Memory Isolation)
CREATE TABLE IF NOT EXISTS public.tenant_agent_memory_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES public.tenant_agent_configs(id) ON DELETE CASCADE,
    session_id VARCHAR(120) NOT NULL, -- معرف جلسة الواتساب أو رقم العميل المقنع (e.g. hashed phone)
    masked_customer_identifier VARCHAR(100),
    short_term_context JSONB DEFAULT '{}'::jsonb,
    sentiment_score NUMERIC(3, 2) DEFAULT 0.0, -- نطاق من -1.0 (غضب شديد) إلى +1.0 (رضا تام)
    active_intent VARCHAR(80),
    last_interaction_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_tenant_agent_session UNIQUE (tenant_id, agent_id, session_id)
);

-- 3. جدول سجل قرارات الوكلاء وتتبع التدخل البشري (Agent Execution Logs & HITL)
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.tenant_agent_configs(id) ON DELETE SET NULL,
    channel VARCHAR(30) DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'web', 'dashboard', 'api', 'webhook')),
    trigger_event VARCHAR(100) NOT NULL, -- e.g., 'customer_booking_request', 'field_technician_conflict', 'cart_abandoned', 'zatca_rejection'
    input_payload JSONB, -- بيانات الدخل المنقحة (PII-masked)
    agent_decision JSONB, -- القرار المقترح، المعاملات، الـ Function Call المستدعى
    confidence_score NUMERIC(5, 2) DEFAULT 95.0, -- نسبة الثقة من 0 إلى 100
    requires_human_approval BOOLEAN DEFAULT false,
    approval_status VARCHAR(20) DEFAULT 'auto_approved' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approval_notes TEXT,
    zatca_tx_reference VARCHAR(255),
    execution_latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    resolved_at TIMESTAMPTZ
);

-- الفهارس للأداء العالي وسرعة الاستعلام
CREATE INDEX IF NOT EXISTS idx_tenant_agent_configs_tenant ON public.tenant_agent_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_tenant_approval ON public.agent_execution_logs(tenant_id, approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_execution_logs_trigger ON public.agent_execution_logs(tenant_id, trigger_event);
CREATE INDEX IF NOT EXISTS idx_agent_memory_session ON public.tenant_agent_memory_contexts(tenant_id, session_id);

-- ============================================================================
-- تفعيل سياسات الأمان على مستوى الصفوف (Row Level Security - RLS)
-- لضمان عزل بيانات كل تاجر بنسبة 100% ومنع أي تسريب بين المستأجرين
-- ============================================================================
ALTER TABLE public.tenant_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_agent_memory_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- سياسات جدول تكوين الوكلاء
CREATE POLICY "Tenant isolation for agent configs"
ON public.tenant_agent_configs FOR ALL
USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- سياسات جدول سياق الذاكرة المعزول
CREATE POLICY "Tenant isolation for agent memory contexts"
ON public.tenant_agent_memory_contexts FOR ALL
USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);

-- سياسات جدول سجلات قرارات الوكلاء
CREATE POLICY "Tenant isolation for agent logs"
ON public.agent_execution_logs FOR ALL
USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::uuid);
