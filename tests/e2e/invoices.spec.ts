import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { Pool } from "pg";
import { readSpaydField } from "../qr-decode";

const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function invoiceCount() {
  return Number((await db.query('SELECT count(*) FROM "Invoice"')).rows[0].count);
}

async function readInvoice(id?: string) {
  const { rows } = await db.query('SELECT * FROM "Invoice" WHERE ($1::text IS NULL OR id = $1) ORDER BY "createdAt" LIMIT 1', [id ?? null]);
  if (!rows[0]) throw new Error("Testovací faktura nebyla nalezena.");
  return rows[0];
}

async function readItem(invoiceId: string) {
  return (await db.query('SELECT * FROM "InvoiceItem" WHERE "invoiceId" = $1 ORDER BY position', [invoiceId])).rows[0];
}

test.beforeEach(async () => {
  // Druhá pojistka před destruktivním resetem, nezávisle na konfiguraci runneru.
  if (!/^\/fakturka_e2e_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL ?? "").pathname)) {
    throw new Error("Reset je povolen jen v databázi vytvořené E2E runnerem.");
  }
  await db.query('TRUNCATE "UserProfile" CASCADE');
  await db.query(`INSERT INTO "UserProfile"
    (id, "displayName", street, city, "postalCode", ico, "accountNumber", "bankCode", "updatedAt")
    VALUES ('test-profile', 'Testovací OSVČ', 'Testovací 1', 'Praha', '11000', '00000019', '2000145399', '0800', CURRENT_TIMESTAMP)`);
});
test.afterAll(async () => { await db.end(); });

async function signIn(page: Page) {
  await page.goto("/invoices/new");
  await expect(page).toHaveURL(/\/login/);
  await page.locator('[name="password"]').fill("e2e-only-password");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/new$/);
}

async function fillInvoice(page: Page, quantity: string, unitPrice: string) {
  for (const [key, value] of Object.entries({
    clientName: "E2E odběratel", clientStreet: "Testovací 1", clientCity: "Praha",
    clientPostalCode: "11000", itemName: "Přesná konzultace", quantity, unitPrice,
  })) await page.locator(`[name="${key}"]`).fill(value);
}

async function submitInvoice(page: Page) {
  await page.getByRole("button", { name: "Vystavit fakturu", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\/(?!new$)[^/?]+$/);
  return page.url().split("/").at(-1)!;
}

function decodePng(data: Buffer) {
  const png = PNG.sync.read(data);
  const payload = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  expect(payload, "Skutečně vykreslený QR musí být čitelný").toBeTruthy();
  return payload!;
}

test("přihlášení chrání doklady, export, PDF, assety i přímé odeslání akce", async ({ page, request }) => {
  for (const url of ["/invoices", "/invoices/export?ids=test", "/invoices/test/pdf", "/invoice-assets/test"]) {
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/login");
  }
  await page.goto("/login");
  await page.locator('[name="password"]').fill("nesprávné heslo");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page).toHaveURL(/error=invalid/);
  await signIn(page);
  const html = await (await page.request.get("/invoices/new")).text();
  const actionName = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, "text/html");
    const form = document.querySelector<HTMLInputElement>('input[name="itemName"]')?.form;
    return form?.querySelector<HTMLInputElement>('input[name^="$ACTION_ID_"]')?.name;
  }, html);
  expect(actionName).toBeTruthy();
  const response = await request.post("/invoices/new", {
    multipart: {
      [actionName!]: "", clientName: "E2E odběratel", clientStreet: "Testovací 1",
      clientCity: "Praha", clientPostalCode: "11000", itemName: "Test ochrany",
      quantity: "1", unitPrice: "100",
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
  expect(await invoiceCount()).toBe(0);
});

test("náhled, uložení, editace a PDF zachovají přesné množství a stejné částky", async ({ page }, info) => {
  await signIn(page);
  await fillInvoice(page, "0,5", "0,29");
  await expect(page.getByText(/Řádek celkem:/)).toContainText("0,15");
  const id = await submitInvoice(page);
  expect((await readInvoice(id)).total.toString()).toBe("0.15");
  await page.goto(`/invoices/${id}/edit`);
  await page.locator('[name="quantity"]').fill("1,234567891");
  await page.locator('[name="unitPrice"]').fill("1000");
  await expect(page.getByText(/Řádek celkem:/)).toContainText(/1\s234,57/);
  await page.getByRole("button", { name: "Uložit změny", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}\\?saved=1$`));
  await expect(page.getByRole("region", { name: "Položky faktury" })).toContainText("1,234567891");
  const item = await readItem(id);
  expect(item.quantity.toString()).toBe("1.234567891");
  expect(item.lineTotal.toString()).toBe("1234.57");
  const pdf = await page.request.get(`/invoices/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  const file = info.outputPath("precision.pdf");
  fs.writeFileSync(file, await pdf.body());
  const text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  expect(text.replace(/\s/g, "")).toContain("1,234567891");

  // Celých 18 číslic může přesáhnout šířku sloupce. Další řádek musí zůstat čitelný.
  await page.goto(`/invoices/${id}/edit`);
  await page.getByRole("button", { name: "Přidat položku", exact: true }).click();
  await page.locator('[name="itemName"]').nth(1).fill("Dlouhé přesné množství");
  await page.locator('[name="quantity"]').nth(1).fill("123456789,123456789");
  await page.locator('[name="unitPrice"]').nth(1).fill("0,01");
  await page.getByRole("button", { name: "Uložit změny", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${id}\\?saved=1$`));
  const longPdf = await page.request.get(`/invoices/${id}/pdf`);
  expect(longPdf.status()).toBe(200);
  const longFile = info.outputPath("precision-long.pdf");
  fs.writeFileSync(longFile, await longPdf.body());
  // Pořadí obsahového streamu zachová zalomené množství pohromadě;
  // layout extrakce může mezi jeho dva řádky vložit sousední ceny.
  const longText = execFileSync("pdftotext", ["-raw", longFile, "-"], { encoding: "utf8" });
  expect(longText.replace(/\s/g, "")).toContain("123456789,123456789");
  expect(longText.replace(/\s/g, "")).toContain("1235802,46");
  execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1400", "-png", longFile, info.outputPath("precision-long")]);
});

test("částečná úhrada nastaví doplatek v reálném webovém i PDF QR a doplacení QR odstraní", async ({ page }, info) => {
  await signIn(page);
  await fillInvoice(page, "1", "10000");
  const id = await submitInvoice(page);
  await page.locator('[name="amount"]').fill("4000");
  await page.getByRole("button", { name: "Zaevidovat úhradu", exact: true }).click();
  await expect(page).toHaveURL(/payment=added/);
  const src = await page.getByRole("img", { name: "QR platba", exact: true }).getAttribute("src");
  const webPayload = decodePng(Buffer.from(src!.split(",")[1], "base64"));
  expect(readSpaydField(webPayload, "AM")).toBe("6000.00");
  expect(readSpaydField(webPayload, "ACC")).toBe("CZ7908000000002000145399");
  const invoice = await readInvoice(id);
  expect(readSpaydField(webPayload, "X-VS")).toBe(invoice.variableSymbol);
  const pdf = await page.request.get(`/invoices/${id}/pdf`);
  expect(pdf.status()).toBe(200);
  const file = info.outputPath("partial.pdf");
  fs.writeFileSync(file, await pdf.body());
  const prefix = info.outputPath("partial");
  execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-scale-to", "1800", "-png", file, prefix]);
  const pdfPayload = decodePng(fs.readFileSync(`${prefix}.png`));
  expect(readSpaydField(pdfPayload, "AM")).toBe("6000.00");
  expect(readSpaydField(pdfPayload, "ACC")).toBe(readSpaydField(webPayload, "ACC"));
  expect(readSpaydField(pdfPayload, "X-VS")).toBe(invoice.variableSymbol);
  await page.getByRole("button", { name: "Označit jako zaplacené", exact: true }).click();
  await expect(page).toHaveURL(/paid=1/);
  await expect(page.getByRole("img", { name: "QR platba", exact: true })).toHaveCount(0);
  const paid = await readInvoice(id);
  const payments = (await db.query('SELECT amount FROM "InvoicePayment" WHERE "invoiceId" = $1', [id])).rows;
  expect(paid.status).toBe("PAID");
  expect(payments.map((payment) => Number(payment.amount).toString()).sort()).toEqual(["4000", "6000"]);
});

test("CSV náhled nic nezapíše, potvrzení zachová přesnost a opakovaný import nevytvoří duplicitu", async ({ page }) => {
  await signIn(page);
  const csv = "number;client_name;issued_on;lines__line__name;lines__line__quantity;lines__line__unit_price\n" +
    "E2E-IMPORT;E2E odběratel;2026-10-11;Importovaná práce;1,234567891;1000\n";
  async function preview() {
    await page.goto("/import");
    await page.locator('input[type="file"]').last().setInputFiles({ name: "invoices.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByRole("button", { name: "Importovat 1", exact: true })).toBeEnabled();
  }
  await preview();
  expect(await invoiceCount()).toBe(0);
  await page.getByRole("button", { name: "Importovat 1", exact: true }).click();
  await expect(page).toHaveURL(/invoicesCreated=1/);
  const invoice = await readInvoice();
  const item = await readItem(invoice.id);
  expect(invoice.number).toBe("E2E-IMPORT");
  expect(item.quantity.toString()).toBe("1.234567891");
  expect(invoice.total.toString()).toBe("1234.57");
  await preview();
  await page.getByRole("button", { name: "Importovat 1", exact: true }).click();
  await expect(page).toHaveURL(/invoicesCreated=0&invoicesSkipped=1/);
  expect(await invoiceCount()).toBe(1);
});
