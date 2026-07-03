# STATE — Suivi d'implémentation de bout en bout (Prospection & Base Entreprises)

> **Fichier de reprise de l'autopilot.** Point d'ancrage unique pour reprendre après une fermeture
> inopinée de Claude Code (limite de session, crash, coupure). Légende : 🔲 à faire · 🔄 en cours ·
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
5. Reprendre à l'étape 🔄 (ou la première 🔲 après le dernier ✅). **Ne jamais refaire une étape ✅.**

## 🔁 CADENCE DE MISE À JOUR (obligatoire pour que la reprise soit fiable)

Mettre à jour ce fichier **à chaque fin d'ÉTAPE** (pas seulement fin de tranche) : après chaque
schéma / server action / worker / UI / test / gate / vérif adversariale / commit. Séquence type d'une
étape : (a) faire le travail → (b) cocher la case ici + actualiser l'en-tête (tranche, étape, dernier
commit, prochaine action) → (c) committer sur la branche (message = `prospection(Tn): <étape>`). Ainsi
une fermeture inopinée ne perd **au plus qu'une seule étape**, toujours reconstructible via `git log` + DB.

## En-tête de session (à actualiser)

- **Tranche en cours** : **T1 (SSOT & config)** — démarrée
- **Dernier commit** : (T0 à committer)
- **Worktree** : ✅ `.claude/worktrees/prospection`, branche `feat/prospection` (off `main` @15b115fd), `pnpm install` OK.
- **Gate juridique (Q9)** : ✅ **NON BLOQUANT pour le build** (directive Will) — AIPD/LIA/mention pré-remplies ; valeurs légales = placeholders `SiteSetting`/`[À COMPLÉTER]`. T3+ construit/testé sur fixtures/mocks, jamais de SIREN réel/collecte prod. Reste côté Will = 3 champs + relecture juriste avant collecte prod.
- **Prochaine action** : T1 — écrire les SSOT purs (`departement-to-region` ✅ écrit) + `taille`, `naf-to-secteur`, `qualite-to-fonction`, `crawl-targets`, `scoring` + registry SiteSetting, puis tests + gate + adversarial + commit.
- **Directive Will (2026-07-03)** : autopilot complet T0→T9 + pilote, sans blocage juridique, gates+croisement+vérif adversariale par tranche, 2 vérifs E2E finales, worktree isolé, sources gratuites, aucun outreach, jamais push main sans accord.

## Avancement global

| Tranche   | Objet                                                                                                  | Bloqué par        | Statut |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------- | ------ |
| **T0**    | Grounding + RAPPORT D'EXPLORATION + ADR actés (AIPD/LIA **déjà pré-remplies**)                         | —                 | 🔲     |
| **T1**    | SSOT purs (naf-to-secteur, taille, dép-région, qualite-fonction, crawl-targets, scoring) + SiteSetting | — (non bloqué)    | 🔲     |
| **T2**    | Schéma Prisma (migration additive, toutes entités)                                                     | T1                | 🔲     |
| **T3**    | Ingestion Stock Sirene + delta + rate-limit distribué + Zod + circuit breaker                          | ⛔ gate juridique | 🔲     |
| **T4**    | Collecte ciblée + coverage-worker (rollup dép→région→France) + idempotence                             | T3                | 🔲     |
| **T5**    | Enrichissement 2 passes (coordonnées + responsables) + confirmation domaine + validation email/tél     | T4                | 🔲     |
| **T6**    | Console admin pilotage (pôle nav, wizard, détail campagne)                                             | T4                | 🔲     |
| **T7**    | Console admin exploitation (base, fiche, contacts onglets, coverage-map, carte)                        | T5                | 🔲     |
| **T8**    | Export segmenté + RGPD (opt-out multi-clé, journal d'accès, purge, pont CRM manuel)                    | T7                | 🔲     |
| **T9**    | Durcissement (circuit breaker, alertes, Web Vitals, bench charge, tests complets)                      | T8                | 🔲     |
| **Final** | Campagne pilote Isère 38 · BTP + Santé prouvée + couverture matrice 100 %                              | T9                | 🔲     |

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

### T3 — Ingestion Stock Sirene ⛔ (gate juridique)

- 🔲 `StockSource` (interface) + `sireneStockIngestor` (bulk-upsert) + `StockReference`
- 🔲 `delta-worker` · 🔲 rate-limit distribué (file limiter + token-bucket) · 🔲 Zod · 🔲 circuit breaker
- 🔲 tests non-régression #1 (re-enqueue), #3 (exhaustivité), #8 (rate-limit), #10 (stub) · 🔲 GATE · 🔲 vérif adversariale · 🔲 commit

### T4 — Collecte + coverage

- 🔲 `collect-worker` (dédup SIREN/SIRET) · 🔲 `coverage-worker` (rollup 3 niveaux) · 🔲 idempotence jobId
- 🔲 tests #2 (anti-dérive), #6 (anti-doublon) · 🔲 GATE · 🔲 vérif adversariale · 🔲 commit

### T5 — Enrichissement (2 passes)

- 🔲 découverte domaine + confirmation SIREN (test #9) · 🔲 passe A coordonnées · 🔲 passe B responsables (test #7)
- 🔲 validation email (MX)/tél (E.164) · 🔲 matching nominatif · 🔲 Annuaire administration (public)
- 🔲 GATE · 🔲 vérif adversariale · 🔲 commit

### T6 — Admin pilotage

- 🔲 pôle nav · 🔲 wizard 4 étapes (aperçu volume) · 🔲 détail campagne · 🔲 scheduler/priorité
- 🔲 GATE (+ size-limit/lhci) · 🔲 vérif adversariale · 🔲 commit

### T7 — Admin exploitation

- 🔲 base + filtres (keyset) · 🔲 fiche entreprise · 🔲 contacts à onglets · 🔲 coverage-map + région/France · 🔲 carte SVG
- 🔲 GATE (+ Web Vitals) · 🔲 vérif adversariale · 🔲 commit

### T8 — Export & RGPD

- 🔲 export segmenté (re-filtre opt-out + non-diffusible) · 🔲 tests #4 (non-diffusible), #5 (opt-out post-collecte)
- 🔲 journal d'accès · 🔲 RBAC · 🔲 purge rétention (entreprise + personne) · 🔲 pont CRM manuel
- 🔲 GATE · 🔲 vérif adversariale · 🔲 commit

### T9 — Durcissement

- 🔲 circuit breaker · 🔲 alertes anomalies · 🔲 Web Vitals admin · 🔲 bench charge/soak · 🔲 suite complète
- 🔲 GATE · 🔲 vérif adversariale · 🔲 commit

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
