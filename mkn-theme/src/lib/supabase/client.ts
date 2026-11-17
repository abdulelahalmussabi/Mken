import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicSupabaseEnv, requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

export const createClient = () => {
  const { url, anon } = requirePublicSupabaseEnv();
  return createSupabaseClient(url, anon);
};

function createConfiguredClient(): SupabaseClient | null {
  const env = publicSupabaseEnv();
  if (!env) return null;
  return createSupabaseClient(env.url, env.anon);
}

const configured = createConfiguredClient();

/**
 * Production sets both public Supabase vars, so this is the same eager client as before.
 * Preview currently has the URL only (anon key is production-scoped). Importing this
 * module must not throw during `next build`; the first real call still fails closed.
 */
export const supabase: SupabaseClient =
  configured ??
  new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
    },
  });
