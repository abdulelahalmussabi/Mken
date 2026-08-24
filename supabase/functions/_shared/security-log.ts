import type { AdminClient } from "./env.ts";

export async function logSecurityEvent(
  admin: AdminClient,
  args: {
    tenantSlug?: string | null;
    userId?: string | null;
    deviceId?: string | null;
    eventType: string;
    severity?: string;
    detail?: Record<string, unknown>;
    ipHash?: string | null;
    userAgentHash?: string | null;
  },
): Promise<void> {
  const { error } = await admin.rpc("log_auth_security_event", {
    p_tenant_slug: args.tenantSlug ?? null,
    p_user_id: args.userId ?? null,
    p_device_id: args.deviceId ?? null,
    p_event_type: args.eventType,
    p_severity: args.severity ?? "INFO",
    p_detail: args.detail ?? {},
    p_ip_hash: args.ipHash ?? null,
    p_user_agent_hash: args.userAgentHash ?? null,
  });
  if (error) {
    // Fallback direct insert if RPC signature drift
    const { error: insErr } = await admin.from("auth_security_events").insert({
      tenant_slug: args.tenantSlug ?? null,
      user_id: args.userId ?? null,
      device_id: args.deviceId ?? null,
      event_type: args.eventType,
      severity: args.severity ?? "INFO",
      detail: args.detail ?? {},
      ip_hash: args.ipHash ?? null,
      user_agent_hash: args.userAgentHash ?? null,
    });
    if (insErr) console.error("security_event_log_failed", insErr.message);
  }
}

export async function tenantExists(
  admin: AdminClient,
  tenantSlug: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("mken_saas_clients")
    .select("tenant_slug")
    .eq("tenant_slug", tenantSlug)
    .maybeSingle();
  if (error) {
    console.error("tenant_lookup_failed", error.message);
    return false;
  }
  return Boolean(data?.tenant_slug);
}
