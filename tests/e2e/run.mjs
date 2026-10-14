import { randomUUID } from "node:crypto";
import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Client } from "pg";

// Záměrně nečteme .env. Běh vyžaduje explicitní disposable lokální instanci.
if (!process.env.DATABASE_URL) throw new Error("E2E potřebuje DATABASE_URL jednorázového PostgreSQL.");
const source = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost", "[::1]"].includes(source.hostname)) {
  throw new Error("E2E lze spouštět pouze nad jednorázovým lokálním PostgreSQL.");
}

const databaseName = `fakturka_e2e_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(source);
adminUrl.pathname = "/postgres";
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl.toString() });
const env = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  AUTH_PASSWORD: "e2e-only-password",
  AUTH_SECRET: "e2e-only-secret",
  TZ: "UTC",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.TEST_DATABASE_URL;
let created = false;

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const migrate = spawnSync("npm", ["run", "prisma:deploy"], { env, stdio: "inherit" });
  if (migrate.error) throw migrate.error;
  if (migrate.status !== 0) process.exitCode = migrate.status ?? 1;
  else {
    // Stejné rozložení souborů, jaké připravuje runner image v Dockerfile.
    cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
    if (existsSync("public")) cpSync("public", ".next/standalone/public", { recursive: true });
    const tests = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], { env, stdio: "inherit" });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  }
} finally {
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
