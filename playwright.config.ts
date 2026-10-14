import { defineConfig, devices } from "@playwright/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !/^\/fakturka_e2e_[a-f0-9]{32}$/.test(new URL(databaseUrl).pathname)) {
  throw new Error("E2E spouštějte přes npm run test:e2e, které vytvoří izolovanou databázi.");
}
const port = Number(process.env.E2E_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Neplatný E2E_PORT.");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: "node .next/standalone/server.js",
    env: { PORT: String(port), HOSTNAME: "127.0.0.1" },
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
