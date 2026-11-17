-- =============================================================================
-- مكّن — عزل جداول الطابور لكل منشأة (لا تُنفَّذ على الإنتاج من هذا الطلب)
-- طبّقها يدوياً في محرر SQL في Supabase بعد db/queue-management-schema.sql
-- و db/tenant-isolation-rls.sql (دوال current_tenant_slug / is_super_admin).
-- الخدمة (service_role) تتجاوز RLS. المفتاح العام anon لا يقرأ الأسماء أو الجوال.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_tenant_slug()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'tenant_slug',
    current_setting('request.jwt.claim.tenant_slug', true),
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_slug'),
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role') IN ('super_admin', 'service_role', 'super'),
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_is_tenant_staff(target_tenant text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin()
    OR (
      target_tenant IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_slug = target_tenant
          AND u.role::text IN ('admin', 'receptionist', 'counter_agent')
      )
      AND (
        public.current_tenant_slug() IS NULL
        OR public.current_tenant_slug() = target_tenant
      )
    );
$$;

REVOKE ALL ON FUNCTION public.queue_is_tenant_staff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.queue_is_tenant_staff(text) TO authenticated;

-- لا تسقط الصفوف الجديدة في منشأة default إذا نُسي tenant_slug
ALTER TABLE IF EXISTS public.branches ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.users ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.services ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.counters ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.tickets ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.ticket_logs ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.counter_sessions ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.agent_breaks ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.reception_handovers ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.queue_configs ALTER COLUMN tenant_slug DROP DEFAULT;
ALTER TABLE IF EXISTS public.queue_audit_logs ALTER COLUMN tenant_slug DROP DEFAULT;

ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counter_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reception_handovers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.branches FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counters FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.counter_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agent_breaks FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reception_handovers FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.queue_audit_logs FORCE ROW LEVEL SECURITY;

-- المفتاح العام لا يملك صلاحية الجداول. شاشة العرض تمر عبر واجهة الخادم بعد حجب البيانات الشخصية.
REVOKE ALL ON TABLE public.branches FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.services FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.counters FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.tickets FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ticket_logs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.counter_sessions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.agent_breaks FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.reception_handovers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.queue_configs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.queue_audit_logs FROM PUBLIC, anon;

REVOKE SELECT (pin_code) ON TABLE public.users FROM PUBLIC, anon, authenticated;
REVOKE SELECT (customer_name) ON TABLE public.tickets FROM PUBLIC, anon;
REVOKE SELECT (phone_number) ON TABLE public.tickets FROM PUBLIC, anon;
REVOKE SELECT (session_token) ON TABLE public.tickets FROM PUBLIC, anon;
REVOKE SELECT (push_subscription) ON TABLE public.tickets FROM PUBLIC, anon;
REVOKE SELECT (transfer_notes) ON TABLE public.tickets FROM PUBLIC, anon;

DROP POLICY IF EXISTS reception_all_access ON public.tickets;
CREATE POLICY reception_all_access ON public.tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_slug = tickets.tenant_slug
        AND u.role::text IN ('admin', 'receptionist')
    )
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tickets.tenant_slug)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_slug = tickets.tenant_slug
        AND u.role::text IN ('admin', 'receptionist')
    )
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tickets.tenant_slug)
  );

DROP POLICY IF EXISTS counter_scoped_select ON public.tickets;
CREATE POLICY counter_scoped_select ON public.tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.counters c ON c.current_user_id = u.id AND c.tenant_slug = u.tenant_slug
      WHERE u.id = auth.uid()
        AND u.tenant_slug = tickets.tenant_slug
        AND u.role::text = 'counter_agent'
        AND (tickets.current_service_id = c.assigned_service_id OR tickets.served_by_counter_id = c.id)
    )
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tickets.tenant_slug)
  );

DROP POLICY IF EXISTS counter_scoped_update ON public.tickets;
CREATE POLICY counter_scoped_update ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.counters c ON c.current_user_id = u.id AND c.tenant_slug = u.tenant_slug
      WHERE u.id = auth.uid()
        AND u.tenant_slug = tickets.tenant_slug
        AND u.role::text = 'counter_agent'
        AND (tickets.served_by_user_id = u.id OR tickets.served_by_counter_id = c.id)
    )
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tickets.tenant_slug)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.tenant_slug = tickets.tenant_slug
        AND u.role::text = 'counter_agent'
    )
    AND (public.current_tenant_slug() IS NULL OR public.current_tenant_slug() = tickets.tenant_slug)
  );

DROP POLICY IF EXISTS sessions_admin_reception_all ON public.counter_sessions;
CREATE POLICY sessions_admin_reception_all ON public.counter_sessions
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(counter_sessions.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(counter_sessions.tenant_slug));

DROP POLICY IF EXISTS breaks_admin_reception_all ON public.agent_breaks;
CREATE POLICY breaks_admin_reception_all ON public.agent_breaks
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(agent_breaks.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(agent_breaks.tenant_slug));

DROP POLICY IF EXISTS queue_configs_admin_all ON public.queue_configs;
CREATE POLICY queue_configs_admin_all ON public.queue_configs
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(queue_configs.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(queue_configs.tenant_slug));

DROP POLICY IF EXISTS queue_audit_read_admin ON public.queue_audit_logs;
CREATE POLICY queue_audit_read_admin ON public.queue_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.queue_is_tenant_staff(queue_audit_logs.tenant_slug)
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_slug = queue_audit_logs.tenant_slug
          AND u.role::text = 'admin'
      )
    )
  );

DROP POLICY IF EXISTS queue_tenant_staff_branches ON public.branches;
CREATE POLICY queue_tenant_staff_branches ON public.branches
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(branches.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(branches.tenant_slug));

DROP POLICY IF EXISTS queue_tenant_staff_users ON public.users;
CREATE POLICY queue_tenant_staff_users ON public.users
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(users.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(users.tenant_slug));

DROP POLICY IF EXISTS queue_tenant_staff_services ON public.services;
CREATE POLICY queue_tenant_staff_services ON public.services
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(services.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(services.tenant_slug));

DROP POLICY IF EXISTS queue_tenant_staff_counters ON public.counters;
CREATE POLICY queue_tenant_staff_counters ON public.counters
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(counters.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(counters.tenant_slug));

DROP POLICY IF EXISTS queue_tenant_staff_logs ON public.ticket_logs;
CREATE POLICY queue_tenant_staff_logs ON public.ticket_logs
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(ticket_logs.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(ticket_logs.tenant_slug));

DROP POLICY IF EXISTS queue_tenant_staff_handovers ON public.reception_handovers;
CREATE POLICY queue_tenant_staff_handovers ON public.reception_handovers
  FOR ALL TO authenticated
  USING (public.queue_is_tenant_staff(reception_handovers.tenant_slug))
  WITH CHECK (public.queue_is_tenant_staff(reception_handovers.tenant_slug));

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_status ON public.tickets (tenant_slug, status);

-- لوحة عامة بلا اسم أو جوال. لا تُمنح لـ anon حتى لا تُسرد كل المنشآت دفعة واحدة.
CREATE OR REPLACE VIEW public.queue_public_board
WITH (security_invoker = true) AS
SELECT tenant_slug, ticket_number, status::text AS status, called_counter_number
FROM public.tickets
WHERE status::text IN ('waiting', 'called', 'in_service', 'on_hold');

REVOKE ALL ON public.queue_public_board FROM PUBLIC, anon, authenticated;
