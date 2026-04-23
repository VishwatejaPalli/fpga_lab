import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Required for native modules (better-sqlite3, serialport)
  serverExternalPackages: [
    "better-sqlite3",
    "serialport",
    "@serialport/parser-readline",
    "@serialport/bindings-cpp",
  ],
  // Disable image optimization (not needed for this project)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
