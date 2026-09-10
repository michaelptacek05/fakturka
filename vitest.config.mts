import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Integrační testy mají vlastní konfiguraci a potřebují databázi,
    // proto do jednotkového běhu nepatří.
    exclude: ["tests/integration/**"],
    include: ["tests/**/*.test.ts"],
  },
});
