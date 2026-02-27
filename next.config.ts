import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/T2W",
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
