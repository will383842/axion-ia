# ADR-0003 — Périmètre V1, gratuité et infrastructure

- **Statut** : **Accepté** (Will 2026-07-03 — autopilot go)
- **Date** : 2026-07-01
- **Module** : Prospection & Base Entreprises
- **Voir aussi** : `ADR-0001`, `ADR-0002`, plan §0 et §1

## Contexte

Le besoin exprimé est ambitieux (toutes les entreprises de France, contacts enrichis, pilotage,
suivi). Il faut cadrer un périmètre V1 livrable, conforme et sans coût, en s'appuyant sur l'existant
d'axionia et sur les patterns (mais pas le code) du service SOS-Expat backlink-engine.

## Décision

1. **Périmètre V1 = constitution de base + enrichissement + pilotage + suivi + export UNIQUEMENT.**
   **Aucun cold-outreach** (envoi d'emails/SMS de prospection) depuis Axion-IA en V1. Le moteur
   d'emailing (séquences, IMAP replies, suppression list) est explicitement **reporté en V2**, sous
   condition d'une base légale/AIPD d'outreach dédiée.
2. **Sources 100 % gratuites**, collecte **et** enrichissement. **Aucune source payante** dans
   l'architecture (ni Pappers/Dropcontact/Hunter, ni Perplexity payant, ni scraping de SERP).
   L'email/téléphone est obtenu gratuitement via le site public de l'entreprise ; le **taux de
   contactabilité est mesuré honnêtement** (certaines entreprises resteront `non_contactable`).
3. **Infrastructure = celle d'axionia** : Next.js 16 App Router + Prisma + Postgres + BullMQ + Redis +
   **Server Actions (pas de REST, pas de Fastify)** + next-intl FR + Tailwind v4. Le backlink-engine
   SOS-Expat ne sert que de **référence de patterns** (enrichment worker, dédup, coverage, event log,
   dashboard) — **son code n'est pas porté**.
4. **Livrable actuel = plan/dossier de conception**, pas de code. Le skill `axionia-prospection` puis
   l'implémentation (tranches T0→T9) viennent **après validation** du dossier et des 10 questions
   ouvertes (plan §14).
5. **Cloisonnement strict**, migrations additives, contrat de build `stub.invalid` respecté, budgets
   Web Vitals des pages admin.

## Alternatives considérées

- **V1 avec outreach intégré** : rejeté (risque RGPD + périmètre trop large pour une V1).
- **Enrichissement payant dès V1** : rejeté par décision Will (0 payant).
- **Service séparé type Fastify (comme SOS-Expat)** : rejeté (second système parallèle, hors conventions
  axionia, coût de maintenance).

## Conséquences

- **Positives** : périmètre net et livrable, coût nul, risque réduit, réutilisation maximale de
  l'existant, réversibilité (V2 additive).
- **Négatives** : contacts email/téléphone **partiels** (dépendants du site public) — limite assumée et
  mesurée ; l'outreach nécessitera une V2 dédiée.

## STOP & ASK

Toute bascule vers du payant · tout envoi de prospection · tout changement d'infrastructure.
