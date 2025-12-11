import type { NextConfig } from "next";
// import withPWA from "@ducanh2912/next-pwa";

// const pwaConfig = withPWA({
//   dest: "public",
//   cacheOnFrontEndNav: true,
//   aggressiveFrontEndNavCaching: true,
//   reloadOnOnline: true,
//   swcMinify: true,
//   disable: process.env.NODE_ENV === "development",
//   workboxOptions: {
//     disableDevLogs: true,
//   },
// });

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent Next.js from bundling these server-side libraries
  serverExternalPackages: ["imapflow", "pino", "mailparser"],
};

// export default pwaConfig(nextConfig);
export default nextConfig;
