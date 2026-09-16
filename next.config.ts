import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "serialport", "ssh2"],
};

export default nextConfig;
