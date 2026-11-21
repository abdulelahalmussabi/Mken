-- تذاكر التشغيل الحية + مناداة ذرية (FOR UPDATE SKIP LOCKED)

CREATE TABLE IF NOT EXISTS queue_runtime_tickets (
    id TEXT PRIMARY KEY,
    tenant_slug VARCHAR(100) NOT NULL,
    branch_id VARCHAR(100) NOT NULL DEFAULT 'default',
    ticket_date DATE NOT NULL,
    ticket_number VARCHAR(30) NOT NULL,
    queue_id TEXT NOT NULL,
    status VARCHAR(30) NOT NULL,
    session_token TEXT,
    first_arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pos_link_id UUID,
    order_summary JSONB DEFAULT '{}'::jsonb,
    order_channel VARCHAR(30) DEFAULT 'pos',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_slug, branch_id, ticket_date, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_queue_runtime_waiting
  ON queue_runtime_tickets (tenant_slug, branch_id, status, first_arrived_at)
  WHERE status IN ('waiting', 'bumped');

CREATE INDEX IF NOT EXISTS idx_queue_runtime_day
  ON queue_runtime_tickets (tenant_slug, ticket_date, status);

ALTER TABLE queue_runtime_tickets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_next_queue_ticket(
    p_tenant TEXT,
    p_queue_ids TEXT[],
    p_branch TEXT DEFAULT 'default'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    rec queue_runtime_tickets%ROWTYPE;
BEGIN
    SELECT * INTO rec
    FROM queue_runtime_tickets
    WHERE tenant_slug = p_tenant
      AND branch_id = p_branch
      AND status IN ('waiting', 'bumped')
      AND queue_id = ANY (p_queue_ids)
    ORDER BY
      CASE WHEN COALESCE(payload->>'priority_level', '') = 'immediate_next' THEN 0 ELSE 1 END,
      first_arrived_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE queue_runtime_tickets
    SET status = 'called',
        payload = jsonb_set(payload, '{status}', '"called"'),
        updated_at = NOW()
    WHERE id = rec.id
    RETURNING * INTO rec;

    RETURN rec.payload;
END;
$$;
