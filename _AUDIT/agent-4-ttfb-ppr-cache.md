# Agent 4 — TTFB / Streaming PPR / Caching

**Date** : 2026-05-08
**Périmètre** : chapitres 5 (TTFB) + 10 (Streaming & PPR) + 13 (Caching) du prompt `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`.
**Méthode** : lecture seule. 30 critères × 15 pages stratégiques = 450 cases scorées.
**Stack cible** : Hetzner CX32 + Caddy 2 (à installer) + Cloudflare free (à configurer) + Next 16.2.4 self-hosted.
**Doc Next 16 lue** : `node_modules/next/dist/docs/01-app/02-guides/{self-hosting,ppr-platform-guide,cdn-caching,streaming}.md`.

---

## 1. Score chapitre 5 (TTFB) : **48 / 150**

### Détail critère par critère (moyenne 15 pages × 1 pt)

| #    | Critère                                                                             |       Score | Observation                                                                                                                                                                                                                                                                                                                                                |
| ---- | ----------------------------------------------------------------------------------- | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | Toutes pages SSG, zéro `force-dynamic` non justifié                                 | **15 / 15** | Vérifié : Top 15 pages stratégiques 100 % SSG (cf. `prerender-manifest.json`). `/maintenance` est `force-static` (légitime). Routes `/api/*`, `/llms*.txt` et `/feed.xml` sont des Route Handlers — hors périmètre 15 pages.                                                                                                                               |
| 5.2  | `/api/vitals` < 50 ms Node.js + Zod + persistance async                             |  **3 / 15** | `runtime = "edge"` annoté (incompatible Hetzner). Pas de Zod. Pas de persistance prod (console.warn dev only — payloads jetés).                                                                                                                                                                                                                            |
| 5.3  | 103 Early Hints via Caddy ou Cloudflare                                             |  **0 / 15** | Pas de Caddyfile ni config Cloudflare en place. Ressources critiques (woff2 Manrope, woff2 Fraunces, CSS hero) jamais pré-poussées. Gain LCP −100 à −400 ms perdu.                                                                                                                                                                                         |
| 5.4  | ISR `revalidate` configuré là où pertinent                                          | **15 / 15** | Aucune ISR sur les 15 pages (toutes 100 % SSG) — c'est correct. Les feeds (`feed.xml`, `llms.txt`) ont un `Cache-Control: max-age=900-3600, swr=86400` cohérent côté Route Handler. **Conformité : pas de `revalidate` parasite.**                                                                                                                         |
| 5.5  | `Cache-Control` granulaire HTML / assets                                            |  **0 / 15** | Aucun header cache custom dans `next.config.ts` pour HTML. Next 16 émet par défaut `s-maxage=31536000` sur SSG (cf. doc) — OK théorique mais sans Caddy/CF en aval, aucun edge cache n'en bénéficie. Sur `/_next/static/*`, Next pose `public,max-age=31536000,immutable` automatiquement (vérifié). Mais pas de Caddy → Hetzner sert tout depuis Node.js. |
| 5.6  | Brotli côté Caddy ET Cloudflare, désactiver `compress: true` Next si proxy compress |  **0 / 15** | `compress: true` actif Next. Pas de Caddy. Cloudflare libre activera Brotli auto, mais double compression Next → Caddy → CF possible (gaspillage CPU CX32 ~5-8 %).                                                                                                                                                                                         |
| 5.7  | Pas de redirect chain                                                               | **15 / 15** | `next.config.ts` n'a aucun `async redirects()`. `proxy.ts` (next-intl middleware) gère la négociation locale uniquement (308 vers `/fr` ou `/en` à la racine — _un seul hop_, pas de chain).                                                                                                                                                               |
| 5.8  | Hostname canonical unique                                                           | **15 / 15** | Métadonnées `metadataBase` posées. Cloudflare DNS fixera www → apex via redirect 301 (à vérifier Phase E). Aucun bascule mid-path détecté dans le code.                                                                                                                                                                                                    |
| 5.9  | HTTP/3 (QUIC) activé                                                                |  **0 / 15** | Pas de Caddy, pas de Cloudflare → HTTP/3 inactif. Next start émet HTTP/1.1 nu. Gain handshake ~50-150 ms p75 perdu sur connexions mobiles.                                                                                                                                                                                                                 |
| 5.10 | TTFB ≤ 100 ms p75 field data                                                        |  **5 / 15** | Pas mesurable aujourd'hui (pas de prod, RUM jeté). Heuristique : SSG pur + Cloudflare free POPs Paris/Francfort + Hetzner FSN1/Helsinki = ~30-80 ms p75 atteignable, mais aujourd'hui 0 RUM persisté → score d'observabilité 5/15.                                                                                                                         |

**Sous-total chapitre 5 : 48 / 150**

---

## 2. Score chapitre 10 (Streaming & PPR) : **63 / 150**

| #     | Critère                                                              |       Score | Observation                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1  | PPR `incremental` activé                                             |  **0 / 15** | `experimental.ppr: "incremental"` **commenté** dans `next.config.ts:39`. Différé Sprint 17. STOP & ASK obligatoire avant flip (§8 critère 1 prompt).                                                                                                                                                                                                                                                                            |
| 10.2  | Routes statiques marquées `experimental_ppr = true`                  |  **0 / 15** | Aucune route ne l'export. Cohérent avec 10.1 (PPR globalement off).                                                                                                                                                                                                                                                                                                                                                             |
| 10.3  | Suspense boundaries autour sections dynamiques                       |  **0 / 15** | **Zéro `<Suspense>` dans tout `src/app/`** (vérifié `Grep`). Toutes les pages rendent en un seul shell synchrone. Sans Suspense, PPR ne peut pas streamer (cf. doc Next 16 PPR-platform-guide.md ligne 24-25).                                                                                                                                                                                                                  |
| 10.4  | `loading.tsx` granulaires par route segment lourd                    |  **5 / 15** | **Un seul `loading.tsx`** au niveau `[locale]/` (vérifié). Routes lourdes sans loading dédié : `/reserver` (calendrier client-heavy), `/contact`, `/audit/*`, `/implantations/[region]/[ville]`. Score 5/150 (1 fichier seulement, pas 15).                                                                                                                                                                                     |
| 10.5  | Streaming HTML actif (pas de `force-static` qui désactive streaming) | **15 / 15** | Aucune des 15 pages stratégiques n'a `force-static`. `/maintenance` l'a (légitime). Streaming activable dès qu'on aura Suspense.                                                                                                                                                                                                                                                                                                |
| 10.6  | Server Components par défaut, `"use client"` justifié                | **15 / 15** | Vérifié : 31/105 composants `"use client"` (~70 % Server Components). Toutes les pages `[locale]/*/page.tsx` sont Server. `BookingCalendar` (client) isolé sur `/reserver` uniquement. Justifications en commentaires en tête de chaque fichier client (vu sur `BookingCalendar.tsx:1-15` et `WebVitals.tsx:1-3`).                                                                                                              |
| 10.7  | Réservation espace au-dessus du fold streaming                       |  **8 / 15** | Sur les 15 pages, hero text H1 + paragraphe + éventuellement HeroSchema SVG inline. Layout `min-h-full` posé sur `<body>`. `loading.tsx` pose ~16-18 rem de skeleton mais pas aux dimensions exactes du contenu réel (4 rem H1 vs 8-12 rem cible). Risque CLS lors transition skeleton → page.                                                                                                                                  |
| 10.8  | Aucun `await` long bloquant le shell                                 | **12 / 15** | Pages stratégiques : `await params` + `setRequestLocale` + `getMessages()` next-intl + factories JSON-LD synchrones. Aucune fetch DB/API distante détectée dans les 15 page.tsx. `BookingCalendar` charge fixtures inline (pas d'await réseau). Bon. Léger doute sur `getMessages()` qui charge tout le bundle locale (FR ou EN ~50-80 KB JSON) — chargement filesystem rapide en SSG mais en runtime SSR ce serait à streamer. |
| 10.9  | Shell HTML statique < 100 ms TTFB depuis POP CF                      |  **0 / 15** | Pas mesurable. Pas de prod. Cible atteignable mais nécessite Caddy + CF + Hetzner FSN1.                                                                                                                                                                                                                                                                                                                                         |
| 10.10 | Doc `Design.md` ou ADR mise à jour quand PPR activé                  |  **8 / 15** | ADR 0007 (typo) commit récent. Pas d'ADR PPR (cohérent avec PPR off). Préparation possible : ADR 0009 « PPR incremental + Suspense roll-out » à écrire avant Sprint 17. Score partiel (préparation OK, exécution future).                                                                                                                                                                                                       |

**Sous-total chapitre 10 : 63 / 150**

---

## 3. Score chapitre 13 (Caching & headers) : **31 / 150**

| #     | Critère                                                                                       |       Score | Observation                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------- | ----------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.1  | `Cache-Control` granulaire (HTML s-maxage=600, swr=86400 ; assets immutable max-age=31536000) |  **5 / 15** | Next pose automatiquement `public,max-age=31536000,immutable` sur `/_next/static/*` (vérifié doc self-hosting.md). Sur HTML SSG, Next pose `s-maxage=31536000` par défaut (cf. cdn-caching.md). Mais c'est trop long pour AxionIA qui veut publier des révisions blog/casconcrets quotidien — cible doctrine = `s-maxage=600, swr=86400`. Aucun override custom. Caddy + CF doivent override en aval. |
| 13.2  | ETag / Last-Modified cohérents                                                                |  **5 / 15** | Next start émet ETag pour SSG (cf. doc). Pour Route Handlers (`/api/vitals`, feeds, llms.txt) ETag non garanti. Caddy en aval émettra Last-Modified pour fichiers statiques sur disque automatiquement.                                                                                                                                                                                               |
| 13.3  | Aucun `no-store` non justifié                                                                 | **15 / 15** | Aucun usage de `no-store` détecté dans le code. Bon.                                                                                                                                                                                                                                                                                                                                                  |
| 13.4  | Brotli compression confirmée prod                                                             |  **0 / 15** | `compress: true` Next (gzip uniquement, pas Brotli côté Next start). Sans Caddy ni Cloudflare configuré, **0 % Brotli en prod**. Gain LCP −15 à −25 % bytes wire.                                                                                                                                                                                                                                     |
| 13.5  | `vary: Accept-Encoding` correct                                                               |  **8 / 15** | Next start ajoute `Vary: Accept-Encoding` quand `compress: true`. Mais critique pour Caddy/CF : doit aussi set `Vary` sur RSC (`Vary: rsc, accept-encoding` selon cdn-caching.md ligne 47-57). Aujourd'hui partiellement OK côté Next, à compléter Caddy.                                                                                                                                             |
| 13.6  | Pas de cache-buster `?v=…` random                                                             | **15 / 15** | Vérifié : aucun `?v=`, `?t=`, `?_=` dans les chemins assets. Next utilise hashes immutables sur `/_next/static/*`. Bon.                                                                                                                                                                                                                                                                               |
| 13.7  | Service Worker stale HTML                                                                     | **15 / 15** | Aucun Service Worker enregistré (vérifié — pas de `register('/sw.js')`). N/A donc no-risk.                                                                                                                                                                                                                                                                                                            |
| 13.8  | RSC payload cache (`__next/static/*.rsc`) configuré CDN                                       |  **0 / 15** | Pas de Caddy, pas de Cloudflare config. RSC payloads streamés directement depuis Hetzner Node.js sans cache edge. Cf. cdn-caching.md ligne 35-43 : pour PPR, RSC prefetches sont cacheables si `_rsc` search param dans cache key. À configurer dans CF Cache Rules.                                                                                                                                  |
| 13.9  | ISR `revalidate` documenté par route                                                          |  **0 / 15** | Aucune ISR. Aucune doc ISR. Pas de tableau `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` encore.                                                                                                                                                                                                                                                                                                          |
| 13.10 | Cache-Control field test (curl) intégré CI                                                    |  **0 / 15** | Aucun test CI sur headers cache. À ajouter (script `scripts/check-cache-headers.mjs` ou ajout `lighthouserc.json`).                                                                                                                                                                                                                                                                                   |

**Sous-total chapitre 13 : 31 / 150**

---

## 4. TOTAL périmètre Agent 4 : **142 / 450 (31,5 %)**

Cible 100 % = 450/450. Gap = 308 points soit 68,5 % du périmètre à patcher.

**Sévérité** : 🔴 critique. Le périmètre TTFB/Cache n'est aujourd'hui **adressé que par les défauts Next 16**, ce qui est insuffisant pour un objectif Lighthouse 100 + CrUX p75 vert sur 4 562 SSG. La quasi-totalité du gap se résout par 1 fichier `Caddyfile` + 1 `Dockerfile` + 1 patch `next.config.ts` + 1 patch `/api/vitals` + 1 config Cloudflare dashboard.

---

## 5. Diagnostic per-page (TTFB heuristique + caching)

### Méthode

Pas de mesure runtime (pas de prod). Heuristique basée sur :

- Bundle First Load (cf. baseline §A.2)
- Présence de `"use client"` (TBT initial)
- `await` dans `page.tsx` (latence shell)
- Présence de `loading.tsx` dédié
- Profile cache attendu (HTML SSG `s-maxage=600 swr=86400` cible doctrine)

### Tableau 15 pages stratégiques

| Page                                          | First Load uncomp. | TTFB heuristique post-V5 | Loading dédié | Cache cible                               | Risque streaming                                                        |
| --------------------------------------------- | -----------------: | -----------------------: | :-----------: | ----------------------------------------- | ----------------------------------------------------------------------- |
| `/[locale]` (home)                            |           1 022 KB |                ~60-90 ms |      ❌       | HTML 600s/swr86400                        | 🟠 H1 hero — préload font Manrope critique                              |
| `/[locale]/interventions`                     |             913 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢 hero schema SVG inline OK                                            |
| `/[locale]/interventions/essentielle`         |             899 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/audit`                             |             914 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/audit/flash`                       |             899 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/implementation`                    |             914 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/cas-concrets`                      |             901 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/methodologie`                      |             901 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/comparaisons`                      |             901 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/stack-ia`                          |             901 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/implantations`                     |             887 KB |                ~50-80 ms |      ❌       | HTML 600s/swr86400                        | 🟢                                                                      |
| `/[locale]/implantations/ile-de-france`       |             887 KB |                ~50-80 ms |      ❌       | HTML 1800s/swr86400 (région change moins) | 🟢                                                                      |
| `/[locale]/implantations/ile-de-france/paris` |             899 KB |                ~50-80 ms |      ❌       | HTML 1800s/swr86400                       | 🟢                                                                      |
| `/[locale]/reserver`                          |             941 KB |               ~70-110 ms |     ❌ ⚠️     | HTML 60s/swr3600 (slots fluctuent)        | 🟠 BookingCalendar client-heavy — Suspense + skeleton dédié obligatoire |
| `/[locale]/contact`                           |           1 002 KB |               ~60-100 ms |      ❌       | HTML 600s/swr86400                        | 🟠 Form interactif — Suspense form + skeleton                           |

**Constat** : 14/15 pages convergent vers le même profil cache (`s-maxage=600, swr=86400`). 1 cas spécial `/reserver` (slots fluctuent → cache court). Régions/villes pSEO peuvent prendre TTL plus long (1800s) car contenu stable.

---

## 6. Patches P-300 → P-399

### P-300 — `Caddyfile` complet (à créer racine repo)

**Effort** : M (2 h installation + tests)
**Gain estimé** : LCP −300 à −500 ms p75 (Early Hints + Brotli + HTTP/3 cumulés), TTFB −50 à −150 ms (HTTP/3 0-RTT)
**Risque** : Moyen (config initiale Hetzner, Let's Encrypt rate-limit si bouclé en debug)
**Dépendances** : aucune (Caddy 2 standalone)
**Fichier** : `Caddyfile` (nouveau, racine repo, NON committé tant que Will n'a pas validé)

**Contenu complet** :

```caddy
# Caddyfile — AxionIA prod Hetzner CX32
# Cible : axionia.eu + www.axionia.eu (apex + www)
# Stack : Caddy 2 → Next.js standalone (localhost:3000)
# Doc : https://caddyserver.com/docs/caddyfile

{
	# Caddy global options
	email williamsjullin@gmail.com
	# HTTP/3 (QUIC) explicite — Caddy 2.7+ l'active par défaut, on documente.
	servers {
		protocols h1 h2 h3
	}
	# Logs JSON pour ingestion future Loki/Grafana
	log {
		output file /var/log/caddy/access.log {
			roll_size 50mb
			roll_keep 10
		}
		format json
		level INFO
	}
}

# Redirect www → apex (canonical unique, critère 5.8)
www.axionia.eu {
	redir https://axionia.eu{uri} permanent
}

axionia.eu {
	# Compression : Brotli + zstd + gzip (négociation client)
	encode br zstd gzip

	# Healthcheck (consommé par Coolify / load balancer / monitoring)
	handle /healthz {
		respond "ok" 200
	}

	# Static assets Next 16 — immutable 1 an
	# Path : /_next/static/*  (chunks JS/CSS hashés)
	# Path : /_next/image*    (résultat sharp)
	@nextStatic path /_next/static/*
	header @nextStatic Cache-Control "public, max-age=31536000, immutable"

	@nextImage path /_next/image*
	header @nextImage Cache-Control "public, max-age=31536000, immutable"

	# Fonts woff2 servies par next/font/google self-hosted — immutable
	@fonts path *.woff2 *.woff
	header @fonts Cache-Control "public, max-age=31536000, immutable"

	# OG images (statique opengraph-image.tsx) — 1 jour
	@ogImage path /opengraph-image*
	header @ogImage Cache-Control "public, max-age=86400"

	# HTML SSG — s-maxage 600s + swr 86400s (cible doctrine)
	# Override Next default `s-maxage=31536000` qui est trop long pour
	# un site éditorial avec révisions quotidiennes.
	@html {
		path *
		not path /_next/* /api/* *.woff2 *.woff /opengraph-image*
	}
	header @html Cache-Control "public, max-age=0, s-maxage=600, stale-while-revalidate=86400"

	# RSC payloads — cache court (révisions = bust nécessaire)
	# Cf. cdn-caching.md : RSC variants distinguées par _rsc search param
	@rsc query _rsc=*
	header @rsc Cache-Control "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"

	# 103 Early Hints — pré-pousser font Manrope + CSS hero
	# NB Caddy 2.8+ : directive `early_hints` native.
	# Liste tenue minimale (RFC 8297 : 1 KB max recommandé).
	# IMPORTANT : doit être exposé SEULEMENT pour requêtes HTML (pas RSC).
	@htmlOnly {
		path *
		not path /_next/* /api/* *.woff2 *.woff
		header Accept text/html*
	}
	early_hints @htmlOnly {
		Link "</_next/static/media/manrope-latin-400.woff2>; rel=preload; as=font; type=font/woff2; crossorigin"
		Link "</_next/static/media/fraunces-latin-500.woff2>; rel=preload; as=font; type=font/woff2; crossorigin"
	}
	# NB chemins font woff2 ci-dessus : noms réels à confirmer post-build
	# (Next 16 hash les noms : on lira `.next/static/media/*.woff2` après build).

	# Streaming pass-through — Caddy ne buffer pas par défaut, on documente
	# (cf. self-hosting.md ligne 263-267 : load balancers doivent supporter
	# chunked transfer encoding ou HTTP/2 streaming).
	# Pas de flush_interval explicite : Caddy reverse_proxy stream natif.

	# HSTS preload — ajouté ici en doublon désactivé (déjà sur Next)
	# header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
	# Désactivé : Next.js l'émet déjà via securityHeaders dans next.config.ts.

	# Reverse proxy vers Next.js standalone
	reverse_proxy localhost:3000 {
		# Forward client IP réelle pour next-intl + RUM
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}

		# Pas de buffering (streaming-friendly, cf. doc Next self-hosting)
		# Caddy ne buffer pas par défaut — on documente l'intention.

		# Health check container Next
		health_uri /api/healthz
		health_interval 30s
		health_timeout 5s
	}
}
```

**Notes** :

- Le path exact des fonts Manrope/Fraunces doit être lu **après** un `pnpm build` dans `.next/static/media/*.woff2` (noms hashés). Patch P-300b à venir une fois build prod fait.
- `early_hints` directive Caddy : exige Caddy ≥ 2.8 — vérifier version installée Hetzner.
- Healthcheck `/api/healthz` exige patch P-302 (route Next).

**Validation** :

- `caddy validate Caddyfile`
- `curl -I --http3 https://axionia.eu/` → vérifier `content-encoding: br`, `alt-svc: h3=...`
- WebPageTest : voir 103 Early Hints dans waterfall (resource type `early-hint`).

---

### P-301 — Dockerfile multi-stage standalone

**Effort** : M (1,5 h)
**Gain estimé** : image 200-250 MB (vs ~1,2 GB avec full node_modules), boot < 5 s (vs 25-40 s)
**Risque** : Moyen (premier Docker build prod, deps natives sharp à compiler pour Alpine)
**Dépendances** : P-302 (`output: "standalone"` activé)
**Fichier** : `Dockerfile` (nouveau, racine repo)

**Contenu complet** :

```dockerfile
# Dockerfile — AxionIA Next 16 standalone
# Build : docker build -t axionia:latest .
# Run   : docker run -p 3000:3000 axionia:latest
# Cible : Hetzner CX32 + Coolify

# ──────────── Stage 1 : deps (cache pnpm) ────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat \
	&& corepack enable
COPY package.json pnpm-lock.yaml ./
# Cache pnpm store entre builds
RUN --mount=type=cache,id=pnpm,target=/root/.pnpm-store \
	pnpm install --frozen-lockfile

# ──────────── Stage 2 : builder ────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat \
	&& corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build SSG 4 562 pages (~5-12 min sur CX32)
RUN pnpm build

# ──────────── Stage 3 : runner (production minimal) ────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0

# User non-root (best practice prod)
RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs

# Sharp pour image optim — déjà bundle dans output:"standalone" depuis Next 15
# RUN apk add --no-cache vips-tools  # si sharp pose souci sur Alpine glibc

# Copy standalone build (server.js auto-généré + node_modules minimal)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets (servis par Caddy en prod, mais utiles si on retire Caddy)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (favicon, robots.txt, sitemaps)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Healthcheck (Docker + Coolify natif)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
	CMD wget -qO- http://127.0.0.1:3000/api/healthz || exit 1

CMD ["node", "server.js"]
```

**Notes** :

- `--mount=type=cache` exige Docker BuildKit (`DOCKER_BUILDKIT=1`).
- Sharp installation : Next 16 + `output:"standalone"` package sharp lib auto. Si erreur Alpine glibc/musl : ajouter `apk add --no-cache vips-tools`.
- Healthcheck path = `/api/healthz` (P-302).

**Validation** :

- `docker build -t axionia:latest .` → image < 280 MB visée
- `docker run -p 3000:3000 axionia:latest` → boot < 8 s, healthcheck OK après 30 s
- `docker history axionia:latest` → vérifier aucune layer > 100 MB

---

### P-302 — `next.config.ts` patch (output standalone + headers streaming)

**Effort** : XS (10 min)
**Gain estimé** : préparer P-301 (Docker minimal). Pas d'impact runtime direct.
**Risque** : Faible (option supportée Next 13+)
**Dépendances** : aucune

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const nextConfig: NextConfig = {
   reactStrictMode: true,
   poweredByHeader: false,
-  compress: true,
+  // Compression déléguée à Caddy (encode br zstd gzip) en prod.
+  // Garder true en dev/CI pour parité bande passante locale.
+  compress: process.env.NODE_ENV !== "production",
+  // Standalone build → Docker image minimale (server.js auto + node_modules
+  // tree-shaké). Cf. P-301 Dockerfile multi-stage.
+  output: "standalone",
   images: {
     formats: ["image/avif", "image/webp"],
     remotePatterns: [],
   },
   experimental: {
     // ViewTransition disabled — cf. note ADR.
     // viewTransition: true,
     // PPR (Partial Prerendering) deferred — cf. note ADR.
     // ppr: "incremental",
     optimizePackageImports: [
```

**Validation** :

- `pnpm build` → vérifier `.next/standalone/server.js` créé.
- `pnpm typecheck && pnpm lint` passent.
- Lighthouse local après deploy : pas de régression.

---

### P-303 — `/api/vitals/route.ts` runtime fix + Zod + persistance async

**Effort** : S (45 min)
**Gain estimé** : critère 1.3 + 1.4 + 1.6 + 5.2 (4 critères) passent à vert. RUM sauvé en prod = monitoring opérationnel.
**Risque** : Faible (Route Handler isolé, pas dans le chemin critique)
**Dépendances** : aucune. Optionnellement : Sprint 20 dashboard `/admin/pseo-stats` pour visualiser.

**Fichier** : `src/app/api/vitals/route.ts`

**Diff complet** (réécriture) :

```diff
-// use-client: not needed — this is a Route Handler, not a React Component.
-// Edge runtime so the beacon stays cheap and lands close to the user.
-import { type NextRequest } from "next/server";
-
-export const runtime = "edge";
-
-interface VitalsPayload {
-  id?: string;
-  name?: string;
-  value?: number;
-  rating?: "good" | "needs-improvement" | "poor";
-  navigationType?: string;
-  url?: string;
-  locale?: string;
-}
-
-export async function POST(req: NextRequest) {
-  let body: VitalsPayload | null = null;
-  try {
-    body = (await req.json()) as VitalsPayload;
-  } catch {
-    return new Response(null, { status: 204 });
-  }
-
-  // Sprint 0 stub: log to console.
-  // Sprint 14: forward to Plausible custom events / ClickHouse.
-  if (body && process.env.NODE_ENV !== "production") {
-    console.warn(
-      `[web-vitals] ${body.name ?? "?"}=${body.value ?? "?"} (${body.rating ?? "?"}) on ${body.url ?? "?"}`,
-    );
-  }
-
-  return new Response(null, { status: 204 });
-}
+// Route Handler RUM ingest — Node.js runtime (Hetzner self-hosted, pas Edge).
+// Cible < 50 ms (critère 5.2) : validation Zod légère + persistance fire-and-forget.
+// Persistance V1 : append fichier rotatif `/var/log/axionia/vitals-YYYYMMDD.ndjson`.
+// Persistance V2 (Sprint 20) : insert Postgres `web_vitals` lue par /admin/pseo-stats.
+import { type NextRequest } from "next/server";
+import { z } from "zod";
+import { appendVitalsLog } from "@/lib/observability/vitals-store";
+
+// Pas d'annotation `runtime` → Node.js par défaut. Hetzner-compatible.
+// `dynamic = "force-dynamic"` pour empêcher tout cache (POST déjà non-cache,
+// mais on le rend explicite).
+export const dynamic = "force-dynamic";
+
+// Limite payload (sécurité + perf). 500 bytes suffisent pour tous les vitals.
+const MAX_BODY_BYTES = 500;
+
+const VitalsSchema = z.object({
+  id: z.string().min(1).max(64),
+  name: z.enum(["LCP", "INP", "CLS", "FCP", "TTFB", "FID"]),
+  value: z.number().finite().nonnegative(),
+  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
+  delta: z.number().finite().optional(),
+  navigationType: z.string().max(32).optional(),
+  href: z.string().url().max(512).optional(),
+  // RUM enrichment (cf. critère 1.4)
+  route: z.string().max(128).optional(),
+  locale: z.enum(["fr", "en"]).optional(),
+  effectiveType: z.enum(["slow-2g", "2g", "3g", "4g"]).optional(),
+  deviceMemory: z.number().min(0).max(64).optional(),
+});
+
+export async function POST(req: NextRequest) {
+  // Garde-fou taille payload (DoS protection)
+  const lengthHeader = req.headers.get("content-length");
+  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
+    return new Response(null, { status: 413 });
+  }
+
+  let raw: unknown;
+  try {
+    raw = await req.json();
+  } catch {
+    return new Response(null, { status: 204 });
+  }
+
+  const parsed = VitalsSchema.safeParse(raw);
+  if (!parsed.success) {
+    // Fail-silent : on ne casse pas la collecte si un champ exotique arrive.
+    return new Response(null, { status: 204 });
+  }
+
+  // Fire-and-forget : on ne await pas — le client a déjà reçu la réponse.
+  // L'écriture peut échouer sans impacter la latence beacon.
+  // (Patch lib/observability/vitals-store.ts en P-303b ci-dessous).
+  void appendVitalsLog(parsed.data).catch(() => {
+    // Sentry capture sera ajoutée Sprint 20 si besoin.
+  });
+
+  return new Response(null, { status: 204 });
+}
```

**P-303b — `src/lib/observability/vitals-store.ts` (nouveau)** :

```ts
// Persistance RUM web-vitals — V1 fichier ndjson rotatif quotidien.
// V2 Sprint 20 : remplacer par Prisma `web_vitals` table + dashboard /admin/pseo-stats.
import { promises as fs } from "node:fs";
import path from "node:path";

interface VitalsRecord {
  id: string;
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  navigationType?: string;
  href?: string;
  route?: string;
  locale?: string;
  effectiveType?: string;
  deviceMemory?: number;
}

const LOG_DIR = process.env["AXIONIA_VITALS_LOG_DIR"] ?? "/var/log/axionia";

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function appendVitalsLog(record: VitalsRecord): Promise<void> {
  // Filtre dev — on ne pollue pas le store prod en local.
  if (process.env.NODE_ENV !== "production") return;

  const line = JSON.stringify({ ts: Date.now(), ...record }) + "\n";
  const file = path.join(LOG_DIR, `vitals-${todayStamp()}.ndjson`);

  // Création répertoire idempotente (premier call de la journée)
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch {
    // Permission souvent refusée hors prod — fail-silent
  }
  // Append atomique (O_APPEND posix-safe en mono-process)
  await fs.appendFile(file, line, { encoding: "utf8" });
}
```

**Validation** :

- `pnpm typecheck && pnpm lint` passent.
- `curl -X POST -d '{"id":"x","name":"LCP","value":1234}' http://localhost:3000/api/vitals -H "Content-Type: application/json" -w "%{time_total}\n"` < 50 ms.
- Vérifier création `/var/log/axionia/vitals-YYYYMMDD.ndjson` en prod.

**STOP & ASK** : alternative persistance — voir STOP & ASK #3 ci-dessous.

---

### P-304 — `src/components/analytics/WebVitals.tsx` enrichissement payload

**Effort** : XS (15 min)
**Gain estimé** : critère 1.4 passe à vert (route + locale + connection.effectiveType + deviceMemory).
**Risque** : Faible (élargissement payload, validé par Zod côté serveur)
**Dépendances** : P-303

**Fichier** : `src/components/analytics/WebVitals.tsx`

**Diff** :

```diff
-"use client";
+"use client";
 // use-client: useReportWebVitals is a client-only hook by design — RUM
 // metrics ship from the browser via navigator.sendBeacon.

 import { useReportWebVitals } from "next/web-vitals";
+import { usePathname, useParams } from "next/navigation";

 const VITALS_ENDPOINT = "/api/vitals";

 interface VitalsPayload {
   id: string;
   name: string;
   value: number;
   rating: string;
   delta: number;
   navigationType: string;
   href: string;
+  route: string;
+  locale: string;
+  effectiveType?: string;
+  deviceMemory?: number;
 }

+// Window.navigator type augmentation locale (NetworkInformation API non-standard).
+interface NavigatorConnection {
+  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
+}
+
 export function WebVitals() {
+  const pathname = usePathname();
+  const params = useParams();
+  const locale = (typeof params?.locale === "string" ? params.locale : "fr") as string;
+
   useReportWebVitals((metric) => {
+    const navConnection = (typeof navigator !== "undefined"
+      ? (navigator as Navigator & { connection?: NavigatorConnection }).connection
+      : undefined);
+    const deviceMemory = (typeof navigator !== "undefined"
+      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
+      : undefined);
+
     const payload: VitalsPayload = {
       id: metric.id,
       name: metric.name,
       value: metric.value,
       rating: metric.rating,
       delta: metric.delta,
       navigationType: metric.navigationType,
       href: typeof window !== "undefined" ? window.location.href : "",
+      route: pathname ?? "/",
+      locale,
+      ...(navConnection?.effectiveType ? { effectiveType: navConnection.effectiveType } : {}),
+      ...(typeof deviceMemory === "number" ? { deviceMemory } : {}),
     };
     const body = JSON.stringify(payload);
```

**Validation** :

- DevTools Network → payload `/api/vitals` contient `route`, `locale`, `effectiveType`, `deviceMemory` (sur Chrome qui expose `navigator.connection` + `navigator.deviceMemory`).
- Safari : `effectiveType` absent (pas de leak — clé optionnelle).

---

### P-305 — `src/app/api/healthz/route.ts` (nouveau)

**Effort** : XS (5 min)
**Gain estimé** : healthcheck Caddy + Docker + Coolify opérationnel. Pas de gain perf direct, mais critique infra.
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `src/app/api/healthz/route.ts` (nouveau)

**Contenu complet** :

```ts
// Healthcheck minimal — consommé par :
// - Caddy reverse_proxy health_uri
// - Docker HEALTHCHECK
// - Coolify readiness probe
// Pas d'I/O distant : on confirme uniquement que Node.js process répond.
// Une vraie liveness DB sera ajoutée en /api/healthz/deep Sprint 17 (Prisma ping).
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      build: process.env["NEXT_PUBLIC_BUILD_ID"] ?? "unknown",
      uptime: Math.round(process.uptime()),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}
```

**Validation** :

- `curl http://localhost:3000/api/healthz` → 200 + JSON.
- Caddy `health_uri /api/healthz` → état UP.

---

### P-306 — `loading.tsx` granulaires par route segment lourd

**Effort** : M (1,5 h)
**Gain estimé** : streaming perçu plus rapide sur transitions inter-pages (FCP −100 à −200 ms ressenti). Critère 10.4 passe de 5/15 à 12-15/15.
**Risque** : Faible (skeleton statique, pas de logique)
**Dépendances** : aucune (Suspense pas requis pour `loading.tsx` — Next 16 wrap auto)

**Fichiers à créer** (skeleton dédié par segment lourd) :

1. `src/app/[locale]/reserver/loading.tsx` — skeleton calendrier (grille 7×6)
2. `src/app/[locale]/contact/loading.tsx` — skeleton form 4 fields + CTA
3. `src/app/[locale]/audit/loading.tsx` — skeleton hero + 3 cards intervention
4. `src/app/[locale]/audit/[slug]/loading.tsx` — skeleton détail audit
5. `src/app/[locale]/interventions/loading.tsx` — skeleton hub interventions
6. `src/app/[locale]/interventions/[slug]/loading.tsx` — skeleton détail intervention
7. `src/app/[locale]/implantations/[region]/loading.tsx` — skeleton région
8. `src/app/[locale]/implantations/[region]/[ville]/loading.tsx` — skeleton ville

**Pattern recommandé** (exemple `/reserver/loading.tsx`) :

```tsx
// Skeleton dédié /reserver — dimensions calquées sur BookingCalendar réel
// pour minimiser CLS lors du remplacement (critère 3.5 + 10.7).
export default function ReserverLoading() {
  return (
    <>
      {/* Breadcrumb skeleton */}
      <div className="border-border mx-auto w-full max-w-[1280px] border-b px-4 py-3 sm:px-6 lg:px-8">
        <div className="bg-border h-3 w-40 animate-pulse rounded-xs" aria-hidden="true" />
      </div>
      {/* Hero skeleton — h-[20rem] match hero réel */}
      <section className="bg-halo-warm py-12 sm:py-14 lg:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="bg-border h-4 w-24 animate-pulse rounded-xs" aria-hidden="true" />
          <div className="bg-border mt-4 h-12 w-2/3 animate-pulse rounded-xs" aria-hidden="true" />
          <div className="bg-border mt-4 h-4 w-1/2 animate-pulse rounded-xs" aria-hidden="true" />
        </div>
      </section>
      {/* Calendrier skeleton — h-[600px] match grille 7×6 */}
      <div className="bg-bg py-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <div className="bg-border h-[600px] w-full animate-pulse rounded-md" aria-hidden="true" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </>
  );
}
```

**Validation** :

- DevTools Network → throttle slow 4G → naviguer vers `/reserver` → voir skeleton calendrier (pas le générique).
- Lighthouse `/reserver` : CLS reste < 0,01 (skeleton aux dimensions réelles).

---

### P-307 — Suspense boundaries autour BookingCalendar (préparation PPR)

**Effort** : S (30 min)
**Gain estimé** : prépare PPR critère 10.3. Permet futur `Cache-Control` HTML shell long + dynamic resume calendrier. Sans PPR, gain immédiat = streaming perçu (LCP H1 hero <500 ms même si calendrier prend 1s à hydrater).
**Risque** : Faible (pas d'impact runtime sans PPR activé)
**Dépendances** : aucune. Idéalement bouclé avant P-308 (PPR).

**Fichier** : `src/app/[locale]/reserver/page.tsx`

**Diff** :

```diff
 import type { Metadata } from "next";
+import { Suspense } from "react";
 import { setRequestLocale } from "next-intl/server";
 import { hasLocale } from "next-intl";
 import { notFound } from "next/navigation";
 ...

       {/* Calendrier — page quasi-pleine largeur (override Container max-w-1520) */}
       <div className="bg-bg py-8 sm:py-10">
         <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8 xl:px-10">
-          <BookingCalendar initialBookedSlots={bookedSlots} locale={loc} />
+          <Suspense fallback={<CalendarSkeleton />}>
+            <BookingCalendar initialBookedSlots={bookedSlots} locale={loc} />
+          </Suspense>
         </div>
       </div>
```

Plus extraction de `CalendarSkeleton` dans le même fichier (composant local, ~20 lignes, dimensions exactes).

**Validation** :

- `pnpm build` → pas d'erreur.
- `pnpm test` → vert.
- DevTools : voir skeleton tant que BookingCalendar (client) n'est pas hydraté.

---

### P-308 — PPR `incremental` (STOP & ASK obligatoire)

**Effort** : L (4-6 h ; ADR + audit Suspense exhaustif)
**Gain estimé** : LCP −300 à −800 ms p75 sur pages avec dynamic content (calendrier slots, blog feed, sitemap fragments). Sur 14/15 pages stratégiques 100 % SSG, gain ~0 (PPR n'apporte rien sur du pur statique). Donc gain ciblé sur `/reserver` principalement.
**Risque** : Élevé (cassant : Suspense requis partout où dynamic ; sans Suspense, build échoue avec error « Route uses dynamic without Suspense »).
**Dépendances** : P-307 + Suspense exhaustif partout
**Doc** : `node_modules/next/dist/docs/01-app/02-guides/ppr-platform-guide.md`. Origin-only PPR fonctionne nativement avec `next start` (cf. ligne 49-55).

**STOP & ASK obligatoire** — voir liste ci-dessous.

**Fichier** : `next.config.ts`

**Diff** (à appliquer **après GO Will + ADR 0008 PPR**) :

```diff
   experimental: {
     // ViewTransition disabled — cf. note ADR.
     // viewTransition: true,
-    // PPR (Partial Prerendering) deferred — needs per-route Suspense
-    // boundaries before flipping. Re-evaluate Sprint 17 after server
-    // actions land.
-    // ppr: "incremental",
+    // PPR incremental — opt-in par route via `experimental_ppr = true`.
+    // ADR 0008. Routes opt-in :
+    //   - /reserver (BookingCalendar dynamic)
+    // Toutes les autres routes restent en SSG pur (PPR ignoré sans opt-in).
+    ppr: "incremental",
     optimizePackageImports: [
```

Et dans `src/app/[locale]/reserver/page.tsx` :

```diff
 export async function generateMetadata({ params }: Props): Promise<Metadata> {
+
+// Opt-in PPR — shell statique (hero + breadcrumb) + resume dynamic calendar.
+export const experimental_ppr = true;
+
   const { locale } = await params;
```

**Validation** :

- `pnpm build` → output indique `◐ /reserver` (PPR partial).
- `curl -I https://axionia.eu/fr/reserver` → 200 ms TTFB shell, dynamic content streamé après.
- Visuel : aucune régression (skeleton calendrier visible < 100 ms).

---

### P-309 — Cloudflare cache rules (instructions Will dashboard)

**Effort** : S (30 min côté Will dashboard CF)
**Gain estimé** : LCP −200 à −400 ms p75 (offload Hetzner → POPs CF Paris/Francfort), bandwidth Hetzner −60 à −80 %.
**Risque** : Faible (CF free, revertable depuis dashboard)
**Dépendances** : DNS axionia.eu pointé sur CF nameservers d'abord.

**Fichier** : aucun patch code. Liste actions Will sur Cloudflare dashboard :

#### Étape 1 — DNS (si pas déjà fait)

1. Cloudflare → Add Site → `axionia.eu` → plan **Free**
2. Récupérer 2 nameservers CF
3. OVH/registrar → remplacer NS par ceux de CF
4. Vérifier propagation (24-48 h max, souvent < 1 h)

#### Étape 2 — Cache Rules (Rules → Cache Rules)

| #   | Pattern                                                                | Cache eligibility                                         | Edge TTL | Browser TTL |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ----------- | ------ |
| 1   | `(http.request.uri.path matches "^/_next/static/")`                    | Eligible                                                  | 1 year   | 1 year      |
| 2   | `(http.request.uri.path matches "^/_next/image")`                      | Eligible                                                  | 1 month  | 1 month     |
| 3   | `(http.request.uri.path matches "\.(woff2                              | woff)$")`                                                 | Eligible | 1 year      | 1 year |
| 4   | `(http.request.uri.path matches "^/opengraph-image")`                  | Eligible                                                  | 1 day    | 1 day       |
| 5   | `(http.request.uri.path eq "/" or http.request.uri.path matches "^/(fr | en)/")`AND`(not http.request.uri.query contains "\_rsc")` | Eligible | 10 min      | 10 min |
| 6   | `(http.request.uri.query contains "_rsc")`                             | Eligible                                                  | 5 min    | No store    |

#### Étape 3 — Speed Settings

- **Auto Minify** → Off (Next minifie déjà, double-pass risque)
- **Brotli** → On
- **HTTP/3 (QUIC)** → On
- **0-RTT** → On
- **Early Hints** → On
- **Rocket Loader** → Off (casse hydration React)
- **Mirage** → Off
- **Polish** → Off (déjà géré par Next/sharp)

#### Étape 4 — Network

- **HTTP/2 to Origin** → On
- **WebSockets** → On (si Sprint 17+ besoin)
- **Onion Routing** → Off

#### Étape 5 — Security

- **DNSSEC** → On (domaine OVH compatible)
- **Bot Fight Mode** → On (free tier basic)
- **WAF Managed Rules** → free tier limité — accepter défaut. Pro $20/mois pas justifié V1-V2.
- **Always Use HTTPS** → On

#### Étape 6 — SSL/TLS

- **SSL/TLS encryption mode** → **Full (strict)** (Caddy auto-HTTPS Let's Encrypt valide certifie côté origin)
- **Minimum TLS Version** → 1.2
- **TLS 1.3** → On
- **Automatic HTTPS Rewrites** → On

#### Étape 7 — Speed → Optimization → Web Analytics

- Activer Web Analytics (free, RUM externe complémentaire à `/api/vitals`)
- Coller le snippet dans `<head>` ou utiliser le script automatique (proxy CF inject)

**Validation** :

- `curl -I https://axionia.eu/fr/` → headers `cf-cache-status: HIT` après 2e requête, `cf-ray: ...`, `alt-svc: h3=":443"`
- WebPageTest depuis Paris : voir TTL CF respectés
- PageSpeed Insights : score Lighthouse Lab desktop ≥ 95

---

### P-310 — `Vary` header pour RSC (compatibilité CDN)

**Effort** : XS (5 min)
**Gain estimé** : évite cache miss CF sur RSC payload prefetch (cf. cdn-caching.md ligne 47-57). Critère 13.5 vert.
**Risque** : Faible (header additionnel)
**Dépendances** : P-309

**Fichier** : `next.config.ts`

**Diff** :

```diff
 const securityHeaders = [
   { key: "X-Frame-Options", value: "DENY" },
   { key: "X-Content-Type-Options", value: "nosniff" },
   { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
   {
     key: "Permissions-Policy",
     value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
   },
   { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
   { key: "X-DNS-Prefetch-Control", value: "on" },
+  // Cache variability — Cloudflare/Caddy doivent voir Vary pour distinguer
+  // les variants RSC vs HTML. Cf. node_modules/next/dist/docs/01-app/02-guides/cdn-caching.md
+  { key: "Vary", value: "rsc, next-router-state-tree, next-router-prefetch, accept-encoding" },
 ];
```

**NB** : Caddy/CF utilisent aussi le search param `_rsc` comme cache discriminator (cf. cdn-caching.md ligne 57) — ne pas strip query strings dans CF cache key.

**Validation** :

- `curl -I https://axionia.eu/fr/ -H "rsc: 1"` → header `Vary: rsc, ...`
- `curl -I https://axionia.eu/fr/?_rsc=abc` → cache hit séparé du `/fr/` HTML

---

### P-311 — Cache-Control overrides per route (next.config.ts headers)

**Effort** : S (30 min)
**Gain estimé** : harmonise cache HTML cible 600s/swr86400 même sans Caddy/CF en aval (cas dev/staging Hetzner solo).
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `next.config.ts`

**Diff** :

```diff
   async headers() {
-    return [{ source: "/:path*", headers: securityHeaders }];
+    return [
+      // Headers sécurité globaux
+      { source: "/:path*", headers: securityHeaders },
+      // Cache HTML SSG — override Next default `s-maxage=31536000`
+      // Note : Caddy/CF en aval peuvent override. Ce header sert
+      // de fallback si on retire le proxy.
+      {
+        source: "/((?!api|_next|.*\\..*).*)",
+        headers: [
+          {
+            key: "Cache-Control",
+            value: "public, max-age=0, s-maxage=600, stale-while-revalidate=86400",
+          },
+        ],
+      },
+      // Régions / villes pSEO — cache plus long (contenu stable)
+      {
+        source: "/:locale(fr|en)/implantations/:path*",
+        headers: [
+          {
+            key: "Cache-Control",
+            value: "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400",
+          },
+        ],
+      },
+      // /reserver — cache court (slots fluctuent)
+      {
+        source: "/:locale(fr|en)/reserver",
+        headers: [
+          {
+            key: "Cache-Control",
+            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=3600",
+          },
+        ],
+      },
+    ];
   },
```

**Validation** :

- `curl -I http://localhost:3000/fr/` → `Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400`
- `curl -I http://localhost:3000/fr/implantations/ile-de-france/paris` → `s-maxage=1800`

---

### P-312 — `proxy.ts` — confirmer matcher exclut `_next` + assets

**Effort** : XS (5 min — vérification)
**Gain estimé** : évite TTFB +10-30 ms par request asset si proxy intercepte par erreur.
**Risque** : nul (déjà conforme)
**Dépendances** : aucune

**Fichier** : `src/proxy.ts`

**État actuel** (vérifié) :

```ts
matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"];
```

**Verdict** : conforme. Pas de patch. **Score : 1/1 critère TTFB-overhead**.

---

### P-313 — `X-Accel-Buffering: no` header streaming (vérification doc Next)

**Effort** : XS (5 min)
**Gain estimé** : préventif. Si Caddy buffer accidentellement → streaming cassé. Header force pass-through.
**Risque** : nul
**Dépendances** : aucune
**Doc** : self-hosting.md ligne 240-261 (préconise pour nginx ; Caddy ne buffer pas par défaut mais on documente).

**Fichier** : `next.config.ts`

**Diff** (additionnel à P-311) :

```diff
   async headers() {
     return [
       // Headers sécurité globaux
       { source: "/:path*", headers: securityHeaders },
+      // Streaming pass-through — header utile si reverse proxy nginx/legacy.
+      // Caddy 2 ne buffer pas par défaut, mais on documente l'intention pour
+      // résilience future (changement de proxy, load balancer cloud, etc.).
+      // Cf. node_modules/next/dist/docs/01-app/02-guides/self-hosting.md ligne 240
+      {
+        source: "/:path*",
+        headers: [{ key: "X-Accel-Buffering", value: "no" }],
+      },
       // Cache HTML SSG ...
```

**Validation** :

- `curl -I http://localhost:3000/fr/` → `X-Accel-Buffering: no`

---

### P-314 — Lighthouse CI mobile preset

**Effort** : XS (10 min)
**Gain estimé** : critère 1.8 passe à vert. Couvre slow 4G obligatoire pour CrUX cible.
**Risque** : Faible (allonge CI ~3 min)
**Dépendances** : aucune
**Périmètre** : recoupe Agent 6 (chap. 1) — listé ici car prérequis pour valider TTFB mobile.

**Fichier** : `lighthouserc.json`

**Diff conceptuel** (sans accès au fichier exact) :

```diff
   "ci": {
     "collect": {
-      "settings": { "preset": "desktop" },
+      "settings": [
+        { "preset": "desktop" },
+        { "preset": "mobile", "throttling": { "cpuSlowdownMultiplier": 4, "rttMs": 150, "throughputKbps": 1638.4 } }
+      ],
       "numberOfRuns": 3
     },
```

**STOP & ASK** : confirmer avec Agent 6 (périmètre formel chap. 1.8) qu'on ne double-patche pas.

---

### P-315 — Doc ADR 0008 PPR + ADR 0009 Hetzner stack

**Effort** : S (45 min rédaction)
**Gain estimé** : gouvernance perf. Pré-requis avant flip PPR (critère 10.10).
**Risque** : nul
**Dépendances** : Will valide intention PPR

**Fichiers à créer** :

- `_AUDIT/ADR-0008-PPR-incremental.md`
- `_AUDIT/ADR-0009-hetzner-stack-cx32.md` (peut déjà exister — vérifier)

Pas de diff — rédaction libre suivant template ADR existant.

---

## 7. STOP & ASK ouverts

### STOP & ASK #1 — Activation PPR `incremental`

**Contexte** : `experimental.ppr: "incremental"` est commenté (différé Sprint 17). Le périmètre Agent 4 chapitre 10 critères 10.1-10.3 dépend de son activation. Le gain réel est ciblé : 14/15 pages stratégiques sont 100 % SSG (PPR n'apporte rien) ; seul `/reserver` bénéficie (BookingCalendar dynamic). Cible internationaliste : préparer V1 (Suspense P-307 + skeleton P-306) **sans flip PPR** ; flip PPR Sprint 17 quand le calendrier sera vraiment dynamic (Prisma slots).

**Décision requise** : flip PPR maintenant ou attendre Sprint 17 ?

**Options** :

- **A. Maintenir PPR off (actuel)** — V1 livré sans PPR. Suspense + loading granulaires installés (P-306, P-307) en préparation. Pas de risque cassant build.
- **B. Flip PPR `incremental` + opt-in `/reserver` uniquement** — gain `/reserver` LCP −300 à −600 ms p75. Risque : cassant si une autre route utilise dynamic API (`cookies()`, `headers()`, search params) sans Suspense — build échoue.
- **C. Flip PPR + opt-in agressif (top 5 pages)** — gain plus large mais risque cassant proportionnel.

**Recommandé** : **A pour V1**, basculer B Sprint 17 après audit exhaustif `Grep cookies\|headers\|searchParams` sur tout `src/app/`.

**Impact si on attend** : aucun — gain PPR concentré sur `/reserver` qui reste sur fixtures jusqu'au Sprint 17.

---

### STOP & ASK #2 — Cloudflare configuration (étapes Will dashboard)

**Contexte** : P-309 dépend d'actions Will sur le dashboard Cloudflare (pas patchable depuis le code). Décision ferme `axionia_hosting_hetzner.md` = CF free tier, mais aucune étape n'a encore été exécutée.

**Décision requise** : qui fait quoi quand ?

**Options** :

- **A. Will fait toutes les étapes lui-même (P-309 §1-7)** — autonome. Risque : oubli d'une étape critique (Cache Rules pSEO, Bot Fight Mode).
- **B. Claude scripte avec Cloudflare API + token** — automatisable, mais [BUDGET-FLAG] non, c'est gratuit. Nécessite token API + zone ID en env. Sécurité : Will doit fournir un token CF scopé en lecture/écriture cache rules + DNS, isolé.
- **C. Will exécute en pair-programming session avec Claude qui guide écran par écran** — robuste mais bloque ~30 min.

**Recommandé** : **C** — checklist P-309 ci-dessus + session live le jour où Will pointe DNS.

**Impact si on attend** : 0 gain CDN edge tant que CF inactif. TTFB mondial ~150-300 ms p75 vs ~30-80 ms attendus avec CF.

---

### STOP & ASK #3 — Persistance vitals (Postgres vs fichier vs Sprint 20 dashboard)

**Contexte** : P-303b propose append fichier ndjson `/var/log/axionia/vitals-YYYYMMDD.ndjson`. Sprint 20 prévoit `/admin/pseo-stats` qui pourrait lire ces fichiers ou une table Postgres dédiée.

**Décision requise** : forme de persistance V1 ?

**Options** :

- **A. Fichier ndjson rotatif quotidien** (proposé P-303b) — zéro dépendance, pas de DB I/O dans le chemin critique. Lecture par script offline (cron + agrégation Postgres une fois par jour).
- **B. Insert direct Postgres `web_vitals` table** — query immédiate possible, mais ajoute Prisma au chemin critique RUM = risque latence si DB lente. À mitiger via `setImmediate` + connection pool.
- **C. Sprint 20 dashboard dépend d'une table Postgres** — décision de cohérence : si Sprint 20 lira Postgres, V1 doit y écrire dès maintenant.
- **D. Forwarder vers Plausible Custom Events** — déjà installé, gratuit, mais Plausible n'agrège pas LCP/INP/CLS nativement.

**Recommandé** : **A pour V1**, **B en V2** (Sprint 20 + table Prisma `web_vitals`). Migration scripte un `cat *.ndjson | jq | psql -c "INSERT INTO web_vitals ..."`.

**Impact si on attend** : V1 RUM = lectures manuelles fichier (acceptable pour 1-100 visites/jour début).

---

### STOP & ASK #4 — Caddy vs Nginx

**Contexte** : décision ferme `axionia_hosting_hetzner.md` = Caddy 2 (récap memory). P-300 propose Caddyfile complet. Mais Coolify (dans la stack ferme) installe Nginx Proxy Manager par défaut.

**Décision requise** : confirmer Caddy 2 standalone ou laisser Coolify gérer Nginx ?

**Options** :

- **A. Caddy 2 standalone (P-300)** — auto-HTTPS native, HTTP/3 + Early Hints + Brotli en 1 fichier. Simple, robuste. Coolify peut être bypass pour le proxy front.
- **B. Coolify Nginx Proxy Manager (NPM)** — UI graphique gestion vhosts. Pas de support natif Early Hints. Brotli via module à compiler. Plus complexe.
- **C. Caddy 2 dans container Coolify** — bénéfice Coolify (UI deploy) + Caddy (perf). Nécessite Coolify configuration custom proxy.

**Recommandé** : **A** ou **C**. Will tranche selon préférence Ops.

**Impact si on attend** : Critères 5.3, 5.6, 5.9 restent à 0/15 chacun.

---

### STOP & ASK #5 — `compress: true` Next vs Caddy `encode br`

**Contexte** : P-302 propose `compress: process.env.NODE_ENV !== "production"`. Si Caddy en aval compresse, double-pass Next gzip puis Caddy Brotli = gaspillage CPU CX32 (~5-8 % charge inutile). Mais si Caddy tombe (debug, redémarrage), Next solo doit pouvoir compresser.

**Décision requise** : éteindre `compress: true` en prod ou garder ceinture-bretelles ?

**Options** :

- **A. `compress: false` en prod** — Caddy seul compresse. Économie CPU. Risque : si Caddy off, traffic non compressé.
- **B. `compress: true` toujours** — double compression, mais résilient. Caddy émet Brotli alors que Next aurait gzippé en amont → Caddy détecte gzip et bypass, ou recompress Brotli (selon version). Comportement à tester.
- **C. `compress: true` seulement sur HTML, false sur assets** — pas trivialement implémentable sans patch Next custom.

**Recommandé** : **A** + monitoring (alerte si Caddy down) ou **B** si économie CPU non critique.

**Impact si on attend** : non critique, ~5 % CPU CX32.

---

## 8. Top 5 quick wins du périmètre

Effort XS/S, gain ≥ 100 ms ou critère bloquant.

1. **P-303 + P-304** — Fix `/api/vitals` runtime + Zod + persistance + payload enrichi (S, 1 h cumul). **Débloque chapitre 1 RUM + critère 5.2**. Sans cela, on opère à l'aveugle après deploy.
2. **P-305** — Healthcheck `/api/healthz` (XS, 5 min). **Pré-requis Caddy/Docker/Coolify**. Doit être livré avant Hetzner deploy.
3. **P-302** — `output: "standalone"` + `compress: NODE_ENV !== production` (XS, 10 min). **Pré-requis Dockerfile minimal**. Effort dérisoire.
4. **P-310** — `Vary: rsc, ...` header (XS, 5 min). **Bloque cache CDN correct sur RSC**. Sans, CF servira HTML pour requêtes RSC = navigation cassée.
5. **P-311** — Cache-Control overrides per route (S, 30 min). **Sans Caddy actif, Next default `s-maxage=31536000` est trop long pour HTML éditorial** — révisions blog/casconcrets bloquées 1 an en cache CDN.

---

## 9. Roadmap Hetzner — checklist déploiement

Ordre opérationnel à exécuter pour passer V0 (dev local) → V1 (prod Hetzner CX32).

### Pré-requis code (cet audit)

- [ ] **GO patches V5** — Will valide P-302, P-303, P-303b, P-304, P-305, P-310, P-311, P-312, P-313
- [ ] Commit + tests verts (`pnpm verify:all`)
- [ ] `pnpm build` confirme `.next/standalone/` créé

### Étape 1 — Provisionner Hetzner CX32

- [ ] Hetzner Cloud Console → Create CX32 (4 vCPU x86 / 8 GB / 80 GB NVMe)
- [ ] Datacenter recommandé : **FSN1 (Falkenstein, DE)** — minimise latence CF Paris/Francfort
- [ ] OS : Ubuntu 24.04 LTS
- [ ] SSH key Will uploadée
- [ ] Firewall : SSH 22 + HTTP 80 + HTTPS 443 (ouvrir UDP 443 pour HTTP/3)
- [ ] DNS : note IP publique pour Cloudflare

### Étape 2 — Installer Coolify (option recommandée)

- [ ] `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
- [ ] Login dashboard Coolify
- [ ] Connect GitHub repo Axion-IA (deploy key)
- [ ] Resource type : Docker Compose (pour bundle Caddy + Next + Postgres + Redis)
- [ ] Persistent volume `/var/log/axionia` mounté (P-303b ndjson)

### Étape 3 — Caddy 2 (P-300)

- [ ] Coolify → Add custom Caddy service OU container apart
- [ ] Coller `Caddyfile` (P-300)
- [ ] `caddy validate` OK
- [ ] Lire `.next/static/media/*.woff2` pour ajuster paths Early Hints (P-300 note)

### Étape 4 — Cloudflare (P-309)

- [ ] Add site `axionia.eu` plan Free
- [ ] DNS A record → IP Hetzner CX32 (proxied 🟧 ON)
- [ ] Update nameservers OVH/registrar
- [ ] Cache Rules (P-309 §2 — 6 règles)
- [ ] Speed Settings (P-309 §3)
- [ ] Network (P-309 §4)
- [ ] Security (P-309 §5)
- [ ] SSL/TLS Full (strict) (P-309 §6)
- [ ] Web Analytics activé (P-309 §7)

### Étape 5 — Premier déploiement

- [ ] Coolify → Deploy main branch
- [ ] Build dans CX32 ~5-12 min (4 562 SSG)
- [ ] Healthcheck `/api/healthz` UP
- [ ] Caddy reverse_proxy UP
- [ ] CF DNS propagé → `curl -I https://axionia.eu/`

### Étape 6 — Premier benchmark TTFB

- [ ] WebPageTest `https://axionia.eu/fr/` depuis Paris (Verizon FIOS) → TTFB target < 100 ms p75
- [ ] PageSpeed Insights : Lab desktop ≥ 95
- [ ] CrUX query (vide en V0, baseline T+28j)
- [ ] `curl -I --http3 https://axionia.eu/fr/` → `alt-svc: h3=":443"; ma=86400`
- [ ] `curl -I -H "Accept-Encoding: br" https://axionia.eu/fr/` → `content-encoding: br`
- [ ] Lighthouse CI gate vert sur les 15 pages stratégiques (desktop + mobile)
- [ ] RUM `/api/vitals` reçoit beacons → vérifier `/var/log/axionia/vitals-*.ndjson` non-vide après 24 h

### Étape 7 — Monitoring continu

- [ ] CrUX 28j post-deploy : LCP/INP/CLS p75 dans target
- [ ] Sentry free tier ingère erreurs (déjà OK)
- [ ] CF Analytics : trafic + cache hit ratio > 80 %
- [ ] Cron quotidien : agrégation `/var/log/axionia/vitals-*.ndjson` → `_AUDIT/snapshots/vitals-YYYYMM.csv`

---

## 10. Synthèse périmètre Agent 4

**État actuel** : 142 / 450 (31,5 %)
**Après patches V5 (P-300 → P-313, hors PPR)** : ~390 / 450 (87 %) — gap restant = critères field data (5.10, 13.10) qui exigent prod CrUX.
**Après PPR (P-308) Sprint 17** : ~420 / 450 (93 %)
**Plafond atteignable V2 + 28j CrUX** : ~445 / 450 (99 %)

**Chemin critique** :

1. P-302 + P-305 + P-303 + P-310 + P-311 (XS+S total ~2 h dev)
2. P-301 Dockerfile (M, 1,5 h)
3. P-300 Caddyfile (M, 2 h installation Hetzner)
4. P-309 Cloudflare (S, 30 min Will dashboard)
5. P-306 + P-307 loading + Suspense (M, 2 h)
6. **STOP** — Sprint 17 : P-308 PPR + ADR 0008
7. T+28j : CrUX validation, ajustements TTL si nécessaire

**Risques résiduels identifiés** :

- 🟡 Speculation Rules `eager prefetch` partout (4 562 SSG) — bandwidth Hetzner egress + CF cache fill. Memory `axionia_perf_audit_2026-05-07.md` flag déjà. À monitorer Phase F. Hors périmètre Agent 4.
- 🟡 `getMessages()` next-intl FR ~50-80 KB JSON chargé per-request — cache Caddy `Cache-Control: immutable` sur RSC payload `_next/static/chunks/messages-*.js` à confirmer.
- 🟢 Pas d'ISR donc pas de `revalidate` complexity.

---

## 11. Limites de cet audit

- Pas de Lighthouse run live (cf. baseline §A.5).
- Pas de Chrome trace.
- Pas de mesure RUM réelle (pas de prod).
- Pas de modification source (audit lecture seule).
- Pas de création de Caddyfile/Dockerfile fichier (contenus dans ce markdown uniquement).
- Patches `_AUDIT/ADR-0008` et `_AUDIT/ADR-0009` non rédigés — placeholders seulement.

---

## Annexe A — Fichiers source examinés

| Fichier                                                              | Rôle dans l'audit                             |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `next.config.ts`                                                     | Headers, experimental flags, output, compress |
| `src/proxy.ts`                                                       | Middleware impact TTFB                        |
| `src/app/api/vitals/route.ts`                                        | Runtime annotation Edge → fix Node.js         |
| `src/components/analytics/WebVitals.tsx`                             | Payload RUM enrichissement                    |
| `src/app/[locale]/layout.tsx`                                        | Speculation Rules + JSON-LD + fonts           |
| `src/app/[locale]/loading.tsx`                                       | Loading global unique                         |
| `src/app/[locale]/reserver/page.tsx`                                 | Cas critique Suspense + skeleton              |
| `src/components/calendar/BookingCalendar.tsx`                        | Client component lourd `/reserver`            |
| `lighthouserc.json`                                                  | Baseline thresholds (mobile preset à ajouter) |
| `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`       | Doctrine streaming + caching Next 16          |
| `node_modules/next/dist/docs/01-app/02-guides/ppr-platform-guide.md` | Origin-only PPR confirmé `next start`         |
| `node_modules/next/dist/docs/01-app/02-guides/cdn-caching.md`        | Vary, RSC, \_rsc cache key                    |
| `_AUDIT/AUDIT-WEB-VITALS-2026-BASELINE-A.md`                         | Inputs Phase A                                |
| `_AUDIT/PROMPT-WEB-VITALS-PERFECTION-2026.md`                        | Périmètre + critères                          |

---

**Fin Agent 4.**
**Aucun fichier source modifié. Aucun patch appliqué. STOP & ASK x5 ouverts.**
