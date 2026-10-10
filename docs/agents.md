# Agenti pro větve a pull requesty

Konfigurace hlídá `main` a všechny pull requesty. Chyby popíše a doporučí další
krok; opravy a rozhodnutí o sloučení zůstávají na autorovi. AI review běží přes
Codex propojený s GitHubem v ChatGPT, bez `OPENAI_API_KEY` v repozitáři.

## Co je připravené

| Agent | Spouštění | Výsledek |
| --- | --- | --- |
| Kontrola projektu | Push do `main`, otevření/změna PR, ruční spuštění CI | Lint, TypeScript, unit testy, testy notifikací, produkční build a integrační testy PostgreSQL. |
| Codex code review | Automatické review podle nastavení Codexu | Review diffu podle `AGENTS.md`, konkrétní nálezy a doporučení opravy. |
| Upozornění | Dokončení CI nebo zpráva/review od Codexu | GitHub komentář s označením uživatele a odkazy na logy či nálezy. |

Při selhání CI na PR vznikne jeden komentář pro daný běh a pokus. Při selhání
na `main` se založí issue; další neúspěchy přidají komentář do stejného issue.
Úspěšný aktuální běh stejného typu issue uzavře. Starší commity, starší pokusy,
uzavřená PR a záměrně zrušené běhy neposílají upozornění. Publikace Docker image
po pushi do `main` čeká na obě kontrolní úlohy.

U Codexu se posílá jedno upozornění na review s nálezy P0–P2, požadavkem na
změny nebo připomínkou bez rozpoznané priority. Samostatné P3 návrhy neupozorňují.
Upozorní se také na zprávy o nedokončeném review, například vyčerpaný limit.
Formát a rozsah nálezů určuje služba Codex; parser podporuje její priority v
hranatých závorkách i badge obrázcích. Samotná absence komentáře není doklad,
že code review prošlo. Automatizace nevytváří vlastní schvalovací status a
nenahrazuje required checks nebo lidské schválení.

## Aktivace

1. Dostaň tyto soubory na `main`. Notifikační workflow načítají skripty vždy
   z výchozí větve; dokud tam soubory nejsou, nejsou notifikace aktivní.
2. V [nastavení Codex code review](https://chatgpt.com/codex/settings/code-review)
   připoj `michaelptacek05/fakturka`, pokud ještě není připojený. Při instalaci
   GitHub aplikace vyber pouze tento repozitář.
3. U repozitáře zapni **Review code → Automatic review → All PRs**. V osobních
   preferencích zapni **Automatic review** a v **Review trigger** zvol spouštění
   i po nových commitech/pushích, pokud ho účet nabízí. Pokud účet nabízí jen
   review při otevření PR, další review vyžádej komentářem `@codex review`.
4. V GitHub **Settings → Actions → General** ověř, že jsou Actions povolené.
   Workflow mají potřebná oprávnění deklarovaná přímo v YAML; pokud je blokuje
   politika organizace, musí je povolit správce. GitHub Issues musí být zapnuté
   pro upozornění na selhání `main`.
5. V GitHub **Settings → Notifications** zapni doručování **Participating,
   @mentions and custom** do inboxu nebo e-mailu podle své preference.
   Notifikátor standardně označuje `@michaelptacek05`.

Volitelné repository variables v **Settings → Secrets and variables → Actions
→ Variables**:

| Proměnná | Výchozí hodnota | Použití |
| --- | --- | --- |
| `AGENT_NOTIFY_USER` | Vlastník repozitáře (`michaelptacek05`) | GitHub uživatelské jméno příjemce, bez `@`. |
| `CODEX_REVIEW_BOT` | `chatgpt-codex-connector[bot]` | Přesný login Codex bota, pokud má instalace jiné jméno. |

V pravidlech ochrany `main` lze vyžadovat kontroly **Lint a typová kontrola**
a **Integrační testy PostgreSQL** a vyřešené review konverzace. Samotné přidání
workflow tato pravidla v nastavení GitHubu nezapne.

## Ověření

Lokálně ověř logiku směrování a deduplikace upozornění:

```bash
npm run test:agents
```

Po aktivaci otevři testovací PR. Ověř, že proběhnou obě CI úlohy, Codex zareaguje
a vloží review. Dočasnou chybou TypeScriptu v tomto PR ověř neúspěšné CI a
komentář s označením uživatele; následným opravným commitem ověř průchod kontrol.
Nález Codexu ověří i odkaz na konkrétní připomínku. Testy notifikátorů používají
mock GitHub API a neposílají skutečné zprávy.

Notifikátory spouštějí jen důvěryhodné skripty z výchozí větve, bez instalace
PR závislostí a bez čtení jeho artefaktů. Kontrolní CI naopak běží s read-only
GitHub tokenem. Tyto části používají standardní `GITHUB_TOKEN`.

Oficiální nastavení a podporu pravidel popisuje
[dokumentace Codex pro GitHub](https://learn.chatgpt.com/docs/third-party/github).
