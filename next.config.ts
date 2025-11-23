import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent Next.js from bundling these server-side libraries
  serverExternalPackages: ["imapflow", "pino", "mailparser", "jsdom"],
};

export default nextConfig;
