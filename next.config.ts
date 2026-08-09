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
    ];
  },
};

export default nextConfig;
