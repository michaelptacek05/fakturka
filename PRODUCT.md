# Fakturka

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

České OSVČ spravující fakturaci a vlastní zakázky, potvrzeno zadáním a README.

## Product Purpose

Vystavovat a evidovat faktury, sledovat skutečné úhrady a spravovat odběratele, projekty a úkoly ve vlastní aplikaci.

## Operating Context

Self-hosted aplikace s jedním profilem dodavatele a volitelným přihlášením heslem. Čeština, částky v CZK, česká data a ARES. Výstupem je tisk A4, PDF, CSV a QR platba.

## Capabilities and Constraints

- Next.js App Router, React, TypeScript, Tailwind, Prisma a PostgreSQL.
- Částečné úhrady, historie plateb, vrácení peněz při stornu a QR platba na zbývající částku.
- Zamrazené údaje odběratele na faktuře; úprava adresáře nesmí změnit existující doklad.
- Import CSV vyžaduje náhled a potvrzení, zachovává čísla a brání duplicitám.
- Projekty a úkoly mají stav, prioritu, termíny, pořadí a poznámky.
- Orientační odhady daní a odvodů mají existující omezení popsaná v README; UI práce je nemění.
- Funkční chování má být při zlepšení použitelnosti zachováno (výslovný požadavek uživatele).

## Brand Commitments

Název Fakturka a české produktové texty. Uživatel požaduje výraznější změnu vzhledu při zachování funkcí a svěřil návrh agentovi podle Impeccable; stávající zelená paleta není závazná.

## Evidence on Hand

README.md, src/app, src/components, prisma/schema.prisma a tests. Demo data slouží jen k lokálnímu ověření; nesmějí být vydávána za skutečné zákazníky nebo výsledky.

## Product Principles

- Umožnit dokončit běžný úkon bez hledání ovládacích prvků.
- Zřetelně rozlišovat stav dokladu, přijaté peníze a zbývající částku.
- Zachovat nativní klávesnicové i dotykové ovládání.
- U nevratných akcí zachovat potvrzení a srozumitelný výsledek.
