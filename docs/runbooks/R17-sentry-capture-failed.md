# R17 — Sentry capture failed (DSN invalide / quota)

- **Code** : R17
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (observabilité perdue)
- **Impact si non traité** : exceptions runtime non capturées → bugs invisibles → MTTR explose.

## Trigger

- Sentry dashboard `https://sentry.io/...` 0 events reçus depuis > 1h alors que site est UP.
- App logs : `Sentry: failed to send event (HTTP 401)` ou `429 quota exceeded`.
- Test forcé via `/api/test-sentry` (route ponctuelle à créer) renvoie 200 mais Sentry n'affiche rien.

## Prérequis

- Accès Sentry SaaS EU `https://sentry.io/organizations/<ORG>/projects/<PROJECT>/keys/`.
- Coolify env vars `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.

## Étapes

### 1. Vérifier état DSN

```bash
# DSN doit être de la forme : https://<key>@ingest.de.sentry.io/<project_id>
curl -s "${SENTRY_DSN}/security/?sentry_key=<key>" -o /dev/null -w "%{http_code}\n"
# 200 OK = DSN valide
# 401 = key révoquée
# 403 = project disabled
```

### 2. Cas A — DSN révoqué/invalide

#### Régénérer DSN

Sentry UI : Settings → Projects → axion-ia → Client Keys (DSN) → "Generate New Key" ou activer key existante.

#### Update env Coolify

```bash
NEW_DSN="https://<new-key>@ingest.de.sentry.io/<project_id>"

curl -X PATCH "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d "{\"key\":\"SENTRY_DSN\",\"value\":\"${NEW_DSN}\"}"

curl -X PATCH "http://178.105.55.15:8000/api/v1/applications/mqbmlz1bcwsdwi3t9fxsllqt/envs" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -d "{\"key\":\"NEXT_PUBLIC_SENTRY_DSN\",\"value\":\"${NEW_DSN}\"}"
```

### 3. Cas B — Quota dépassé

Sentry Free plan = 5K events/mois (ou Team plan = 50K). Si dépassé :

#### Réduire bruit (immediat)

```ts
// src/sentry.server.config.ts — augmenter tracesSampleRate restrictif
Sentry.init({
  tracesSampleRate: 0.05, // 5% au lieu de défaut
  // Filter known noisy errors
  ignoreErrors: [/^ResizeObserver loop/, /^Non-Error promise rejection/],
});
```

Commit + push → Coolify auto-deploy.

#### Upgrade plan ou attendre reset

Reset mensuel ~24h après hit quota. Décision Will : payer ou réduire échantillonnage.

### 4. Vérifier scrub PII config (RGPD Art. 32)

Mémoire `axionia_session_2026-05-09_sprint_24` : `src/lib/observability/sentry-pii-scrub.ts` doit être actif.

```bash
# Test scrub : forcer event contenant PII fake
docker exec axion-ia-app-prod node -e "
  const Sentry = require('@sentry/node');
  Sentry.captureMessage('test email=user@example.com phone=0612345678');
"
# Vérifier Sentry dashboard : email/phone doivent être [Filtered]
```

### 5. Re-test capture

Créer route ponctuelle `/api/test-sentry/route.ts` :

```ts
export async function GET() {
  throw new Error("R17 test capture " + new Date().toISOString());
}
```

Hit → vérif Sentry → 1 event apparaît dans la minute. Supprimer la route après.

## Vérifications post-fix

- [ ] DSN test renvoie 200.
- [ ] 1 event Sentry visible dashboard post-test capture.
- [ ] Pas d'erreur app logs Sentry SDK dans les 10 min suivantes.
- [ ] PII scrub fonctionne (event test → email masqué).

## Rollback

- Restaurer ancien DSN (si pas révoqué côté Sentry).
- Restaurer `tracesSampleRate` original via revert commit.

## Escalation

| Niveau | Contact        | Quand                                         |
| ------ | -------------- | --------------------------------------------- |
| L1     | Will           | toujours                                      |
| L2     | Sentry support | si DSN génération bug ou quota policy unclear |

## Liens

- ADR 0010 — PII minimisation (couvre Sentry scrub)
- `runbook-monitoring.md` §1 (config Sentry SaaS EU)
- Code : `src/lib/observability/sentry-pii-scrub.ts`
- Mémoire `axionia_session_2026-05-11_e2e_audit_p0_sprint` — withSentryConfig + scrub
