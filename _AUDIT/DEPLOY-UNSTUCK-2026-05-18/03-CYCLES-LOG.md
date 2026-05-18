# 03 — Cycles log (Phase 4 self-healing)

Généré au fur et à mesure des cycles. Pour chaque cycle : stratégie + commit + push + run id + durée + résultat + diagnostic.

## Numérotation

Cycle 1-4 = audit verif-fix-deploy 2026-05-18 (sessions précédentes). Cycle 5+ = autopilot deploy-unstuck 2026-05-18 (cette session).

| Cycle | Commit          | Stratégie                                                                   | Run ID          | Durée         | Résultat                           |
| ----- | --------------- | --------------------------------------------------------------------------- | --------------- | ------------- | ---------------------------------- |
| 1     | 87f5ff8         | audit fixes (12 routes V1/V2 + CI gates)                                    | 26005748035     | ~38 min       | ❌ OOM-kill silencieux step 8      |
| 2     | (rerun 87f5ff8) | gh run rerun --failed                                                       | 26005748035#2   | ~38 min       | ❌ OOM-kill silencieux step 8      |
| 3     | 0bdc46f         | disable cache-to: type=gha,mode=min                                         | 26007749354     | ~40 min       | ❌ OOM-kill silencieux step 8      |
| 4     | f193e2e         | NODE_OPTIONS 8192 → 6144                                                    | 26008830067     | ~41 min       | ❌ OOM-kill silencieux step 8      |
| **5** | **27d6e03**     | **S1+S10 : ubuntu-latest-large 32 GB + memory monitor**                     | **26016747329** | 9m 27s queued | ❌ cancelled (runner indisponible) |
| **6** | _à venir_       | **revert ubuntu-latest + D4-QW1 : SSG villes indexable only + S10 monitor** | _à venir_       | en cours      | en cours                           |

---

## Cycle 5 (HEAD `27d6e03`) — S1 + S10

- **Date** : 2026-05-18 ~06:12 UTC (push), ~06:13 UTC (run start).
- **Run ID** : `26016747329`
- **URL** : https://github.com/will383842/axion-ia/actions/runs/26016747329
- **Stratégie** :
  - S1 : `runs-on: ubuntu-latest-large` (32 GB RAM, 8 cores)
  - S10 : background memory + disk + load + CPU monitor toutes les 30s
- **Commit** : `27d6e03 fix(deploy): cycle 5 unstuck — ubuntu-latest-large 32 GB + memory monitor (S1+S10)`
- **Diagnostic appliqué** :
  - D2 confirmé peak prévu 14.8-16.2 GB sur runner 16 GB → larger runner 32 GB = marge ~16 GB.
  - D3 confirmé pattern OOM déterministe à 38 min, runner IDs différents → cause = code, fix = +RAM.
  - D6 confirmé Coolify queue saine, webhook OK → si build success, deploy automatique.
- **Validation locale pré-push** :
  - typecheck ✅ (anti-siren ✅, anti-hex ✅, use-client ✅)
  - tests vitest : 96 files / 945 passed / 2 skipped en 96.67 s ✅
  - pnpm audit --prod --audit-level high : No vulnerabilities ✅
- **Push** : `223d1f5..27d6e03 main -> main` 2026-05-18 06:12:40 UTC ✅
- **Coût attendu** : ~$3-4 (25-30 min × $0.16/min larger runner).
- **Durée** : 9m 27s queued (06:12:40Z → 06:22:07Z).
- **Résultat** : ❌ **cancelled** — sous-cas C confirmé : `ubuntu-latest-large` indisponible sur le compte `will383842`. Labels demandés `["ubuntu-latest-large"]` jamais matchés à un runner. Signaux : (a) 2 autres runs queued depuis 2026-05-15 (3 jours, jamais démarrés) = `25906878058` + `25906810693`, (b) `gh api repos/.../actions/runners` retourne `total_count: 0` (pas de self-hosted runner non plus). → Pivot **Cycle 6 sous-cas C**.

---

## Cycle 6 (HEAD `à pusher`) — revert ubuntu-latest + D4-QW1 + garde S10

- **Stratégie** :
  - Revert `runs-on: ubuntu-latest-large` → `ubuntu-latest` (larger runner indisponible).
  - D4-QW1 : `buildStaticParams()` dans `VilleServicePageTemplate.tsx` retourne `getIndexableVilles()` (~1 ville = Paris) au lieu de `VILLES` (2150) **quand env var `BUILD_SSG_VILLES_INDEXABLE_ONLY=true`**.
  - Propagation Dockerfile (ARG + ENV) + workflow build-args (`BUILD_SSG_VILLES_INDEXABLE_ONLY=true`).
  - S10 instrumentation conservée (utile pour diagnostiquer le nouveau peak).
- **Impact attendu** :
  - 3 templates villes × ~2150 = ~6450 pages SSG ⇒ 3 × 1 = 3 pages SSG.
  - Peak RAM SSG : ~3-4 GB économisés (cf. D2 row "Next SSG collection 3.0-4.0 GB").
  - Total peak prévu après réduction : ~11-12 GB / 16 GB runner = marge 4-5 GB ✅.
  - Pages villes non-indexables servies via ISR (dynamicParams=true + revalidate=86400).
- **Cohérence SEO** : villes sans `copy.services` sont **déjà `noindex` côté metadata** (commentaire ligne 100 template) → pas de perte d'indexation, juste plus de génération paresseuse.
- **Coût** : 0 (runner standard gratuit).
- **Réversibilité** : 1-liner env var = false.

### Si SUCCESS

→ Phase 5 + 6 + 7.

### Si FAILURE — sous-cas attendus

- **A** : Build die avant 38 min → peak RAM toujours trop haut → Cycle 7 = W3 (heap 4096) + W6 (purge GHA cache).
- **B** : Build die après 38 min (plus tard que d'habitude — D4-QW1 a aidé partiellement) → Cycle 7 = W3 + W7 (BUILDKIT_PROGRESS=plain verbose).
- **C** : Build success mais Coolify deploy fail → Phase 5 diagnostic ciblé Coolify (vérifier env vars manquantes runtime).

---

## Plafonds

- ⏱️ Phase 4 cumulé : 6 h max.
- 🔁 Cycles max : 12.
- 💸 Coût max : $50.
- 🛑 Si épuisé → §28 cas 4 (STOP & ASK Will).
