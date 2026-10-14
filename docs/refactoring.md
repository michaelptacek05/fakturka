# Opravy před strukturálním refactoringem

Základ: `61c557f5c6228fc1879f5752c079459e6d4e55da`.
Pracovní větev: `fix/invoice-precision-e2e`.
Výsledky se vztahují k této feature větvi, nikoli k mergnutému PR.

## Rozhodnutí a realizace

Uživatel zvolil opravy před přesuny, malou E2E sadu a vyšší přesnost množství.
Pracovní limit je 9 desetinných míst při zachování devíti míst celé části.

- Společný desetinný výpočet pro formulář, server a CSV náhled/import:
  `0,5 × 0,29 Kč` nyní konzistentně vychází na 0,15 Kč.
- Množství prochází z formuláře a CSV jako desetinný řetězec až do DB,
  bez ořezu na tři místa a bez převodu přes JavaScriptový float.
- Nová migrace rozšiřuje množství na `Decimal(18,9)`. Nepřepočítává částky
  historických dokladů a neobnovuje dříve ztracené číslice.
- Web a PDF zobrazují celou uloženou přesnost. Výška PDF řádku zohledňuje
  zalomené množství, aby se další položky nepřekryly.
- E2E ověřuje autentizaci a přímé odeslání akce, tvorbu/editaci, vyšší
  přesnost, skutečné web/PDF QR po částečné úhradě, doplacení a import
  s náhledem, potvrzením a opakováním. CI před publikací image čeká i na E2E.

## Ověření

Čistá instalace `npm ci`, generování klienta a kontroly proběhly na Node
24.11.1; DB testy používají jednorázový PostgreSQL 16 a `TZ=UTC`.
Celá níže uvedená sada včetně čisté instalace byla zopakována 14. 10. 2026.

| Kontrola | Výsledek |
| --- | --- |
| `npm run lint` | Prošlo. |
| `npm run typecheck` | Prošlo. |
| `npm test` | 170 testů prošlo. |
| `npm run test:agents` | 30 testů prošlo. |
| `npm run build` | Prošlo. |
| `npm run test:integration` | 34 testů prošlo, včetně migrace se staršími hodnotami. |
| `npm run test:e2e` | 4 scénáře prošly nad produkčním standalone serverem. |

Vizuálně zkontrolováno PDF s devíti desetinnými místy i s celými 18 číslicemi
množství. Dekodér přečetl skutečný web/PDF QR na 6000,00 Kč po úhradě
4000,00 Kč z faktury na 10000,00 Kč. E2E databáze mají unikátní názvy
a runner je odstraní po běhu. GitHub CI a nezávislé PR review zatím neproběhly.

## Další rozhodnutí a rozsah

Nově nalezený starší nesoulad přesnosti sazby DPH je v `REFACTORING_PLAN.md`.
Uživatel dostal otázku na odmítnutí, zaokrouhlení nebo podporu vyšší přesnosti
sazby; tato oprava pravidlo DPH nemění. Ostatní hypotézy původního auditu
zůstávají k prověření v R0. Strukturální přesuny R2–R8 tímto balíkem nejsou
označené jako dokončené.

Při opakovaném ověření 14. 10. 2026 upozornil `npm audit` na bezpečnostní
nálezy v závislostech, včetně kritického nálezu u Next.js 16.2.6. Stejná
verze je ve výchozím `main`; nejde o nově přidanou závislost tohoto balíku.
Samotný audit nedokládá zneužitelnost v této aplikaci. Uživatel zvolil
prověření a opravy v samostatné větvi před strukturálním refactoringem.
