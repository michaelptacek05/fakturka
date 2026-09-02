# Fakturka

Self-hosted fakturační aplikace pro české OSVČ. Slouží k vedení odběratelů, vystavování faktur, tisku, QR platbě, PDF exportu a rychlému přehledu příjmů.

Tento projekt je vibe coded. Vzniká iterativně s pomocí AI asistenta, s důrazem na rychlé ověření funkčního toku a postupné zpřesňování detailů.

## Funkce

- Lokální OSVČ profil vystavitele včetně bankovních údajů.
- Přihlášení jedním heslem přes proměnnou prostředí.
- Adresář odběratelů.
- Vyhledávání firem přes ARES.
- Vytvoření, úprava, storno a označení faktury jako zaplacené.
- Údaje odběratele se na faktuře zamrazí, pozdější úprava adresáře doklad nezmění.
- Číslování faktur podle volitelného formátu s resetem řady na začátku období.
- Import odběratelů a faktur z CSV exportu Fakturoidu (i z jiného CSV).
- Projekty vedené pod odběrateli, se stavem, prioritou a termíny.
- Úkoly na nástěnce ve stylu Jiry: sloupce podle stavu, drag & drop, priority.
- Poznámky u úkolů s datem a časem.
- Hromadný výběr faktur, mazání a CSV export přehledu.
- Výpočty položek, DPH a celkové částky v CZK.
- Detail faktury v A4 rozložení vhodném pro tisk.
- QR platba ve formátu SPAYD.
- Server-side PDF export faktury.
- Logo, podpis a razítko na webové faktuře i v PDF.
- Dashboard příjmů, nezaplacených faktur, DPH limitu a orientačních odvodů.
- Světlý i tmavý motiv.

## Technologie

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Docker Compose
- PDFKit
- Vitest

## Lokální spuštění

Nainstalujte závislosti:

```bash
npm install
```

Vytvořte lokální `.env` ze vzoru:

```bash
cp .env.example .env
```

Spusťte PostgreSQL pro vývoj:

```bash
docker compose -f docker-compose.dev.yml up -d db
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

Pokud v `.env` nastavíte `AUTH_PASSWORD`, aplikace se zeptá na heslo. Bez něj běží
otevřená a nahoře svítí varovný pruh.

## Docker

Repozitář obsahuje dva compose soubory:

- `docker-compose.yml` — produkční stack pro Portainer. Tahá hotové image z GHCR
  a připojuje se do externí sítě `nginx-proxy-manager_default`.
- `docker-compose.dev.yml` — lokální vývoj. Databáze publikuje port a aplikace se
  staví ze zdrojáků.

Dockerfile staví dva image:

- `runner` → `ghcr.io/michaelptacek05/fakturka:latest` — samotná aplikace.
- `migrator` → `ghcr.io/michaelptacek05/fakturka:migrate` — Prisma CLI a migrace,
  spouští se jednorázově před startem aplikace.

Aplikační image neobsahuje Prisma CLI ani adresář s migracemi, proto migrace
**musí** běžet z image `:migrate`. Oba image publikuje GitHub Actions při pushi
do `main`.

Lokální build a push obou image:

```bash
npm run docker:build && npm run docker:push
```

Celý stack ze zdrojáků:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Nasazení přes Portainer

1. Vytvořte externí síť, pokud ještě neexistuje:

```bash
docker network create nginx-proxy-manager_default
```

2. Vytvořte nový Stack z `docker-compose.yml`.
3. Nastavte proměnné prostředí podle `.env.example`. Povinné jsou
   `POSTGRES_PASSWORD`, `AUTH_PASSWORD` a `AUTH_SECRET` — bez nich stack
   záměrně nenaběhne.
4. `AUTH_SECRET` vygenerujte náhodně:

```bash
openssl rand -base64 32
```

5. Po nasazení zkontrolujte logy služby `migrate`. Musí skončit úspěšně, teprve
   pak startuje `app`.
6. V nginx proxy manageru nasměrujte doménu na hostitele `app` a port `3000`.
   Obě služby musí být ve stejné síti `nginx-proxy-manager_default`.

Aplikace publikuje port i na hostiteli, ale ve výchozím stavu jen na `127.0.0.1`
kvůli ladění. Přímé vystavení na veřejné rozhraní zapnete přes `APP_BIND=0.0.0.0`.

Služba `app` má healthcheck na `/api/health`, který ověřuje i spojení s databází.

### Zálohování

Pro zálohu nestačí jen databáze. Zálohujte:

- PostgreSQL volume `postgres_data`
- aplikační volume `invoice_storage` (logo, podpis, razítko)

## Import z Fakturoidu

V aplikaci najdete sekci **Import**. Podporuje CSV export z Fakturoidu, který
pojmenovává sloupce podle svého API (`name`, `registration_no`, `issued_on`,
`lines__line__unit_price` a podobně), i běžné české hlavičky (`nazev`, `ico`,
`datum_vystaveni`, `celkem`).

- **Odběratelé** — Kontakty → Exportovat → CSV.
- **Faktury** — Faktury → Exportovat. Export včetně položek dá každé položce
  vlastní řádek se stejným číslem faktury, import je zase složí dohromady.
  Export bez položek se naimportuje jako jedna položka s celkovou částkou.

Před uložením se vždy zobrazí náhled, rozpoznané sloupce a upozornění. Nic se
neuloží bez potvrzení. Import je bezpečné spustit opakovaně: faktura s již
existujícím číslem se přeskočí, odběratel se stejným IČO se aktualizuje.
Importované faktury si nechají původní čísla a číselná řada se podle nich posune.

Rozpoznají se oddělovače `;`, `,`, tabulátor i `|`, kódování UTF-8 i Windows-1250
a české i anglické zápisy čísel a dat.

## Projekty a úkoly

**Projekty** sdružují práci pro jednoho odběratele. Odběratel je volitelný, takže
jde vést i interní projekt. Každý projekt má stav (Plánováno, Běží, Pozastaveno,
Dokončeno, Zrušeno), prioritu, termíny a popis. V přehledu jsou projekty
seskupené podle odběratele.

**Úkoly** patří vždy pod projekt a zobrazují se na nástěnce s pěti sloupci:
Zásobník, K udělání, Dělá se, Blokováno a Hotovo. Stav se mění přetažením karty
mezi sloupci; na dotykových displejích slouží k témuž rozbalovací seznam přímo
na kartě. Přesun do sloupce Hotovo automaticky vyplní datum dokončení a návrat
zpět ho zase zruší.

Pořadí karet ve sloupci se drží ručně podle toho, kam je přetáhnete. Karty se
stejným pořadím se řadí podle priority a pak podle termínu. Úkol po termínu má
datum červeně, dokud není hotový.

Nástěnku najdete jednak v agendě **Úkoly** (přes všechny projekty, s filtrem na
projekt a prioritu), jednak na detailu projektu, kde ukazuje jen jeho úkoly.

**Poznámky** se píšou na detailu úkolu. Každá nese datum a čas a řadí se od
nejnovější — hodí se na průběh práce, domluvy s klientem nebo co ještě zbývá.
Počet poznámek je vidět i na kartě na nástěnce.

## Číslování faktur

Formát se nastavuje v **Nastavení → Číslování faktur**. Zástupné znaky:

- `YYYY` — rok
- `MM` — měsíc
- `###` — pořadové číslo, počet znaků `#` určuje počet míst

Pokud formát obsahuje `MM`, řada se resetuje každý měsíc. Pokud jen `YYYY`, tak
každý rok. Bez obojího běží průběžně. Změna formátu se projeví až u další
vystavené faktury, existující doklady si své číslo ponechají.

## Užitečné příkazy

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
docker compose config
```

## Proměnné prostředí

Kompletní seznam je v `.env.example` i s komentáři. Nejdůležitější:

| Proměnná | Význam |
| --- | --- |
| `DATABASE_URL` | Připojení k PostgreSQL pro Prisma. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Údaje databáze v compose. |
| `AUTH_PASSWORD` | Heslo do aplikace. Prázdné = běh bez přihlášení a varovný pruh. |
| `AUTH_SECRET` | Náhodný klíč pro podpis session cookie. |
| `AUTH_SESSION_HOURS` | Platnost přihlášení, výchozí 720 hodin. |
| `NEXT_PUBLIC_APP_URL` | Veřejná URL aplikace. |
| `APP_PORT`, `APP_BIND` | Port a rozhraní publikované na hostiteli. |

Změna `AUTH_PASSWORD` nebo `AUTH_SECRET` odhlásí všechny existující relace.

Docker image má napevno `TZ=UTC`, aby se data vystavení a splatnosti neposouvala
o den podle časové zóny hostitele.

## Testy

Testy pokrývají čistou logiku bez databáze — číslování faktur, parsování CSV,
mapování importu z Fakturoidu, řazení úkolů na nástěnce a validace IČO, DIČ,
účtu, IBANu a částek.

```bash
npm test
```

## Stav projektu

Hlavní end-to-end tok je funkční a ověřený: profil vystavitele, odběratelé,
faktury, ARES, tiskové rozložení, QR platba, PDF export, assety, import
z Fakturoidu, projekty s úkoly a dashboard.

Známá omezení:

- Aplikace je single-user, přihlášení je jedno sdílené heslo.
- QR platbu je vhodné ověřit v cílové bankovní aplikaci.
- PDF výstup může vyžadovat další typografické doladění.
- Podporovaná měna je CZK. Faktury v jiné měně se naimportují, ale přehledy
  a QR platba s nimi nepočítají.
- Aplikace nenahrazuje účetní ani daňové poradenství.

Další plánované kroky:

- integrační testy nad databází,
- exporty pro účetní programy (ISDOC),
- propojení projektů s fakturací (vyfakturováno na projektu),
- lepší produkční observabilita.

## Licence

Projekt je dostupný pod licencí MIT. Podrobnosti jsou v souboru `LICENSE`.
