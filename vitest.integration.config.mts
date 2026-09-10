import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integrační testy potřebují běžící PostgreSQL a mají vlastní konfiguraci,
 * aby `npm test` zůstal čistě jednotkový a spustitelný bez databáze.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Testy sahají na stejné doklady, souběh by je rozhodil.
    fileParallelism: false,
    globalSetup: ["tests/integration/global-setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 20_000,
  },
});
