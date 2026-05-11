/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    // Enable instrumentation.ts hook so BullMQ workers and chokidar watcher
    // start automatically when the app boots — no separate `npm run worker`.
    instrumentationHook: true,
  },
  // chokidar / fsevents are native Node.js modules. serverExternalPackages
  // prevents webpack from bundling them so Node.js resolves them at runtime.
  // Required for instrumentation.ts to import watcher.ts safely.
  serverExternalPackages: ["chokidar", "fsevents"],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
