import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePublicSupabaseEnv } from "@/lib/supabase/public-env";

export const createClient = () => {
  const { url, anon } = requirePublicSupabaseEnv();
  return createSupabaseClient(url, anon);
};

export const supabase = createClient();
