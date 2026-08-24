// Shared CORS for Mken Trust Edge Functions (*.mken.live + localhost)
export const TRUSTED_ORIGIN_RE =
  /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/([a-z0-9-]+\.)*mken\.(live|app|com))$/i;

export function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") ?? "";
  if (origin && TRUSTED_ORIGIN_RE.test(origin)) return origin;
  return "https://mken.live";
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = resolveCorsOrigin(req);
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-turnstile-token, x-mken-tenant",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
      ...extraHeaders,
    },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
