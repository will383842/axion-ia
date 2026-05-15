# R11 — Provider IA circuit breaker open

- **Code** : R11
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (info-only V1 si fallback prend le relais)
- **Impact si non traité** : tous les jobs `text` du provider concerné échouent jusqu'à reset 60s half-open. Si fallback saturé → backlog queue.

## Trigger

- Telegram `[⚠️ PROVIDER DOWN] OpenAI down (5 erreurs/30s — circuit ouvert). Fallback Claude actif.`
- Telegram `[🔴 PROVIDER LONG DOWN] OpenAI down 30 min. Claude saturé.` (escalade)
- Worker logs : `[router] circuit-breaker OPEN for openai, falling back to anthropic`

## Prérequis

- Accès admin `/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers`.
- Statut public provider : `status.openai.com` / `status.anthropic.com` / `status.perplexity.ai`.
- Connaissance du circuit breaker V0 (in-memory, 5 fails / 30 s → open 60 s → half-open).

## Étapes

### 1. Vérifier la panne upstream

```bash
curl -fsS https://status.openai.com/api/v2/status.json | jq .status.indicator
curl -fsS https://status.anthropic.com/api/v2/status.json | jq .status.indicator
# none | minor | major | critical
```

Si "critical" / "major" → panne externe confirmée → §2 patience.
Si "none" mais circuit ouvert → §3 investiguer.

### 2. Patience 60 s — half-open auto

Le circuit breaker (`src/server/content-gen/providers/router.ts`) bascule auto en half-open après 60 s. 1 requête test est laissée passer ; si OK → fermeture circuit.

```bash
# Vérifier router state en mémoire
docker exec axion-ia-worker-prod node -e "
  const { getCircuitState } = require('./dist/server/content-gen/providers/router');
  console.log(JSON.stringify(getCircuitState(), null, 2));
"
# Attendu après 60s : { openai: 'half-open', anthropic: 'closed', ... }
```

### 3. Forcer fallback Anthropic manuel (si fallback chain incomplète)

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers
→ ligne OpenAI → toggle "Enabled" → OFF
→ ligne Anthropic → vérifier "Enabled" ON + "Priority" élevée
```

Server Action : `updateProviderConfigAction`. Effet :

```sql
UPDATE "ProviderConfig"
SET enabled = false, "updatedAt" = NOW()
WHERE slug = 'openai';
```

### 4. Si fallback saturé (rate-limit Anthropic 50/min)

Ralentir le débit content-gen :

```
/fr/{ADMIN_URL_PREFIX}/content-gen/settings/batches
→ "Workers concurrency" : 5 → 2
→ "Rate-limit par minute" : 10 → 5
```

Ou pause batch en cours :

```
/fr/{ADMIN_URL_PREFIX}/content-gen/coverage/<id>
→ bouton "Pause campaign"
```

### 5. Vérifier coûts si fallback prolongé

Anthropic plus cher qu'OpenAI sur certains modèles. Surveiller `/content-gen/costs` pour éviter trigger cost cap (R02).

## Vérifications post-fix

- [ ] `getCircuitState()` retourne `closed` pour le provider concerné.
- [ ] Telegram silencieux > 5 min après reset.
- [ ] Worker logs : 3 jobs consécutifs OK depuis le provider re-enabled.
- [ ] Coûts du jour cohérents avec usage estimé (pas de spike).

## Rollback

- Re-enable OpenAI quand provider sain :
  ```
  /fr/{ADMIN_URL_PREFIX}/content-gen/settings/providers
  → toggle ON
  ```
- Restaurer concurrency / rate-limit normaux.
- Resume campaigns paused.

## Escalation

| Niveau | Contact          | Quand                                                                      |
| ------ | ---------------- | -------------------------------------------------------------------------- |
| L1     | Will             | si panne > 30 min ou coût anormal                                          |
| L2     | Provider support | OpenAI help.openai.com (status incident) / Anthropic support@anthropic.com |

## Liens

- Code : `src/server/content-gen/providers/router.ts` (circuit breaker V0)
- Master prompt § 12.3bis alertes (Provider down 5/30 min)
- R02 cost cap (risque si fallback prolongé)
