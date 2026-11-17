import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(projectRoot, "..");
const require = createRequire(import.meta.url);
const { PAGE_REWRITES, buildApiRewrites } = require("./src/server/platform/public-routes.cjs") as {
  PAGE_REWRITES: { source: string; destination: string }[];
  buildApiRewrites: () => { source: string; destination: string }[];
};

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/api/v1/queue/[[...extra]]": ["../db/migrations/**/*.sql"],
    "/api/platform/[[...path]]": ["../db/migrations/**/*.sql"],
  },
  serverExternalPackages: ["pg", "web-push"],
  turbopack: {
    root: repoRoot,
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
      {
        source: "/googleae07a7b850e5250d.html",
        headers: [
          { key: "Content-Type", value: "text/html; charset=utf-8" },
          { key: "X-Robots-Tag", value: "noindex" },
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
        source: "/book.html",
        destination: "/book",
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
        source: "/googleae07a7b850e5250d.html",
        destination: "/api/google-site-verification",
      },
      {
        source: "/googleae07a7b850e5250d",
        destination: "/api/google-site-verification",
      },
      {
        source: "/book.html",
        destination: "/book",
      },
      ...PAGE_REWRITES,
      ...buildApiRewrites(),
    ];
  },
};

export default nextConfig;
