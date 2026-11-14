import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const themeRoot = path.resolve(here, "..");
const repoRoot = path.resolve(themeRoot, "..");

const envFiles = [
  path.join(themeRoot, ".env.local"),
  path.join(themeRoot, ".env"),
  path.join(themeRoot, ".env.production.local"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env.production.local"),
  path.join(repoRoot, ".env.vercel.production.pull"),
  path.join(repoRoot, ".env.vercel.production.new.pull"),
  path.join(repoRoot, ".env"),
];

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim().replace(/^\uFEFF/, "");
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && value) result[key] = value;
  }
  return result;
}

const env = {};
for (const file of envFiles) {
  const parsed = parseEnv(file);
  for (const [key, value] of Object.entries(parsed)) {
    if (value) env[key] = value;
  }
}

const url = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  env.SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).trim();
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY ||
  ""
).trim();

if (!url || !serviceKey) {
  console.error("MISSING_ENV", { hasUrl: Boolean(url), hasKey: Boolean(serviceKey) });
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tenantSlug = "rewaq";
const email = "rewaqresident@gmail.com";
const password = process.env.REWAQ_ADMIN_PASSWORD || "Aa#321321";
const phone = "0541303411";
const businessName = "Rewaq Resident | رواق ريزدنت";
const configData = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "tenants", "rewaq.json"), "utf8"));

const { data: usersData, error: usersErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (usersErr) throw usersErr;

const existing = (usersData.users || []).find((u) => (u.email || "").toLowerCase() === email);
let userId;
if (existing) {
  userId = existing.id;
  const { error } = await sb.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    user_metadata: { businessName, phone, tenantSlug },
  });
  if (error) console.warn("auth update:", error.message);
  console.log("AUTH_EXISTING", userId);
} else {
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { businessName, phone, tenantSlug },
  });
  if (error || !created?.user) throw error || new Error("createUser failed");
  userId = created.user.id;
  console.log("AUTH_CREATED", userId);
}

const freeSubEnd = new Date();
freeSubEnd.setFullYear(freeSubEnd.getFullYear() + 10);

const { data: clientRecord, error: upsertErr } = await sb
  .from("mken_saas_clients")
  .upsert(
    {
      tenant_slug: tenantSlug,
      owner_id: userId,
      business_name: businessName,
      email,
      phone,
      subscription_status: "active",
      subscription_end: freeSubEnd.toISOString(),
      config_data: configData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_slug" }
  )
  .select("tenant_slug,email,phone,owner_id,business_name")
  .single();

if (upsertErr) throw upsertErr;
console.log("CLIENT", JSON.stringify(clientRecord));

const { data: staff } = await sb
  .from("mken_staff")
  .select("id")
  .eq("tenant_slug", tenantSlug)
  .eq("email", email)
  .maybeSingle();

if (!staff) {
  const { error: staffErr } = await sb.from("mken_staff").insert({
    tenant_slug: tenantSlug,
    name: "مدير رواق ريزدنت",
    phone,
    email,
    role: "admin",
    pin_code: "321321",
    status: "active",
  });
  if (staffErr) console.warn("staff:", staffErr.message);
  else console.log("STAFF_CREATED");
} else {
  console.log("STAFF_EXISTING");
}
