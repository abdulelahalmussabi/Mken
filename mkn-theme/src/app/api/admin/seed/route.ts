import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const seedBuckets = new Map<string, { windowStart: number; count: number }>();

function secretsEqual(a: string, b: string): boolean {
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function seedLimited(ip: string, increment: boolean): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowMs = 60_000;
  let bucket = seedBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    if (!increment) return { limited: false, retryAfterSec: 0 };
    bucket = { windowStart: now, count: 0 };
  }
  if (bucket.count >= 5) {
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - bucket.windowStart)) / 1000));
    return { limited: true, retryAfterSec };
  }
  if (increment) {
    bucket.count += 1;
    seedBuckets.set(ip, bucket);
  }
  return { limited: false, retryAfterSec: 0 };
}

/** Disabled unless SEED_ADMIN_SECRET and SEED_ADMIN_PASSWORD are set. */
function authorizeSeed(request: Request): string | null {
  const secret = process.env.SEED_ADMIN_SECRET || "";
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const presented = request.headers.get("x-seed-secret") || "";
  const configured = secret.length >= 16 && password.length >= 12;
  const matches = presented.length > 0 && secret.length > 0 && secretsEqual(presented, secret);
  if (!configured || !matches) return null;
  return password;
}

export async function GET(request: Request) {
  return handleSeed(request);
}

export async function POST(request: Request) {
  return handleSeed(request);
}

async function handleSeed(request: Request) {
  const ip = clientIp(request);
  const blocked = seedLimited(ip, false);
  if (blocked.limited) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 429, headers: { "Retry-After": String(blocked.retryAfterSec) } }
    );
  }

  const defaultPassword = authorizeSeed(request);
  if (!defaultPassword) {
    seedLimited(ip, true);
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const serviceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ""
    ).trim();

    if (!url || !serviceKey) {
      return NextResponse.json(
        { success: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server" },
        { status: 500 }
      );
    }

    const sb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const accounts = [
      { email: "admin@mken.live", slug: "admin", name: "الإدارة العامة (Super Admin)" },
      { email: "almahrusa@mken.live", slug: "almahrusa", name: "مجموعة المحروسة" },
      { email: "almahrosa@mken.live", slug: "almahrosa", name: "مجموعة المحروسة" },
      { email: "almasabi@mken.live", slug: "almasabi", name: "مؤسسة المصعبي للتجارة" },
      { email: "rewa@mken.live", slug: "rewa", name: "منتجع رواء الاستشفاء الرقمي" },
      { email: "rewaqresident@gmail.com", slug: "rewaq", name: "Rewaq Resident | رواق ريزدنت" },
      { email: "demo@mken.live", slug: "demo", name: "صالون النخبة" },
    ];

    const { data: usersData, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      return NextResponse.json({ success: false, error: listErr.message }, { status: 500 });
    }

    const usersList = usersData.users || [];
    const results = [];

    for (const acc of accounts) {
      let userId: string;
      const existingUser = usersList.find((u) => {
        const e = (u.email || "").toLowerCase();
        return e === acc.email.toLowerCase() || (acc.slug === "admin" && e === "admin@mkem.live");
      });

      if (existingUser) {
        userId = existingUser.id;
        const { error: updErr } = await sb.auth.admin.updateUserById(userId, {
          email: acc.email,
          password: defaultPassword,
          email_confirm: true,
        });
        if (updErr) {
          console.error(`Failed to update Auth for ${acc.email}:`, updErr.message);
        }
      } else {
        const { data: newAuth, error: createErr } = await sb.auth.admin.createUser({
          email: acc.email,
          password: defaultPassword,
          email_confirm: true,
        });
        if (createErr || !newAuth.user) {
          console.error(`Failed to create Auth for ${acc.email}:`, createErr?.message);
          continue;
        }
        userId = newAuth.user.id;
      }

      const { data: existingClient } = await sb
        .from("mken_saas_clients")
        .select("id")
        .eq("tenant_slug", acc.slug)
        .maybeSingle();

      const oneYear = new Date();
      oneYear.setFullYear(oneYear.getFullYear() + 10);

      if (existingClient) {
        await sb
          .from("mken_saas_clients")
          .update({
            owner_id: userId,
            email: acc.email,
            business_name: acc.name,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_slug", acc.slug);
      } else {
        await sb.from("mken_saas_clients").insert({
          tenant_slug: acc.slug,
          owner_id: userId,
          business_name: acc.name,
          email: acc.email,
          phone: "966543530333",
          subscription_end: oneYear.toISOString(),
          config_data: { brand: { name: acc.name } },
          subscription_status: "active",
        });
      }

      results.push({ email: acc.email, slug: acc.slug, uuid: userId });
    }

    return NextResponse.json({
      success: true,
      message: "🎉 All 4 admin accounts have been seeded in Supabase Auth & mken_saas_clients!",
      accounts: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
