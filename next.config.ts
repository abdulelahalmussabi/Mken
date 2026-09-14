import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
loadEnvConfig(projectRoot);

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || "";
const supabaseAnon =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_KEY?.trim() ||
  "";

if (supabaseUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
if (supabaseAnon) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnon;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnon,
  },
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/staff.html",
        destination: "/staff/login",
        permanent: true,
      },
      {
        source: "/dashboarc/:path*",
        destination: "/dashboard/:path*",
        permanent: true,
      },
      {
        source: "/themes",
        destination: "/",
        permanent: true,
      },
      {
        source: "/dashboard/theme",
        destination: "/dashboard/themes",
        permanent: true,
      },
      {
        source: "/signup.html",
        destination: "/register",
        permanent: false,
      },
      {
        source: "/track.html",
        destination: "/track",
        permanent: false,
      },
      {
        source: "/order.html",
        destination: "/order",
        permanent: false,
      },
      {
        source: "/legal-portal.html",
        destination: "/book?activity=legal",
        permanent: false,
      },
      {
        source: "/football-coaching.html",
        destination: "/book?activity=football",
        permanent: false,
      },
      {
        source: "/coaching.html",
        destination: "/book?activity=hockey",
        permanent: false,
      },
      {
        source: "/pricing.html",
        destination: "/license",
        permanent: false,
      },
      {
        source: "/license-success.html",
        destination: "/license/success",
        permanent: false,
      },
      {
        source: "/admin.html",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/almahrusa",
        destination: "/subscriber/almahrusa",
        permanent: true,
      },
      {
        source: "/rewaq",
        destination: "/subscriber/rewaq",
        permanent: true,
      },
      {
        source: "/demo",
        destination: "/subscriber/demo",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/api/brand-icon",
      },
      {
        source: "/book.html",
        destination: "/book",
      },
      {
        source: "/api/v1/push-subscribe",
        destination: "/api/v1/push?action=subscribe",
      },
      {
        source: "/api/v1/push-notify",
        destination: "/api/v1/push?action=notify",
      },
      {
        source: "/api/v1/push-test",
        destination: "/api/v1/push?action=test",
      },
    ];
  },
};

export default nextConfig;
