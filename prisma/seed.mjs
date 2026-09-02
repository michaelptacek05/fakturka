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

/**
 * Prisma posílá do databáze čas v UTC. Tenhle skript jde přes syrové pg,
 * které by poslalo lokální čas, a hodnoty by se pak lišily o zónu.
 * Proto všechno normalizujeme stejně jako aplikace.
 */
function toDbTimestamp(date) {
  return date.toISOString();
}

/** Datum bez času ukládáme jako půlnoc UTC, stejně jako to dělá aplikace. */
function toDbDate(date) {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  ).toISOString();
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
    [toDbTimestamp(now)],
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
      toDbTimestamp(now),
    ],
  );
}

async function upsertSequence(periodKey, nextNumber) {
  await db.query(
    `
      insert into "InvoiceSequence" (
        id, "profileId", name, format, "nextNumber", "periodKey",
        "createdAt", "updatedAt"
      )
      values ('demo-sequence', 'demo-profile', 'Výchozí', 'YYYYMM###', $1, $2, $3, $3)
      on conflict (id) do update set
        "nextNumber" = greatest("InvoiceSequence"."nextNumber", excluded."nextNumber"),
        "periodKey" = excluded."periodKey",
        "updatedAt" = excluded."updatedAt"
    `,
    [nextNumber, periodKey, toDbTimestamp(now)],
  );
}

async function upsertInvoice(invoice) {
  await db.query(
    `
      insert into "Invoice" (
        id, "profileId", "clientId", "sequenceId", number, "variableSymbol",
        "constantSymbol", "specificSymbol", status, "issueDate",
        "taxableSupplyDate", "dueDate", "paidAt", currency, subtotal, "vatTotal",
        total, notes, "clientName", "clientStreet", "clientCity",
        "clientPostalCode", "clientCountry", "clientIco", "clientDic",
        "clientEmail", "qrPaymentPayload", "pdfPath", "createdAt", "updatedAt"
      )
      values (
        $1, 'demo-profile', $2, 'demo-sequence', $3, $4, null, null, $5,
        $6, $6, $7, $8, 'CZK', $9, $10, $11, $12,
        $13, $14, $15, $16, 'Česká republika', $17, $18, $19,
        null, null, $20, $20
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
        "clientName" = excluded."clientName",
        "clientStreet" = excluded."clientStreet",
        "clientCity" = excluded."clientCity",
        "clientPostalCode" = excluded."clientPostalCode",
        "clientCountry" = excluded."clientCountry",
        "clientIco" = excluded."clientIco",
        "clientDic" = excluded."clientDic",
        "clientEmail" = excluded."clientEmail",
        "updatedAt" = excluded."updatedAt"
    `,
    [
      invoice.id,
      invoice.clientId,
      invoice.number,
      invoice.number.replace(/\D/g, ""),
      invoice.status,
      toDbDate(invoice.issueDate),
      toDbDate(invoice.dueDate),
      invoice.paidAt ? toDbDate(invoice.paidAt) : null,
      toDecimal(invoice.subtotal),
      toDecimal(invoice.vatTotal),
      toDecimal(invoice.total),
      invoice.notes,
      invoice.client.companyName,
      invoice.client.street,
      invoice.client.city,
      invoice.client.postalCode,
      invoice.client.ico,
      invoice.client.dic,
      invoice.client.email,
      toDbTimestamp(now),
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

async function upsertProject(project) {
  await db.query(
    `
      insert into "Project" (
        id, "profileId", "clientId", name, description, status, priority,
        "startDate", "dueDate", "createdAt", "updatedAt"
      )
      values ($1, 'demo-profile', $2, $3, $4, $5, $6, $7, $8, $9, $9)
      on conflict (id) do update set
        "clientId" = excluded."clientId",
        name = excluded.name,
        description = excluded.description,
        status = excluded.status,
        priority = excluded.priority,
        "startDate" = excluded."startDate",
        "dueDate" = excluded."dueDate",
        "updatedAt" = excluded."updatedAt"
    `,
    [
      project.id,
      project.clientId,
      project.name,
      project.description,
      project.status,
      project.priority,
      project.startDate ? toDbDate(project.startDate) : null,
      project.dueDate ? toDbDate(project.dueDate) : null,
      toDbTimestamp(now),
    ],
  );
}

async function upsertTask(task) {
  await db.query(
    `
      insert into "Task" (
        id, "projectId", title, description, status, priority, position,
        "dueDate", "doneAt", "createdAt", "updatedAt"
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
      on conflict (id) do update set
        "projectId" = excluded."projectId",
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        priority = excluded.priority,
        position = excluded.position,
        "dueDate" = excluded."dueDate",
        "doneAt" = excluded."doneAt",
        "updatedAt" = excluded."updatedAt"
    `,
    [
      task.id,
      task.projectId,
      task.title,
      task.description ?? null,
      task.status,
      task.priority,
      task.position,
      task.dueDate ? toDbDate(task.dueDate) : null,
      task.status === "DONE" ? toDbDate(task.doneAt ?? now) : null,
      toDbTimestamp(now),
    ],
  );

  await db.query(`delete from "TaskNote" where "taskId" = $1`, [task.id]);

  for (const [index, note] of (task.notes ?? []).entries()) {
    await db.query(
      `
        insert into "TaskNote" (id, "taskId", body, "createdAt")
        values ($1, $2, $3, $4)
      `,
      [
        `${task.id}-note-${index + 1}`,
        task.id,
        note,
        toDbTimestamp(addDays(now, -index)),
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
    paidAt: null,
    status: "CANCELLED",
    subtotal: 5000,
    total: 5000,
    vatTotal: 0,
  },
];

const projects = [
  {
    clientId: "demo-client-alfa",
    description:
      "Kompletní redesign firemního webu včetně nové struktury a copy.",
    dueDate: addDays(now, 30),
    id: "demo-project-web",
    name: "Redesign webu",
    priority: "HIGH",
    startDate: addDays(now, -20),
    status: "ACTIVE",
  },
  {
    clientId: "demo-client-beta",
    description: "Napojení e-shopu na skladový systém přes REST API.",
    dueDate: addDays(now, 60),
    id: "demo-project-api",
    name: "Integrace skladu",
    priority: "MEDIUM",
    startDate: addDays(now, -5),
    status: "ACTIVE",
  },
  {
    clientId: null,
    description: "Vlastní agenda, kterou používám pro provoz živnosti.",
    dueDate: null,
    id: "demo-project-interni",
    name: "Interní nástroje",
    priority: "LOW",
    startDate: addDays(now, -90),
    status: "ON_HOLD",
  },
];

const tasks = [
  {
    description: "Projít s klientem strukturu stránek a schválit wireframy.",
    dueDate: addDays(now, -3),
    id: "demo-task-wireframy",
    notes: [
      "Klient chce na homepage přidat sekci s referencemi.",
      "Wireframy odeslány ke schválení.",
    ],
    position: 0,
    priority: "URGENT",
    projectId: "demo-project-web",
    status: "IN_PROGRESS",
    title: "Odsouhlasit wireframy",
  },
  {
    description: "Nasadit novou grafiku na testovací doménu.",
    dueDate: addDays(now, 7),
    id: "demo-task-grafika",
    notes: [],
    position: 100,
    priority: "HIGH",
    projectId: "demo-project-web",
    status: "TODO",
    title: "Nasadit grafiku na test",
  },
  {
    description: "Sepsat texty pro podstránky služeb.",
    dueDate: null,
    id: "demo-task-copy",
    notes: ["Čeká se na podklady od klienta."],
    position: 200,
    priority: "MEDIUM",
    projectId: "demo-project-web",
    status: "BLOCKED",
    title: "Dopsat texty služeb",
  },
  {
    description: "Analýza endpointů skladového systému.",
    dueDate: addDays(now, -10),
    doneAt: addDays(now, -8),
    id: "demo-task-analyza",
    notes: ["Dokumentace API dodána, endpointy sedí."],
    position: 0,
    priority: "MEDIUM",
    projectId: "demo-project-api",
    status: "DONE",
    title: "Zmapovat API skladu",
  },
  {
    description: "Napsat synchronizaci skladových zásob.",
    dueDate: addDays(now, 14),
    id: "demo-task-sync",
    notes: [],
    position: 0,
    priority: "HIGH",
    projectId: "demo-project-api",
    status: "TODO",
    title: "Synchronizace zásob",
  },
  {
    description: "Nastavit pravidelné zálohy databáze i souborů.",
    dueDate: null,
    id: "demo-task-zalohy",
    notes: [],
    position: 0,
    priority: "LOW",
    projectId: "demo-project-interni",
    status: "BACKLOG",
    title: "Zautomatizovat zálohy",
  },
];

function getPeriodKey(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Čísla přidělíme podle data vystavení, aby odpovídala formátu YYYYMM###
 * a řada se v každém měsíci počítala od jedničky.
 */
function assignInvoiceNumbers(entries) {
  const serialByPeriod = new Map();
  const clientsById = new Map(clients.map((client) => [client.id, client]));

  return entries
    .slice()
    .sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime())
    .map((invoice) => {
      const periodKey = getPeriodKey(invoice.issueDate);
      const serial = (serialByPeriod.get(periodKey) ?? 0) + 1;

      serialByPeriod.set(periodKey, serial);

      return {
        ...invoice,
        client: clientsById.get(invoice.clientId),
        number: `${periodKey}${String(serial).padStart(3, "0")}`,
        periodKey,
      };
    });
}

const numberedInvoices = assignInvoiceNumbers(invoices);
const currentPeriodKey = getPeriodKey(now);
const usedInCurrentPeriod = numberedInvoices.filter(
  (invoice) => invoice.periodKey === currentPeriodKey,
).length;

await db.connect();

try {
  await db.query("begin");
  await upsertProfile();

  for (const client of clients) {
    await upsertClient(client);
  }

  await upsertSequence(currentPeriodKey, usedInCurrentPeriod + 1);

  for (const invoice of numberedInvoices) {
    await upsertInvoice(invoice);
  }

  for (const project of projects) {
    await upsertProject(project);
  }

  for (const task of tasks) {
    await upsertTask(task);
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
