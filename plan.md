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
- `Project`: zakázka pod odběratelem, stav, priorita, termíny a popis.
- `Task`: úkol pod projektem, stav odpovídá sloupci nástěnky, priorita a ruční pořadí.
- `TaskNote`: časované poznámky k úkolu.

## Fáze a stav

### In Progress

- Žádná aktivní fáze.

### To Do

- Další rozvoj
  - Integrační testy nad databází (zatím jsou pokryté jen čisté funkce).
  - Export pro účetní programy, například ISDOC.
  - Propojení projektů s fakturací, tedy vyfakturováno na projektu.
  - Lepší produkční observabilita.
  - Podpora více měn v přehledech a QR platbě.

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
- Fáze 6C: Logo a podpis
  - Přidána správa assetů do `/settings/profile`.
  - Assety se ukládají lokálně do `storage/invoice-assets` mimo Git.
  - Přidána route `/invoice-assets/[id]` pro bezpečné servírování uložených obrázků.
  - Podporované typy jsou logo, podpis a razítko.
  - Webová faktura zobrazuje logo v hlavičce a podpis/razítko ve spodní části.
  - PDF export vkládá logo a podpis/razítko, pokud existují a soubor je dostupný.
- Fáze 7: Dashboard
  - Úvodní stránka používá reálná data z `Invoice` místo mock hodnot.
  - Přidány metriky zaplacených příjmů za měsíc, kvartál a rok podle `paidAt`.
  - Přidán přehled nezaplacených a po splatnosti vystavených faktur.
  - Přidán 12měsíční sloupcový graf zaplacených příjmů bez nové grafové knihovny.
  - Přidán indikátor obratu vůči DPH limitu 2 mil. Kč za posledních 12 měsíců.
  - Přidán orientační odhad daně, sociálního a zdravotního při paušálních výdajích 60 %.
  - Přidán přehled posledních faktur a rychlé odkazy do fakturačního workflow.
- Fáze 8: Produkční stabilizace
  - Přidány sdílené validační helpery pro IČO, DIČ, e-mail, účet, IBAN, částky a množství.
  - Server actions vrací konkrétnější validační chyby přes současný redirect/query-param styl.
  - Přidán idempotentní demo seed skript `npm run prisma:seed`.
  - Docker Compose obsahuje persistentní volume `invoice_storage` pro lokální assety ve `storage/`.
  - Docker image připravuje zapisovatelný adresář `/app/storage`.
  - README bylo aktualizováno pro aktuální funkce, seed, Docker, Portainer a zálohování.
  - Přidán public readiness checklist před commitem nebo publikací.
- Hromadná správa faktur
  - Seznam faktur umožňuje vybrat více faktur najednou.
  - Vybrané faktury lze hromadně smazat s potvrzením.
  - Vybrané faktury lze exportovat do CSV přehledu přes `/invoices/export`.
- Fáze 9: Oprava nasazení a produkční mezery
  - Opraven Docker workflow: publikovaný `:latest` neobsahuje Prisma CLI ani
    migrace, proto se stage `migrator` publikuje zvlášť jako `:migrate` a
    compose ho používá pro jednorázovou službu `migrate`.
  - CI staví a pushuje oba image a před tím spouští lint, typecheck a testy.
  - `docker-compose.yml` je produkční stack pro Portainer: DNS 1.1.1.1 a 8.8.8.8,
    externí síť `nginx-proxy-manager_default`, povinné heslo k databázi i aplikaci.
  - Přidán `docker-compose.dev.yml` pro lokální vývoj s publikovaným portem
    databáze a buildem ze zdrojáků.
  - Přidán healthcheck `/api/health`, který ověřuje i spojení s databází.
  - Image má napevno `TZ=UTC`, aby se data dokladů neposouvala o den.
  - README srovnáno se skutečným chováním compose.
- Fáze 10: Přihlášení
  - Přidáno přihlášení jedním heslem z `AUTH_PASSWORD`.
  - Session je podepsaný token v HttpOnly cookie, podpis přes Web Crypto.
  - `src/proxy.ts` chrání všechny routy kromě `/login` a `/api/health`.
  - Změna hesla nebo `AUTH_SECRET` zneplatní existující relace.
  - Bez nastaveného hesla aplikace běží dál, ale zobrazuje varovný pruh.
  - Přidáno omezení počtu neúspěšných pokusů.
- Fáze 11: Datové opravy
  - Faktura má snapshot odběratele. Úprava adresáře už nemění vystavené doklady.
  - Číselná řada se resetuje podle období odvozeného z formátu čísla.
  - Formát čísla faktury je volitelný v nastavení.
  - Vystavení faktury zamyká řádek číselné řady, aby dvě souběžná uložení
    nedostala stejné číslo.
  - Variabilní symbol se zkracuje na deset číslic.
  - ARES endpoint má timeout, ošetřené výpadky a jednoduchý rate limit.
  - Servírování assetů kontroluje, že cesta nevede mimo adresář `storage`.
- Fáze 12: Import z Fakturoidu
  - Přidána route `/import` s importem odběratelů a faktur z CSV.
  - Sloupce se poznají podle názvů z Fakturoid API i podle českých hlaviček.
  - Parser zvládá oddělovače `;,\t|`, UTF-8 i Windows-1250 a české i anglické
    zápisy čísel a dat.
  - Položkový export se skládá zpět do jedné faktury podle čísla dokladu.
  - Export bez položek se naimportuje jako jedna položka z celkové částky.
  - Náhled s upozorněními běží v prohlížeči, server data validuje znovu.
  - Import je idempotentní a po doběhnutí posune číselnou řadu.
- Fáze 13: Sjednocení designu
  - Přidány UI primitivy: Card, Input, Select, Textarea, Label, Field, Badge,
    Alert, Table, EmptyState, PageHeader.
  - Nové barevné tokeny včetně stavových barev a funkční tmavý motiv
    s přepínačem bez probliknutí.
  - Přepsány všechny stránky a formuláře na sdílené komponenty.
  - Navigace má aktivní stav a mobilní menu.
  - Stav faktury po splatnosti se zobrazuje jednotně v seznamu i na dashboardu.
  - Ladicí výpis SPAYD payloadu se už netiskne na faktuře.
- Fáze 14: Testy
  - Přidán Vitest a sada testů nad čistou logikou.
  - Pokryto číslování faktur, CSV parser, import z Fakturoidu a validace.
- Fáze 15: Projekty a úkoly
  - Přidány modely `Project`, `Task` a `TaskNote` s enumy pro stav a prioritu.
  - Route `/projects` seskupuje projekty podle odběratele, `/projects/new`
    a `/projects/[id]` řeší založení a úpravu včetně smazání s potvrzením.
  - Odběratel je na projektu volitelný, aby šlo vést i interní projekty.
  - Route `/tasks` je nástěnka ve stylu Jiry s pěti sloupci podle stavu,
    filtrem na projekt a prioritu a rychlým přidáním úkolu.
  - Přesun mezi sloupci řeší drag & drop s optimistickým překreslením přes
    `useOptimistic`; na dotykových displejích se stav mění výběrem na kartě.
  - Pořadí karet je vedené v rámci sloupce napříč projekty, při shodě
    rozhoduje priorita a potom termín.
  - Přesun do sloupce Hotovo vyplní datum dokončení, návrat zpět ho zruší.
  - Detail projektu ukazuje vlastní nástěnku jen s jeho úkoly.
  - Route `/tasks/[id]` má úpravu úkolu a vlákno časovaných poznámek.
  - Detail odběratele odkazuje na založení projektu s předvyplněným klientem.
  - Z hlavičky zmizela Nová faktura, zůstává na dashboardu a v agendě faktur.
  - Seed doplněn o demo projekty, úkoly a poznámky.
  - Seed nově ukládá časy v UTC, aby seděly s tím, co zapisuje aplikace.

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

Projekt je ověřený lokálně proti PostgreSQL: migrace včetně upgrade cesty s daty,
seed, vystavení faktury, import z Fakturoidu, PDF i CSV export, přihlášení,
projekty s úkoly včetně drag & dropu a poznámek, a mobilní zobrazení.
Zbývá první nasazení na Portainer podle README a ověření QR platby v cílové
bankovní aplikaci.
