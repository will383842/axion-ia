# Phase 9 — Monitor déploiement pipeline (autopilot 2026-05-18)

## Runs identifiés sur HEAD `87f5ff8`

```bash
gh api repos/will383842/axion-ia/actions/runs?per_page=15 \
  --jq ".workflow_runs[] | select(.head_sha == \"$HEAD_SHA\")"
```

| ID            | Workflow                        | Status    | Conclusion               | Notes                                               |
| ------------- | ------------------------------- | --------- | ------------------------ | --------------------------------------------------- |
| `26005748038` | Staging · Gate C                | completed | **success**              | 🟢 P1-02 fix validé (env indirection)               |
| `26005748037` | CI · Gates A + B                | completed | **success**              | 🟢 P0-02 fix validé (coverage ratchet)              |
| `26005748035` | Build & Deploy · GHCR + Coolify | completed | **failure** (attempt #1) | 🔴 Step 8 build & push image, ~36 min, no log flush |

### Attempt #2 (re-run autopilot Phase 10)

```bash
gh run rerun 26005748035 --failed
# Re-run scheduled, attempt #2
```

| Attempt | Status      | Heure démarrage                 |
| ------- | ----------- | ------------------------------- |
| #1      | failure ❌  | 23:23:55Z → 00:02:39Z (~38 min) |
| #2      | in_progress | 00:04:24Z → en cours            |

## Diagnostic attempt #1

- **Steps 1-7** : success en ~2:30 min (Set up job, Free disk space 137s, Checkout, Docker Buildx, Login GHCR, Extract metadata, Compute BUILD_TIME).
- **Step 8 "Build & push image"** : durée ~36 min, conclusion failure, **AUCUN log file produit** dans le zip téléchargé via `gh api .../logs`.
- **Step 9 "Print image ref"** : non exécuté.
- **Job "Trigger Coolify deploy"** : skipped (build a fail).
- **Job "Lighthouse CI post-deploy gate"** : skipped.

## Hypothèses cause racine

Le manque de log file pour step 8 indique probablement :

1. **Runner disque saturé** (ADR 0026 mentionne build SSG saturation ~117 GB peak) → log writer ne peut plus flush.
2. **OOM killed** → process tué sans flush stderr.
3. **Network timeout** GHCR push → mais ça produirait du log.
4. **GHA cache corruption** → mais ça produirait erreur en début.

Cause la plus probable : **disque saturé pendant le `docker push` final** (export des layers ~10 GB + cache ~30 GB + image en mémoire + intermédiaires = peut dépasser le headroom même après "Free disk space" libère ~75 GB).

## Smoke prod baseline (sanity check)

Pendant le re-run, vérif que la prod actuelle (image baseline pré-audit) répond :

```bash
curl -s -o /dev/null -w "%{http_code}" https://axion-ia.com/api/healthz   # 200 ✅
curl -s -o /dev/null -w "%{http_code}" -L https://axion-ia.com/fr/        # 200 ✅
for url in /fr /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://axion-ia.com$url"); echo "$url → $code"
done
# 5/5 = 200 ✅
```

**🟢 Prod baseline UP** — pas de régression visible côté utilisateur. Le streak deploy raté laisse la prod sur l'image baseline 2026-05-17 (sans les fixes 7fde8cb + 9f040fb).

## Décision

Continue Phase 10 self-healing (attendre re-run #2). Si re-run échoue à nouveau, investiguer le Dockerfile + cache.

(Suite dans `PHASE-10-SELF-HEALING-LOG.md`.)
