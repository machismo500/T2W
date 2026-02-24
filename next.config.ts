import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/T2W",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
