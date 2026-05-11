import { defineConfig } from "vitest/config";
import path from "node:path";

// IA-35 — node project config. `vitest.workspace.ts` bu dosyayı
// `extends` ile node-env integration testleri için kullanır;
// `vitest.config.ui.ts` ayrı jsdom-env config'i taşır. Tek
// `npm test` komutu vitest.workspace.ts üzerinden ikisini de koşar.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-integration.ts"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
