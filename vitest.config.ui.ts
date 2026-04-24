import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    // Next.js new JSX transform — React import gerekmez
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/setup-ui.ts"],
    globals: true,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
