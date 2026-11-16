/** Browser-safe Supabase config. Never read service-role keys here. */

const PLACEHOLDER = {
  url: "https://mock-project-id.supabase.co",
  anon: "mock-anon-key",
} as const;

function missingEnvFallback(): { url: string; anon: string } | null {
  // Preview / local / build-time: keep `next build` alive when secrets are unset.
  // Production runtime without env still fails closed below.
  if (process.env.NODE_ENV !== "production") return { ...PLACEHOLDER };
  if (process.env.VERCEL_ENV === "preview") return { ...PLACEHOLDER };
  if (process.env.NEXT_PHASE === "phase-production-build") return { ...PLACEHOLDER };
  if (process.env.npm_lifecycle_event === "build") return { ...PLACEHOLDER };
  return null;
}

export function publicSupabaseEnv(): { url: string; anon: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (url && anon) return { url, anon };
  return missingEnvFallback();
}

export function requirePublicSupabaseEnv(): { url: string; anon: string } {
  const env = publicSupabaseEnv();
  if (!env) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  return env;
}
