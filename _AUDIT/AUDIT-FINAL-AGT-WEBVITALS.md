# AUDIT FINAL — AGT-WEBVITALS-CHIFFRÉS

**Date** : 2026-05-09
**Build analysé** : `.next/` (Next 16.2.4 Turbopack, BUILD_ID `a3WGSk70PyzMjtmwuqx6q`)
**Source de vérité** : `.next/diagnostics/route-bundle-stats.json` + gzip Optimal sur chaque chunk physique
**Mode** : stat fichiers + grep config + gzip mesuré (pas de Lighthouse, pas de RUM)
**Périmètre** : 16 routes stratégiques + Sentry + caches/CDN

---

## 1. Bundle size par route stratégique (First Load JS gz mesuré)

Méthode : pour chaque route du `route-bundle-stats.json`, somme `gzip(chunk)` (CompressionLevel.Optimal) des `firstLoadChunkPaths`. Ratio gz observé ≈ 30 % de la taille raw (cohérent JS minifié).

| Route                                       | Raw KB | **Gz KB** | Budget | Statut       |
| ------------------------------------------- | -----: | --------: | -----: | ------------ |
| `/[locale]/contact`                         |  996.4 | **296.9** |     75 | OVER (×3.96) |
| `/[locale]/implementation`                  |  910.5 | **274.0** |     75 | OVER (×3.65) |
| `/[locale]/audit`                           |  910.5 | **274.0** |     75 | OVER (×3.65) |
| `/[locale]` (homepage)                      |  909.5 | **273.6** |     75 | OVER (×3.65) |
| `/[locale]/interventions`                   |  908.8 | **273.4** |     75 | OVER (×3.65) |
| `/[locale]/methodologie`                    |  897.2 | **269.5** |     75 | OVER (×3.59) |
| `/[locale]/stack-ia`                        |  897.2 | **269.5** |     75 | OVER (×3.59) |
| `/[locale]/cas-concrets`                    |  897.2 | **269.5** |     75 | OVER (×3.59) |
| `/[locale]/comparaisons`                    |  897.2 | **269.5** |     75 | OVER (×3.59) |
| `/[locale]/interventions/par-ville/[ville]` |  895.0 | **268.3** |     75 | OVER (×3.58) |
| `/[locale]/implantations/[region]/[ville]`  |  895.0 | **268.3** |     75 | OVER (×3.58) |
| `/[locale]/audit/par-ville/[ville]`         |  895.0 | **268.3** |     75 | OVER (×3.58) |
| `/[locale]/reserver`                        |  886.5 | **265.6** |    110 | OVER (×2.41) |
| `/[locale]/implantations/[region]`          |  883.2 | **264.2** |     75 | OVER (×3.52) |
| `/[locale]/implantations`                   |  883.2 | **264.2** |     75 | OVER (×3.52) |
| `/[locale]/confirmation`                    |  883.2 | **264.2** |     75 | OVER (×3.52) |

**16 / 16 routes stratégiques en dépassement**. Aucune n'approche le budget.

Top 5 chunks gz (qui dominent le shell de chaque route) :

| Chunk              | Raw KB |                                Gz KB |
| ------------------ | -----: | -----------------------------------: |
| `01_9-61.lm-9l.js` |  436.5 | **136.9** ← contient Sentry + vendor |
| `03~yq9q893hmn.js` |  110.0 |                                 38.5 |
| `0rekp4rvysexf.js` |  137.2 |                                 37.3 |
| `0kvwp1y9n_us7.js` |   57.1 |                                 17.9 |
| `0l5w54vrhrfdq.js` |   63.4 |                                 15.0 |

**Cause racine** : 5 chunks "rootMain" (`build-manifest.json.rootMainFiles`) + polyfill sont eagerly chargés sur toute route → ~210 KB gz de plancher partagé, avant même le code page.

**Compteur P0** : **1** (bundle ×3.5× au-dessus budget V6 sur 16/16 routes stratégiques).

---

## 2. Sentry overhead vérifié

| Vérification                                | Résultat | Source                                                                 |
| ------------------------------------------- | :------: | ---------------------------------------------------------------------- |
| `tracesSampleRate` ≤ 0.1 prod (server)      |    OK    | `src/sentry.server.config.ts:8` → `0.1` si NODE_ENV=production         |
| `tracesSampleRate` ≤ 0.1 prod (edge)        |    OK    | `src/sentry.edge.config.ts:8` → `0.1` si NODE_ENV=production           |
| `tracesSampleRate` ≤ 0.1 prod (client)      |    OK    | `src/instrumentation-client.ts:9` → `0.1` si prod                      |
| `replaysSessionSampleRate: 0`               |    OK    | `src/instrumentation-client.ts:16`                                     |
| `replaysOnErrorSampleRate: 0`               |    OK    | `src/instrumentation-client.ts:17`                                     |
| Replay integration NON importée dans client |    OK    | `grep replayIntegration src/` → 1 hit (commentaire défense uniquement) |
| Replay code absent du bundle                |    OK    | `grep "@sentry-internal/replay" .next/static/chunks/` → 0 hit          |

**Sentry footprint chiffré dans le bundle client** :

- 1 seul chunk contient du code Sentry : `01_9-61.lm-9l.js` (gz **136.9 KB** total).
- 178 occurrences identifiantes `Sentry|sentry` dans ce chunk (cf. `Get-Content` regex).
- Estimation Sentry seul (browser SDK v10.51 + tracing + react integration, **sans Replay**) : **~130-150 KB gz** dans ce chunk vendor partagé.
- C'est cohérent avec l'observation V1 mémorisée : « Sentry 150 KB gz = 53 % shell » → toujours d'actualité, **non régressé** mais **non corrigé**.

**Compteur P0** : **0** côté config Sentry (toutes garanties tenues).
**Compteur P1** : **1** — Sentry browser SDK pleine version chargée eager sur toutes les routes (incl. `/confirmation` purement statique). Lazy-load conditionnel via `Sentry.lazyLoadIntegration` / dynamic import sous error boundary aurait sauvé ~110 KB gz sur ~80 % des routes. Ticket Sprint 16 PERF.

---

## 3. Caches & CDN check

### Caddyfile (`Caddyfile`)

| Règle                                                                      | Présent | Ligne                    |
| -------------------------------------------------------------------------- | :-----: | ------------------------ |
| `@nextStatic` → `Cache-Control: public, max-age=31536000, immutable`       |   OK    | L65-68                   |
| `@publicAssets` → 1 jour (`max-age=86400`)                                 |   OK    | L71-74                   |
| `encode zstd br 6 gzip 6` (Brotli préféré)                                 |   OK    | L47-52                   |
| `Vary: Accept-Encoding, RSC, Next-Router-State-Tree, Next-Router-Prefetch` |   OK    | L60                      |
| HTTP/3 + HSTS via `auto_https on` + sous-domaines monitoring               |   OK    | L33-39, L101, L113, L124 |
| `health_uri /api/healthz` + interval 30s                                   |   OK    | L85-87                   |

### `next.config.ts`

| Règle                                                       | Présent  | Ligne                                                                                    |
| ----------------------------------------------------------- | :------: | ---------------------------------------------------------------------------------------- |
| Headers sécurité OWASP (HSTS, X-Frame-Options, COOP/CORP)   |    OK    | L32-44                                                                                   |
| CSP production-only (évite hot-reload violations en dev)    |    OK    | L47-49                                                                                   |
| `Vary: RSC, Next-Router-State-Tree, ...`                    |    OK    | L55-60                                                                                   |
| `images.minimumCacheTTL: 31536000` (1 an, anti-pattern fix) |    OK    | L96                                                                                      |
| `serverExternalPackages` verrouille leak server→client      |    OK    | L76-87                                                                                   |
| `productionBrowserSourceMaps: false`                        |    OK    | L69                                                                                      |
| `compress: true` (Next start) — note: redondant avec Caddy  |  TRACÉ   | L67 (commentaire V3)                                                                     |
| **Cache-Control sur `/sitemap*.xml`**                       | **MISS** | aucun header dans `next.config.ts` ; Next sert sitemap.ts sans `Cache-Control` explicite |
| **Cache-Control sur `app/opengraph-image.tsx`**             | **MISS** | runtime edge mais aucun `headers` retourné — défaut Next                                 |
| **Cache-Control sur `/api/healthz`**                        |    OK    | `src/app/api/healthz/route.ts:71` → `no-store, no-cache, must-revalidate`                |

Cache-Control trouvés ailleurs (cohérents) :

- `/llms.txt` + `/llms-full.txt` → `public, max-age=3600, swr=86400`
- `/api/indexnow/key` → `public, max-age=86400`
- `/blog/feed.xml`, `/cas-concrets/feed.xml` → `public, max-age=900, swr=86400`
- `/faq/feed.xml` → `public, max-age=3600, swr=86400`

### DNS / Cloudflare (mémoire AxionIA — non vérifiable depuis filesystem)

D'après mémoire `axionia_domain_hosting.md` : domaine `axion-ia.com` (Namecheap), VPS Hetzner CPX32 IP `178.105.55.15`, Cloudflare Free en amont. **Vérification DNS proxied/DNS-only non faisable depuis ce périmètre lecture-seule** ; à valider sur dashboard Cloudflare avant cutover.

**Compteur P0** : **0** (Caddy + headers principaux OK).
**Compteur P1** : **2**

1. `/sitemap*.xml` : aucun `Cache-Control` court (~1h) côté Next → Cloudflare/Caddy revaliderait à chaque hit. Ajouter `Cache-Control: public, max-age=3600, s-maxage=3600` dans le `Response` de `src/app/sitemap.ts` + sub-sitemaps.
2. `app/opengraph-image.tsx` : pas de header `Cache-Control: public, max-age=86400` → re-générée à chaque hit. Ajouter via `ImageResponse` headers param.

---

## Synthèse compteurs & verdict

| Sévérité | Bundle | Sentry | Cache/CDN | **Total** |
| -------- | -----: | -----: | --------: | --------: |
| **P0**   |      1 |      0 |         0 |     **1** |
| **P1**   |      0 |      1 |         2 |     **3** |

### Verdict : **CONDITIONAL GO**

**Bloqueur P0 unique** : First Load JS gz **265-297 KB** sur 16/16 routes stratégiques vs budget interne **75 KB** (×3.5). Cela ne casse PAS la prod (Google "good" LCP ≤ 2500 ms peut tenir avec Hetzner + CF CDN brotli-9), mais **viole formellement la cible interne V6** définie dans `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` et `AGENTS.md`.

**Conditions du GO** :

1. Acter par ADR que la cible V6 (75 KB) est reportée post-Sprint 16 (lazy Sentry + code-splitting) ; ou
2. Lancer Sprint 16 PERF avant prod cutover : Sentry lazy-load + scinder le chunk `01_9-61.lm-9l.js` (446 KB raw) → vise ramener le shell à ≤ 130 KB gz.
3. Patcher 2 P1 cache (sitemap + opengraph-image) avant cutover (effort < 30 min combiné).

**Si Will accepte le décalage de la cible 75 KB → GO PROD immédiat** (la stack Caddy + CF Free + brotli + immutable assets est saine, Sentry est config-correct, headers OK, healthz fonctionnel pour Caddy).
