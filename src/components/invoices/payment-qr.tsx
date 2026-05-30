import Image from "next/image";
import QRCode from "qrcode";

import {
  buildSpaydPayload,
  isValidCzechAccountNumber,
  sanitizeSpaydPayload,
  validateBankProfile,
} from "@/lib/spayd";

type PaymentQrProps = {
  accountNumber: string;
  amount: number | string | { toString(): string };
  bankCode: string;
  currency: string;
  dueDate?: Date | string | null;
  iban?: string | null;
  invoiceNumber: string;
  swift?: string | null;
  variableSymbol: string;
};

export async function PaymentQr({
  accountNumber,
  amount,
  bankCode,
  currency,
  dueDate,
  iban,
  invoiceNumber,
  swift,
  variableSymbol,
}: PaymentQrProps) {
  const payload = sanitizeSpaydPayload(
    buildSpaydPayload({
      accountNumber,
      amount,
      bankCode,
      currency,
      dueDate,
      iban,
      includeBic: false,
      message: `Faktura ${invoiceNumber}`,
      swift,
      variableSymbol,
    }),
  );
  const hasValidDomesticAccount = isValidCzechAccountNumber(
    accountNumber,
    bankCode,
  );
  const bankValidation = validateBankProfile({
    accountNumber,
    bankCode,
    iban,
    swift,
  });
  const imageSrc = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 8,
    type: "image/png",
  });

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-[144px_1fr] print:grid-cols-[128px_1fr]">
      <div className="grid size-36 shrink-0 place-items-center border border-zinc-300 bg-white p-2 print:size-32">
        <Image
          src={imageSrc}
          alt="QR platba"
          width={128}
          height={128}
          className="size-32 print:size-28"
          unoptimized
        />
      </div>
      <div className="min-w-0 text-xs leading-5 text-zinc-600">
        <p className="font-semibold uppercase tracking-wide text-zinc-500">
          QR platba
        </p>
        <p>Naskenujte v bankovní aplikaci.</p>
        <dl className="mt-2 grid gap-1 text-[11px] leading-4">
          <div>
            <dt className="inline font-medium text-zinc-500">Účet: </dt>
            <dd className="inline">
              {accountNumber}/{bankCode}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-zinc-500">IBAN v QR: </dt>
            <dd className="inline break-all">{bankValidation.paymentIban}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-zinc-500">VS: </dt>
            <dd className="inline">{variableSymbol}</dd>
          </div>
        </dl>
        {!hasValidDomesticAccount ? (
          <p className="font-medium text-amber-700">
            Zkontrolujte číslo účtu a kód banky v profilu.
          </p>
        ) : null}
        {bankValidation.issues.map((issue) => (
          <p className="font-medium text-amber-700" key={issue}>
            {issue}
          </p>
        ))}
        {bankValidation.warnings.map((warning) => (
          <p className="font-medium text-amber-700" key={warning}>
            {warning}
          </p>
        ))}
        <p
          className="mt-1 max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] leading-4 text-zinc-500 print:max-w-[190px] print:text-[7px]"
          title={payload}
        >
          {payload}
        </p>
      </div>
    </div>
  );
}
