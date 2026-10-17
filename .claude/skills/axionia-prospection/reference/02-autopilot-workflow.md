# 02 — Workflow autopilot

## Phases

```
Phase 0    Grounding : lire le code réel d'axionia (confirmer les briques de reference/01) + tout le
           dossier _PROSPECTION-BASE-ENTREPRISES/ → RAPPORT D'EXPLORATION (aucun code).
Phase 0.5  GATE JURIDIQUE BLOQUANT : AIPD + LIA + exemption art.14 validées (07-DECISIONS Q9).
           → Sans ce feu vert : AUCUN connecteur de collecte. On peut préparer SSOT + schéma + UI.
Phase 1    Plan : ordonner les tranches par dépendance (voir roadmap ci-dessous).
Phase 2..N Par tranche : schéma → server action/worker → UI → test → GATE → CROISEMENT → RÉCONCILIATION
           → commit sur branche.
Final      Campagne pilote prouvée (Isère 38 · BTP + Santé) + couverture matrice d'acceptation 100 %.
```

## RAPPORT D'EXPLORATION (sortie de Phase 0, aucun code)

Doit contenir : confirmation des chemins réels des briques (reference/01) avec `fichier:ligne` ; version
réelle des libs ; état du gate juridique (Q9) ; liste des divergences dossier↔code (à corriger dans le
dossier) ; plan de tranches confirmé ; création du worktree + `STATE.md` initial. Aucune écriture de code
métier avant ce rapport.

## Ordre des tranches (roadmap — détail `06-MATRICE-ACCEPTATION.md`)

- **T0** Grounding + **AIPD/LIA** (bloquant) + ADR actés.
- **T1** SSOT purs : `naf-to-secteur`, `taille`, `departement-to-region`, `qualite-to-fonction`,
  `crawl-targets`, `scoring` + `SiteSetting` `prospection`. _(non bloqué par le gate juridique)_
- **T2** Schéma (migration additive : Company, Establishment, CompanyPerson+Role, Contact, Campaign,
  CoverageCell, CollectRun, Event, AccessLog, Tag, Suppression, StockReference, GeoCoverageStat,
  StatsSnapshot). _(non bloqué)_
- **T3** Ingestion **Stock Sirene** (bulk-load + `StockReference`) + delta + rate-limit distribué + Zod
  - circuit breaker. _(bloqué par gate juridique — c'est de la collecte)_
- **T4** Collecte ciblée + `coverage-worker` (rollup dép→région→France) + idempotence anti-piège jobId.
- **T5** Enrichissement 2 passes (coordonnées + **personnes/team pages**) + confirmation domaine +
  validation email/tél + Annuaire administration (public).
- **T6** Console admin pilotage (pôle nav, wizard, détail campagne).
- **T7** Console admin exploitation (base + filtres, fiche, contacts à onglets, coverage-map, carte).
- **T8** Export segmenté + RGPD (opt-out multi-clé bloquant, journal d'accès, purge, pont CRM manuel).
- **T9** Durcissement (circuit breaker, alertes, Web Vitals, bench charge, tests complets).

## Harnais de vérification (GATE à chaque tranche)

`typecheck` · `eslint` · `format:check` (⚠️ CRLF Windows : cibler les fichiers listés par la CI Linux) ·
`i18n` · `content-gen:isolation-check` et autres isolation-checks · `vitest` (unitaires + intégration) ·
`size-limit` + `lhci` si UI. Lancer la **suite complète** avant de déclarer une tranche « faite »
(le hook pre-push lance toute la Gate A ~10 min ; ne pas confondre « long » et « bloqué »).

## Croisement (à chaque tranche)

Besoin métier ✕ **RGPD** (`05-CONFORMITE`) ✕ contrat codebase (reference/01) ✕ charte admin ✕
**matrice d'acceptation** (`06`). Toute dérive → réconciliation immédiate avant d'avancer.

## Vérification ADVERSARIALE par tranche (gates verts ≠ correct)

Après les gates, lancer une **passe indépendante qui tente de RÉFUTER** que la tranche est correcte
(idéalement un agent distinct de celui qui a écrit le code) : relire le diff contre `06-MATRICE`,
chercher les cas limites non testés, vérifier la conformité RGPD de la tranche, croiser avec le contrat.
Une tranche n'est « faite » que si la vérification ne trouve rien (ou après réconciliation). Détail des
tests, fixtures, mocks et non-régressions : **`08-TEST-STRATEGY.md`**.

## Reprise sur interruption — journal `STATE.md` (résilience session/limite)

⚠️ Les limites de session sont un risque réel (déjà rencontré). Maintenir un **`STATE.md`** dans le
worktree, mis à jour à chaque fin de tranche/étape :

- tranche en cours + étape (schéma/action/UI/test) ;
- dernier commit ; cellules/périmètre traités ; décisions prises ; prochaines actions ;
- gates passés / restants.
  Toute reprise commence par **relire `STATE.md`** puis `git log` pour se resynchroniser, sans refaire
  l'existant. Combiné à l'idempotence DB (ci-dessous), l'autopilot est **reprenable de bout en bout**.

## Idempotence & reprise

- **DB = source de vérité** (état `CoverageCell`). Jobs éphémères (`removeOnComplete`) OU nonce d'attempt
  dans le jobId (`cell:<id>:run:<runId>`) — **jamais** de jobId statique réutilisé (piège BullMQ no-op
  documenté sur content-gen : purger les `failed` sinon le retry est ignoré).
- Reprise = ne rejouer que les cellules `a_faire`/`erreur`. Curseur de pagination persistant.
- Anti-re-scrape : `refreshAfter` + `contentHash` (no-op si inchangé).

## Sécurité git / deploy

- Travailler en **worktree isolé** (`.claude/worktrees/prospection`), branche dédiée off `main`.
- `git add` chemins explicites. Jamais `git add .`. Jamais push `main` sans accord (push = deploy).
- Retirer les jonctions `node_modules` AVANT `worktree remove` (sinon destruction du node_modules principal).
- Migrations : additives, appliquées en prod via `prisma migrate deploy` au restart.

## STOP & ASK

Collecte avant validation AIPD/LIA · source payante · outreach/email · source à CGU restrictives ·
migration destructive · régression Web Vitals · durée de conservation / mention d'information ·
modification du contrat `stub.invalid`. Le reste : décider selon contrat + dossier, documenter, continuer.

## Définition de « done » (V1)

Campagne pilote **Isère 38 · BTP + Santé × 4 tailles** : base peuplée, **responsables de secteur
capturés**, coverage 100 % des cellules, stats dép/région/France correctes, export segmenté généré,
**opt-out + non-diffusible prouvés**, **aucun envoi d'email**. + tous les critères de `06-MATRICE`.
