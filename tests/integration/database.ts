import { execFileSync } from "node:child_process";

import { Client } from "pg";

/**
 * Integrační testy běží proti vlastní databázi, ne proti vývojové — mažou
 * a zakládají doklady, což by lokální data rozházelo. URL se odvozuje
 * z `DATABASE_URL`, takže stačí mít spuštěnou obvyklou vývojovou databázi.
 */
export function getTestDatabaseUrl() {
  const explicit = process.env.TEST_DATABASE_URL;

  if (explicit) {
    return explicit;
  }

  const source = process.env.DATABASE_URL;

  if (!source) {
    throw new Error(
      "Integrační testy potřebují DATABASE_URL (nebo TEST_DATABASE_URL).",
    );
  }

  const url = new URL(source);
  url.pathname = `/${getDatabaseName(source)}`;

  return url.toString();
}

export function getDatabaseName(source: string) {
  return `${new URL(source).pathname.replace(/^\//, "") || "fakturka"}_test`;
}

/** Založí testovací databázi, pokud ještě není, a dotáhne na ni migrace. */
export async function prepareTestDatabase() {
  const source = process.env.DATABASE_URL;

  if (!source) {
    throw new Error("Integrační testy potřebují DATABASE_URL.");
  }

  const databaseName = getDatabaseName(source);
  const adminUrl = new URL(source);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();

  try {
    const existing = await admin.query(
      "select 1 from pg_database where datname = $1",
      [databaseName],
    );

    if (existing.rowCount === 0) {
      // Název pochází z DATABASE_URL, ne od uživatele, ale identifikátor
      // se stejně nedá parametrizovat — proto aspoň uvozovky.
      await admin.query(`create database "${databaseName}"`);
    }
  } finally {
    await admin.end();
  }

  const testUrl = getTestDatabaseUrl();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe",
  });

  return testUrl;
}
