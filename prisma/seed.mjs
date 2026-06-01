import "dotenv/config";
import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required for prisma:seed.");
  process.exit(1);
}

const db = new Client({ connectionString });
const now = new Date();

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function toDecimal(value) {
  return value.toFixed(2);
}

async function upsertProfile() {
  await db.query(
    `
      insert into "UserProfile" (
        id, "displayName", "companyName", street, city, "postalCode", country,
        ico, dic, "registryText", "vatPayerStatus", "accountNumber", "bankCode",
        iban, swift, "createdAt", "updatedAt"
      )
      values (
        'demo-profile', 'Demo OSVČ', 'Demo IT služby', 'Ukázková 12',
        'Praha', '11000', 'Česká republika', '00000019', 'CZ00000019',
        'OSVČ zapsaná v živnostenském rejstříku', 'NON_PAYER',
        '2000145399', '0800', null, 'GIBACZPX', $1, $1
      )
      on conflict (id) do update set
        "displayName" = excluded."displayName",
        "companyName" = excluded."companyName",
        street = excluded.street,
        city = excluded.city,
        "postalCode" = excluded."postalCode",
        country = excluded.country,
        ico = excluded.ico,
        dic = excluded.dic,
        "registryText" = excluded."registryText",
        "vatPayerStatus" = excluded."vatPayerStatus",
        "accountNumber" = excluded."accountNumber",
        "bankCode" = excluded."bankCode",
        iban = excluded.iban,
        swift = excluded.swift,
        "updatedAt" = excluded."updatedAt"
    `,
    [now],
  );
}

async function upsertClient(client) {
  await db.query(
    `
      insert into "Client" (
        id, "profileId", "companyName", "fullName", street, city, "postalCode",
        country, ico, dic, email, phone, "aresSyncedAt", "createdAt", "updatedAt"
      )
      values (
        $1, 'demo-profile', $2, null, $3, $4, $5, 'Česká republika',
        $6, $7, $8, $9, null, $10, $10
      )
      on conflict (id) do update set
        "companyName" = excluded."companyName",
        street = excluded.street,
        city = excluded.city,
        "postalCode" = excluded."postalCode",
        country = excluded.country,
        ico = excluded.ico,
        dic = excluded.dic,
        email = excluded.email,
        phone = excluded.phone,
        "updatedAt" = excluded."updatedAt"
    `,
    [
      client.id,
      client.companyName,
      client.street,
      client.city,
      client.postalCode,
      client.ico,
      client.dic,
      client.email,
      client.phone,
      now,
    ],
  );
}

async function upsertSequence() {
  await db.query(
    `
      insert into "InvoiceSequence" (
        id, "profileId", name, format, "nextNumber", "createdAt", "updatedAt"
      )
      values ('demo-sequence', 'demo-profile', 'Výchozí', 'YYYYMM###', 6, $1, $1)
      on conflict (id) do update set
        "nextNumber" = greatest("InvoiceSequence"."nextNumber", excluded."nextNumber"),
        "updatedAt" = excluded."updatedAt"
    `,
    [now],
  );
}

async function upsertInvoice(invoice) {
  await db.query(
    `
      insert into "Invoice" (
        id, "profileId", "clientId", "sequenceId", number, "variableSymbol",
        "constantSymbol", "specificSymbol", status, "issueDate",
        "taxableSupplyDate", "dueDate", "paidAt", currency, subtotal, "vatTotal",
        total, notes, "qrPaymentPayload", "pdfPath", "createdAt", "updatedAt"
      )
      values (
        $1, 'demo-profile', $2, 'demo-sequence', $3, $4, null, null, $5,
        $6, $6, $7, $8, 'CZK', $9, $10, $11, $12, null, null, $13, $13
      )
      on conflict (id) do update set
        "clientId" = excluded."clientId",
        number = excluded.number,
        "variableSymbol" = excluded."variableSymbol",
        status = excluded.status,
        "issueDate" = excluded."issueDate",
        "taxableSupplyDate" = excluded."taxableSupplyDate",
        "dueDate" = excluded."dueDate",
        "paidAt" = excluded."paidAt",
        subtotal = excluded.subtotal,
        "vatTotal" = excluded."vatTotal",
        total = excluded.total,
        notes = excluded.notes,
        "updatedAt" = excluded."updatedAt"
    `,
    [
      invoice.id,
      invoice.clientId,
      invoice.number,
      invoice.number.replace(/\D/g, ""),
      invoice.status,
      invoice.issueDate,
      invoice.dueDate,
      invoice.paidAt,
      toDecimal(invoice.subtotal),
      toDecimal(invoice.vatTotal),
      toDecimal(invoice.total),
      invoice.notes,
      now,
    ],
  );

  await db.query(`delete from "InvoiceItem" where "invoiceId" = $1`, [invoice.id]);

  for (const [index, item] of invoice.items.entries()) {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineVat = lineSubtotal * (item.vatRate / 100);
    const lineTotal = lineSubtotal + lineVat;

    await db.query(
      `
        insert into "InvoiceItem" (
          id, "invoiceId", position, name, quantity, unit, "unitPrice",
          "vatRate", "lineSubtotal", "lineVat", "lineTotal"
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        `${invoice.id}-item-${index + 1}`,
        invoice.id,
        index + 1,
        item.name,
        item.quantity.toFixed(3),
        item.unit,
        toDecimal(item.unitPrice),
        item.vatRate.toFixed(2),
        toDecimal(lineSubtotal),
        toDecimal(lineVat),
        toDecimal(lineTotal),
      ],
    );
  }
}

const clients = [
  {
    city: "Praha",
    companyName: "Demo Klient Alfa s.r.o.",
    dic: "CZ27074358",
    email: "alfa@example.test",
    ico: "27074358",
    id: "demo-client-alfa",
    phone: "+420 111 222 333",
    postalCode: "18600",
    street: "Sokolovská 100/94",
  },
  {
    city: "Brno",
    companyName: "Demo Klient Beta a.s.",
    dic: "CZ25596641",
    email: "beta@example.test",
    ico: "25596641",
    id: "demo-client-beta",
    phone: "+420 444 555 666",
    postalCode: "60200",
    street: "Lidická 12",
  },
  {
    city: "Ostrava",
    companyName: "Demo Klient Gama s.r.o.",
    dic: "CZ27604977",
    email: "gama@example.test",
    ico: "27604977",
    id: "demo-client-gama",
    phone: "+420 777 888 999",
    postalCode: "70200",
    street: "Nádražní 25",
  },
];

const invoices = [
  {
    clientId: "demo-client-alfa",
    dueDate: addDays(now, 14),
    id: "demo-invoice-issued",
    issueDate: now,
    items: [
      { name: "Konzultační služby", quantity: 6, unit: "hod", unitPrice: 1500, vatRate: 0 },
    ],
    notes: "Ukázková vystavená faktura bez DPH.",
    number: "202605001",
    paidAt: null,
    status: "ISSUED",
    subtotal: 9000,
    total: 9000,
    vatTotal: 0,
  },
  {
    clientId: "demo-client-beta",
    dueDate: addDays(now, -10),
    id: "demo-invoice-overdue",
    issueDate: addDays(now, -24),
    items: [
      { name: "Vývoj webové aplikace", quantity: 1, unit: "ks", unitPrice: 28000, vatRate: 0 },
    ],
    notes: "Ukázková nezaplacená faktura po splatnosti.",
    number: "202605002",
    paidAt: null,
    status: "ISSUED",
    subtotal: 28000,
    total: 28000,
    vatTotal: 0,
  },
  {
    clientId: "demo-client-gama",
    dueDate: addDays(now, -18),
    id: "demo-invoice-paid",
    issueDate: addMonths(now, -1),
    items: [
      { name: "Technická podpora", quantity: 10, unit: "hod", unitPrice: 1200, vatRate: 0 },
      { name: "Nasazení aplikace", quantity: 1, unit: "ks", unitPrice: 6500, vatRate: 0 },
    ],
    notes: "Ukázková zaplacená faktura pro dashboard.",
    number: "202605003",
    paidAt: addDays(now, -12),
    status: "PAID",
    subtotal: 18500,
    total: 18500,
    vatTotal: 0,
  },
  {
    clientId: "demo-client-alfa",
    dueDate: addMonths(now, -2),
    id: "demo-invoice-cancelled",
    issueDate: addMonths(now, -3),
    items: [
      { name: "Stornovaná objednávka", quantity: 1, unit: "ks", unitPrice: 5000, vatRate: 0 },
    ],
    notes: "Ukázková stornovaná faktura.",
    number: "202605004",
    paidAt: null,
    status: "CANCELLED",
    subtotal: 5000,
    total: 5000,
    vatTotal: 0,
  },
];

await db.connect();

try {
  await db.query("begin");
  await upsertProfile();

  for (const client of clients) {
    await upsertClient(client);
  }

  await upsertSequence();

  for (const invoice of invoices) {
    await upsertInvoice(invoice);
  }

  await db.query("commit");
  console.log("Demo seed data were upserted.");
} catch (error) {
  await db.query("rollback");
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.end();
}
