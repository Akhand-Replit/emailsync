import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    serverExternalPackages: ["imapflow", "pino", "mailparser"],
};

// export default pwaConfig(nextConfig);
export default nextConfig;
