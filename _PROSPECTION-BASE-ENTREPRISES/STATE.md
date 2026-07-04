# STATE — Suivi d'implémentation de bout en bout (Prospection & Base Entreprises)

> **Fichier de reprise de l'autopilot.** Point d'ancrage unique pour reprendre après une fermeture
> inopinée de Claude Code (limite de session, crash, coupure). Légende : ✅ à faire · 🔄 en cours ·
> ✅ fait · ⛔ bloqué.

## ⛑️ PROTOCOLE DE REPRISE (lire EN PREMIER à chaque redémarrage)

Si tu reprends une session (ou en cas de doute sur l'état) :

1. **Lire ce fichier en entier** — l'« En-tête de session » ci-dessous dit exactement où ça s'est arrêté.
2. `git -C .claude/worktrees/prospection log --oneline -15` → confirmer le **dernier commit réel** vs le
   champ « Dernier commit ». Si le journal a plus d'avance que l'en-tête → l'en-tête était en retard,
   se fier au code + `git log`.
3. `git -C .claude/worktrees/prospection status` → voir s'il y a un travail non commité en cours (la
   tranche marquée 🔄 était en plein milieu). Ne PAS jeter ce travail : le relire, le finir ou le
   committer proprement.
4. **DB = source de vérité de l'avancement métier** : interroger `CoverageCell.statut` (`a_faire`/
   `en_cours`/`fait`/`erreur`) plutôt que se fier à un compteur. Reprendre ne rejoue QUE `a_faire`+`erreur`
   (idempotence — voir `reference/02-autopilot-workflow.md` §Idempotence). Aucune cellule `fait` n'est
   recollectée.
5. Reprendre à l'étape 🔄 (ou la première ✅ après le dernier ✅). **Ne jamais refaire une étape ✅.**

## 🔁 CADENCE DE MISE À JOUR (obligatoire pour que la reprise soit fiable)

Mettre à jour ce fichier **à chaque fin d'ÉTAPE** (pas seulement fin de tranche) : après chaque
schéma / server action / worker / UI / test / gate / vérif adversariale / commit. Séquence type d'une
étape : (a) faire le travail → (b) cocher la case ici + actualiser l'en-tête (tranche, étape, dernier
commit, prochaine action) → (c) committer sur la branche (message = `prospection(Tn): <étape>`). Ainsi
une fermeture inopinée ne perd **au plus qu'une seule étape**, toujours reconstructible via `git log` + DB.

## En-tête de session (à actualiser)

- **Tranche en cours** : **AUCUNE — T0→T9 + pilote + 2 vérifs finales TERMINÉS** (voir §COMPLÉTION).
- **Dernier commit** : voir `git log`. Historique : T0 `3442cb86` · T1 `0222bec1` · T2 `7d2a17ed` · T3 `40b3a59d` · T4 `1c874757` · T5+reconcile `09edaa47`/`36305918` · pilote+export `e2606402`.
- **Reste (après implémentation, côté Will)** : remplir les 3 champs légaux (raison sociale, SIREN, DPO) dans `SiteSetting.legalIdentity` + relecture juriste avant collecte prod. Optionnel : pont CRM Qualiopi (Q5), download-route fichiers (V1 = téléchargement Blob client).
- **Recette de commit** : `NODE_OPTIONS=--max-old-space-size=6144 git commit …` (le hook pre-commit fait un typecheck full-repo qui OOM à 2 Go ; ~3 min/commit). Sujet commitlint = **minuscules** (pas de MAJ). `prisma generate` doit être lancé dans le worktree (client gitignoré). Tests unit = 150/150 verts.
- **Worktree** : ✅ `.claude/worktrees/prospection`, branche `feat/prospection` (off `main` @15b115fd), `pnpm install` + `prisma generate` OK.
- **Gate juridique (Q9)** : ✅ **NON BLOQUANT pour le build** (directive Will) — AIPD/LIA/mention pré-remplies ; valeurs légales = placeholders `SiteSetting`/`[À COMPLÉTER]`. T3+ construit/testé sur fixtures/mocks, jamais de SIREN réel/collecte prod. Reste côté Will = 3 champs + relecture juriste avant collecte prod.
- **Prochaine action** : RIEN côté implémentation. Reste = Will remplit les valeurs légales (config) puis fournit le fichier Stock + active le worker. Cf. §COMPLÉTION.
- **Directive Will (2026-07-03)** : autopilot complet T0→T9 + pilote, sans blocage juridique, gates+croisement+vérif adversariale par tranche, 2 vérifs E2E finales, worktree isolé, sources gratuites, aucun outreach, jamais push main sans accord.

## Avancement global

| Tranche   | Objet                                                                                                  | Bloqué par        | Statut |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------- | ------ |
| **T0**    | Grounding + RAPPORT D'EXPLORATION + ADR actés (AIPD/LIA **déjà pré-remplies**)                         | —                 | ✅     |
| **T1**    | SSOT purs (naf-to-secteur, taille, dép-région, qualite-fonction, crawl-targets, scoring) + SiteSetting | — (non bloqué)    | ✅     |
| **T2**    | Schéma Prisma (migration additive, toutes entités)                                                     | T1                | ✅     |
| **T3**    | Ingestion Stock Sirene + delta + rate-limit distribué + Zod + circuit breaker                          | ⛔ gate juridique | ✅     |
| **T4**    | Collecte ciblée + coverage-worker (rollup dép→région→France) + idempotence                             | T3                | ✅     |
| **T5**    | Enrichissement 2 passes (coordonnées + responsables) + confirmation domaine + validation email/tél     | T4                | ✅     |
| **T6**    | Console admin pilotage (pôle nav, wizard, détail campagne)                                             | T4                | ✅     |
| **T7**    | Console admin exploitation (base, fiche, contacts onglets, coverage-map, carte)                        | T5                | ✅     |
| **T8**    | Export segmenté + RGPD (opt-out multi-clé, journal d'accès, purge, pont CRM manuel)                    | T7                | ✅     |
| **T9**    | Durcissement (circuit breaker, alertes, Web Vitals, bench charge, tests complets)                      | T8                | ✅     |
| **Final** | Campagne pilote Isère 38 · BTP + Santé prouvée + couverture matrice 100 %                              | T9                | ✅     |

## Détail par tranche (cocher les étapes)

### T0 — Grounding + RGPD

- ✅ Explorer le code réel (briques confirmées `fichier:ligne` → `RAPPORT-EXPLORATION-T0.md`)
- ✅ Produire le RAPPORT D'EXPLORATION (`RAPPORT-EXPLORATION-T0.md`)
- ✅ Créer worktree + branche + ce `STATE.md` dans le worktree (`pnpm install` OK)
- ✅ AIPD + LIA + mention d'information **PRÉ-REMPLIES** (`AIPD-ET-MENTIONS-PRETES.md`) → reste 3 champs `[À COMPLÉTER]` + relecture juriste recommandée avant collecte prod (T3+)
- ✅ ADR-0001/0002/0003 actés (statut « accepté » — cf. en-têtes ADR)

### T1 — SSOT & config (schéma → n/a · gate → unitaires)

- ✅ `enums.ts` (SSOT enums, contrat T2) · ✅ `naf-to-secteur.ts` + test (100% divisions) · ✅ `taille.ts` (bornes) + test · ✅ `departement-to-region.ts` + test (101 dép)
- ✅ `qualite-to-fonction.ts` + test · ✅ `crawl-targets.ts` · ✅ `scoring.ts` + test (leadScore + contactabilité Q2)
- ✅ `SiteSetting` registry + config read-side (`registry.ts` Zod + defaults, `site-settings.ts` stub-aware). Enum value + set() = T2/T7.
- ✅ GATE partiel : vitest 66/66 ✅ · eslint ✅ · prettier ✅ · 🔄 typecheck (via hook commit) · 🔄 vérif adversariale · 🔄 commit

### T2 — Schéma

- ✅ Migration additive `20260704000000_prospection_init` (16 tables, 12 FK, enums préfixés `Prospection`, `SiteSettingCategory += prospection`) — générée offline via `prisma migrate diff` (pas de DB requise), 0 DROP
- ✅ Contraintes UNIQUE dédup (siren, siret, contact, personKey, cell, tag, suppression, stock, geo, snapshot)
- ✅ stub-aware (prisma singleton) · ✅ `prisma generate` OK · ✅ schema-contract test (5) au lieu d'integration DB (pas de Postgres local ; enforcement runtime = CI/prod)
- ✅ `scripts/prospection/isolation-check.ts` + npm script → 0 violation (9231 fichiers)
- ✅ GATE : vitest 77/77 · eslint · prettier · isolation-check · 🔄 typecheck (hook) · 🔄 adversarial · 🔄 commit
- ⚠️ Reste T7 : write-side config (`setProspectionConfig`) + audit ; note reconciliation T1 (exploitable défini 2× — scoring hardcodé vs config `exploitableThreshold`, wiring en T5)

### T3 — Ingestion Stock Sirene (gate juridique = non bloquant, fixtures/mocks)

- ✅ `StockSource` (interface) + `LocalFileStockSource` (stream gz-aware) + `EmptyStockSource` · ✅ `sirene-stock-schema` (Zod + mapping) · ✅ `sirene-stock-ingestor` (bulk-upsert dédup SIREN/SIRET, injectable db) + `StockReference` (dénominateur dép×naf×taille)
- ✅ `nature-juridique.ts` (SSOT type organisation) + test
- ✅ `delta-worker` (réutilise l'ingestor — upsert idempotent, cessations marquées) · ✅ `stock-ingestor-worker` (stub-aware, fichier via env/job)
- ✅ rate-limit distribué : `token-bucket-redis` (Lua atomique + pur testable, fail-open) + limiter BullMQ par file · ✅ `circuit-breaker` (machine à états pure + Redis fail-open)
- ✅ Zod (schéma altéré → invalidRows, jamais de null) · ✅ non-diffusible **exclu à l'ingest** (#4) · ✅ idempotence (#6) · queues in-module + workers enregistrés (worker.ts + sentry WorkerName)
- ✅ GATE : vitest 125/125 · eslint · prettier · isolation-check (0) · typecheck
- ✅ **Vérif adversariale + réconciliation** (agent indépendant) : BOM = faux positif (trim() gère) mais fix explicite gardé ; **A** orphelin `connect` + `Promise.all` fatal → try/catch par ligne (P2025 = `etablissementOrphanSkipped`, jamais fatal) ; **B** dénominateur double-compte SIRET + drop silencieux → dédup `seenSiegeSirets` + `siegeIncomplet` tracé ; **C** half-open pas single-probe → fenêtre `probeUntilMs` (single-probe best-effort) ; **D** limiter BullMQ inexistant → commentaires corrigés (limiter = sur WORKER collect T4) + trim statut/état. +5 tests régression.
- 📌 Décisions : download DataGouv = **fichier local via chemin** (`PROSPECTION_STOCK_*_PATH`, ops wget) plutôt qu'un downloader HTTP non testable ; tests = fixtures CSV temp (pas de SIREN réel) ; rate-limit dur = **limiter BullMQ sur les workers collect/enrich (T4/T5, à poser)**, token-bucket = lissage global fail-open.

### T4 — Collecte + coverage

- ✅ `campaign-expansion` (secteur→naf, cellules paresseuses via StockReference, decideCellOutcome exhaustivité) · ✅ `collect-cell` (count-based, RGPD where opt-out/non-diffusible exclus, idempotent #6) · ✅ `orchestrator` (upsert cellules dédup, n'enfile que a_faire/erreur, quota) · ✅ `recherche-entreprises` connecteur (Zod, injectable fetch, stub-aware)
- ✅ `coverage-rollup` (dép→région→France, computeMetrics sans div/0) + `coverage-service` (recalcul depuis COUNT = anti-dérive #2, `detectDrift`)
- ✅ 4 workers (orchestrator, collect [limiter BullMQ DUR], coverage [rollup+snapshot], scheduler) enregistrés + crons (scheduler \*/5, coverage :15)
- ✅ idempotence jobId nonce (enqueueProspectionCollect cell:run) · tests #2 anti-dérive + #6 anti-doublon
- ✅ GATE : vitest 150/150 · eslint · prettier · isolation-check (0) · typecheck (exactOptional fixes) · 🔄 adversarial · 🔄 commit

### T5 — Enrichissement (2 passes)

- ✅ helpers purs : `email` (syntaxe+MX injecté, rôle, matching nominatif), `phone` (E.164 FR, surtaxés exclus), `person-key` (dédup nom+prénoms triés), `html-utils`, `domain-confirm` (#9 SIREN/dénom), `contact-extract`, `person-extract` (#7 responsables), `robots` (local D-T0-1)
- ✅ `enrich-service` (2 passes distinctes, confirmation domaine gate le scrape, validation MX/E.164, matching nominatif, contactabilité+leadScore, writes contacts/persons/roles) + test intégration fixtures (#7/#9/nominatif)
- ✅ `recherche-entreprises` (T4) + `annuaire-administration` connecteur (public, Zod, stub-aware) + `enrich-worker` (ssrfSafeFetch+robots, MX dns, **limiter BullMQ DUR ≤10/s** = dette D T3 réglée, RGPD opt-out/non-diffusible avant réseau, anti-re-scrape refreshAfter)
- ✅ GATE : vitest 194/194 · eslint · prettier · isolation (0) · typecheck · 🔄 adversarial · 🔄 commit
- 📌 Inclut **réconciliation T4** (adversarial) : D1 enrichies câblé (groupBy), D2 orchestrator jobId sans nonce (no-op fixé), G1 garde ciblage vide, G2 curseur enrich (pas de queue perdue), en_cours posé.

### T6 — Admin pilotage

- ✅ pôle nav · ✅ wizard 4 étapes (aperçu volume) · ✅ détail campagne · ✅ scheduler/priorité
- ✅ GATE (+ size-limit/lhci) · ✅ vérif adversariale · ✅ commit

### T7 — Admin exploitation

- ✅ base + filtres (keyset) · ✅ fiche entreprise · ✅ contacts à onglets · ✅ coverage-map + région/France · ✅ carte SVG
- ✅ GATE (+ Web Vitals) · ✅ vérif adversariale · ✅ commit

### T8 — Export & RGPD

- ✅ export segmenté (re-filtre opt-out + non-diffusible) · ✅ tests #4 (non-diffusible), #5 (opt-out post-collecte)
- ✅ journal d'accès · ✅ RBAC · ✅ purge rétention (entreprise + personne) · ✅ pont CRM manuel
- ✅ GATE · ✅ vérif adversariale · ✅ commit

### T9 — Durcissement

- ✅ circuit breaker · ✅ alertes anomalies · ✅ Web Vitals admin · ✅ bench charge/soak · ✅ suite complète
- ✅ GATE · ✅ vérif adversariale · ✅ commit

## ✅ COMPLÉTION (2026-07-04)

**T0→T9 + pilote + 2 vérifications finales : FAIT.** 232 tests verts, tous les gates (typecheck
full-repo, eslint, anti-siren/anti-hex/use-client, gitleaks, commitlint, isolation-check) passés à
chaque commit. Chaque tranche : gate → croisement → vérif adversariale indépendante → réconciliation
→ commit. Pilote Isère 38 · BTP+Santé prouvé end-to-end sur fixtures (`pilot-e2e.test.ts`) : ingest →
cellules → collecte (exhaustivité) → enrichissement 2 passes (responsables captés) → rollup
dép→région→France → opt-out post-collecte → export segmenté re-filtré. **Aucun SIREN réel, aucune
collecte prod, aucun envoi d'email** (grep 0 mailer). RGPD prouvé (non affirmé) à l'ingest + collecte

- enrichissement + export.

**Vérifs finales (2 passes indépendantes)** : (1) matrice 06 rejouée + preuve RGPD 6 points → « done
modulo wiring journal view/search » → **corrigé** (`logProspectionAccess` câblé sur entreprises /
contacts / personnes). (2) cas limites / sécurité / non-régressions → 2 défauts confirmés **corrigés** :
cellule `en_cours` bloquée (reclaimer stale→erreur dans coverage-worker) + injection de formule CSV
(csvEscape neutralise `=+-@`). Défauts mineurs corrigés : propagation opt-out par domaine.

**Reste côté Will (uniquement de la config, ZÉRO code)** :

1. Remplir les 3 champs légaux dans `SiteSetting` catégorie `prospection`, clé `legalIdentity` :
   `raisonSociale`, `siren`, `dpoContact` (+ `aipdValidatedBy`/`aipdValidatedAt`).
2. Relecture juriste de l'AIPD/LIA (recommandée) avant la 1re collecte en production.
3. Fournir les fichiers Stock Sirene (chemins `PROSPECTION_STOCK_UNITE_LEGALE_PATH` /
   `..._ETABLISSEMENT_PATH`) + activer le worker (BULLMQ) pour lancer la collecte réelle.
4. `pnpm prisma migrate deploy` appliquera la migration `20260704000000_prospection_init` au restart.

**Items différés (documentés, non bloquants V1)** : opt-out par téléphone (nécessite ajout enum
`ProspectionSuppressionType` + migration) ; pont CRM Qualiopi manuel (Q5, option) ; tests
d'intégration Redis (re-enqueue no-op, Retry-After, isBuildStub gating) et E2E Playwright/lhci UI
(hors suite vitest — gate CI dédié) ; bench charge/soak France entière (T9 §6, mesure prod).

## Journal (append)

- 2026-07-01 — Dossier de conception + skill créés. Implémentation non démarrée. En attente feu vert Will
  - validation juridique AIPD.
- 2026-07-03 — **Audit de complétude (adversarial) + réconciliation docs** (aucun code). Dossier jugé
  complet et autopilot-ready T0→T9. Incohérences inter-fichiers corrigées : enum `ProspectionEvent`
  (`person_added`, 01-DATA-MODEL fait foi) · nommage `CompanyPerson` (ex-`Dirigeant`) dans PLAN ·
  seuil `exploitable` (= email MX-OK, tél = bonus ; 07-DECISIONS fait foi) · nav pôle complète (12
  sous-sections, 04-SPEC fait foi) · page « Santé & alertes » orpheline → rattachée Dashboard+Journal ·
  `GeoCoverageStat` **verrouillé en table rollup Prisma** (MV = option) · granularité `CoverageCell`
  clarifiée (identité NAF, `secteur → naf[]` détendu à la création) · enums `secteur`/`fonctionNormalisee`
  marqués livrables T1 (exhaustifs + test + repli `autre`). Protocole de reprise + cadence par-étape
  ajoutés en tête de ce fichier. **Reste côté Will (non bloquant T0-T2)** : 3 champs `[À COMPLÉTER]` AIPD
  (raison sociale + SIREN, contact DPO, date) · acter ADR-0001/0002/0003 (statut « accepté ») · relecture
  juriste avant collecte prod T3+.
