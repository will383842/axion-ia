# PROMPT — WEB VITALS PERFECTION 2026

> **À utiliser dans une nouvelle conversation Claude Code, fenêtre fraîche.**
> Lancer depuis le repo `Axion-IA/axionia/`.

---

## 0. Contexte (à lire avant tout)

Tu es invoqué sur le projet **Axion-IA** — cabinet IA opérationnel B2B premium, OÜ estonienne. Le repo est à `Axion-IA/axionia/` (Next.js 16, App Router, Turbopack, next-intl FR/EN, ~4 342 HTML SSG après pSEO villes/régions Sprint 14.9).

**État frontend au lancement de cet audit** :

- Sprints 0-14 + sous-sprints 14.x livrés (typo v3.2, hero-schema v3.3 carré, parity 92 %, pSEO INSEE 13 régions + 2 157 villes).
- 4 342 HTML pré-générés au build (FR+EN).
- Lighthouse CI strict déjà câblé (`lighthouserc.json`) : perf ≥ 95, LCP < 2,5 s, INP < 200 ms, CLS < 0,1, TBT < 200 ms.
- RUM web-vitals ship via `sendBeacon` → `/api/vitals` (`src/components/analytics/WebVitals.tsx`).
- Speculation Rules en prod (`prerender moderate` + `prefetch eager`) — désactivées en dev.
- 31/105 composants sont `"use client"` (~70 % Server Components).
- `optimizePackageImports` activé sur lucide-react + 14 paquets Radix.
- AVIF + WebP côté `next/image`.
- Headers de sécurité minimaux (CSP nonce dynamique différé Sprint 16).
- **Désactivé / différé volontairement** dans `next.config.ts` :
  - `experimental.viewTransition` (commenté)
  - `experimental.ppr: "incremental"` (commenté — différé Sprint 17)
  - `reactCompiler: true` (commenté — différé Sprint 17)

**Ce qui est resté hors-périmètre jusqu'ici** :

- PPR (Partial Prerendering)
- React Compiler 19
- View Transitions API
- CSP nonce dynamique
- Caddy 2 reverse proxy (config Early Hints + HTTP/3 + Brotli) — non installé / pas de `Caddyfile`
- Cloudflare free tier en front (CDN + 103 Early Hints + cache rules) — non configuré
- 103 Early Hints (via Caddy ou Cloudflare free tier)
- `<link rel="preload" as="image" fetchpriority="high">` sur LCP heroes
- `size-adjust` font-fallback declarations (pour CLS = 0 garanti pendant `display: swap`)
- LQIP / blur placeholders sur illustrations
- Audit bundle per-route (chunk splitting réel observé)
- CrUX field data baseline + objectifs p75
- Edge runtime pour `/api/vitals` (ingest RUM)

**Doctrine projet à respecter (intouchable)** :

- Direction visuelle figée HEAD : titleEm serif italique (Fraunces) + Header terracotta + hero-schema carré 576×576 lg+ (cf. mémoire `axionia_design_pivot.md`, `axionia_hero_schema_v3_2.md`).
- Naming : « cabinet IA opérationnel » FR / « operational AI consultancy » EN. Jamais agence/studio/atelier.
- Repo/dossier = **Axion-IA** (tiret) ; marque customer-facing dans `src/` = **Axion-IA** (sans tiret).
- Anti-doorway HCU sur les villes non-pilotes (copy-gated indexation) — ne pas casser.

**Lecture obligatoire avant patch** :

- `CLAUDE.md` → renvoie à `AGENTS.md` qui dit explicitement : _« This is NOT the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. »_ → tu **lis** la doc Next 16 locale avant tout patch sur le router/PPR/Compiler.
- `next.config.ts` (état actuel + commentaires explicatifs des features différées).
- `Design.md` (doctrine v3 Editorial Premium Light).
- ADR récents : 0002 (pivot v3), 0004 (typo baseline), 0007 (typo v3.2 hero cap 88px).
- `lighthouserc.json` (seuils existants — à ne PAS abaisser).

---

## 0bis. Hébergement Hetzner — Architecture & Budget zéro coût additionnel

### Contexte hébergement (intouchable — décidé ADR 0001)

Axion-IA est déployé sur **Hetzner Cloud** (UE — souveraineté OÜ estonienne). **PAS de Vercel.** **PAS de Netlify.** Toutes les features perf doivent fonctionner sur :

- **Hetzner Cloud VPS CX32** (4 vCPU x86 / 8 GB RAM / 80 GB NVMe / 20 TB traffic — €6,49/mois HT, décision ferme Will 2026-05-08). CX22 (2 vCPU / 4 GB) écarté car insuffisant pour build SSG 4 342 pages + 3 containers (Next/Postgres/Redis) + Coolify.
- **Node.js 22+ runtime** (`next start` ou Docker `output: "standalone"`)
- **Reverse proxy à choisir** : **Caddy 2** (recommandé — auto-HTTPS, HTTP/3, Early Hints, Brotli natif, config simple) OU Nginx 1.25+
- **CDN front recommandé** : **Cloudflare free tier** (DNS + CDN illimité + Brotli + HTTP/3 + 103 Early Hints + WAF + cache rules — tout gratuit, illimité)
- **Image optimization** : `sharp` côté Node.js (intégré à `next/image` en self-hosted, gratuit, CPU-bound mais OK pour SSG)
- **Build artifact** : `output: "standalone"` (à activer si pas déjà fait — réduit l'image Docker)

### Implications par rapport à un déploiement Vercel

| Feature                      | Vercel                     | Hetzner + Cloudflare                                      | Coût Hetzner   |
| ---------------------------- | -------------------------- | --------------------------------------------------------- | -------------- |
| Edge Runtime                 | Vercel Edge global         | **N/A — utiliser Node.js runtime classique**              | €0             |
| 103 Early Hints              | Pro $20/mois               | **Caddy natif OU Cloudflare gratuit**                     | €0             |
| Image optimization           | 1000 transforms/mois Hobby | **Sharp Node.js illimité**                                | €0 (CPU local) |
| CDN                          | Inclus auto                | **Cloudflare free** (illimité, 200+ POPs)                 | €0             |
| Bandwidth                    | 100 GB Hobby               | **Hetzner 20 TB inclus** + Cloudflare offload             | €0             |
| Build minutes                | 6000 min Hobby             | **Illimité** (build localement ou CI GitHub gratuit)      | €0             |
| Brotli compression           | Auto                       | **Caddy natif OU Cloudflare auto**                        | €0             |
| HTTP/3 (QUIC)                | Auto                       | **Caddy natif OU Cloudflare auto**                        | €0             |
| `Cache-Control` immutable    | Auto                       | **Configuré dans Caddy/Cloudflare**                       | €0             |
| ISR / on-demand revalidation | Géré                       | **`next start` + Redis pour cache distribué (optionnel)** | €0             |
| Sticky sessions              | Auto                       | **Pas nécessaire (SSG stateless)**                        | €0             |

### Stack recommandé (zéro coût récurrent additionnel)

```
┌─────────────────────────────────────────────────┐
│  Cloudflare (free tier)                          │
│  • DNS + CDN 200+ POPs                           │
│  • Brotli + HTTP/3 + 103 Early Hints             │
│  • Cache Rules + WAF + Bot fight                 │
│  • Auto SSL                                      │
└────────────────┬────────────────────────────────┘
                 │ (origin pull)
┌────────────────▼────────────────────────────────┐
│  Hetzner Cloud CX32 (€6,49/mois HT — décidé)    │
│  4 vCPU x86 / 8 GB RAM / 80 GB NVMe / 20 TB     │
│  ┌───────────────────────────────────────────┐  │
│  │  Caddy 2 (reverse proxy, auto-HTTPS,      │  │
│  │  HTTP/3, Early Hints, Brotli)             │  │
│  └───────────────┬───────────────────────────┘  │
│                  │                               │
│  ┌───────────────▼───────────────────────────┐  │
│  │  Next.js 16 standalone (Node.js 22)        │  │
│  │  • SSG : 4 342 HTML pré-rendus             │  │
│  │  • next start                              │  │
│  │  • sharp (image optim local)               │  │
│  │  • /api/vitals (Node.js, pas Edge)         │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Outils & services autorisés (tous gratuits, tous Hetzner-compatibles)

| Outil                                | Coût                 | Usage                                         | Contrainte Hetzner             |
| ------------------------------------ | -------------------- | --------------------------------------------- | ------------------------------ |
| Lighthouse CI                        | OSS                  | Audit + gate CI                               | OK partout                     |
| `useReportWebVitals` (Next)          | Built-in             | RUM ingestion                                 | OK                             |
| `/api/vitals` route                  | Self-hosted Node.js  | Endpoint RUM                                  | **Runtime Node.js (pas Edge)** |
| `next/bundle-analyzer`               | OSS                  | Bundle audit                                  | OK                             |
| PageSpeed Insights API               | Google free          | Field data                                    | OK                             |
| CrUX query                           | Google free          | Field data 28j                                | OK                             |
| Chrome DevTools                      | Free                 | Trace profiling                               | OK                             |
| WebPageTest free tier                | Free (100 runs/mois) | Profile externe                               | OK                             |
| Microsoft Clarity                    | Free unlimited       | UX heatmaps                                   | OK                             |
| React Compiler 19                    | OSS                  | Auto-memoization                              | OK                             |
| PPR (Partial Prerendering)           | Next built-in        | Streaming hybrid                              | OK self-hosted Next 16         |
| View Transitions API                 | Browser-native       | Transitions routes                            | OK                             |
| `next/font/google` self-hosted       | Built-in             | Fonts                                         | OK                             |
| AVIF/WebP via `next/image` + `sharp` | OSS                  | Images                                        | **Sharp en deps (CPU local)**  |
| Speculation Rules                    | Browser-native       | Prefetch/prerender                            | OK                             |
| Service Worker (Workbox)             | OSS                  | Offline cache                                 | OK                             |
| Caddy 2                              | OSS                  | Reverse proxy + Early Hints + HTTP/3 + Brotli | À installer côté serveur       |
| Cloudflare free tier                 | Free                 | CDN + Early Hints + WAF                       | À configurer                   |

### Outils interdits sans validation explicite Will

| Outil                               | Pourquoi flagué                                                       |
| ----------------------------------- | --------------------------------------------------------------------- |
| Sentry Pro / Team                   | $26-80/mois — préférer dashboard custom `/admin/pseo-stats` Sprint 20 |
| Datadog / New Relic / Akamai mPulse | $50-500/mois — overkill pour RUM jeune trafic                         |
| Cloudflare Pro/Business             | $20-200/mois — Free tier suffit largement pour V1-V2                  |
| LogRocket / FullStory               | Free tier limité ; payant rapidement                                  |
| BrowserStack / Sauce Labs           | Payant ; tester en local + WebPageTest free tier                      |
| Vercel / Netlify / Cloudflare Pages | **Hors-périmètre — décision Hetzner ferme ADR 0001**                  |

### Patches Hetzner-spécifiques attendus dans cet audit

L'audit DOIT proposer (en plus des patches code Next.js) :

1. **Configuration Caddy 2** (`Caddyfile`) avec :
   - Auto-HTTPS Let's Encrypt
   - HTTP/3 (QUIC) activé
   - Brotli compression
   - 103 Early Hints (`early_hints` directive)
   - Headers de cache (`Cache-Control: immutable, max-age=31536000` pour `/_next/static/*`)
   - Headers de sécurité (HSTS preload, X-Frame, etc. — si pas déjà au niveau Next)

2. **Configuration Cloudflare** (si Will valide ajout) :
   - Cache Rules par pattern (`/_next/static/*` immutable, HTML `s-maxage=600 swr=86400`)
   - Auto Minify OFF (déjà minifié par Next)
   - Brotli ON
   - HTTP/3 ON
   - Early Hints ON
   - DNSSEC ON
   - Bot fight mode

3. **`next.config.ts`** : activer `output: "standalone"` pour build Docker plus léger.

4. **`Dockerfile`** multi-stage minimal (node:22-alpine → 200 MB image, démarrage < 5 s).

5. **Healthcheck** + readiness probe (Caddy + container).

### Si un patch nécessite un outil payant

L'agent **DOIT** :

1. Marquer le patch `[BUDGET-FLAG]`.
2. Lister une **alternative gratuite Hetzner-compatible** systématiquement.
3. Mettre le patch dans la dernière vague de la roadmap (V6 « optionnel premium »).
4. Déclencher un STOP & ASK avant exécution.

### Hetzner — décision ferme (Will 2026-05-08)

- **VPS Hetzner CX32** : 4 vCPU x86 / 8 GB RAM / 80 GB NVMe SSD / 20 TB traffic / €6,49/mois HT. Décidé pour absorber build SSG 4 342 pages + 3 containers (Next + Postgres + Redis) + Coolify sans swap.
- **Cloudflare free tier en front** : décidé. Inclut DNS + CDN illimité + 103 Early Hints + Brotli + HTTP/3 + WAF basic + DDoS illimité + Web Analytics. Suffisant pour V1-V2 (< 50 K visites/mois).
- **Aucun upgrade payant** envisagé en V1-V2. Cloudflare Pro ($20/mois) à reconsidérer Sprint 16 uniquement pour WAF Managed Rules. Argo Smart Routing ($5/mois + $0,10/GB) à reconsidérer si trafic international > 30 % en V2.

**Default ferme** : Hetzner CX32 + Coolify + Caddy 2 + Next 16 standalone + Postgres + Redis containerisés + Cloudflare free. Toute alternative déclenche STOP & ASK.

---

## 1. Mission

**Audit + plan de patches 100 % prescriptif** pour atteindre, sur Axion-IA :

1. **Lighthouse Lab** : Performance 100, Best Practices 100, A11y 100, SEO 100 sur **les 15 pages stratégiques** (Top 80/20 — listées §3) — desktop et mobile.
2. **Core Web Vitals field data (CrUX)** : p75 vert sur **toutes les URLs indexables** :
   - LCP ≤ 2 500 ms (cible interne ≤ 1 800 ms)
   - INP ≤ 200 ms (cible interne ≤ 100 ms)
   - CLS ≤ 0,1 (cible interne 0)
3. **Future-proof 2026+** : adopter les nouveaux web vitals quand ils émergent (Long Animation Frames API, Soft Navigation Web Vitals, INP per-interaction breakdowns), preload responsive, prerender Speculation Rules avancées.
4. **Zéro régression** sur le score actuel SEO/AEO/GEO + zéro régression visuelle (doctrine v3 figée).
5. **Budget perf documenté** par route, applicable en CI (Lighthouse + bundle-analyzer thresholds).

**Cible chiffrée à valider à la fin** :

> _« Sur les 15 pages stratégiques, en environnement Hetzner CX32 + Caddy + Cloudflare prod simulé (Lighthouse `--preset=desktop` ET `mobile slow 4G`), nous obtenons 100/100/100/100 en moyenne sur 5 runs ; en field data CrUX p75 sur 28 jours, nous sommes vert sur LCP/INP/CLS pour 95 %+ des origines. »_

---

## 2. Méthode (ordonnancement strict)

### Phase A — MESURE (lecture seule, aucun patch)

1. **Build prod local** (`pnpm build`) → relever : taille bundle initial, taille per-route, nombre de chunks, Server Components vs Client Components, paquets en double, paquets non tree-shakés.
2. **Lighthouse local** sur les 15 pages (desktop + mobile, 3 runs chaque, médiane retenue).
3. **CrUX query** (si origine indexée) ou **PageSpeed Insights API** (origin level + page level) sur les 5 pages racines de chaque locale (FR + EN).
4. **WebPageTest-style profile** (à défaut, Chrome DevTools Performance traces) sur 3 pages : home, `/interventions`, `/implantations/ile-de-france/paris` (ville pilote).
5. **`useReportWebVitals` log inspection** : examiner les payloads `/api/vitals` actuels (en dev les chiffres sont catastrophiques cf. `.next/dev/logs/next-development.log` — c'est attendu, ne pas patcher dev).

### Phase B — DIAGNOSTIC (analyse, scoring per-criterion, aucun patch)

Score chaque critère (§4) par page sur **0 / 0,5 / 1**. Total `/1500` (15 chapitres × 10 critères × 10 pages noyau).

### Phase C — PLAN DE PATCHES (chiffré, priorisé, aucun patch)

Chaque manquement → 1 patch décrit avec :

- Fichier(s) exact(s) + lignes
- Diff complet (`old_string` / `new_string`)
- Effort : XS (<15 min) / S (<1 h) / M (<3 h) / L (<1 j) / XL (multi-jour)
- Gain mesurable estimé (ex. « LCP −400 ms p75 », « INP −80 ms », « bundle −12 KB »)
- Risque (Faible / Moyen / Élevé) + plan de rollback
- Dépendances (autres patches à appliquer avant)

### Phase D — STOP & ASK

À la fin de Phase C, **tu n'appliques rien**. Tu produis :

- `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md` (vue d'ensemble + score /1500)
- `_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md` (per-page, per-criterion)
- `_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md` (toutes les diffs prêtes à coller)
- `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md` (séquencement par effort × gain × risque)
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md` (budgets perf par route, format CI)

Puis tu attends une instruction explicite **« GO PATCHES P1 »** / **« GO PATCHES P2 »** / etc. avant d'appliquer. Aucun patch sans GO.

### Phase E — APPLICATION (par vagues, après chaque GO)

Une vague = un thème homogène (ex. « V1 — Préload LCP + fetchpriority », « V2 — Font fallback size-adjust », « V3 — PPR + Suspense boundaries », « V4 — React Compiler »).

Après chaque vague :

- `pnpm typecheck && pnpm lint && pnpm build` doivent passer.
- `pnpm test` (vitest) doit passer.
- Lighthouse local relancé sur les pages impactées → comparatif before/after dans le commit message.
- Commit atomique par vague, message conventional-commits FR + table de gains.

### Phase F — VALIDATION FINALE

- Lighthouse CI vert sur les 15 pages, desktop ET mobile.
- Bundle-analyzer rapport posé dans `_AUDIT/`.
- Roadmap field-data : checklist de monitoring CrUX 28 j post-déploiement.

---

## 3. Périmètre — 15 pages stratégiques (Top 80/20)

À auditer **et** patcher en priorité :

1. `/[locale]` (home) — Hero LCP critique
2. `/[locale]/interventions`
3. `/[locale]/interventions/essentielle`
4. `/[locale]/audit`
5. `/[locale]/audit/flash`
6. `/[locale]/implementation`
7. `/[locale]/cas-concrets`
8. `/[locale]/methodologie`
9. `/[locale]/comparaisons`
10. `/[locale]/stack-ia`
11. `/[locale]/implantations` (hub villes/régions)
12. `/[locale]/implantations/ile-de-france` (region pilote)
13. `/[locale]/implantations/ile-de-france/paris` (ville pilote — gold standard)
14. `/[locale]/reserver` (calendrier client-heavy → INP critique)
15. `/[locale]/contact`

Chaque page testée en FR **et** EN (2 × 15 = 30 tests Lighthouse min).

**Échantillonnage villes/régions non pilotes** : 3 villes random (≥ 5 000 hab) + 2 régions random pour vérifier qu'on ne dégrade pas le SSG bulk.

---

## 4. Grille de critères — 15 chapitres × 10 critères = 150 points

> Chaque critère est **observable** et **patchable**. Score 0 / 0,5 / 1 par page.

### Chapitre 1 — Mesure baseline & instrumentation

1.1 Lighthouse CI thresholds présents et stricts (perf ≥ 95, LCP, INP, CLS, TBT).
1.2 `useReportWebVitals` actif et tous les vitals (LCP/INP/CLS/FCP/TTFB) reportés.
1.3 Endpoint `/api/vitals` répond en < 50 ms en Node.js runtime self-hosted (validation Zod légère + persistance asynchrone fire-and-forget ; éviter toute I/O DB synchrone).
1.4 RUM payload contient `route`, `locale`, `connection.effectiveType`, `deviceMemory`.
1.5 Logs dev exclus du dashboard prod (filtrage par `NODE_ENV`).
1.6 Dashboard RUM custom configuré pour alerter si p75 LCP > 2 500 ms (cible : `/admin/pseo-stats` Sprint 20 — gratuit, self-hosted ; à défaut, Sentry free tier 5K errors/mois OU log query directe sur les payloads `/api/vitals`).
1.7 CrUX query mensuelle automatisée (script Node + Search Console API).
1.8 Lighthouse CI lance desktop **et** mobile (slow 4G simulé).
1.9 Bundle-analyzer report archivé après chaque release dans `_AUDIT/`.
1.10 INP per-interaction breakdown (Long Animation Frames API) capturé.

### Chapitre 2 — LCP (Largest Contentful Paint)

2.1 Élément LCP identifié pour chaque page (HeroSchema SVG / texte H1 / image).
2.2 Si image LCP : `priority` + `fetchPriority="high"` + `<link rel="preload" as="image" imagesrcset>`.
2.3 Si SVG inline LCP : pas de `dynamic()` lazy, render synchrone.
2.4 Hero text LCP : pas de `font-display: optional` ; `swap` + fallback metrics-matched.
2.5 Pas de `loading="lazy"` sur les images au-dessus du fold.
2.6 Aucune balise `<script>` bloquante avant le LCP.
2.7 CSS critique inliné par Next 16 (vérifier que critical-css plugin n'est pas désactivé).
2.8 Aucun CLS chassé pendant la résolution LCP (réservation espace via `aspect-ratio`).
2.9 LCP ≤ 1 800 ms p75 en field data (cible interne).
2.10 Comparatif LCP avant/après chaque vague de patches documenté.

### Chapitre 3 — CLS (Cumulative Layout Shift)

3.1 Toutes les images ont `width` + `height` ou `aspect-ratio` CSS.
3.2 Toutes les iframes (Calendly etc.) ont `aspect-ratio` réservé.
3.3 Fonts custom : `size-adjust` declaration sur fallback (Manrope Fallback / Fraunces Fallback / Inconsolata Fallback).
3.4 Aucun web font swap ne shifte > 0,001 (mesure Chrome DevTools Layout Shift).
3.5 Skeleton `loading.tsx` aux dimensions réelles du contenu remplacé.
3.6 Pas d'injection client-side de bannière/cookie au-dessus du contenu sans réservation.
3.7 Toutes les ads / consent banners (à venir) ont placeholder réservé.
3.8 `next/image` `sizes` correct (jamais d'image rendue plus grande que demandée).
3.9 CLS = 0 sur les pages statiques (cible interne).
3.10 CLS p75 field data ≤ 0,05 sur toutes les pages (Google seuil 0,1).

### Chapitre 4 — INP (Interaction to Next Paint)

4.1 React Compiler 19 activé (`experimental.reactCompiler: true` + dépendance) → memoization auto.
4.2 Composants client critiques (BookingCalendar, MegaMenu, ⌘K si présent) auditent INP réel.
4.3 Aucun handler `onClick`/`onChange` ne fait > 50 ms de JS sync.
4.4 Listes longues (villes, FAQ, blog) virtualisées si > 100 items rendus.
4.5 `useDeferredValue` / `useTransition` sur les filtres/recherche.
4.6 Debounce 200-300 ms sur les inputs avec computation.
4.7 Pas de re-render inutile sur scroll (vérifier avec React DevTools Profiler).
4.8 Pas de layout thrashing dans les hover (transition CSS only, pas de JS DOM read/write mix).
4.9 Long Animation Frames < 50 ms sur les 3 interactions critiques par page.
4.10 INP p75 ≤ 100 ms field data (cible interne ; Google seuil 200 ms).

### Chapitre 5 — TTFB (Time to First Byte)

5.1 Toutes les pages SSG (zéro `force-dynamic` non justifié) — vérifier avec `next build` output.
5.2 ~~Edge Runtime sur `/api/vitals`~~ — **N/A Hetzner**. Garder Node.js runtime ; viser réponse < 50 ms via traitement minimal (validation Zod + persistance asynchrone via fire-and-forget).
5.3 103 Early Hints activés via **Caddy 2** (`early_hints` directive native) OU **Cloudflare free tier** (toggle dans dashboard) — gratuit, gain LCP −100 à −400 ms p75. Configurer la liste des ressources critiques (CSS hero + font woff2 + LCP image) à pré-pousser.
5.4 ISR `revalidate` configuré là où pertinent (pas sur les pages purement statiques).
5.5 CDN cache `Cache-Control: public, max-age=…, s-maxage=…, stale-while-revalidate=…` cohérent par route.
5.6 Compression Brotli activée **côté Caddy** (`encode br zstd gzip`) ET côté **Cloudflare** (auto). Désactiver `compress: true` Next si Caddy compress en amont (éviter double compression).
5.7 Pas de redirect chain (vérifier `next.config.ts` redirects + middleware si ajouté).
5.8 Hostname unique (canonical) — pas de bascule www/non-www mid-path.
5.9 HTTP/3 (QUIC) activé — **Caddy 2 le supporte nativement** (`servers { protocols h1 h2 h3 }`). **Cloudflare** l'active aussi automatiquement en frontend. Vérifier en prod via `curl --http3` ou WebPageTest.
5.10 TTFB p75 ≤ 100 ms p75 field data (cible interne ; Google « good » 800 ms).

### Chapitre 6 — Bundle JavaScript

6.1 Bundle initial route home ≤ 90 KB gzip (cible interne ≤ 70 KB).
6.2 Aucun paquet > 30 KB gzip importé sans `dynamic()` côté client.
6.3 `lucide-react` tree-shaké (vérifier via bundle-analyzer qu'aucune entrée massive ne reste).
6.4 Radix UI : seuls les sub-paquets utilisés présents.
6.5 Pas de `moment.js` / `lodash` (full) — uniquement modules ciblés.
6.6 `next-intl` messages chunked par locale (vérifier qu'EN ne charge pas FR).
6.7 Code-splitting effectif sur BookingCalendar (chargé uniquement sur `/reserver`).
6.8 Aucune polyfill inutile (Next 16 cible navigateurs modernes).
6.9 Source maps désactivés en prod (`productionBrowserSourceMaps: false`).
6.10 Bundle delta < +5 KB par PR (gate CI à ajouter).

### Chapitre 7 — Images

7.1 Toutes les images servies en AVIF + WebP fallback (déjà OK config).
7.2 `sizes` attribute correct sur 100 % des `<Image>` (pas de chargement 4K pour vignette).
7.3 LQIP / blur placeholder sur images > 50 KB (ou `placeholder="blur"`).
7.4 Toutes les images au-dessus du fold sont `priority` ; toutes les autres lazy.
7.5 SVG inline pour les icônes (lucide-react) plutôt qu'`<img>`.
7.6 OG image (`opengraph-image.tsx`) ≤ 200 KB et 1200×630 exact.
7.7 Favicon multi-tailles + `icon.tsx` Next 16 dynamic (déjà OK).
7.8 Aucune image décorative sans `aria-hidden` ou `alt=""`.
7.9 Build vérifie qu'aucune image source > 2 MB committée (gate CI).
7.10 `next/image` `unoptimized` jamais utilisé en prod.

### Chapitre 8 — Fonts

8.1 `next/font/google` self-hosted (déjà OK : Manrope, Inconsolata, Fraunces).
8.2 `display: swap` partout (déjà OK).
8.3 `size-adjust` declaration pour fallbacks (Arial / Times) — **à ajouter**.
8.4 Subsets `latin` only (déjà OK) — pas de cyrillique inutile.
8.5 Variable axes (Fraunces `opsz`, `SOFT`) chargés uniquement si utilisés.
8.6 Weights minimaux (déjà 2 weights Manrope — bon).
8.7 Aucune font CDN externe (Google Fonts CDN, Adobe Fonts) → tout self-hosted.
8.8 `<link rel="preload" as="font" type="font/woff2" crossorigin>` sur la font hero.
8.9 Pas de FOUT visible (mesure CLS = 0 lors du swap).
8.10 Variable font compressée (woff2 < 80 KB par variant).

### Chapitre 9 — Network hints

9.1 `<link rel="preconnect">` vers origines tiers utilisées (Calendly, Plausible, Stripe si présents).
9.2 `<link rel="dns-prefetch">` en fallback.
9.3 `<link rel="modulepreload">` sur chunks critiques de l'app router.
9.4 Speculation Rules tunées (déjà eager prefetch ; envisager `prerender` plus agressif sur top 6 pages).
9.5 Service Worker offline-first (optionnel mais Lighthouse PWA bonus).
9.6 HTTP/2 push **non** utilisé (déprécié par tous les browsers — préférer 103 Early Hints via Caddy/Cloudflare, cf. critère 5.3).
9.7 `priority` hints (`importance="high"`) sur fetch JS critique.
9.8 Pas de redirect 30x sur les ressources statiques.
9.9 `Cache-Control: immutable` sur les chunks JS/CSS hashés.
9.10 Origin pull CDN-friendly (pas de cookies sur ressources statiques).

### Chapitre 10 — Streaming & PPR

10.1 PPR `incremental` activé (`experimental.ppr: "incremental"`).
10.2 Routes statiques marquées `export const experimental_ppr = true`.
10.3 Suspense boundaries autour de chaque section dynamique potentielle (si on ajoute du dynamic plus tard).
10.4 `loading.tsx` granulaires par route segment lourd (pas un seul global).
10.5 Streaming HTML actif (pas de `force-static` qui désactive streaming).
10.6 Server Components par défaut ; `"use client"` justifié dans chaque fichier.
10.7 Réservation espace au-dessus du fold pour streaming sans CLS.
10.8 Aucun `await` long bloquant le shell (déplacer en composant Suspendu).
10.9 Test que le shell HTML statique arrive < 100 ms TTFB depuis le POP Cloudflare le plus proche (ex. Paris) sur l'origine Hetzner — mesurer via WebPageTest en mode « cached » et « first view ».
10.10 Documentation `Design.md` ou ADR mise à jour quand PPR activé.

### Chapitre 11 — React Compiler 19

11.1 `experimental.reactCompiler: true` activé.
11.2 `babel-plugin-react-compiler` installé (devDep).
11.3 ESLint plugin `eslint-plugin-react-compiler` actif et sans warning.
11.4 Tous les composants compatibles (pas de patterns React 17 cassés).
11.5 Bundle size delta mesuré (typiquement +0 à +5 % JS, mais −15-30 % runtime).
11.6 Avantage INP mesuré before/after sur BookingCalendar et MegaMenu.
11.7 Pas de régression visuelle sur les composants memoisés.
11.8 Test suite vitest passe sans modif.
11.9 Build time impact mesuré et acceptable (< +20 % cold build).
11.10 Documentation ADR (0008 ?) actée + lien vers RFC React Compiler.

### Chapitre 12 — View Transitions API

12.1 `experimental.viewTransition` activé **uniquement** si on l'utilise.
12.2 `<ViewTransition>` wrapper autour des transitions inter-routes critiques (home → /interventions, etc.).
12.3 CSS `view-transition-name` sur les éléments stables (logo header, hero schema).
12.4 Fallback Safari / Firefox : pas de régression (la propriété est ignorée silencieusement).
12.5 `prefers-reduced-motion` respecté → pas de transition si user opt-out.
12.6 Mesure INP : transition n'augmente pas INP > 50 ms.
12.7 Documenté dans `Design.md` (animations).
12.8 Pas de transition sur les sauts > 1 page (UX confus).
12.9 Pas de transition sur les pages de formulaire (calendrier, contact).
12.10 Decision-recorded : ADR (0009 ?) ou note refus motivé.

### Chapitre 13 — Caching & headers

13.1 `Cache-Control` granulaire (HTML : `s-maxage=600, stale-while-revalidate=86400` ; assets : `immutable, max-age=31536000`).
13.2 `ETag` / `Last-Modified` cohérents — Caddy 2 les émet automatiquement pour les fichiers statiques ; vérifier que Next ne les supprime pas pour les routes dynamiques.
13.3 Aucun `no-store` non justifié.
13.4 Brotli compression confirmée en prod via Caddy `encode br zstd gzip` + Cloudflare auto. Vérifier `curl -I -H "Accept-Encoding: br" https://axionia.eu/` retourne `content-encoding: br`.
13.5 `vary: Accept-Encoding` correct.
13.6 Pas de cache-buster `?v=…` random (uniquement hashes Next).
13.7 Service Worker (si activé chap. 9) ne sert pas du HTML stale.
13.8 RSC payload cache (`__next/static/*.rsc`) configuré pour CDN.
13.9 ISR `revalidate` documenté par route.
13.10 Cache-Control field test (curl headers) intégré au CI.

### Chapitre 14 — Sécurité & Best Practices Lighthouse 100

14.1 CSP nonce dynamique (Sprint 16 — à anticiper si gain perf via inlining).
14.2 `Strict-Transport-Security` preload (déjà OK 2 ans).
14.3 `Permissions-Policy` strict (déjà OK).
14.4 `Referrer-Policy: strict-origin-when-cross-origin` (déjà OK).
14.5 `X-Content-Type-Options: nosniff` (déjà OK).
14.6 `X-Frame-Options: DENY` (déjà OK) ou `frame-ancestors 'none'` via CSP.
14.7 Aucune dépendance avec CVE Critical/High (`pnpm audit` clean).
14.8 Pas d'usage `dangerouslySetInnerHTML` non sanitisé (sauf JSON-LD contrôlé).
14.9 HTTPS partout (Caddy auto-HTTPS Let's Encrypt + Cloudflare Universal SSL — gratuit, auto-renew). Vérifier qu'aucun lien externe ne reste en `http://`.
14.10 `console.log` retirés en prod (verifier dans build output).

### Chapitre 15 — Monitoring & gouvernance perf

15.1 Budget perf par route documenté (`_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`).
15.2 Lighthouse CI gate sur PR (bloquant si régression > seuil).
15.3 Bundle delta gate sur PR (bloquant si > +5 KB).
15.4 Dashboard RUM accessible (path à confirmer avec Will — Sprint 20 prévu `/admin/pseo-stats`).
15.5 Alerting sur p75 LCP > 2 500 ms (24 h) via dashboard RUM custom `/admin/pseo-stats` (Sprint 20, gratuit) ; à défaut Sentry free tier (5K errors + 10K perf events/mois).
15.6 Runbook « page lente » documenté pour Will (étapes diagnostic).
15.7 Snapshot mensuel CrUX archivé dans `_AUDIT/`.
15.8 Synthèse trimestrielle perf vs concurrents top 3 (Mistral, Anthropic site, etc.).
15.9 ADR à chaque feature perf majeure (PPR, React Compiler, View Transitions).
15.10 Doctrine `CLAUDE.md` / `AGENTS.md` mise à jour avec règles perf (LCP/INP/CLS budget).

---

## 5. Agents (multi-agent en parallèle)

Lance **6 agents `general-purpose` en parallèle** dès la fin de la Phase A (mesure faite). Chaque agent a un périmètre disjoint et produit un fragment de diagnostic + patch plan.

### Agent 1 — LCP & Images & Network hints

Chapitres 2 + 7 + 9. Sortie : `_AUDIT/agent-1-lcp-images.md`.

### Agent 2 — CLS & Fonts

Chapitres 3 + 8. Sortie : `_AUDIT/agent-2-cls-fonts.md`.

### Agent 3 — INP & React Compiler & View Transitions

Chapitres 4 + 11 + 12. Sortie : `_AUDIT/agent-3-inp-compiler.md`.

### Agent 4 — TTFB & Streaming PPR & Caching

Chapitres 5 + 10 + 13. Sortie : `_AUDIT/agent-4-ttfb-ppr-cache.md`.

### Agent 5 — Bundle & Build

Chapitre 6 + cross-cutting tooling. Sortie : `_AUDIT/agent-5-bundle.md`.

### Agent 6 — Monitoring & Best Practices & Sécurité Lighthouse

Chapitres 1 + 14 + 15. Sortie : `_AUDIT/agent-6-monitoring-bp.md`.

Chaque agent :

- **Lecture seule** sur le code.
- **Écriture seulement** dans son fichier `_AUDIT/agent-N-*.md`.
- Score `0/0,5/1` par critère par page sur les 15 pages stratégiques (10 critères × 15 pages = 150 cases minimum par agent).
- Patches chiffrés (effort, gain ms, risque, dépendances).
- Pas de patch appliqué.

Tu (l'agent superviseur) consolides en :

- `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md`
- `_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md`
- `_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md`
- `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md`
- `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`

---

## 6. Livrables exigés (format strict)

### `_AUDIT/AUDIT-WEB-VITALS-2026-SYNTHESE.md`

```markdown
# Audit Web Vitals Perfection 2026 — Synthèse

**Date** : YYYY-MM-DD
**Score global** : XXX / 1500
**Cible Lighthouse** : 100/100/100/100 sur 15 pages (desktop + mobile)
**Cible CrUX p75** : LCP ≤ 1 800 ms, INP ≤ 100 ms, CLS = 0

## Tableau de bord

| Chapitre  | Score actuel   | Cible | Gap |
| --------- | -------------- | ----- | --- |
| 1. Mesure | X / 100        | 100   | …   |
| …         | …              | …     | …   |
| **Total** | **XXX / 1500** | 1500  | …   |

## Top 5 quick wins (XS / S effort, gain ≥ 200 ms ou ≥ 5 KB)

1. …
2. …

## Top 5 chantiers structurels (M / L effort, gain transformatif)

1. PPR `incremental` + Suspense boundaries
2. React Compiler 19
3. …

## Recommandations vagues (ordre)

- V1 (XS+S quick wins)
- V2 (Fonts size-adjust + LCP preload + dns-prefetch)
- V3 (PPR + Suspense)
- V4 (React Compiler)
- V5 (Caddy + Cloudflare 103 Early Hints + Service Worker optionnel)
- V6 (Polish + monitoring)
```

### `_AUDIT/AUDIT-WEB-VITALS-2026-DIAGNOSTIC.md`

Tableau exhaustif **page × critère** avec score, observation et lien vers patch.

### `_AUDIT/AUDIT-WEB-VITALS-2026-PATCHES.md`

Liste numérotée. Chaque entrée :

```markdown
## P-042 — Préload LCP image hero `/[locale]`

**Effort** : XS (10 min)
**Gain estimé** : LCP −350 à −550 ms p75
**Risque** : Faible
**Dépendances** : aucune

**Fichier** : `src/app/[locale]/page.tsx` (ou layout, selon hero)

**Diff** :
\`\`\`diff

- // ancien

* // nouveau (avec <link rel="preload" as="image" imagesrcset>)
  \`\`\`

**Validation** :

- Lighthouse LCP audit avant/après
- DevTools Network → la requête image démarre avant FCP
```

### `_AUDIT/AUDIT-WEB-VITALS-2026-ROADMAP.md`

Vagues V1 → V6 avec :

- Liste des P-XXX inclus
- Estimation totale effort
- Gain cumulé attendu
- Pré-requis (deps, ADR à écrire)
- Critère de validation pour passer à la vague suivante

### `_AUDIT/AUDIT-WEB-VITALS-2026-BUDGETS.md`

Format CI :

```yaml
routes:
  /:
    lighthouse:
      performance: 100
      lcp_ms: 1800
      inp_ms: 100
      cls: 0.05
    bundle:
      initial_kb_gzip: 70
  /reserver:
    lighthouse:
      performance: 95
      lcp_ms: 2200
      inp_ms: 150
      cls: 0.05
    bundle:
      initial_kb_gzip: 95
```

---

## 7. Contraintes intouchables (rappel)

- **Doctrine v3 visuelle** figée HEAD : titleEm serif italique, Header terracotta, hero-schema carré 576×576, modular scale typo v3.2 (cf. ADR 0007). **Aucun patch ne doit dégrader le rendu visuel.**
- **Anti-doorway HCU** sur villes non pilotes (copy-gated `noindex`) — ne pas casser.
- **Naming** : « cabinet IA opérationnel » FR / « operational AI consultancy » EN. **Axion-IA** sans tiret dans `src/`, **Axion-IA** avec tiret pour repo/dossier/domaine.
- **Lighthouse CI seuils existants** ne se relâchent **jamais** (uniquement se durcissent).
- **JSON-LD** existant ne se casse pas (Organization, WebSite, BreadcrumbList, ItemList, LocalBusiness, Place, FAQPage, etc.).
- **Tests** vitest passent à chaque vague.
- **Sprint 15 backend (Pagefind)** intouché — cet audit est strictement frontend perf.
- **Aucun patch backend** (pas de Stripe, pas d'auth, pas de DB).

---

## 8. STOP & ASK obligatoires

Tu déclenches un STOP & ASK et **tu attends Will** dans ces cas :

1. Avant d'activer **PPR** (`experimental.ppr`) — risque cassant sur certaines routes.
2. Avant d'activer **React Compiler** (besoin de devDep + ADR).
3. Avant d'activer **View Transitions** (impact visuel).
4. Si un patch nécessite de modifier la **doctrine v3 visuelle**.
5. Si tu détectes un trade-off perf vs SEO/AEO/GEO/A11y.
6. Si une mesure baseline diverge de > 30 % des seuils Lighthouse CI actuels (signal d'un autre bug).
7. Avant d'ajouter une dépendance npm > 10 KB gzip.
8. Avant de désactiver Speculation Rules (existant et utile).
9. Avant tout `pnpm install` ou `pnpm add`.
10. Avant tout commit (Will valide avant push, doctrine projet).
11. **Avant tout patch `[BUDGET-FLAG]`** (outil ou plan payant) — alternative gratuite obligatoire en option A.
12. **Avant de proposer un upgrade payant** (Cloudflare Pro $20/mois, Hetzner CCX dedicated, etc.) — chiffrer le gain en ms et le coût explicitement.

Format STOP & ASK :

```markdown
## STOP & ASK [N° + titre]

**Contexte** : …
**Décision requise** : …
**Options** :
A. …
B. …
C. …
**Recommandé** : … (raison)
**Impact si on attend** : …
```

---

## 9. Checklist finale (avant de rendre la main)

- [ ] Phase A baseline mesure faite et documentée
- [ ] 6 fichiers `_AUDIT/agent-N-*.md` produits
- [ ] 5 fichiers de synthèse `_AUDIT/AUDIT-WEB-VITALS-2026-*.md` produits
- [ ] Score `/1500` calculé
- [ ] Top 5 quick wins identifiés
- [ ] Top 5 chantiers structurels identifiés
- [ ] Roadmap V1 → V6 séquencée
- [ ] STOP & ASK ouverts listés
- [ ] **Aucun fichier source modifié** (audit lecture seule)
- [ ] Mémoire `axionia_prompt_web_vitals.md` créée (pointeur vers cet audit)

---

## 10. Mémoire à créer en sortie

Crée une nouvelle entrée mémoire :

**`axionia_audit_web_vitals_2026-MM-DD.md`** :

```markdown
---
name: Axion-IA audit Web Vitals 2026 livré YYYY-MM-DD
description: Audit perf complet 150 critères / 6 agents / 5 livrables _AUDIT/. Score X/1500. Top 5 quick wins + Top 5 structurels + roadmap V1-V6.
type: project
---

… synthèse en 8-10 lignes …
```

Et ajoute la ligne dans `MEMORY.md`.

---

**FIN DU PROMPT.**
**Tu peux maintenant lancer la Phase A.**
