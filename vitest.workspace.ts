import { defineWorkspace } from "vitest/config";
import path from "node:path";

// IA-35 — vitest workspace. Tek `npm test` komutu hem node-env
// integration testlerini (`tests/**/*.test.ts`) hem jsdom-env UI
// testlerini (`tests/**/*.test.tsx`) koşar.
//
// Eski kurulum default `npm test` sadece `.test.ts` çalıştırıyordu;
// `.test.tsx` UI suite atlanıyordu (developer/CI regression
// yakalayamıyordu). Yeni: workspace iki project tanımlar, tek komut
// her ikisini de paralel koşar.
//
// `npm run test:ui` ve `npm run test:all` script'leri geriye dönük
// uyumluluk için korunur; ama default `npm test` her durumda
// kapsamlı koşar.

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "node",
      environment: "node",
      include: ["tests/**/*.test.ts"],
      setupFiles: ["tests/setup-integration.ts"],
    },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  },
  {
    extends: "./vitest.config.ui.ts",
    test: {
      name: "ui",
      environment: "jsdom",
      include: ["tests/unit/**/*.test.tsx"],
      setupFiles: ["tests/setup-ui.ts"],
      globals: true,
    },
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  },
]);
