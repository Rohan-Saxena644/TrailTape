import type { NextConfig } from "next";
const config: NextConfig = {
  // The provider's 45-second retry budget must finish before the proxy deadline.
  experimental: { proxyTimeout: 50000 },
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/:path*",
            destination: `http://127.0.0.1:${process.env.API_PORT || "3001"}/api/:path*`,
          },
        ]
      : [];
  },
};
export default config;
