/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
    // Enable instrumentation.ts hook so BullMQ workers and chokidar watcher
    // start automatically when the app boots — no separate `npm run worker`.
    instrumentationHook: true,
    // Native Node.js modules that webpack must not bundle — resolved at runtime.
    // chokidar/fsevents: file watcher. @imgly/background-removal-node + sharp:
    // native binary in selection worker.
    serverComponentsExternalPackages: [
      "chokidar",
      "fsevents",
      "@imgly/background-removal-node",
      "sharp",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**" },
    ],
  },
  webpack(config, { isServer }) {
    // Native/server-only packages that webpack must not bundle. On the server
    // side these are resolved by Node.js at runtime (serverComponentsExternalPackages
    // handles this for SC code but not for the instrumentation bundle). Adding
    // them to config.externals here covers the instrumentation + worker chains.
    // On the client side they simply don't exist — external("commonjs x") causes
    // a runtime no-op when the browser tries to require them (they're never used).
    const serverOnlyPackages = [
      "@imgly/background-removal-node",
      "chokidar",
      "fsevents",
      "bullmq",
      "ioredis",
      "archiver",
      "archiver-utils",
      "sharp",
      "@img/sharp-libvips-dev",
      "@img/sharp-wasm32",
      "detect-libc",
      "apify-client",
      "@apify/utilities",
      "@apify/timeout",
      "apify",
    ];
    if (isServer) {
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals != null ? [config.externals] : [];
      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          // Externalize node: built-in scheme (node:fs, node:path, node:child_process, etc.)
          if (request && request.startsWith("node:")) {
            return callback(null, `commonjs ${request}`);
          }
          if (request && serverOnlyPackages.some(p => request === p || request.startsWith(p + "/"))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    // Prevent webpack from trying to polyfill Node.js built-ins on the client.
    // These modules are server-only and should never reach the browser bundle.
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        crypto: false,
        fs: false,
        path: false,
        os: false,
        child_process: false,
        net: false,
        tls: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        util: false,
        assert: false,
        url: false,
        buffer: false,
        events: false,
        querystring: false,
        string_decoder: false,
        punycode: false,
        domain: false,
        timers: false,
        vm: false,
        readline: false,
        repl: false,
        inspector: false,
        cluster: false,
        dgram: false,
        dns: false,
        http2: false,
        module: false,
        perf_hooks: false,
        process: false,
        v8: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
