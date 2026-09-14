/** Browser-safe Supabase config. Never read service-role keys here. */

export function publicSupabaseEnv(): { url: string; anon: string } | null {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  ).trim();
  const anon = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim();
  if (url && anon) return { url, anon };
  if (process.env.NODE_ENV === "production") return null;
  return {
    url: "https://mock-project-id.supabase.co",
    anon: "mock-anon-key",
  };
}

export function requirePublicSupabaseEnv(): { url: string; anon: string } {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  return env;
}
