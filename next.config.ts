import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboarc/:path*",
        destination: "/dashboard/:path*",
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
