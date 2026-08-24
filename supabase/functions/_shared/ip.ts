/** Trusted client IP extraction — ignore spoofable X-Forwarded-For */

export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf && isPlausibleIp(cf)) return cf;

  // Vercel edge when proxied through mken.live BFF
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel && isPlausibleIp(vercel)) return vercel;

  // Supabase may expose fly-client-ip on some runtimes
  const fly = req.headers.get("fly-client-ip")?.trim();
  if (fly && isPlausibleIp(fly)) return fly;

  return "0.0.0.0";
}

function isPlausibleIp(ip: string): boolean {
  // IPv4
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((o) => {
      const n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  // coarse IPv6
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) return true;
  return false;
}

/** IPv4 /24 or IPv6 /64 string for drift detection */
export function ipSubnet(ip: string): string {
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length !== 4) return "unknown";
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(":")) {
    const expanded = expandIpv6(ip);
    const groups = expanded.split(":");
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return "unknown";
}

function expandIpv6(ip: string): string {
  const halves = ip.split("::");
  if (halves.length === 1) {
    return ip.split(":").map((g) => g.padStart(4, "0")).join(":");
  }
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const mid = Array(Math.max(missing, 0)).fill("0000");
  return [...left, ...mid, ...right].map((g) => g.padStart(4, "0")).join(":");
}
