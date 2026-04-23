import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "drive.google.com",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    optimizePackageImports: ["@prisma/client", "lucide-react"],
  },

  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
