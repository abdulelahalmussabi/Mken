/**
 * Resolve or create Supabase Auth user for a verified phone (Authentica).
 * Uses phone on auth.users + phone_hash map (PDPL: raw phone only in Auth, not trust tables).
 */

import type { AdminClient } from "./env.ts";

export async function resolveUserAfterOtp(
  admin: AdminClient,
  args: {
    tenantSlug: string;
    e164: string;
    phoneHashValue: string;
  },
): Promise<{ userId: string; created: boolean }> {
  const { data: existing, error: mapErr } = await admin
    .from("auth_phone_identities")
    .select("user_id")
    .eq("tenant_slug", args.tenantSlug)
    .eq("phone_hash", args.phoneHashValue)
    .maybeSingle();

  if (mapErr) throw new Error(`phone_map_lookup_failed:${mapErr.message}`);

  if (existing?.user_id) {
    await admin
      .from("auth_phone_identities")
      .update({ last_login_at: new Date().toISOString() })
      .eq("tenant_slug", args.tenantSlug)
      .eq("phone_hash", args.phoneHashValue);

    return { userId: existing.user_id as string, created: false };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    phone: args.e164,
    phone_confirm: true,
    user_metadata: {
      tenant_slug: args.tenantSlug,
      auth_provider: "authentica",
    },
    app_metadata: {
      provider: "authentica",
      providers: ["authentica", "phone"],
    },
  });

  if (createErr || !created.user) {
    // Race: user may exist globally by phone — try list filter
    const recovered = await findUserIdByPhone(admin, args.e164);
    if (!recovered) {
      throw new Error(`create_user_failed:${createErr?.message ?? "unknown"}`);
    }
    await upsertPhoneMap(admin, args.tenantSlug, args.phoneHashValue, recovered);
    return { userId: recovered, created: false };
  }

  await upsertPhoneMap(
    admin,
    args.tenantSlug,
    args.phoneHashValue,
    created.user.id,
  );

  return { userId: created.user.id, created: true };
}

async function upsertPhoneMap(
  admin: AdminClient,
  tenantSlug: string,
  phoneHashValue: string,
  userId: string,
): Promise<void> {
  const { error } = await admin.from("auth_phone_identities").upsert(
    {
      tenant_slug: tenantSlug,
      phone_hash: phoneHashValue,
      user_id: userId,
      last_login_at: new Date().toISOString(),
    },
    { onConflict: "tenant_slug,phone_hash" },
  );
  if (error) throw new Error(`phone_map_upsert_failed:${error.message}`);
}

async function findUserIdByPhone(
  admin: AdminClient,
  e164: string,
): Promise<string | null> {
  // Paginated search — acceptable for rare race; prefer Auth phone unique constraint
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const hit = data.users.find((u) => u.phone === e164);
    if (hit) return hit.id;
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

/**
 * Issue a short-lived session for the client via generateLink + verify token hash pattern.
 * Returns access/refresh when possible; otherwise userId only (BFF may mint).
 */
export async function issueUserSession(
  admin: AdminClient,
  userId: string,
): Promise<{ accessToken: string | null; refreshToken: string | null; expiresIn: number | null }> {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData.user) {
    return { accessToken: null, refreshToken: null, expiresIn: null };
  }

  const email = userData.user.email;
  if (!email) {
    // Phone-only users: no magiclink email — client relies on device trust + custom BFF session
    return { accessToken: null, refreshToken: null, expiresIn: null };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data) {
    console.error("generate_link_failed", error?.message);
    return { accessToken: null, refreshToken: null, expiresIn: null };
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    return { accessToken: null, refreshToken: null, expiresIn: null };
  }

  const { data: sessionData, error: verErr } = await admin.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (verErr || !sessionData.session) {
    console.error("session_exchange_failed", verErr?.message);
    return { accessToken: null, refreshToken: null, expiresIn: null };
  }

  return {
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
    expiresIn: sessionData.session.expires_in,
  };
}
