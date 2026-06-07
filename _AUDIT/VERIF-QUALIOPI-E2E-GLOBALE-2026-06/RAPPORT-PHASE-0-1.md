# RAPPORT — Phases 0, 0.5 & 1

## Phase 0 — Baseline & intégrité du dépôt

- **Branche** : `main`. **HEAD** `55877bfb` ; **origin/main** `4fed02e0`. Working tree :
  **2 commits locaux non poussés** (deux `Revert` de la vitrine `/interventions` + `/formations`,
  sans rapport avec le moteur Qualiopi), 0 behind. Fichiers non suivis : dossiers d'audit + 2 scripts LH.
  → État cohérent avec « working tree partagé multi-sessions ».
- **Services dev** : Docker Desktop était arrêté → démarré. Postgres dev **5433** (healthy),
  Redis **6381** (healthy), Mailhog **2525/8025**. Connexion Prisma OK.
- **Migrations** : DB dev avait **4 migrations non appliquées** → `prisma migrate deploy` exécuté
  (74 migrations, head atteint). FTS SQL `migrations_fts/*.sql` appliqués (dont la grille v1).
- **Audit précédent (`VERIF-QUALIOPI-E2E-2026-06-06`) re-statué** : G1 (grille runtime + fail-loud),
  R2/R3 (OPCO tripartite + POEI UI), R4 (RAC CPF), R5 (off.32 validée), R7 (numérotation),
  R9 (formateurs), R10 (stagiaires), R11 (devis→convention), B2C, inter-entreprises — tous présents
  dans le code. **MAIS** : voir Phase 1 (le seed auto annoncé « corrigé » était cassé au runtime) et
  RAPPORT-PHASE-3+ (R7 incomplet sur la facture session-level ; clôture cron sans garde émargement).

## Phase 0.5 — Auto-inventaire exhaustif

Inventaire **extrait du code** (`COUVERTURE.md`, N = **275 lignes**) :
- **106** server actions `…Action` sous `src/server/actions/qualiopi/**`.
- **40** pages admin `page.tsx` + 1 route SSE.
- **5** routes/écrans publics (portail ×3, fiche formation, vérif attestation).
- **19** templates PDF (18 `documents/templates` + `supports/support-pdf`).
- **6** templates email qualiopi.
- **25** domaines services.
- **2** workers + crons.
- **4** machines à états (formation / session / enrollment / devis).
- **32** indicateurs RNQ.
- **6** dispositifs financement × **3** types de client.
- **14** gardes de conformité recensées.
- **30** clés config + flags + 6 voies de seed.

## Phase 1 — Modèle de données & seeds runtime — 🔴 1 P0 TROUVÉ & CORRIGÉ

### 🔴 P0 — Le seed auto au boot throw silencieusement → référentiel jamais peuplé en prod

- **Type** : BUG · **Niveau de preuve** : RUNTIME (DB dev + clean-room) · **Domaine** : seed / boot
- **Constat** : `seedQualiopiReferenceData` (`reference-data.ts:119`) appelait
  `pg_try_advisory_lock(${k0}, ${k1})`. Prisma binde les nombres JS en **`bigint`**, or Postgres
  n'expose cette fonction qu'en `(bigint)` **ou** `(int4, int4)` — **jamais `(bigint, bigint)`**.
  → throw `42883 function pg_try_advisory_lock(bigint, bigint) does not exist`.
- **Preuve** : `probes/01-seed-runtime.ts` 1ʳᵉ exécution → `PROBE_ERROR ... 42883`. Comme
  `instrumentation.ts:38-44` est **fail-soft** (try/catch), l'erreur est **avalée** : le serveur boote
  mais **n'a rien seedé**. Le bouton admin `reseedReferenceDataAction` (même chemin) était aussi cassé.
  Les specs ne l'ont jamais vu car elles **mockent `$queryRaw`** (`reference-data.spec.ts`).
- **Impact** : au **premier boot prod sur DB neuve**, `offres_site` + config SiteSetting + grille v2
  restent **vides** → pages offres/réservation vides, config admin sans clés, grille active = v1 (SQL)
  au lieu de v2. La seule raison pour laquelle la DB dev avait des données : un `pnpm qualiopi:seed`
  manuel antérieur. **Exactement le piège « seed runtime » du §1.3 du prompt.**
- **Correctif appliqué** : cast explicite `::int4` sur les deux args (lock + unlock),
  `reference-data.ts`. Commentaire explicatif ajouté.
- **Preuve du correctif (RUNTIME)** :
  - `probes/01` : seed #1 et #2 OK, **idempotent** (offres/config inchangés), **non-destructif**
    (NDA `PROBE-NDA-12345` préservé après re-seed), grille active = **v2** (v1 inactive).
  - `probes/02` : **stub no-op** (`stub.invalid` → `ran:false`, 0 mutation) ; **verrou concurrence**
    (2 seeds simultanés → un seul `ran:true`).
  - `probes/03` (**clean-room DB `axion_ia_audit` vierge**) : `offres 0→11`, `config 0→30/30`,
    grille active `v1→v2`. **PREMIER_BOOT_PEUPLE_OK: true**. Sans le fix, ce boot aurait throw et
    laissé tout vide.

### ✅ Autres vérifications Phase 1
- **Idempotence INSERT runtime** : ✅ (re-seed ne duplique pas — prouvé probe 01).
- **Kill-switch `QUALIOPI_AUTO_SEED=false`** : présent (`instrumentation.ts:26`) — court-circuit avant import.
- **No-op `stub.invalid`** : présent à 2 niveaux (instrumentation + service) — prouvé probe 02.
- **Grille active après coexistence (a)SQL v1 + (b)seed v1/v2** : **v2** (le seed désactive v1). ✅
- 🔵 **Observation** : sur la DB dev, `siteSetting.count(category=qualiopi)` = **33** vs registre **30**
  → 3 clés legacy hors registre (sessions antérieures). Sans impact (la clean-room donne 30/30). Non bloquant.
