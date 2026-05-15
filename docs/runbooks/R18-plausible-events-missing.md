# R18 — Plausible events ne remontent pas

- **Code** : R18
- **Version** : 1.0
- **Date dernière maj** : 2026-05-15
- **Sévérité** : 🟡 **P1 — important** (analytics + Web Vitals tracking perdu)
- **Impact si non traité** : Pas de stats trafic. Pas de RUM Web Vitals. Goals booking/audit invisibles. Tier-1 lifecycle (CTR-based promo/demo) bloqué.

## Trigger

- Plausible dashboard `https://plausible.axion-ia.com` real-time montre 0 visitor alors que prod a du trafic.
- Goals (Booking Submitted, Audit Submitted) à 0 depuis > 24h.
- Console navigateur : `Failed to load plausible.js` ou `Content-Security-Policy` violation.

## Prérequis

- Accès Plausible self-hosted `https://plausible.axion-ia.com`.
- Coolify env vars `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `NEXT_PUBLIC_PLAUSIBLE_API_URL`.
- Compréhension CSP `next.config.ts` `script-src` + `connect-src`.

## Étapes

### 1. Diagnostiquer côté navigateur

Ouvrir `https://axion-ia.com` en privé + DevTools → Console + Network :

```
✅ plausible.js chargé depuis https://plausible.axion-ia.com/js/script.js (200)
✅ POST https://plausible.axion-ia.com/api/event (202)
❌ ou bloqué par CSP : "Refused to load script ..."
❌ ou 404 sur /js/script.js
❌ ou ERR_BLOCKED_BY_CLIENT (adblocker user — pas un problème serveur)
```

### 2. Cas A — CSP bloque le script

Vérifier `next.config.ts` ou middleware CSP :

```ts
// Doit contenir :
"script-src 'self' https://plausible.axion-ia.com",
"connect-src 'self' https://plausible.axion-ia.com",
```

Si manquant → patch + commit + push.

### 3. Cas B — Service Plausible down

```bash
docker ps | grep plausible
# axion-ia-plausible Up X hours
# axion-ia-plausible-postgres Up X hours
# axion-ia-plausible-clickhouse Up X hours

docker logs --tail 30 axion-ia-plausible | grep -i error
```

Si conteneur down → restart :

```bash
ssh root@178.105.55.15 "docker restart axion-ia-plausible"
```

Si crash loop → vérifier ClickHouse (DB events) + Postgres Plausible (DB meta) :

```bash
docker exec axion-ia-plausible-clickhouse clickhouse-client --query "SELECT count() FROM plausible_events_db.events_v2"
```

### 4. Cas C — Domain mismatch

```
/admin/sites → site `axion-ia.com`
→ vérifier domaine exact (sans https, sans trailing slash)
→ env Coolify NEXT_PUBLIC_PLAUSIBLE_DOMAIN doit matcher
```

### 5. Test event manuel

```bash
curl -X POST "https://plausible.axion-ia.com/api/event" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 (test R18)" \
  -d '{
    "name":"pageview",
    "url":"https://axion-ia.com/test-r18",
    "domain":"axion-ia.com"
  }'
# Attendu : 202 Accepted
```

Vérifier dashboard real-time : 1 visitor apparaît dans la minute.

### 6. Helper `trackEvent` côté code

Mémoire `axionia_session_2026-05-13_seo_email_stack` : `Clarity component + helper IndexNow centralisé`. Vérifier `trackEvent` reste fonctionnel :

```bash
grep -rn "trackEvent\b" axionia/src | head -5
# Component : src/components/analytics/Plausible.tsx
```

## Vérifications post-fix

- [ ] Console navigateur : `plausible.js` chargé + `/api/event` 202.
- [ ] Plausible real-time : ≥ 1 visitor visible dans la minute.
- [ ] Test event curl 202 + visible dans dashboard.
- [ ] Goals reprennent (vérifier booking flow + audit form).

## Rollback

- Pas de rollback nécessaire si juste config / restart.
- Si CSP patch regretté → revert commit.

## Escalation

| Niveau | Contact         | Quand                                                     |
| ------ | --------------- | --------------------------------------------------------- |
| L1     | Will            | si Plausible bloque collecte > 24h                        |
| L2     | Hetzner support | si ClickHouse volume corrompu (Plausible storage backend) |

## Liens

- `runbook-monitoring.md` §2 (Plausible self-hosted)
- Code : `src/components/analytics/Plausible.tsx`
- Mémoire `axionia_session_2026-05-13_seo_email_stack` — Clarity + helpers analytics
- Master prompt § 13.3 (events Plausible content*gen*\*)
