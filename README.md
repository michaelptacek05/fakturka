# Fakturka

Self-hosted fakturační aplikace pro české OSVČ. Projekt slouží k vedení odběratelů, vystavování faktur, tisku faktury, QR platbě a exportu do PDF.

Tento projekt je vibe coded. Vzniká iterativně s pomocí AI asistenta, s důrazem na rychlé ověření funkčního toku a postupné zpřesňování detailů.

## Co aplikace umí

- Nastavení lokálního OSVČ profilu vystavitele.
- Adresář odběratelů.
- Vyhledávání firem přes ARES.
- Vytvoření, úprava, storno a označení faktury jako zaplacené.
- Automatické číslování faktur ve formátu `YYYYMM###`.
- Výpočty položek, DPH a celkové částky v CZK.
- Detail faktury v A4 rozložení vhodném pro tisk.
- QR platba ve formátu SPAYD.
- Server-side PDF export faktury.

## Technologie

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker Compose
- PDFKit

## Lokální spuštění

Nejdříve nainstalujte závislosti:

```bash
npm install
```

Vytvořte lokální `.env` ze vzoru:

```bash
cp .env.example .env
```

Spusťte PostgreSQL:

```bash
docker compose up -d db
```

Aplikujte migrace:

```bash
npm run prisma:deploy
```

Spusťte vývojový server:

```bash
npm run dev
```

Aplikace poběží na:

```text
http://localhost:3000
```

## Docker Compose

Celý stack lze spustit přes Docker Compose:

```bash
docker compose up --build
```

Služby:

- `db`: PostgreSQL databáze
- `migrate`: jednorázové spuštění Prisma migrací
- `app`: Next.js aplikace

Výchozí porty:

- aplikace: `3000`
- PostgreSQL: `5432`

## Užitečné příkazy

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:deploy
```

## Proměnné prostředí

Hlavní proměnné jsou v `.env.example`:

```env
POSTGRES_DB=fakturka
POSTGRES_USER=fakturka
POSTGRES_PASSWORD=change-me
POSTGRES_PORT=5432
DATABASE_URL="postgresql://fakturka:change-me@localhost:5432/fakturka?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Stav projektu

Aplikace je ve vývoji. Aktuálně je hotový základní end-to-end fakturační tok: profil vystavitele, odběratelé, faktury, tiskové rozložení, QR platba a PDF export.

Známá omezení:

- QR platba je experimentální a je potřeba ji ověřit v konkrétní bankovní aplikaci.
- PDF výstup je první server-side verze a může vyžadovat další typografické doladění.
- Aplikace je zatím single-user bez přihlášení.

Další plánované kroky:

- logo a podpis/razítko na faktuře,
- další ladění PDF výstupu,
- dashboard příjmů a neuhrazených faktur,
- produkční stabilizace a dokumentace nasazení.

## Licence

Projekt je dostupný pod licencí MIT. Podrobnosti jsou v souboru `LICENSE`.

## Poznámka

Projekt není účetní ani daňové poradenství. Před použitím v produkci je potřeba ověřit správnost faktur, číselných řad, DPH režimu a platebních údajů podle konkrétního podnikání.
