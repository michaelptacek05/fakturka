# Fakturka - plan projektu

## Cíl

Self-hosted webová aplikace pro správu a generování faktur pro české OSVČ. Aplikace bude monolit/BFF nad Next.js App Routerem, nasaditelná přes Docker Compose s PostgreSQL databází.

## Architektura

- Frontend a backend: Next.js 14+ App Router, TypeScript, server actions/API routes.
- UI: Tailwind CSS, shadcn/ui, profesionální light-first design.
- Databáze: PostgreSQL.
- ORM: Prisma, kvůli dobré podpoře migrací, typování a provozu v Next.js standalone Docker deploymentu.
- PDF: server-side generování faktur s QR platbou dle SPAYD.
- Deployment: produkční Dockerfile s `output: "standalone"` a `docker-compose.yml` pro aplikaci a databázi.

## Předběžný databázový model

- `UserProfile`: moje OSVČ údaje dodavatele, bankovní spojení, nastavení DPH, logo/podpis.
- `Client`: odběratelé, adresa, IČO, DIČ, ARES metadata.
- `Invoice`: hlavička faktury, číselná řada, symboly, data, stav, vazba na klienta a profil.
- `InvoiceItem`: položky faktury, množství, jednotka, cena, sazba DPH, vypočtené součty.
- `InvoiceSequence`: nastavení formátu a poslední použité číslo.
- `InvoiceAsset`: volitelné soubory pro logo, podpis nebo razítko, pokud nebudou drženy přímo v profile.

## Fáze a stav

### In Progress

- Fáze 6: PDF a QR platba
  - Webový detail faktury už zobrazuje SPAYD QR platbu.
  - Server-side PDF export je přidaný přes `/invoices/[id]/pdf`.
  - Zbývá logo a podpis/razítko ve faktuře.

### To Do

- Fáze 6C: Logo a podpis
  - Logo a podpis/razítko ve faktuře.

- Fáze 7: Dashboard
  - Příjmy za měsíc, kvartál a rok.
  - Vývoj příjmů v čase.
  - Nezaplaceno po splatnosti.
  - Indikátor obratu pro DPH limit 2 mil. Kč za 12 měsíců.
  - Odhad sociálního, zdravotního a daně při paušálních výdajích 60 %.

- Fáze 8: Produkční stabilizace
  - Validace vstupů.
  - Seed/demo data.
  - Docker smoke test.
  - Dokumentace proměnných prostředí a nasazení přes Portainer.

### Done

- Analyzována přiložená MD specifikace.
- Vytvořen tento živý plán projektu.
- Fáze 1: Bootstrap projektu
  - Inicializován Next.js projekt s TypeScriptem, App Routerem a Tailwind CSS.
  - Zapnut `output: "standalone"` v `next.config.ts`.
  - Nastaven jednoznačný Turbopack root pro lokální build.
  - Připravena Prisma 7 konfigurace pro PostgreSQL včetně adapteru, schématu a úvodní migrace.
  - Připraveny `Dockerfile`, `.dockerignore` a `docker-compose.yml` se službami `app`, `db` a `migrate`.
  - Připraven `.env.example` a lokální `.env`.
  - Přidána shadcn/ui kompatibilní konfigurace, design tokeny a první `Button` komponenta.
  - Nahrazena výchozí stránka pracovním dashboardem pro OSVČ.
  - Ověřeno: `npm run prisma:generate`, `npx prisma validate`, `npm run lint`, `npm run build`, `docker compose config`.
- Fáze 2: Základ aplikace a design systém
  - Doplněn aplikační shell s navigací: Dashboard, Faktury, Nová faktura, Nastavení.
  - Přidány tiskové styly `@media print` a třídy pro skrytí webové navigace.
  - Připraveny helpery pro formátování měny, dat a čísel.
- Fáze 3: Nastavení moje údaje / OSVČ
  - Přidána route `/settings/profile`.
  - Přidán formulář pro jeden lokální `UserProfile` bez auth.
  - Ukládání OSVČ údajů dodavatele řeší server action `upsertProfile(formData)`.
  - Formulář obsahuje fakturační údaje, IČO/DIČ, režim DPH a bankovní spojení.
- První funkční fakturační vertikála
  - Přidána route `/invoices` se seznamem faktur.
  - Přidána route `/invoices/new` s dynamickým formulářem položek.
  - Přidána server action `createInvoice(formData)`.
  - Faktura vytváří nebo znovupoužívá odběratele podle IČO/e-mailu.
  - Automatické číslo faktury má formát `YYYYMM###`.
  - Variabilní symbol vzniká z číslic čísla faktury.
  - Výchozí splatnost je 14 dní.
  - Výpočty položek, DPH a celkové částky probíhají v haléřích a ukládají se do Prisma `Decimal`.
  - Přidána route `/invoices/[id]` s realistickým A4 rozložením faktury.
  - Tlačítko `Tisk / PDF` používá browser print dialog přes `window.print()`.
  - Přidány uživatelské chybové hlášky pro nedostupnou DB a validační problémy při ukládání profilu nebo faktury.
  - Ověřeno: `docker compose config`, `docker compose up -d db`, `npm run prisma:deploy`, `npm run lint`, `npm run build`.
  - End-to-end ověřeno nad PostgreSQL: uložení OSVČ profilu, vytvoření faktury bez DPH, vytvoření faktury s více položkami a DPH, přesměrování na detail a perzistence v seznamu faktur.
- ARES vyhledávání odběratele podle názvu
  - Přidán interní endpoint `/api/ares/search?q=...` nad oficiálním ARES REST API.
  - Vyhledávání používá obchodní jméno a vrací normalizované údaje: název, IČO, DIČ, ulice, město, PSČ, země.
  - Přidána komponenta pro vyhledání firmy v ARES a předvyplnění mých OSVČ údajů i odběratele na nové faktuře.
  - Ověřeno přes lokální endpoint dotazem `Škoda`.
- Fáze 4: Adresář odběratelů
  - Přidán samostatný CRUD odběratelů mimo rychlé vytvoření při fakturaci.
  - Přidány route `/clients`, `/clients/new` a `/clients/[id]`.
  - Rozšířen ARES lookup o hledání podle IČO a napojen do klientského formuláře.
  - Doplněny akce pro vytvoření, editaci a mazání klientů včetně revalidace cache.
  - Rozšířena navigace aplikace o adresář odběratelů.
- Fáze 5: Fakturační modul
  - Přidána úprava faktur přes `/invoices/[id]/edit` se sdíleným formulářem.
  - Přidány akce pro označení faktury jako zaplacené a pro storno.
  - Doplněny filtry a vyhledávání v seznamu faktur.
  - Ošetřeny read-only stavy pro zaplacené a stornované faktury.
- Fáze 6A: QR platba ve webu
  - Přidán helper pro sestavení SPAYD payloadu.
  - Pokud profil nemá IBAN, payload dopočítá český IBAN z čísla účtu a kódu banky.
  - Přidána QR komponenta do platební sekce detailu faktury.
  - QR obsahuje částku, měnu, variabilní symbol a zprávu `Faktura <číslo>`.
- Fáze 6A.1: QR diagnostika a bankovní validace
  - Doplněna validace českého účtu, IBANu a nesouladu bankovního kódu se SWIFT/BIC.
  - `/settings/profile` ukazuje varování k bankovním údajům.
  - Detail faktury ukazuje QR diagnostiku: účet, IBAN v QR, VS a SPAYD payload.
- Fáze 6B: PDF export
  - Přidána route `/invoices/[id]/pdf`.
  - PDF se generuje server-side z DB dat přes route handler.
  - PDF obsahuje Dodavatele, Odběratele, data, symboly, položky, součty, platební údaje a QR platbu.
  - Detail faktury obsahuje tlačítko `Stáhnout PDF`.

## Technické poznámky

### Proměnné prostředí

- `DATABASE_URL`: PostgreSQL connection string pro Prisma.
- `POSTGRES_DB`: název databáze v Docker Compose.
- `POSTGRES_USER`: uživatel PostgreSQL.
- `POSTGRES_PASSWORD`: heslo PostgreSQL.
- `NEXT_PUBLIC_APP_URL`: veřejná URL aplikace pro odkazy a budoucí PDF metadata.

### Docker

- Aplikace poběží jako Next.js standalone server.
- Databáze poběží jako služba `db` nad oficiálním PostgreSQL image.
- Compose obsahuje persistentní volume pro databázi.
- Compose obsahuje jednorázovou službu `migrate` pro `prisma migrate deploy`.
- Lokální PostgreSQL běží přes `docker compose up -d db` a publikuje port `5432`.
- Prisma migrace jsou aplikované přes `npm run prisma:deploy`.
- Při lokálním pullu PostgreSQL image byl obejit problém s macOS credential helperem dočasným `DOCKER_CONFIG=/tmp/fakturka-docker-config`.

## Bezprostřední další krok

Pokračovat logem a podpisem/razítkem: upload `InvoiceAsset`, zobrazení ve webové faktuře a vložení do PDF.
