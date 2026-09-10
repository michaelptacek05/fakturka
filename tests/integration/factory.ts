import { InvoiceStatus, VatPayerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const PROFILE_ID = "test-profile";
const CLIENT_ID = "test-client";

/** Smaže data z předchozího běhu. Profil a odběratel se zakládají znovu. */
export async function resetDatabase() {
  await prisma.invoicePayment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.userProfile.deleteMany();

  await prisma.userProfile.create({
    data: {
      accountNumber: "2000145399",
      bankCode: "0800",
      city: "Praha",
      displayName: "Testovací OSVČ",
      ico: "00000019",
      id: PROFILE_ID,
      postalCode: "11000",
      street: "Testovací 1",
      vatPayerStatus: VatPayerStatus.NON_PAYER,
    },
  });

  await prisma.client.create({
    data: {
      city: "Praha",
      companyName: "Testovací odběratel s.r.o.",
      id: CLIENT_ID,
      postalCode: "11000",
      profileId: PROFILE_ID,
      street: "Odběratelská 2",
    },
  });
}

type InvoiceOptions = {
  dueDate?: Date;
  id?: string;
  payments?: { amount: string; note?: string; paidOn: Date }[];
  status?: InvoiceStatus;
  total?: string;
};

/**
 * Založí fakturu i s platbami a dopočtenou uhrazenou částkou, aby test
 * nezačínal ve stavu, který doména sama nikdy nevyrobí.
 */
export async function createInvoice({
  dueDate = new Date("2026-09-30"),
  id = "test-invoice",
  payments = [],
  status = InvoiceStatus.ISSUED,
  total = "10000.00",
}: InvoiceOptions = {}) {
  const paidAmount = payments
    .reduce((sum, payment) => sum + Math.round(Number(payment.amount) * 100), 0);

  return prisma.invoice.create({
    data: {
      clientId: CLIENT_ID,
      dueDate,
      id,
      issueDate: new Date("2026-09-01"),
      items: {
        create: {
          lineSubtotal: total,
          lineTotal: total,
          lineVat: "0.00",
          name: "Testovací položka",
          position: 1,
          quantity: "1.000",
          unit: "ks",
          unitPrice: total,
          vatRate: "0.00",
        },
      },
      number: id,
      paidAmount: (paidAmount / 100).toFixed(2),
      paidAt:
        status === InvoiceStatus.PAID
          ? (payments.at(-1)?.paidOn ?? new Date("2026-09-05"))
          : null,
      payments: {
        create: payments.map((payment) => ({
          amount: payment.amount,
          note: payment.note ?? null,
          paidOn: payment.paidOn,
        })),
      },
      profileId: PROFILE_ID,
      status,
      subtotal: total,
      total,
      variableSymbol: "12345678",
      vatTotal: "0.00",
    },
  });
}

export async function readInvoice(id = "test-invoice") {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    include: { payments: { orderBy: { paidOn: "asc" } } },
    where: { id },
  });

  return {
    paidAmount: invoice.paidAmount.toString(),
    paidAt: invoice.paidAt,
    payments: invoice.payments.map((payment) => payment.amount.toString()),
    status: invoice.status,
    total: invoice.total.toString(),
  };
}

export { CLIENT_ID, PROFILE_ID };
