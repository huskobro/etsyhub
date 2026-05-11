/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // chokidar / fsevents are native Node.js modules used only in the
  // worker process (scripts/dev-worker.ts). They must not be bundled
  // by Next.js webpack; exclude them from server-side bundling so
  // Next.js resolves them at runtime via require() instead.
  serverExternalPackages: ["chokidar", "fsevents"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
