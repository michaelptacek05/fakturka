# Ověření redesignu Fakturky

Větev: `feat/impeccable-ui-ux`. Návrh a implementace podle Impeccable 4.3.1, režim Operate. Zadání: výraznější změna vzhledu, zachovat funkce; výběr směru uživatel svěřil agentovi. Plán je v [UI_PLAN.md](UI_PLAN.md), produktové zásady v [PRODUCT.md](PRODUCT.md).

## Výsledek změn

- Nová inkoustová navigace, modré hlavní akce, chladný podklad a odpovídající tmavý motiv. Přehled spojuje přijaté platby do jednoho pásu a otevřené doklady do panelu K inkasu.
- Mobilní faktury a odběratelé mají kompaktní řádky. Výběr dokladů, CSV export a potvrzení mazání zůstávají společné pro mobil i desktop.
- Formuláře mají větší dotykové cíle, propojené popisky a nápovědy, jedinečná ID a zpětnou vazbu při odesílání. Dlouhé nastavení má odkazy na sekce.
- Úkoly umožňují změnu stavu nativním výběrem na všech šířkách, zachovávají přetahování a při chybě vrátí stav s možností opakovat přesun.
- ARES doplňuje pouze vlastní formulář, oznamuje průběh a dovoluje ruční vyplnění. Prázdné údaje z výsledku odstraní starou hodnotu, například DIČ.
- Opravena existující chyba hromadného mazání: úspěšné přesměrování již nezachytí větev pro databázovou chybu. Dva nové integrační testy hlídají úspěch a prázdný výběr.

Číslování, peněžní výpočty, DPH, úhrady, import a obsah PDF/QR používají stávající implementaci. Nepřibyla závislost ani změna databázového schématu. Tabulka v náhledu faktury má na telefonu vlastní posuvnou oblast; celá stránka se neroztahuje. Technický řetězec QR byl odstraněn z obrazovky, samotný QR a platební údaje zůstaly.

## Automatické a funkční kontroly

| Kontrola | Výsledek |
| --- | --- |
| Jednotkové testy | 155/155 |
| Integrační testy | 28/28, včetně dvou nových regresních testů |
| ESLint | Prošel |
| TypeScript | Prošel |
| Produkční build | Prošel |
| Nezávislé scénáře v prohlížeči | 20/20 |
| Závěrečné kontroly rozložení a motivů | 29 základních a 2 doplňkové záznamy historie úhrad, bez přetečení; základní sada také bez duplicitních ID |
| axe: WCAG 2 A/AA a 2.1 AA | Bez automaticky detekovaných porušení v 17 kontrolovaných pohledech |
| Chyby konzole a běhu stránky | Žádné během kontrol |

Funkční agent ověřil přihlášení a odhlášení; tvorbu, úpravu a hledání odběratele; ARES; položky faktury a české desetinné částky; úpravu faktury; částečnou a úplnou úhradu; zákaz úprav uhrazeného dokladu; storno s vratkou; filtry; CSV a PDF; hromadné mazání; vazby projektu; úkoly a poznámky; návrat po neúspěšném přesunu; mobilní menu s klávesnicí, Escape a změnou šířky; uchování motivu; náhled a potvrzení obou importů a ochranu před duplicitami.

Testy a prohlížeč používaly oddělený dočasný PostgreSQL kontejner a syntetická data. Stávající lokální databáze nebyla použita. ARES byl v regresním testu simulován; dostupnost veřejné služby tím není ověřena. Prohlížečové kontroly proběhly v Chromium, automatická kontrola přístupnosti nenahrazuje uživatelský test se čtečkou.

## Vizuální kontrola a důkazy

Desktop 1440px, mobil 390px, vybrané formuláře a úkoly také 320px. Zkontrolováno přihlášení, přehled, seznam a tvorba faktur, detail faktury, odběratelé a jejich tvorba, projekty a detail projektu, úkoly, import a nastavení. Ověřen světlý i tmavý motiv a omezení pohybu. Po první sadě snímků byly v jedné dávce opraveny kontrast oranžových štítků, sémantika přehledu odvodů, mobilní šířka dokladu a dělení hlavičky úkolů. Nezávislý posudek pak vedl ke zjednodušení vnořených rámů v úhradách, ARES, položkách a uploaderech. Doplněna neprázdná historie plateb a opraven kontrast štítku Zaplaceno na podkladu stránky. Závěrečné sady prošly.

Lokální důkazy jsou v ignorované složce `.impeccable/review/`: `desktop.png`, `mobile.png`, snímky jednotlivých obrazovek, `checks.json`, `history-checks.json`, `browser-regression.json` a závěrečný posudek. Snímky ani dočasné nástroje Playwright nejsou součástí distribuované aplikace. Návrh nevytváří žádné rastrové produktové assety.

Nezávislý posudek Impeccable: **disposition: ship**. První úplný posudek je v `.impeccable/review/finish-review.md`; závěrečné hodnocení v `finish-verdict.md` potvrzuje vyřešení všech pojmenovaných oprav. Závěrečný verdikt má rozsah těchto oprav, nejde o nový úplný audit. Nezávažné poznámky k hustotě projektů na desktopu a šířce polí na 320px zůstávají v prvním posudku. Designový systém je zachycen v [DESIGN.md](DESIGN.md) a `.impeccable/design.json`; prošlo parsování YAML/JSON, kontrola odkazů a porovnání klíčových tokenů s CSS.

## Aktualizace Impeccable po dokončení práce

Podle volby uživatele byl update řešen až po dokončení návrhu, ověření a dokumentace. `npx impeccable update --global --yes` nenašel samostatnou instalaci skillu: zde je Impeccable spravovaný jako plugin Codexu. `codex plugin add impeccable@openai-curated-remote --json` obnovil plugin, ale vrátil verzi 4.3.1; následný seznam dostupných pluginů potvrdil stejnou nainstalovanou a zapnutou verzi. Nabízenou upstream verzi 4.5.2 tedy nebylo možné tímto správcem získat. Redesign je dokončený s verzí 4.3.1.
