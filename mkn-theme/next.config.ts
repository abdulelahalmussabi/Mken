import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
        source: "/book.html",
        destination: "/book",
        permanent: true,
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
        source: "/book.html",
        destination: "/book",
      },
    ];
  },
};

export default nextConfig;
