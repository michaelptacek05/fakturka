# Fakturka — realizační plán refactoringu pro AI agenty

## Cíl a rozsah

Postupně zpřehlednit současnou aplikaci, usnadnit orientaci lidem i AI,
omezit duplicity a zlepšit testovatelnost. Výkon optimalizovat až podle měření.
Každá etapa má být samostatně použitelná, kontrolovatelná a vratná přes Git.

Výchozí chování určují `README.md`, `AGENTS.md` a ověřené současné toky.
`plan.md` slouží pouze jako historický kontext. Zachovat české texty,
single-user režim, existující URL, formulářová pole, chybové stavy a výstupy.

Součástí tohoto tasku jsou průzkum, malé strukturální změny, cílené testy,
kontrola dopadů a dokumentace architektury. Produktový backlog je v
[TODO.md](TODO.md). Nové produktové funkce, redesign,
změny daňových pravidel, plošný upgrade závislostí a změny schématu vést
samostatně. Nalezenou existující chybu zaznamenat s reprodukcí; opravu nemíchat
do mechanického přesunu kódu.

## Doporučený rozsah první realizace

Nezačínat závazkem dokončit všechny R0–R8. První milník je rozdělení
serverových akcí podle agendy, zachování jejich kontraktů a krátká mapa
architektury. Navazující sjednocení výpočtů vyžaduje nejprve vyřešit rozdíly
současného chování. Formulář, PDF a výkon posuzovat jako další milníky.

- **Nezbytné:** inventura call sites, výchozí validace, potřebné charakterizační
  testy, malé přesuny akcí a průběžná dokumentace.
- **Podmíněné přínosem:** samostatné DB služby, rozdělení PDF layoutu,
  hook formuláře a části task boardu. Nevytvářet je jen pro splnění checkboxu.
- **Samostatná rozhodnutí:** opravy existujících chyb, E2E infrastruktura,
  přesnost množství a stránkování. Přesun kódu je sám nerozhoduje.

Testy přidávat před konkrétní rizikovou extrakcí. R1 není požadavek předem
automatizovat celou aplikaci. Výkonový baseline velkých sad není podmínkou
prvního mechanického přesunu; je podmínkou pozdějšího výkonového PR.

## Doplnění průzkumu — 11. 10. 2026

Kontrolovaný základ: `61c557f5c6228fc1879f5752c079459e6d4e55da`, větev
`docs/refactoring-plan`. Na začátku byly `REFACTORING_PLAN.md` a `TODO.md`
nesledované soubory; checkout tedy nebyl čistý. Tento průzkum upravuje pouze
plán, ne aplikaci. Jde o doplnění původního auditu, nikoli dokončené R0.

| Zjištění | Důkaz a omezení | Dopad na plán |
| --- | --- | --- |
| Náhled a server používají rozdílné pořadí výpočtu. | `invoice-form.tsx:getRowTotal` a `totals` proti `actions.ts:parseInvoiceFormData`. Pro množství `0.5`, cenu `0.29` a DPH 0 vychází náhled 14 haléřů, server 15. Výrazy reprodukovány v Node; celý submit/UI zatím neověřen. | Před sjednocením v R3 doložit tok regresním scénářem a opravu oddělit od přesunu. Zachovat serverový výsledek je doporučený návrh. |
| Přesnost výpočtu množství neodpovídá uložené přesnosti. | Tvorba, editace i import počítají z původního množství, ale zapisují `quantity.toFixed(3)` do `Decimal(12,3)`. Pro `1.2345 × 1000` je vypočteno 1234,50 Kč, uložené množství `1.234` odpovídá 1234,00 Kč. Reprodukovány výrazy; DB/import/UI tok zatím neověřen. | Rozhodnout zaokrouhlení, odmítnutí nebo podporu vyšší přesnosti. Změnu pravidla nemíchat do extrakce výpočtů. |
| Souběžné mazání plateb není pokryté. | `deleteInvoicePayment` přepočítává cache v transakci bez explicitní izolace, oproti přidání a doplacení. Existující testy pokrývají jen postupné mazání. | Doplnit prověření dvou různých mazaných plateb a mazání/úhrady; porovnat cache se součtem historie. Jde o hypotézu, ne potvrzenou chybu. |
| `format.ts` nemá runtime závislost na Prisma klientovi. | `decimalFromCents` vrací řetězec přes `toFixed(2)`; modul nemá importy. | Modul lze používat na klientu. Pro extrakci nevyžaduje zvláštní serverovou hranici. |
| Testovací factory obchází skutečné vystavení dokladu. | `tests/integration/factory.ts:createInvoice` zapisuje přímo přes Prisma; nevolá serverovou akci tvorby. | Pro R2 faktur doplnit test skutečné akce s `FormData`, číslem, položkami a snapshotem; nezaměňovat jej za existující platební testy. |

Provedeno: `npm test` — 8 souborů / 155 testů prošlo;
`npm run test:agents` — 30 testů prošlo. Použity stávající lokální závislosti
a Node `v22.20.0`, nikoli čistá instalace odpovídající CI. CI nyní používá
Node 24, PostgreSQL 16 a `TZ=UTC`. `npm ci`, generování klienta, lint,
typecheck, build, integrační testy, HTTP/browser testy, render PDF ani měření
výkonu při tomto doplnění spuštěny nebyly.

Otevřené otázky před realizací:

1. **Rozhodnuto uživatelem:** existující chyby opravit před refaktorem dotčené
   oblasti, opravy oddělit od mechanických přesunů.
2. **Rozhodnuto uživatelem:** přidat malou automatickou E2E sadu.
3. **Rozhodnuto uživatelem:** podporovat vyšší přesnost množství. Pracovní
   návrh je 9 desetinných míst a zachování devíti míst celé části
   (`Decimal(18,9)`); otázka na jiný požadovaný limit byla položena zvlášť.
   Jde o samostatnou funkční změnu s novou migrací.

Opravy nalezených výpočtů, vyšší přesnost a E2E tooling jsou nyní schválené.
Realizují se na větvi `fix/invoice-precision-e2e` před strukturálními přesuny.
Nový nález zaznamenat
s důkazem, označit úroveň ověření a položit otázku jen tehdy, pokud vyžaduje
změnu rozsahu nebo produktového pravidla.

### Další nález při realizaci — přesnost sazby DPH

`normalizeVatRate` i potvrzený import ponechávají více než dvě desetinná místa,
ale zápis používá `vatRate.toFixed(2)` a sloupec má `Decimal(5,2)`.
Pro sazbu `21.005` a základ 1000 Kč vychází DPH 210,05 Kč, zatímco uložená
sazba `21.00` odpovídá 210,00 Kč. Rozdíl reprodukován na výrazech v Node;
celý importní tok pro tento případ zatím ověřen nebyl. Problém existoval už
před touto změnou. Vyžaduje rozhodnutí mezi odmítnutím vyšší přesnosti,
normalizací sazby před výpočtem a rozšířením její DB přesnosti. Otázka byla
položena uživateli; nynější oprava množství toto pravidlo nemění.

Výsledek realizace a konkrétní ověření jsou v [docs/refactoring.md](docs/refactoring.md).

## Výchozí mapa a doporučená místa změn

Počty řádků jsou orientační ze stavu prozkoumaného při přípravě plánu.
Délka souboru sama o sobě není důvod ke změně.

| Oblast | Současné místo | Doporučený zásah |
| --- | --- | --- |
| Serverové akce | `src/app/actions.ts` (~1 053 řádků) | Rozdělit podle agendy; postupně oddělit vstupy, operace a Next.js obsluhu. |
| Výpočty položek | `src/app/actions.ts`, `src/app/(app)/import/actions.ts`, `src/components/invoices/invoice-form.tsx` | Porovnat vstupní normalizaci a zaokrouhlení, pak sdílet čistý výpočet. |
| Stavy dokladů | `src/app/(app)/page.tsx`, `src/app/(app)/invoices/page.tsx`, `src/app/(app)/invoices/export/route.ts` | Sjednotit popisky; stav nadále odvozovat přes `invoice-payment.ts`. |
| Formulář faktury | `src/components/invoices/invoice-form.tsx` (~660 řádků) | Oddělit sekce a pomocnou logiku bez změny odesílaných dat. |
| PDF a detail | `src/lib/invoice-pdf.ts` (~807 řádků), `src/app/(app)/invoices/[id]/page.tsx` | Sjednotit přípravu společných údajů a oddělit PDF layout. |
| Import | `src/app/(app)/import/actions.ts`, `src/lib/fakturoid-import.ts`, `src/lib/csv.ts` | Oddělit validaci potvrzeného payloadu od zápisu; zachovat náhled. |
| Projekty a úkoly | `src/app/(app)/projects/actions.ts`, `src/components/tasks/task-board.tsx` | Oddělit akce projektů a úkolů, případně menší části nástěnky. |
| Dashboard a seznam | `src/app/(app)/page.tsx`, `src/lib/dashboard.ts`, `src/app/(app)/invoices/page.tsx` | Změřit načítání celé historie; teprve poté navrhnout omezení dat a stránkování. |
| Autentizace a provoz | `src/proxy.ts`, `src/lib/auth.ts`, Docker a `.github/` | Kontrolovat dopady změn; upravovat jen při doložené potřebě. |

## Zjištění z přípravného auditu

Příprava tohoto plánu zahrnovala tři nezávislé read-only průzkumy:
strukturu a duplicity, architekturu a testovací pokrytí. Testy aplikace ani
měření výkonu při přípravě dokumentu spuštěny nebyly. Následující body jsou
podněty k ověření, nikoli potvrzené nové regresní nálezy:

- `tests/integration/invoice-import-qr.test.ts` sestavuje payload vlastní
  pomocnou funkcí. Případ nazvaný „QR nese doplatek“ používá fakturu bez
  plateb; nepokrývá skutečný QR webu/PDF po částečné úhradě. Přidat scénář
  10 000 Kč celkem, 4 000 Kč úhrada, 6 000 Kč v dekódovaném QR.
- Dashboard dotaz ani jeho vstupní typ neobsahují `currency`, zatímco README
  deklaruje vyloučení cizích měn z CZK přehledů. Reprodukovat import EUR
  a ověřit dashboard, web a PDF včetně pravidel QR; případnou opravu vést zvlášť.
- `updateInvoice` kontroluje platby před transakcí a `cancelInvoice` čte
  uhrazenou částku před svou transakcí. Prověřit editaci/úhradu, storno/úhradu
  a dvě současná storna s refundací. Z výsledku neodvozovat chybu bez reprodukce.
- Prověřit souběžné první vytvoření bez existující číselné řady a souběh
  importu s vystavením nové faktury.
- Browser/E2E runner a automatické testy auth/proxy ani skutečně renderovaného
  PDF nebyly v inventuře nalezeny. Jednotkové testy nenahrazují HTTP/UI kontrolu.
- `format.ts` má kandidáty na mrtvé exporty (`parseMoneyToCents`,
  `parseQuantity`, `getRequiredString`, `getOptionalString`). Před odstraněním
  prověřit všechny importy, reexporty a použití. PDF dotaz má také kandidáta
  na zbytečné načítání `client: true`; skutečné konzumenty ověřit.

Zachovat a využít existující moduly `invoice-payment.ts`, `invoice-number.ts`,
`validation.ts`, `dashboard.ts`, `project-task.ts`, `spayd.ts` a `tax-estimate.ts`.
Nevytvářet univerzální repository vrstvu, DI framework, generický CRUD ani
soubor `helpers.ts` spojující nesouvisející agendy.

## Role agentů a jejich zadání

Role jsou pracovní zadání pro budoucí realizaci; jejich uvedení zde neznamená,
že implementace nebo testy již proběhly. Koordinátor před každou etapou předá
agentům konkrétní výchozí commit, rozsah a vlastnictví souborů.
Role lze vykonat postupně. Samotné čtení tohoto plánu není zadáním spustit
pomocné agenty; paralelní realizaci určuje aktuální zadání.

| ID / role | Odpovědnost | Výstup | Práva |
| --- | --- | --- | --- |
| A0 — koordinátor | Řídit etapy, závislosti, větve, předávání a řešení připomínek. | Aktuální plán, přidělené úkoly, integrovaný PR a závěrečný report. | Edituje dokumentaci a integruje do feature větve. |
| A1 — průzkumník | Hledat další místa pro zjednodušení, duplicity a zbytečnou složitost. | Seznam kandidátů s důkazem, dopadem, rizikem a prioritou. | Pouze čtení. |
| A2 — architekt | Prověřit hranice modulů, kontrakty a pořadí extrakcí. | Mapa současné/cílové struktury, seznam call sites a návrh etap. | Pouze čtení; dokumentaci předává A0. |
| A3 — implementátor | Provést právě přidělenou etapu s minimálním diffem. | Kód, seznam dopadů a podklady pro PR. | Jen přidělené soubory aplikace. |
| A4 — autor testů / tester | Doplnit důležité scénáře a spustit ověření konkrétního commitu. | Testy a výsledky příkazů s prostředím a commitem. | Přidělené testy; konfigurace po domluvě s A0. |
| A5 — nezávislý reviewer | Prověřit diff a affected call sites proti pravidlům projektu. | České actionable nálezy nebo výslovně žádné nálezy. | Pouze čtení; nepíše opravy ani nemerguje. |
| A6 — výkon a dokumentace | Měřit skutečné úzké místo a popsat výslednou architekturu. | Reprodukovatelné měření a návrh; podklady pro `docs/architecture.md`. | Měřicí skripty a dokumentace, pokud je A0 přidělí. |

Společná instrukce pro všechny agenty:

> Přečti `AGENTS.md`, `README.md` a `REFACTORING_PLAN.md`. Pracuj na přidělené
> etapě a commitu. Zachovej chování a účetní pravidla. Needituj soubory jiného
> agenta. Odděl ověřená zjištění od hypotéz a existující problémy od regresí.
> Používej syntetická data. Nepřidávej tajné údaje ani generované artefakty do
> Gitu. Vrať konkrétní důkazy, provedené kontroly a zbývající nejistoty.
> Nepushuj ani nemerguj `main`. Nespouštěj další agenty mimo přidělený rozpočet.

Konkrétní zadání při spuštění role:

- **A1:** „Prozkoumej přidělenou oblast i její volající místa. Najdi maximálně
  pět užitečných zlepšení. U každého uveď cestu a symbol, příklad problému,
  nejmenší změnu, riziko a test. Zvlášť označ novou funkci nebo možnou chybu.
  Před dokončením etapy znovu prohlédni změněnou oblast a navazující call sites.“
- **A2:** „Navrhni minimální rozdělení pro tuto etapu: odkud kam se přesouvají
  konkrétní symboly, kdo je volá a které moduly patří jen na server. Popiš
  zachované transakce, validační hranice a kompatibilitu exportů. Rozhodni,
  zda extrakce skutečně zlepšuje práci s kódem.“
- **A3:** „Implementuj schválenou mapu této etapy. Mechanický přesun odděl
  od změny logiky. Zachovej podpisy akcí, pole formulářů, přesměrování,
  revalidace a zámky. Nově nalezené problémy předej A0 s důkazem.“
- **A4:** „Ověř výchozí chování a doplň jen scénáře potřebné pro tuto změnu.
  Testuj výsledek, ne kopii implementace. Použij skutečný PostgreSQL pro
  transakční pravidla. Vrať příkaz, commit, výsledek a přesné omezení ověření.“
- **A5:** „Zkontroluj diff konkrétního commitu i affected call sites.
  U nálezu napiš česky závažnost, nejmenší rozsah souboru/řádků, scénář selhání,
  dopad, relevantní pravidlo a návrh opravy. Lint nech CI. Dokumentovaná omezení
  neoznačuj jako nové regrese. Opravy pouze doporuč.“
- **A6:** „Změř přidělený tok před změnou a po ní za stejných podmínek.
  Rozliš čas databáze, přípravy dat a odezvy. Navrhni nejmenší doloženou
  optimalizaci. Aktualizuj mapu architektury pouze podle skutečného výsledku.“

## Organizace paralelní práce

Použít nejvýše čtyři současně aktivní agenty včetně A0. Role se obsazují
postupně; není potřeba sedm agentů běžících současně.

1. Příprava: A0 + A1 + A2 + A4, všichni kromě A0 nejprve čtou.
2. Realizace etapy: A0 + A3 + A4; A1 může souběžně hledat další kandidáty.
3. Po dokončení editací: A0 + A5 + A4 + případně A6. Review i testy musí
   vyhodnotit stejný konečný commit; po opravě znovu ověřit dotčené oblasti.

Jeden soubor má vždy jednoho zapisujícího vlastníka. A3 mění aplikaci,
A4 testy; oba si předem sjednají názvy exportů a vstupy. `package.json`,
lockfile, CI, Prisma schéma a sdílené základní moduly mají v dané etapě
výslovného vlastníka. Široké změny na jednom checkoutu neprovádět souběžně.

Pro nezávislé implementace použít samostatné feature větve/worktrees.
Závislé PR nejlépe realizovat postupně z aktualizovaného `main`; pokud
vzniknou stacked PR, explicitně uvést jejich základ a závislosti a po změně
základu znovu ověřit výsledný diff. Reviewer nesmí být autorem změny.

Nespouštět více integračních/E2E sad nad stejnou databází. Ani vypnutá
paralelizace souborů ve Vitestu nezabrání kolizi mezi dvěma agentími procesy.
Každý izolovaný běh potřebuje vlastní disposable instanci nebo vlastní
jednoznačný název databáze a úložiště.

## Etapy a podmínky dokončení

Každá položka R0–R8 je samostatný pracovní balík; větší balík rozdělit do
menších PR podle agendy. Checkbox označit až po doloženém dokončení.

### R0 — průzkum a výchozí stav

- [ ] A0 zaznamená výchozí commit, čistotu checkoutu a aktuální větve.
- [ ] A1 a A2 zmapují call sites a závislosti, ne jen dlouhé soubory.
- [ ] A4 spustí výchozí validaci a inventuru již pokrytých scénářů.
- [ ] A6 nebo A0 připraví reprodukovatelné podmínky měření dashboardu a seznamu.
  Měření velkých sad provede nejpozději před výkonovou změnou v R7.
- [ ] A0 založí stručný `docs/refactoring.md`: výchozí commit, zjištění,
  rozhodnutí, testovací mezery, měření a plán PR.

Pro srovnání použít prostředí odpovídající současnému CI: Node 24,
PostgreSQL 16 a `TZ=UTC`; před realizací ověřit, zda se CI nezměnilo.
U každého rizikového scénáře evidovat výsledek na výchozím i novém SHA.

**Dokončeno:** každý kandidát má konkrétní přínos a riziko; jsou odděleny
předem existující problémy a je známý výchozí stav kontrol. Selhání výchozí
kontroly nejprve vysvětlit, případně opravit samostatně; nevykládat je jako
úspěšnou validaci refactoringu.

### R1 — cílené pokrytí rizikových hranic

- [ ] A4 doplní chybějící scénáře potřebné pro následující extrakce:
  tvorbu/úpravu dokladu, klientský snapshot, číslování a import.
- [ ] Využije existující `tests/integration/factory.ts` a testy plateb,
  hromadného mazání a importovaného QR; nevytváří druhý testovací systém.
- [ ] Připraví syntetické příklady pro web/PDF a formulář. Browser/E2E tooling
  přidá jen pokud je nutné pro ověření, v samostatném malém PR s vlastní CI.

**Dokončeno:** nové testy ověřují pozorovatelné pravidlo a běží již nad
výchozím kódem. Pokud odhalí chybu, A0 ji zařadí samostatně a určí závislost.
Prostý přesun exportu nevyžaduje nový test zrcadlící strukturu souborů.

### R2 — rozdělení `src/app/actions.ts`

- [ ] Nejprve přesunout odběratele do `src/app/(app)/clients/actions.ts`
  a profil do `src/app/(app)/settings/profile/actions.ts`; aktualizovat
  formuláře a nastavení. Použít stejný vzor jako existující import/projekty.
- [ ] Poté přesunout upload/mazání do
  `src/app/(app)/settings/profile/asset-actions.ts`;
  zachovat použití `src/lib/invoice-assets.ts` a cleanup souborů.
- [ ] Přesunout tvorbu, editaci a hromadné mazání do
  `src/app/(app)/invoices/actions.ts` a platební operace včetně `cancelInvoice`
  do `src/app/(app)/invoices/payment-actions.ts`. Pomocný přepočet plateb
  nejprve ponechat jako soukromou funkci vedle akcí.
- [ ] Upravit volající stránky, komponenty a integrační testy; přes
  `rg '@/app/actions' src tests` ověřit, že nezůstaly zastaralé importy.
- [ ] Původní `src/app/actions.ts` odstranit po migraci všech call sites.
  Dočasný kompatibilní modul ponechat jen s jasným důvodem a úkolem k odstranění.

**Dokončeno:** malé PR podle agendy, stejné výsledky a chybové URL, žádná
změna účetní logiky. Soubory s `"use server"` exportují pouze asynchronní
serverové akce; obyčejné helpery a konstanty mají samostatné moduly. Build
ověří hranici mezi klientskými importy akcí a serverovým kódem.

Kontrolovat minimálně `client-form.tsx`, `invoice-bulk-table.tsx`,
`invoice-status-actions.tsx`, `invoice-payments-card.tsx`, stránku nastavení
profilu, vytvoření/editaci faktury a integrační testy plateb a mazání.
Sdílený parser odběratele případně vyjmout již při prvním přesunu jako jeho
nutnou závislost; změnu výpočtů ponechat pro R3.

### R3 — oddělení pravidel a sjednocení duplicity

- [ ] Oddělit `buildClientData` do `src/lib/client-form.ts` a
  `parseInvoiceFormData`, klientský snapshot a související typy do
  `src/lib/invoice-form.ts`; další dělení jen při prokázané potřebě.
- [ ] Po porovnání současného chování extrahovat čisté výpočty do
  `src/lib/invoice-calculations.ts`; vstupem jsou již normalizované hodnoty.
  Serverová validace a tolerantní náhled rozepsaného formuláře mají odlišný účel.
- [ ] Sdílené české popisky stavů umístit do
  `src/lib/invoice-presentation.ts`, bez závislosti na Prisma klientovi nebo Nextu.
  Zahrnout i detail faktury a případné sdílené varianty badge.
- [ ] DB operace extrahovat do `src/lib/server/invoice-mutations.ts` a případně
  `src/lib/server/invoice-payments.ts`, pokud to zlepší čitelnost a testování.
  Next akce si ponechají `redirect` a `revalidatePath`.
- [ ] A2 prověří, že helper uvnitř transakce používá předané `tx`, nikoli
  globální `prisma`, a že změna nepřidala vnořené transakce.
- [ ] Posoudit společné mapování položek do Prisma Decimal hodnot pro tvorbu,
  úpravu a import. Pravidla hledání klienta podle IČO/e-mailu/názvu nesjednocovat
  bez specifikace: současné toky mají rozdílné účely.

**Dokončeno:** žádná změna pořadí zaokrouhlení, peněz, datumů, locků nebo
atomického zápisu. Čisté moduly lze importovat v klientu bez `fs`, PDFKit,
DB klienta nebo tajných konfigurací. Serverové služby nejsou přímé klientské
importy; případné použití `server-only` řešit i v konfiguraci testů.
`redirect` zůstává mimo transakci a nesmí jej spolknout obecný `catch`;
revalidace probíhá po úspěšném zápisu. `format.ts` je nyní bez runtime importů;
`decimalFromCents` připravuje řetězec pro DB, nevytváří Prisma Decimal.
Tuto použitelnost na klientu zachovat i při další extrakci.

### R4 — import, projekty a úkoly

- [ ] V samostatném PR oddělit validaci potvrzeného importního payloadu do
  `src/lib/import/validation.ts` a zápis do `src/lib/server/import-service.ts`.
  `csv.ts` a `fakturoid-import.ts` ponechat jako využívané parsery.
- [ ] Zmapovat `syncSequenceAfterImport` a tvorbu faktury společně;
  při extrakci neměnit transakční hranice. Případnou chybu souběhu řešit
  jako samostatnou opravu s integračním testem.
- [ ] V dalším PR rozdělit `src/app/(app)/projects/actions.ts` na akce
  projektů, úkolů a poznámek; pro úkoly použít
  `src/app/(app)/tasks/actions.ts`, poznámky oddělit až při reálném přínosu.
- [ ] Zachovat `project-task.ts`, pořadí karet, priority, `doneAt`, termíny,
  drag & drop i dotykové ovládání. Nástěnku dělit jen podle odpovědností.

**Dokončeno:** import má nadále náhled, potvrzení, serverovou validaci,
idempotenci a klientské párování podle IČO; úkoly se chovají stejně.
Žádná neplánovaná změna mazání vztahů, číslování nebo stavů.
Zachovat i dosavadní chování při částečném selhání importu; nepřevádět jej
automaticky na jednu velkou transakci. U nástěnky prověřit řazení napříč
projekty, nejen uvnitř detailu jednoho projektu.

### R5 — formulář a stránky

- [ ] Rozdělit formulář v `src/components/invoices/` například na
  `invoice-client-fields.tsx`, `invoice-date-fields.tsx`,
  `invoice-items-editor.tsx` a `invoice-payment-fields.tsx`.
- [ ] `invoice-form.tsx` ponechat jako orchestrace společného stavu a submitu.
  Hook extrahovat jen pro ucelenou logiku, ne jako přesun všech řádků jinam.
- [ ] Zachovat `name` polí a pořadí polí více položek, výběr klienta,
  přednastavenou splatnost, ARES, předvyplnění při editaci a chování neplátce.
  Zachovat stabilní klíče řádků a `useId` při hydrataci.
- [ ] Dlouhé stránky dělit na obsahové sekce pouze tam, kde to usnadní změny;
  zachovat serverové komponenty a nešířit `"use client"` na celý dashboard.

**Dokončeno:** srovnání stejného vstupu před/po, stejné odeslané `FormData`
a serverové výsledky. Browser kontrola klávesnice, mobilního rozložení,
přidání/odebrání položek, submitu a chyb. Vzhled není cílem této etapy.

### R6 — společná příprava web/PDF a PDF moduly

- [ ] A2 porovná údaje a pravidla detailu, PDF a QR. Společnou čistou
  přípravu extrahovat například do `src/lib/invoice-document-data.ts`.
- [ ] `invoice-pdf.ts` zachovat jako veřejný vstup `renderInvoicePdf`;
  do `src/lib/server/invoice-pdf/` přesunout typy, layout, kreslení položek a patičky
  v míře, která zjednoduší čtení.
- [ ] Zachovat práci s fonty, assety, stránkováním a zbývající částkou QR.
- [ ] A4 porovná texty, hodnoty a QR a vizuálně zkontroluje vyrenderované
  PDF; byte-for-byte porovnání PDF není vhodná podmínka shody.
  Dekódovat skutečný QR výstup, nikoli jeho napodobeninu v testovacím helperu.

**Dokončeno:** web/PDF se shodují u plátce i neplátce, částečné a plné úhrady,
storna a jiné měny; dlouhé položky, více stran a chybějící assety nezničí layout.
Snapshot vystavitele z produktového backlogu v `TODO.md` zůstává samostatnou funkční změnou.

### R7 — doložené zlepšení výkonu

- [ ] A6 změří dashboard a seznam na syntetických sadách např. 100,
  1 000 a 10 000 faktur s platbami. Zaznamená prostředí a rozložení stavů/dat.
- [ ] Použije produkční build, zahřátí a více opakování; zaznamená medián,
  případně p95, počet/čas dotazů a přibližný objem načítaných dat.
- [ ] Oddělí práci databáze, `buildDashboardData` a odezvu stránky.
  Agregace i dotazy posoudí nad stejnými daty a bez citlivých parametrů v logách.
- [ ] Podle výsledků navrhne menší výběr sloupců, vhodné omezení historie,
  agregace nebo stránkování. Index přidá jen na základě dotazu a jeho plánu;
  vyžaduje novou migraci a integrační ověření.
- [ ] Stránkování realizovat v samostatném PR s definicí filtrů, celkových
  počtů, výběru řádků a exportu. Vizuální stav nelze filtrovat pouze
  podle uloženého `InvoiceStatus`.

**Dokončeno:** měřitelný přínos bez změny součtů a historie plateb; porovnání
se referenčním výpočtem. Pokud se přínos nepotvrdí, ponechat jednodušší variantu
a zaznamenat výsledek. Neslibovat zrychlení jen na základě struktury kódu.

### R8 — dokumentace a závěrečná kontrola

- [ ] A0/A6 sepíšou `docs/architecture.md`: mapa agend, server/klient hranice,
  kde měnit konkrétní funkci, peníze/datumy, transakce a přiřazené testy.
- [ ] A1 zkontroluje výslednou strukturu a předá další doložené příležitosti
  do backlogu; nic nového automaticky nepřidává do dokončované etapy.
- [ ] A0 odstraní přechodné exporty a mrtvé importy a připraví konečný commit.
- [ ] A5 provede závěrečné review výsledného diffu a call sites a A4 spustí
  celou předepsanou validaci stejného konečného SHA. Po jakékoli další změně
  znovu ověřit výsledný commit.
- [ ] A0 aktualizuje checkboxy, rozhodnutí a odkazy na PR; výsledný report
  rozlišuje hotové změny, neprovedené kontroly a zbývající omezení.

**Dokončeno:** strukturu lze pochopit z krátké mapy, každá etapa má evidenci
kontrol a review a nezůstaly nevyřešené actionable regrese.

## Závislosti a doporučená posloupnost PR

R0 je společný začátek. R1 se doplňuje po částech před dotčenými změnami.
R2 klientů/profilu/assets předchází R2 faktur/plateb kvůli sdíleným parserům.
R3 výpočtů předchází R5 formuláře; R6 společných údajů potřebuje ustálené
platební a prezentační kontrakty. R4 projektů není závislé na R3 faktur.
R4 importu potřebuje rozhodnutá pravidla výpočtů, pokud je bude sdílet.
R7 lze otevřít až s měřením; není podmínkou R8 ani ostatních refaktorů.
Dokumentace vzniká průběžně, R8 je závěrečná kontrola příslušného milníku.

### Konkrétní pracovní balíky a hranice PR

Pořadí v tabulce je doporučené. Nezávislé balíky lze přehodit; žádný PR
nemá čekat na všechny pozdější etapy. Každý aplikační PR projde sadou z
`AGENTS.md`; sloupec ověření zdůrazňuje cílené scénáře navíc.

| PR / etapa | Konkrétní rozsah | Závislost | Cílené ověření / podmínka dokončení |
| --- | --- | --- | --- |
| P0 / R0 | Výchozí kontroly, mapa exportů/call sites, `docs/refactoring.md` a evidence existujících problémů. | Žádná. | Čistá instalace v CI prostředí, úplné výsledky kontrol; nic neoznačit za dokončené pouze podle tohoto průzkumu. |
| P1 / R1 | Charakterizační testy tvorby a úpravy přes skutečné akce; snapshot klienta a neměnné číslo. | P0. | Platné i neplatné `FormData`, DB rollback a cíl redirectu. Chybu řešit samostatně; test správného chování nemusí na chybném základu projít. |
| P2 / R2 | `createClient`, `updateClient`, `deleteClient` do clients/actions; `buildClientData` do lib/client-form jako nutná sdílená závislost. | P0 a příslušné scénáře R1. | Pole a validační URL client-form; stejný parser pro faktury. |
| P3 / R2 | `upsertProfile` a potom obě asset akce do profilové agendy. Pokud diff míchá odlišné odpovědnosti, rozdělit na dvě PR. | P2. | Všechny sekce nastavení, číselná řada, upload/odstranění a cleanup po neúspěchu. |
| P4 / R2 | `createInvoice`, `updateInvoice`, `deleteInvoices` do invoices/actions. Parser prozatím vedle nich. | P1, P2, P3. | Integrační tvorba/úprava, snapshot, položky, číslování a bulk delete. Transakce zůstávají stejné. |
| P5 / R2 | `addInvoicePayment`, `deleteInvoicePayment`, `markInvoicePaid`, `cancelInvoice` a jejich soukromé helpery do payment-actions. Odstranit původní actions až po ověření všech importů. | P4 a platební scénáře R1. | Existující platební integrace, revalidace a redirecty; souběhové chyby mají vlastní opravu. |
| P6 / R3 | `parseInvoiceFormData`, snapshot a typy do invoice-form; čistý výpočet sdílet po vyřešení nalezených rozdílů. | P4/P5 a rozhodnutí o výpočtech. | Matice plátce/neplátce, množství, ceny, hraniční zaokrouhlení; preview/DB/import porovnat na platných normalizovaných vstupech. |
| P7 / R3 | Společné popisky vizuálních stavů pro dashboard, seznam, detail a CSV. | P0; může předcházet P6. | Partial po splatnosti, koncept, storno a shoda filtru s viditelným štítkem. Výpočet stavu zůstává v invoice-payment. |
| P8 / R4 | Serverová validace importu odděleně od orchestrace/zápisu. | P6 jen při sdílení výpočtu. | Potvrzený payload, druhý import, více položek, import→nové číslo, částečné selhání a původní čísla. |
| P9 / R4 | Úkolové akce do tasks/actions; projekty ponechat. Poznámky/board rozdělit jen při přínosu. | P0 a cílené testy R1. | `doneAt`, pořadí napříč projekty, filtry a dotykový přesun. |
| P10 / R5 | Oddělit sekce formuláře bez změny řízení společného stavu a `name` polí. | P6 a zvolená browser kontrola. | Shodné `FormData`, editace, přidání/odebrání řádků, ARES, hydratace, chyby a mobil. |
| P11 / R6 | Nejprve společná příprava dokumentu, potom případně rozdělení PDF layoutu jako další PR. | P5/P7 a charakterizační web/PDF scénáře. | Skutečný QR 10000−4000=6000, PDF text/layout, více stran, DPH a měny; vady výchozího chování řešit zvlášť. |
| P12 / R7, volitelné | Nejmenší optimalizace podložená měřením. Stránkování ani index nezahrnovat automaticky. | Reprodukovatelný baseline a specifikace případné změny UI. | Stejné syntetické sady před/po, shodné součty, filtry, export a výběr. Bez přínosu PR nevytvářet. |
| P13 / R8 | Dokončit průběžnou mapu `docs/architecture.md`, odstranit přechodné exporty a uzavřít milník. | Jen skutečně realizované balíky. | Dokumentace odpovídá výslednému kódu; testy a nezávislé review konečného SHA. |

Pro každý balík před editací sepsat exporty, jejich nové umístění, konzumenty,
`FormData` klíče, chybové/úspěšné URL, revalidované cesty a transakční hranice.
Případná DB služba z R3 vyžaduje zvláštní zdůvodnění; není povinným P6.
U samostatného PR s chybou uvést reprodukci na původním SHA a regresní test,
který před opravou selže a po opravě projde. Nezaměňovat jej za
charakterizační test zachovaného chování.

Příklad názvů větví: `refactor/baseline-tests`, `refactor/profile-client-actions`,
`refactor/invoice-payment-actions`, `refactor/invoice-rules`,
`refactor/import`, `refactor/project-task-actions`, `refactor/invoice-form`,
`refactor/invoice-pdf`, `perf/invoice-queries`, `docs/architecture`.
Jde o návrhy názvů, nikoli již vytvořené větve.

## Validace a kritické scénáře

Před implementací: `npm ci` a `npm run prisma:generate`.
Pro každý PR měnící aplikaci nebo automatizaci spustit:

```sh
npm run lint
npm run typecheck
npm test
npm run test:agents
npm run build
```

Pro změny DB, plateb, importu nebo migrací navíc:

```sh
npm run test:integration
```

Použít jednorázový PostgreSQL kontejner se syntetickými credentials,
unikátním jménem a portem na `127.0.0.1`, bez produkčních volumes. Na konci
odstranit pouze kontejner vytvořený pro tento běh. Testovací infrastruktura
odvozuje `<název>_test` z `DATABASE_URL`; testy resetují data. Neukazovat
produkční přihlašovací údaje ani výpis `.env`. Před běhy odstranit případný
`TEST_DATABASE_URL` z prostředí a lokální testové konfigurace, aby nepřebil
syntetický cíl. Výchozí setup stále potřebuje `DATABASE_URL`. Ověřit skutečnou
testovou DB, nastavit `TZ=UTC` a nedovolit souběžné resety stejné databáze.
Při migraci testovat prázdnou DB i syntetická starší data; aplikované migrace
neupravovat.

| Hranice | Scénáře k ověření při její změně |
| --- | --- |
| Doklad a číslování | Nový/úprava, změna klienta bez změny snapshotu, změna formátu jen pro budoucí doklady, reset období, souběžná tvorba, číslo po importu. |
| Částky | České zápisy, desetinné množství, zaokrouhlení každé položky i součtu, plátce/neplátce, shoda náhledu a uloženého výsledku pro platné vstupy. |
| Platby | Částečná úhrada, doplacení, souběžné úhrady bez přeplatku, smazání platby, zákaz editace při zaznamenané platbě. |
| Storno a příjmy | Zachování historie, ponechané peníze, refundace v datu vrácení, platby napříč měsíci/roky. |
| Import | Náhled bez zápisu, potvrzení, podvržený payload, duplicitní číslo, párování IČO, více položek, původní čísla a následná řada. |
| Web/PDF/QR | Účet, zbývající CZK částka, numerický VS do 10 číslic, žádný CZK QR pro jinou měnu, DPH status, více stran a dlouhé texty. |
| Auth a přístup | Chráněné stránky, export, PDF, assety a přímé mutations s `AUTH_PASSWORD`; dokumentovaný lokální režim bez hesla. |
| Projekty/úkoly | Přesun a pořadí, priority/termíny, `doneAt` při dokončení a návratu, poznámky, filtr projektu, dotykové ovládání. |
| Provoz | UTC data, runner/migrator a migrace před startem; jen pokud změna zasáhne tyto hranice. |

Nejprve využít existující testy; scénáře v tabulce nejsou tvrzením, že všechny
již mají automatické pokrytí. Manuální/browser ověření zaznamenat odděleně.
Při změně CI zachovat bezpečnost notifierů z `AGENTS.md`.

## Předávání práce a dokončení PR

Každý agent předává:

```text
Etapa a role:
Výchozí / ověřený commit:
Rozsah a vlastněné soubory:
Co se změnilo nebo zjistilo:
Call sites a zachované kontrakty:
Kontroly — příkaz, prostředí, výsledek:
Nálezy — regrese / existující problém / hypotéza:
Rizika a otevřené otázky:
Doporučený další krok:
```

Podmínky dokončení každého PR:

- [ ] Jeden srozumitelný účel; žádné nesouvisející opravy nebo plošné formátování.
- [ ] Aktualizované call sites a ověřené server/klient hranice.
- [ ] Potřebné testy ověřují chování a všechny předepsané kontroly prošly.
- [ ] Nezávislé review odpovídá poslednímu commitu; připomínky jsou vyřešeny.
- [ ] PR popisuje přínos, zachované chování, validaci a konkrétní omezení.
- [ ] CI je zelené. Začlenění provádí A0 pouze při autorizaci; reviewer nemerguje.

Neúspěšná kontrola není důvod obejít CI nebo smazat test. Pokud selže prostředí,
zaznamenat příčinu a chybějící ověření. Po revertu či opravě znovu validovat
výsledný commit. Pokud další abstrakce přidává navigaci bez jasného přínosu,
extrakci zmenšit nebo vynechat a uvést rozhodnutí v `docs/refactoring.md`.

## Úvodní zadání pro koordinátora AI

> Proveď postupný refactoring Fakturky podle `REFACTORING_PLAN.md` a pravidel
> `AGENTS.md`. Začni R0 a ověř skutečný stav repozitáře. Přiděl A1 průzkum,
> A2 architekturu a A4 inventuru testů, maximálně tři pomocné agenty současně.
> Před editací urči vlastníka souborů a kontrakty. Realizuj malé feature PR
> podle závislostí; A3 implementuje, A4 testuje a A5 nezávisle kontroluje.
> A1 průběžně hledá další doložená zlepšení, A6 měří výkon a pomáhá s mapou
> architektury. Zachovej stávající chování, transakce, autentizaci a účetní
> pravidla. Nové funkce a existující chyby eviduj samostatně. Po každé etapě
> zaznamenej commit a výsledky kontrol. Push feature větví, založení PR a merge
> řiď autorizací aktuálního zadání; tento plán sám je neprovádí ani nepovoluje.
> Nikdy nepushuj přímo do `main`. Úkol dokonči doloženou validací a dokumentací,
> nikoli pouze přesunem souborů nebo tvrzením, že je kód čistší.
