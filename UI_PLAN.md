# Plán zlepšení UI a použitelnosti Fakturky

Větev: `feat/impeccable-ui-ux`. Cílem je zrychlit běžné úkony českého OSVČ a výrazně zlepšit vzhled celé aplikace. Uživatel potvrdil výraznější vizuální změnu při zachování funkcí a svěřil návrh agentovi podle Impeccable. Nové účetní funkce ani změny výpočtů nejsou součástí tohoto plánu.

## Postup

1. **Výchozí audit a funkční základ.** Projít přihlášení, přehled, faktury (seznam, tvorba, úprava, detail), odběratele, projekty, úkoly, import a nastavení. Nezávislý agent zkontroluje akce a testy, druhý použitelnost a přístupnost. Zachytit aktuální UI na desktopu a mobilu.
2. **Společné ovládání.** Zlepšit čitelnost a dotykové cíle, propojit nápovědu s poli, doplnit klávesnicový přístup k hlavnímu obsahu a jasné potvrzení průběhu ukládání. Zachovat stejné ovládací prvky a barevné tokeny napříč stránkami.
3. **Faktury a odběratelé.** Zpřehlednit seznam faktur na telefonu, zachovat výběr, export a potvrzení mazání. Upravit položky faktury tak, aby se na mobilu pohodlně vyplňovaly a celková částka byla snadno dohledatelná. Zkontrolovat vyhledávání a prázdné výsledky v adresáři.
4. **Projekty a úkoly.** Zajistit změnu stavu úkolu i klávesnicí na desktopu, rozumné rozložení rychlého přidání úkolu a zpětnou vazbu při přesunu. Zachovat přetahování, pořadí, priority, vazby a poznámky.
5. **Nastavení, import a okrajové stavy.** Prověřit dlouhé formuláře, ARES, importní náhled, prázdné stavy, chyby, tmavý motiv, tisk a PDF. Upravit konkrétní nalezené potíže bez přidávání nové složitosti.
6. **Ověření a předání.** Spustit lint, TypeScript, jednotkové a integrační testy nad oddělenou databází. Nezávislý agent prověří skutečné uživatelské postupy. Po úpravách provést společnou vizuální kontrolu desktopu/mobilu, jednu dávku oprav, závěrečnou kontrolu Impeccable a zapsat výsledky.

## Co musí zůstat funkčně shodné

- Číslování, zamrazení údajů na faktuře, výpočet položek a DPH.
- Částečné platby, vrácení peněz při stornu, datum úhrady a zbývající částka v QR/PDF.
- Filtry podle vypočteného stavu a příjmy podle skutečně přijatých plateb.
- Import s náhledem, potvrzením a ochranou před duplikáty.
- Vazby odběratelů, projektů, úkolů a poznámek; potvrzení nevratných akcí.
- Přihlášení, světlý/tmavý motiv, nativní formuláře a tisk A4.

## Kritéria přijetí

- Běžné ovládání nevyžaduje vodorovné posouvání celé stránky na 390 px; úmyslně široká data či tiskový doklad mohou mít vlastní posuvnou oblast.
- Všechny hlavní akce lze provést klávesnicí a na dotykovém displeji.
- Ukládání jasně ukazuje průběh a omezuje opakované odeslání.
- Filtry a výběr faktur odpovídají zobrazeným datům.
- Výsledky kontrol rozlišují výchozí chyby, nové regrese a neověřené oblasti.

## Výchozí ověření

- Jednotkové testy: 155/155 prošlo (8 souborů).
- Lint a TypeScript: prošly.
- Pro prohlížeč a integrace bude použita samostatná dočasná PostgreSQL databáze; existující data projektu se nebudou měnit.

Zvolený směr: modulární pracovní stůl — inkoustová navigace, světlé pracovní plochy a modré hlavní akce; přehled s jediným pásem příjmů, přiměřeně velkým grafem a jasnou prioritou otevřených dokladů. Návrh je přímo v kódu v rámci uživatelem delegovaného rozhodnutí. Nové výchozí nastavení návrhového postupu se neukládá. Po dokončení práce byla podle volby uživatele ověřena aktualizace Impeccable; správce pluginů Codexu stále poskytuje verzi 4.3.1. Podrobnosti jsou v reportu.

## Splnění plánu

Všech šest kroků je dokončených. Prošlo 155 jednotkových a 28 integračních testů, 20 nezávislých scénářů v prohlížeči, lint, TypeScript a produkční build. Závěrečné snímky nemají přetečení ani automaticky detekované chyby přístupnosti. Nezávislý hodnotitel vydal `ship` pro všechny požadované opravy. Designový systém je zapsaný a ověřený v [DESIGN.md](DESIGN.md) a `.impeccable/design.json`. Podrobný rozsah a omezení kontrol jsou v [UI_REVIEW.md](UI_REVIEW.md).
