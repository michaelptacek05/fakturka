# Fakturka: project guidelines

Fakturka is a single-user, self-hosted invoicing app for Czech sole traders.
Use the current behavior documented in `README.md`; `plan.md` is historical
context and can contain outdated tasks. The stack is Next.js App Router,
TypeScript, Prisma/PostgreSQL, Tailwind, PDFKit and Vitest. User-facing copy is
Czech. Keep changes focused and follow the surrounding code.

## Validation

- Install with `npm ci` and generate the client with `npm run prisma:generate`.
- Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:agents`
  and `npm run build` for changes to application code or automation.
- Run `npm run test:integration` for database, payment, import or migration
  changes. Use a disposable PostgreSQL instance; the suite creates a separate
  database derived from `DATABASE_URL`. Never use production credentials.
- Add regression coverage for changed behavior. Generated Prisma clients,
  `.next`, credentials and invoice assets do not belong in Git.

## Git workflow

- Never push or merge directly into `main`. Every change reaches `main`
  through a pull request from a feature branch, merged only after CI passes.
- Pushing `main` publishes the production Docker image, so a direct push
  bypasses both review and the CI gate.

## Code Review Rules

Review the PR diff and the affected call sites. Report actionable regressions
introduced by the change, with the smallest useful file/line range, a concrete
failure scenario and a suggested correction. Cite the applicable rule when
relevant. Write explanations in Czech. Keep lint and formatting findings in CI.
Do not report documented limitations as new bugs or claim a check was run when
it was not. Review and recommend fixes; do not push fixes or merge PRs.

### Invoice integrity

- Existing invoices preserve their client snapshot and invoice number when
  the client or numbering settings change. New numbers must stay unique under
  concurrent creation and after imports. Safe path: update only future invoices
  and advance numbering inside the existing transactional flow.
- Preserve amounts in cents/Prisma Decimal and server-side validation. Partial
  payments, refunds and paid status must agree; concurrent payments cannot
  overpay an invoice. Invoices with recorded payments cannot be edited.
  Cancellation preserves payment history; a refund is a negative payment dated
  when the money was returned. Dashboard income follows actual payment dates.
- Web and PDF output must agree on invoice details and VAT-payer status. The
  payment QR uses the remaining CZK balance, the correct account and a numeric
  variable symbol of at most ten digits. Other currencies must not silently
  enter CZK aggregates or CZK payment QR codes.

### Imports and data changes

- CSV imports retain their preview/confirmation step and remain idempotent:
  existing invoice numbers are skipped and clients are matched by registration
  number. Validate submitted payloads on the server, even after a preview.
- Schema changes require a new migration that also works with existing data.
  Do not rewrite applied migrations. Keep the runner and migrator images
  separate and preserve migration-before-app startup and UTC date behavior.

### Authentication and automation

- Protect invoice data, exports, assets and mutations when authentication is
  enabled. Preserve the documented local mode without `AUTH_PASSWORD`; this
  intentional mode is not itself a regression. Never expose passwords, session
  secrets, database URLs or customer data in logs or public responses.
- Workflows that can write comments/issues must execute only automation code
  from the default branch. Treat PR code, comments and job names as data; never
  execute them in a privileged notifier. Do not notify from an obsolete CI run
  or a review of an older commit as though it describes the current PR.
