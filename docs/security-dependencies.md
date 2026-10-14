# Bezpečnostní aktualizace závislostí — 14. 10. 2026

Výchozí commit: `61c557f5c6228fc1879f5752c079459e6d4e55da` (`main`).
Větev `fix/dependency-security` je nezávislá na přípravných opravách množství
a E2E ve větvi `fix/invoice-precision-e2e`. Strukturální refactoring nezačal.

## Rozsah opravy

- Next.js a `eslint-config-next`: 16.2.6 → 16.4.0. Opravy vydavatele zahrnují
  mimo jiné [problém optimalizace AVIF obrázků](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
  Samotný záznam v auditu není důkazem zneužití konkrétního nasazení.
- Prisma CLI, klient a PostgreSQL adaptér: 7.8.0 → 7.10.0, ve stejné stabilní
  hlavní řadě. Schéma, migrace, transakce a účetní pravidla se nemění.
- Lockfile aktualizuje související závislosti a kompatibilní bezpečnostní
  opravy z `npm audit fix`, včetně Sharp, PostCSS, fast-uri, js-yaml,
  brace-expansion, source-map-js a řetězce nástrojů Prisma.

Prisma 7.10.0 stále připíná dvě postižené tranzitivní závislosti. `overrides`
jsou proto omezené na jejich konkrétní rodiče:

| Rodič | Závislost | Vynucená verze | Důvod |
| --- | --- | --- | --- |
| `@prisma/config` | `deepmerge-ts` | 8.0.0 | GHSA-ggr8-5vv4-36mx, zpracování cyklických grafů. |
| `prisma` | `mysql2` | 3.24.6 | GHSA-3f6p-5ww8-9rcr a GHSA-rgwj-5xj2-c3m3. Aplikace nadále používá PostgreSQL. |

Přechod deepmerge-ts z 7 na 8 má [změny chování](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0),
zejména slučování Map. Současný `prisma.config.ts` obsahuje obyčejné objekty
a řetězce; Prisma používá export `deepmerge`, který zůstává dostupný.
Načtení této konfigurace bylo ověřeno generováním klienta i skutečným
nasazením migrací na jednorázový PostgreSQL. Při budoucí změně konfigurace
nebo aktualizaci Prisma znovu prověřit kompatibilitu a odstranit overrides,
jakmile vydavatel použije opravené závislosti sám.

## Výsledek auditu a zbývající nález

| Příkaz | Před opravou | Po opravě |
| --- | --- | --- |
| `npm audit --omit=dev` | 14 nálezů: 1 critical, 9 high, 4 moderate | 0 nálezů |
| `npm audit` | 22 nálezů: 1 critical, 17 high, 4 moderate | 5 high |

Zbývajících pět záznamů odpovídá jednomu problému
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
v `braces` a navazujícím balíčkům `micromatch`, `fast-glob`,
`@next/eslint-plugin-next`, `eslint-config-next`. Jde o vyčerpání zásobníku
při zpracování hluboce vnořeného vzoru v nástrojích pro lintování.
Nejde o pět nezávislých chyb aplikace.

K datu kontroly je poslední publikovaná verze braces 3.0.3 stále postižená.
Audit nabízí downgrade eslint-config-next na 14.2.35; ten by neodpovídal
používanému Next.js 16 a nebyl proveden. Nález není potlačen ani skryt.
Při další aktualizaci prověřit vydanou opravu braces nebo aktualizaci
řetězce ESLint pluginu.

Kontrola sestaveného `.next/standalone/node_modules` nenašla braces,
micromatch, fast-glob ani ESLint plugin/config. Migrační Docker image podle
stávajícího Dockerfile obsahuje všechny závislosti včetně vývojových;
audit celého projektu tedy zůstává relevantní pro nástroje a migrátor.

## Ověření

Node 24.11.1, jednorázový PostgreSQL 16, DB testy v `TZ=UTC`:

- `npm ci`, `npm run prisma:generate`, `npm run lint`,
  `npm run typecheck`, `npm run build` prošly.
- `npm test`: 155 testů; `npm run test:agents`: 30 testů;
  `npm run test:integration`: 28 testů, vše prošlo.
- Nad produkčním standalone serverem této větve prošly dva browser scénáře
  převzaté z `fix/invoice-precision-e2e`: ochrana dokladů, exportu, PDF,
  assetů a přímého odeslání akce; částečná úhrada s dekódováním skutečného
  webového/PDF QR a doplacení. Použit dočasný runner s vlastní UUID databází
  a Chromium z přípravné větve. Nejde o čtyři E2E scénáře přesnosti množství
  a tato větev nezavádí E2E infrastrukturu do CI.

Výsledky jsou lokální. Po publikaci větve je potřeba posoudit také CI a PR
review; bezpečnostní aktualizace dosud není nasazená do produkce.
