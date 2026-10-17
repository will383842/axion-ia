---
name: axionia-prospection
description: >-
  Implémenter, étendre, vérifier ou auditer le module « Prospection & Base Entreprises » d'Axion-IA :
  collecte de bout en bout des entreprises françaises **département par département**, filtrable par
  **secteur d'activité (code NAF/APE : BTP, santé, droit…)** et par **taille (TPE/PME/ETI/GE)**, avec
  **enrichissement gratuit** (dirigeants **+ responsables de secteur/équipe**, email, téléphone, ville),
  **pilotage depuis la console d'administration** et **suivi de couverture** (taux « déjà fait » et % de
  contacts utilisables, agrégés **département → région → France**). Périmètre **V1 = constitution de base
  + export uniquement** (aucun cold-outreach / envoi d'email depuis Axion-IA en V1). **Sources 100 %
  GRATUITES** : fichiers **Stock Sirene** open data (backbone d'exhaustivité) + delta quotidien + API
  recherche-entreprises (ciblage) + INPI RNE (dirigeants) + Annuaire administration (contacts publics) +
  BODACC + BAN (géocodage) ; email/téléphone via mini-crawl du **site public** de l'entreprise. **Aucune
  source payante** (pas de Pappers/Dropcontact/Hunter/Perplexity payant, pas de scraping de SERP, pas de
  LinkedIn/Pages Jaunes/annuaires privés). Anti-doublon fort (1 SIREN = 1 entreprise ; succursales =
  Establishment/SIRET ; dédup email/téléphone/personne). Stack RÉELLE = celle d'axionia : Next.js 16.2
  App Router + Prisma 5.22 + Postgres + BullMQ + Redis + **Server Actions (pas de REST, pas de Fastify)**
  + next-intl (FR canonique) + Tailwind v4. Admin sous
  src/app/[locale]/(admin)/[adminPrefix]/prospection/**, workers src/server/queue/workers/prospection-*,
  config via SiteSetting (catégorie `prospection`). Respecte le contrat de build stub.invalid (ADR 0026),
  les budgets Web Vitals, le cloisonnement des modules, et une **conformité RGPD/CNIL bloquante**
  (AIPD/DPIA avant tout connecteur, statut « non-diffusible » INSEE + opposition RNE, information art.14,
  opt-out réellement bloquant, journal d'accès, durée 3 ans). NE PAS porter le service Fastify SOS-Expat
  backlink-engine : seuls ses PATTERNS sont réutilisés. Déclencheurs : « prospection », « scraping
  entreprises », « base entreprises », « collecte entreprises par département », « annuaire entreprises »,
  « SIRENE / SIRET / NAF », « TPE PME ETI GE », « enrichissement entreprises », « dirigeants /
  responsables », « coverage prospection », « campagne de collecte ». Formulations de lancement de Will :
  « lance/lancer le système de prospection », « le module base entreprises », « démarrer le scraping
  d'entreprises », « collecte d'entreprises par département/activité/taille ». → activer ce skill puis
  lire `reference/01-codebase-contract.md`, et s'appuyer sur le dossier
  `axionia/_PROSPECTION-BASE-ENTREPRISES/**` (specs détaillées).
---

# Axion-IA — Module Prospection & Base Entreprises

Ce skill pilote l'implémentation, l'extension et la vérification du module de collecte d'entreprises
françaises **à l'intérieur du codebase `axionia`** (Next.js 16), en **autopilot de bout en bout**
(exploration → plan → tranches verticales → gates → croisement → réconciliation → conformité prouvée),
sans jamais casser l'existant ni créer un second système parallèle.

Besoin métier : **scraper toutes les entreprises, département par département, filtrées par activité
(NAF) et par taille (TPE/PME/ETI/GE), enrichir chaque entreprise (dirigeant/responsables, email,
téléphone, ville…), piloter depuis la console admin, et suivre le taux de ce qui a déjà été fait par
département × activité × taille — décliné département → région → France.**

## Le dossier de conception fait autorité

Les spécifications détaillées vivent dans **`axionia/_PROSPECTION-BASE-ENTREPRISES/`** (lire au besoin) :

| Fichier                                      | Contenu                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `README.md`                                  | Index + décisions verrouillées                                                             |
| `PLAN-DIRECTEUR-V1.md`                       | Plan directeur v1.1 (vue d'ensemble, audit intégré)                                        |
| `00-ADR/ADR-0001..0003`                      | Décisions : collecte Stock Sirene · RGPD/AIPD · périmètre V1                               |
| `01-DATA-MODEL.md`                           | Modèle de données (entités, champs, index, dédup, enums, migration)                        |
| `02-SPEC-SOURCES-COLLECTE-ENRICHISSEMENT.md` | Sources gratuites, pipeline Stock, rate-limit, mini-crawl 2 passes                         |
| `03-SPEC-STATS-REPORTING.md`                 | Suivi dép→région→France, formules, KPI, carte, alertes                                     |
| `04-SPEC-UI-ROUTES.md`                       | Pôle nav, toutes les routes/pages admin, wizard, RBAC                                      |
| `05-CONFORMITE-RGPD-AIPD.md`                 | AIPD, LIA, art.14, opt-out bloquant, journal, registre                                     |
| `06-MATRICE-ACCEPTATION.md`                  | Oracle du « done » : exigence → artefact → test, par tranche                               |
| `07-DECISIONS.md`                            | Les 10 arbitrages verrouillés (périmètre, seuils, pilote…)                                 |
| `08-TEST-STRATEGY.md`                        | Stratégie de test : pyramide, fixtures/mocks, non-régressions, vérif adversariale, cadence |

## Quand l'utiliser

Active ce skill dès que la tâche touche : la collecte/scraping d'entreprises, la base de prospects B2B,
le filtrage par département/activité/taille, l'enrichissement de contacts d'entreprises, le suivi de
couverture, ou l'export de cette base.

Ne l'utilise PAS pour : le CRM clients **Qualiopi** (formations → `axionia-qualiopi`), la génération
d'articles par ville (content-gen), la banque d'images (`axionia-image-bank`), les leads entrants des
formulaires du site, ou les offres d'emploi.

## Documents de référence (progressive disclosure)

| Fichier                               | Charger quand                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reference/01-codebase-contract.md`   | **Toujours, en premier.** Stack réelle, briques à réutiliser, cloisonnement, contrat stub.invalid, valeurs interdites, mapping « patterns backlink-engine → réalité axionia ». |
| `reference/02-autopilot-workflow.md`  | Avant de planifier ou coder. Phases T0→T9, ordre des tranches, gates, croisement, réconciliation, idempotence/reprise, sécurité git/worktree, STOP & ASK.                      |
| `reference/03-decisions-and-scope.md` | Avant toute décision de périmètre. Les 10 arbitrages, V1 vs V2, et le **gate juridique bloquant**.                                                                             |

## Les 5 lois (contrat — détail dans reference/01)

1. **Le code réel fait foi, en permanence.** Ordre d'autorité : **code vivant > dossier `_PROSPECTION-*` >
   ce skill**. Toute divergence → suivre le code, corriger le dossier, noter dans `STATE.md`.
2. **Stack imposée = celle d'axionia.** Prisma (pas de SQL brut sauf staging bulk justifié), **Server
   Actions (pas de REST, pas de Fastify)**, BullMQ + Redis, next-intl FR, Tailwind v4. Réutiliser les
   briques (`prisma.ts`, `redis.ts`, `queues.ts`, `ssrfSafeFetch`, respect robots.txt de
   `kb-ingest-external`, `cost-tracker`, token-bucket, `admin-nav.ts`, SiteSetting, pattern coverage-map).
   **Jamais** de port du service Fastify SOS-Expat.
3. **Non destructif & resumable.** Migrations **additives** ; aucun `DROP`. Contrat `stub.invalid`
   (workers/connecteurs stub-aware). Branche/worktree isolé ; jamais de push `main` sans accord.
4. **Zéro valeur en dur, zéro TODO/stub.** Quotas, rate-limits, seuils, fenêtre de fraîcheur, budgets de
   crawl → **`SiteSetting` (catégorie `prospection`)**. Aucune fonction fictive.
5. **Conformité prouvée, pas affirmée.** Chaque exigence RGPD (AIPD, non-diffusible, opposition RNE,
   information, opt-out bloquant, journal d'accès, minimisation) est reliée à un artefact ET à un test
   (voir `06-MATRICE-ACCEPTATION.md`). La **loyauté de la source** est vérifiée avant chaque connecteur.

## Boucle de fonctionnement (détail dans reference/02)

```
Phase 0   Grounding : lire le code réel d'axionia + le dossier → RAPPORT D'EXPLORATION (aucun code)
Phase 0.5 GATE JURIDIQUE : AIPD + LIA validées (Q9 — bloquant) AVANT tout connecteur de collecte
Phase 1   Plan : tranches verticales (SSOT → schéma → Stock ingest → collecte → enrichissement →
          coverage/stats → admin UI → export/RGPD → durcissement)
Phase 2..N Par tranche : schéma → server action/worker → UI → test
          → GATE (typecheck, eslint, i18n, isolation-check, vitest, size-limit/lhci si UI)
          → CROISEMENT (besoin ✕ RGPD ✕ contrat codebase ✕ charte) → RÉCONCILIATION → commit branche
Final     Campagne pilote (Isère 38 · BTP + Santé) prouvée + couverture RGPD 100 %
```

## STOP & ASK (ne jamais deviner)

Interromps et demande à Will pour : **toute collecte avant validation juridique de l'AIPD/LIA** (gate
bloquant), toute **source payante** (exclue), tout **envoi d'email/SMS de prospection** (hors V1), toute
source à **CGU restrictives** (LinkedIn, Pages Jaunes, société.com, annuaires privés, scraping de SERP),
une migration destructive, une régression Web Vitals, un doute sur une **durée de conservation** ou une
**mention d'information**, toute modification du contrat `stub.invalid`. Le reste : décider selon le
contrat + le dossier, documenter, continuer.

## Démarrage rapide

1. Lire `reference/01-codebase-contract.md`, `reference/03-decisions-and-scope.md`, puis
   `reference/02-autopilot-workflow.md`.
2. Lancer **Phase 0** (exploration du code réel : confirmer `prisma.ts`, `queues.ts`, `ssrfSafeFetch`,
   `admin-nav.ts`, pattern coverage-map, token-bucket) → RAPPORT D'EXPLORATION.
3. **Vérifier le gate juridique (Q9)** : sans AIPD/LIA validées, ne coder AUCUN connecteur de collecte —
   on peut préparer SSOT + schéma + UI en amont.
4. Dérouler les tranches (reference/02) avec gate + croisement + réconciliation. Prouver la V1 sur le
   **département pilote (Isère 38, BTP + Santé)** avant de généraliser à la France.
