# P-01 — HEADERS (15 routes critiques + spéciales)

**Date** : 2026-05-11 12:48-12:50 UTC. UA : `AxionIA-Audit/1.0`. Intervalle 200 ms.

## Tableau routes (HEAD only)

| URL                                     | Status      | Content-Type | Cache-Control                              | cf-cache-status | HSTS | CSP type |
| --------------------------------------- | ----------- | ------------ | ------------------------------------------ | --------------- | ---- | -------- |
| `/`                                     | 307 → `/fr` | —            | (redirect)                                 | DYNAMIC         | ✅   | soft     |
| `/fr`                                   | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/audit`                             | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/interventions`                     | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/interventions/essentielle`         | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/reserver`                          | 200         | text/html    | `max-age=300, s-maxage=31536000`           | **HIT**         | ✅   | soft     |
| `/fr/contact`                           | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/blog`                              | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/comparaisons`                      | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/methodologie`                      | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/cas-concrets`                      | 200         | text/html    | `private, max-age=300, must-revalidate` ⚠️ | MISS            | ✅   | soft     |
| `/fr/centre-aide`                       | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/faq`                               | 200         | text/html    | `max-age=300, s-maxage=31536000`           | HIT             | ✅   | soft     |
| `/fr/glossaire`                         | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/presse`                            | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/stack-ia`                          | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/fr/implantations/ile-de-france/paris` | 200         | text/html    | `max-age=300, s-maxage=31536000`           | **HIT**         | ✅   | soft     |
| `/en`                                   | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |
| `/en/audit`                             | 200         | text/html    | `max-age=300, s-maxage=31536000`           | MISS            | ✅   | soft     |

## Routes API + spéciales

| URL                     | Status                        | Content-Type              | Cache-Control            | Notes                                                                                                    |
| ----------------------- | ----------------------------- | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/api/healthz`          | 200                           | application/json          | no-store, no-cache       | DB ok, Redis ok ✅                                                                                       |
| **`/sitemap.xml`**      | **404**                       | text/html                 | public 3600/86400        | **BUG (cached 404)** AGT-04 dégradé : trade-off Next 16 documenté `sitemap-index.xml/route.ts:1-20`      |
| `/sitemap-index.xml`    | 200                           | application/xml           | public 3600/86400        | 11 sitemaps split référencés                                                                             |
| `/robots.txt`           | 200                           | text/plain                | public 86400             | **CF Managed Content prepend** : Disallow GPTBot/ClaudeBot/anthropic-ai en tête → contredit origin Allow |
| `/llms.txt`             | 200                           | text/plain                | public 3600 SWR 86400    | ✅                                                                                                       |
| **`/llms-full.txt`**    | **307** → `/fr/llms-full.txt` | —                         | —                        | AGT-04 P1 confirmé : middleware next-intl intercepte (devrait être 200 direct spec llmstxt.org)          |
| `/manifest.webmanifest` | 200                           | application/manifest+json | public 0 must-revalidate | ✅                                                                                                       |

## Headers sécurité (constants sur toutes les routes)

```
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
permissions-policy: camera=(), microphone=(), geolocation=(), interest-cohort=()...
referrer-policy: strict-origin-when-cross-origin
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-origin
cross-origin-embedder-policy: credentialless
vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding
```

## CSP

- **CSP soft** sur toutes les pages publiques (incluant /fr/reserver, /fr/audit, /fr/recherche) :
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://plausible.axion-ia.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://challenges.cloudflare.com https://plausible.axion-ia.com https://api.telegram.org https://*.ingest.sentry.io …;
  frame-src 'self' https://challenges.cloudflare.com;
  frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none';
  upgrade-insecure-requests
  ```
- `x-nonce` header présent (ex `SvMxaqJFiyik2PKGhKTxuRLecxMpKq0H`).
- **CSP strict** sur `/fr/<vrai-admin-prefix>/login` (AGT-08 confirme curl avec préfixe valide).
- **Faux préfixe admin** (`/fr/admin-test123/login`) → 200 + CSP soft (AGT-08 anti-fingerprinting confirmé).

## Trouvailles

1. ⚠️ **`/fr/cas-concrets` Cache-Control `private`** alors que les autres pages publiques sont `public`. Possible côté `app/[locale]/cas-concrets/page.tsx` qui force `dynamic`/`cookie()` ou similaire. **P2**.
2. ⚠️ **`/sitemap.xml` 404 cached** (cf-cache-status: HIT) par Cloudflare → invalidation difficile. AGT-04 a déjà tranché : trade-off documenté.
3. ⚠️ **`/llms-full.txt` 307** au lieu de 200 direct — AGT-04 P1 **CONFIRMÉ PROD**.
4. ✅ Tous les headers OWASP en place et constants.
5. ✅ HSTS preload sur toutes les routes (CF zone réécrit à 1 an).
6. ✅ CSP nonce per-request OK (différent pour chaque hit).
