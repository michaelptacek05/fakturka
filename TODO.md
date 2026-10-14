# Fakturka — TODO

Návrhy dalšího rozvoje vycházejí ze současného stavu aplikace v `README.md`
a z kódu. Pořadí je doporučené; jde o backlog, nikoli závazný plán vydání.

- [ ] **Postupný refactoring aplikace.** Realizovat podle samostatného
  [plánu pro AI agenty](REFACTORING_PLAN.md).

## Priorita 1 — integrita dokladů a spolehlivost

- [ ] **Zamrazit údaje vystavitele na faktuře.**
  U nových dokladů uložit snapshot jména, adresy, IČO, DIČ, plátcovství DPH
  a platebních údajů. Web i PDF musí používat stejné uložené údaje, aby změna
  profilu nepřepisovala staré doklady. U existujících faktur navrhnout migraci
  s vědomím, že původní historické údaje nemusí být dostupné.
- [ ] **Automatizovat zálohy a ověřit obnovu.**
  Přidat zálohování databáze i úložiště loga, podpisu a razítka, uchovávání
  několika záloh a návod k obnově. Obnovu vyzkoušet na prázdné instalaci.
- [ ] **Přidat testy hlavních toků v prohlížeči.**
  Pokrýt přihlášení, vystavení faktury, PDF, částečnou úhradu a doplacení.
  Samostatně ověřit import s náhledem a potvrzením.

## Priorita 2 — rychlejší každodenní práce

- [ ] **Duplikovat fakturu.**
  Připravit nový doklad s převzatým odběratelem a položkami, novými daty
  a bez plateb. Nové číslo přidělit při uložení v existujícím transakčním toku.
- [ ] **Zachovat rozepsaný formulář.**
  Po obnovení stránky nebo validační chybě obnovit vyplněné údaje a položky.
  Rozpracovaná data odstranit po úspěšném uložení nebo výslovném zahození.
- [ ] **Rozšířit filtry a řazení faktur.**
  Přidat období, odběratele, rozmezí částek a řazení podle splatnosti.
  Nad výsledky zobrazit celkovou a zbývající částku; různé měny nesčítat dohromady.
- [ ] **Hromadně stáhnout PDF do ZIPu.**
  Umožnit stažení vybraných faktur nebo faktur za určité období v jednom archivu.
- [ ] **Nastavit výchozí hodnoty pro odběratele.**
  Uložit vlastní splatnost, obvyklou poznámku a předvyplněné položky pro opakované
  zakázky. Nastavení použít u nových faktur bez změny existujících dokladů.

## Priorita 3 — propojení a automatizace

- [ ] **Propojit projekty s fakturami.**
  Umožnit vystavení faktury z projektu a zobrazit související doklady,
  vyfakturovanou částku, úhrady a zbývající úhradu. Zohlednit storna a měny.
- [ ] **Importovat a párovat bankovní platby.**
  Začít CSV výpisem a navrhovat párování podle variabilního symbolu, částky
  a měny. Před zápisem zobrazit náhled a potvrzení; zabránit duplicitám
  při opakovaném importu a přeplatkům při souběžném zápisu plateb.
- [ ] **Přidat opakované faktury.**
  Vytvářet koncepty z šablony podle nastaveného intervalu ke kontrole uživatelem.
  Opakované spuštění nesmí vytvořit více dokladů za stejné období.
- [ ] **Odesílat faktury a upomínky e-mailem.**
  Přidat náhled zprávy, PDF přílohu a historii odeslání. Automatické upomínky
  nabídnout volitelně a pouze pro aktuální nezaplacený zůstatek.
- [ ] **Rozšířit exporty pro účetní.**
  Doplnit export jednotlivých plateb podle skutečného data, včetně vrácení peněz.
  Následně přidat ISDOC export s ověřením výstupu a shody s fakturou.
- [ ] **Přidat historii změn a provozní diagnostiku.**
  Evidovat vystavení, úpravy, storno a změny plateb. Zlepšit dohledatelnost
  provozních chyb bez zákaznických dat, hesel, session secrets a databázových URL
  v logách nebo veřejných odpovědích.

## Doporučený začátek

1. Snapshot vystavitele.
2. Zálohy a ověřená obnova.
3. Duplikování faktury.

## Pravidla realizace

- Aktuální chování ověřovat v `README.md`; `plan.md` je historický kontext.
- Změny realizovat na feature větvích a začleňovat přes PR po úspěšném CI.
- Zachovat integritu dokladů, historii plateb, serverovou validaci a ochranu dat
  podle `AGENTS.md`.
- Ke změně chování přidat regresní pokrytí a spustit kontroly předepsané
  v `AGENTS.md`. Databázové změny ověřovat na disposable PostgreSQL instanci.
