# Phase 11 — Smoke prod final (autopilot 2026-05-18)

## Contexte

⚠️ **Le pipeline Build & Deploy est en streak de failures (8+ runs) depuis `fea4b2e` (2026-05-17 13:40 UTC) à cause d'un problème OOM-kill runner pré-existant** (cf. PHASE-10-SELF-HEALING-LOG.md). La prod tourne donc actuellement sur l'image baseline (HEAD pre-audit `1cd3d5f`).

Mes fixes audit Phase 4 (`7fde8cb`, `9f040fb`, `0bdc46f`, `f193e2e`) sont **sur origin/main** mais pas encore déployés en prod.

**Néanmoins**, smoke prod baseline = vérif que la prod ne s'est PAS cassée pendant ce temps.

## Smoke prod V1 (image baseline 2026-05-17)

### Endpoints critiques

| URL                                     | HTTP                | Notes                                       |
| --------------------------------------- | ------------------- | ------------------------------------------- |
| `https://axion-ia.com/api/healthz`      | 200                 | ✅ Healthcheck app OK                       |
| `https://axion-ia.com/fr/`              | 200 (via 308 → /fr) | ✅ Home FR (trailing slash redirect normal) |
| `https://www.axion-ia.com/fr/`          | 308                 | ✅ www → apex redirect                      |
| `https://axion-ia.com/fr/interventions` | 200                 | ✅                                          |

### LHCI pilot URLs (5/5 green)

```bash
for url in /fr /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://axion-ia.com$url")
  echo "$url → $code"
done
```

| Route               | HTTP   |
| ------------------- | ------ |
| `/fr`               | 200 ✅ |
| `/fr/interventions` | 200 ✅ |
| `/fr/methodologie`  | 200 ✅ |
| `/fr/reserver`      | 200 ✅ |
| `/fr/stack-ia`      | 200 ✅ |

✅ **5/5 LHCI pilot URLs = 200**.

## Smoke V2 (cookie admin_v2=1)

**Non testable autopilot** : nécessite `ADMIN_URL_PREFIX` (env var prod secret, lue depuis Coolify).

Recommandation Will pour preview V2 :

1. Récupérer `ADMIN_URL_PREFIX` depuis Coolify.
2. Naviguer vers `https://axion-ia.com/fr/<ADMIN_URL_PREFIX>/login`, login.
3. Activer cookie `admin_v2=1` via DevTools (`document.cookie="admin_v2=1; path=/"`).
4. Refresh pages admin → vérifier composants `_v2/` rendus au lieu de V1.

**Cependant** : V2 preview NÉCESSITE que la pipeline soit débloquée (l'image baseline n'a pas tous les V2 composants — ils sont dans HEAD `f193e2e` non-déployé).

## Verdict smoke

🟡 **Baseline V1 100% vert** mais **V2 fixes non-déployés** (pipeline pré-existant bloqué).

- **Côté utilisateur final** : aucun impact, prod V1 fonctionne normalement.
- **Côté V2 admin** : preview impossible jusqu'à déblocage pipeline.

## Décision

Continuer Phase 12 (verdict final) avec :

- Bilan audit Phase 1-7 + fixes Phase 4 = ✅ 100% green.
- Pipeline deploy = 🔴 pré-existant, non-bloquant pour les utilisateurs, **action humaine recommandée Sprint Hardening**.
