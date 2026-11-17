import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database driver and job queue run only on the server.
  serverExternalPackages: ["postgres", "pg-boss"],
};

export default nextConfig;
