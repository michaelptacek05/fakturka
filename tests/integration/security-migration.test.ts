import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { expect, it } from "vitest";

it("bezpečnostní migrace zachová existující profil, číslování, doklad, položky i platby", async () => {
  const source = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) || !source.pathname.endsWith("_test")) {
    throw new Error("Test migrace vyžaduje lokální testovací databázi.");
  }
  const name = `fakturka_migration_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(source); adminUrl.pathname = "/postgres";
  const testUrl = new URL(source); testUrl.pathname = `/${name}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  const db = new Client({ connectionString: testUrl.toString() });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await db.connect();
    const root = new URL("../../prisma/migrations/", import.meta.url);
    const securityMigration = "20261101120000_auth_sessions_and_throttle";
    for (const dir of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && entry.name < securityMigration).sort((a, b) => a.name.localeCompare(b.name))) {
      await db.query(await readFile(new URL(`${dir.name}/migration.sql`, root), "utf8"));
    }
    await db.query(`
      INSERT INTO "UserProfile" (id,"displayName",street,city,"postalCode",ico,"accountNumber","bankCode","updatedAt")
      VALUES ('profile','Existující OSVČ','Test 1','Praha','11000','00000019','2000145399','0800',now());
      INSERT INTO "Client" (id,"profileId","companyName",street,city,"postalCode","updatedAt")
      VALUES ('client','profile','Původní odběratel','Test 2','Brno','60200',now());
      INSERT INTO "InvoiceSequence" (id,"profileId","nextNumber","periodKey","updatedAt") VALUES ('sequence','profile',42,'202610',now());
      INSERT INTO "Invoice" (id,"profileId","clientId","sequenceId",number,"variableSymbol",status,"issueDate","dueDate",total,"paidAmount","paidAt","clientName","updatedAt")
      VALUES ('invoice','profile','client','sequence','202610041','202610041','PAID','2026-10-01','2026-10-15',100,100,'2026-10-10','Zamrzlý odběratel',now());
      INSERT INTO "InvoiceItem" (id,"invoiceId",position,name,quantity,"unitPrice","lineSubtotal","lineTotal")
      VALUES ('item','invoice',1,'Existující práce',1.234567891,81,100,100);
      INSERT INTO "InvoicePayment" (id,"invoiceId",amount,"paidOn") VALUES ('payment','invoice',100,'2026-10-10');
    `);
    const tables = ["UserProfile", "Client", "InvoiceSequence", "Invoice", "InvoiceItem", "InvoicePayment"];
    async function snapshot() {
      return Promise.all(tables.map(async (table) => (await db.query(`SELECT row_to_json(t) AS value FROM "${table}" AS t ORDER BY id`)).rows));
    }
    const before = await snapshot();
    await db.query(await readFile(new URL(`${securityMigration}/migration.sql`, root), "utf8"));
    expect(await snapshot()).toEqual(before);
    expect((await db.query('SELECT count(*) FROM "AuthSession"')).rows[0].count).toBe("0");
    expect((await db.query('SELECT count(*) FROM "LoginThrottle"')).rows[0].count).toBe("0");
  } finally {
    await db.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
});
