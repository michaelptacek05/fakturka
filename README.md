# Fakturka

Self-hosted fakturační aplikace pro české OSVČ. Slouží k vedení odběratelů, vystavování faktur, tisku, QR platbě, PDF exportu a rychlému přehledu příjmů.

Tento projekt je vibe coded. Vzniká iterativně s pomocí AI asistenta, s důrazem na rychlé ověření funkčního toku a postupné zpřesňování detailů.

## Funkce

- Lokální OSVČ profil vystavitele včetně bankovních údajů.
- Adresář odběratelů.
- Vyhledávání firem přes ARES.
- Vytvoření, úprava, storno a označení faktury jako zaplacené.
- Hromadný výběr faktur, mazání a CSV export přehledu.
- Automatické číslování faktur ve formátu `YYYYMM###`.
- Výpočty položek, DPH a celkové částky v CZK.
- Detail faktury v A4 rozložení vhodném pro tisk.
- QR platba ve formátu SPAYD.
- Server-side PDF export faktury.
- Logo, podpis a razítko na webové faktuře i v PDF.
- Dashboard příjmů, nezaplacených faktur, DPH limitu a orientačních odvodů.

## Technologie

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker Compose
- PDFKit

## Lokální spuštění

Nainstalujte závislosti:

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

Volitelně nahrajte demo data:

```bash
npm run prisma:seed
```

Spusťte vývojový server:

```bash
npm run dev
```

Aplikace poběží na `http://localhost:3000`.

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

Persistentní volumes:

- `postgres_data`: databáze
- `invoice_storage`: nahrané logo, podpis, razítko a další lokální soubory ve `storage/`

## Užitečné příkazy

```bash
npm run dev
npm run build
npm run lint
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
docker compose config
docker compose build
```

## Proměnné prostředí

Hlavní proměnné jsou v `.env.example`:

```env
POSTGRES_DB=fakturka
POSTGRES_USER=fakturka
POSTGRES_PASSWORD=change-me
POSTGRES_PORT=5432
APP_PORT=3000
DATABASE_URL="postgresql://fakturka:change-me@localhost:5432/fakturka?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Pro produkci změňte hlavně `POSTGRES_PASSWORD`, případně `APP_PORT` a `NEXT_PUBLIC_APP_URL`.

## Nasazení přes Portainer

1. Vytvořte nový Stack z `docker-compose.yml`.
2. Nastavte env proměnné podle `.env.example`.
3. Použijte silné heslo pro `POSTGRES_PASSWORD`.
4. Zachovejte volumes `postgres_data` a `invoice_storage`.
5. Po nasazení zkontrolujte logy služby `migrate` a potom otevřete službu `app`.

Pro zálohu nestačí jen databáze. Zálohujte:

- PostgreSQL volume `postgres_data`
- aplikační volume `invoice_storage`

## Public Readiness Checklist

Před zveřejněním nebo commitem zkontrolujte:

```bash
git status --short
npm run lint
npm run build
docker compose config
```

Do veřejného repozitáře nepatří:

- `.env`
- `storage/`
- `.idea/`
- osobní testovací údaje v databázi
- lokální build výstupy

## Stav projektu

Aplikace je ve vývoji, ale hlavní end-to-end tok je funkční: profil vystavitele, odběratelé, faktury, ARES, tiskové rozložení, QR platba, PDF export, assety a dashboard.

Známá omezení:

- Aplikace je zatím single-user bez přihlášení.
- QR platbu je vhodné ověřit v cílové bankovní aplikaci.
- PDF výstup je server-side a může vyžadovat další typografické doladění.
- Aplikace nenahrazuje účetní ani daňové poradenství.

Další plánované kroky:

- důkladnější automatizované testy,
- exporty přehledů,
- lepší produkční observabilita,
- případně autentizace pro veřejnější nasazení.

## Licence

Projekt je dostupný pod licencí MIT. Podrobnosti jsou v souboru `LICENSE`.
