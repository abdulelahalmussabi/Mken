import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

export const createClient = () => {
  const { url, anon } = requirePublicSupabaseEnv();
  return createSupabaseClient(url, anon);
};

let browserClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient {
  if (!browserClient) browserClient = createClient();
  return browserClient;
}

/** Lazy so prerender can import this module without NEXT_PUBLIC_* inlined yet. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getBrowserClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") return value.bind(client);
    return value;
  },
});
