# Phase A — Baseline mesure (lecture seule)

**Date** : 2026-05-08
**Build référencé** : `.next/BUILD_ID = E3PP2kWtZKG7UfgwwGBdi` (built 2026-05-08 13:02 CEST)
**Méthode** : lecture des artifacts de build récents — aucun `pnpm build` relancé (économie de ~30 min sur 4 562 SSG)

---

## A.1 — État frontend & contraintes

### Stack

- Next.js **16.2.4** (App Router, Turbopack par défaut)
- React **19.2.4** + React DOM 19.2.4
- next-intl **4.11.0** (FR / EN)
- Sentry **@sentry/nextjs 10.51.0** (SDK + Replay 1 % on-error, Tracing 10 % en prod)
- Fonts : `next/font/google` self-hosted — Manrope (400, 600), Inconsolata (1 weight), Fraunces (400/500/600 + italic, axes opsz/SOFT)
- Build : Turbopack (no `output: "standalone"` activé)
- Hosting cible : Hetzner CPX32 + Caddy 2 (à installer) + Cloudflare free (à configurer)
- Runtime : Node.js 22 (pas Vercel Edge)

### Configuration `next.config.ts` (état)

- `compress: true` — _risque double-compression si Caddy + CF en aval_
- `images.formats = ["image/avif", "image/webp"]` ✅
- `experimental.optimizePackageImports` activé sur **lucide-react + 14 sub-paquets Radix** ✅
- `experimental.viewTransition` ❌ **commenté** (différé Sprint 17)
- `experimental.ppr: "incremental"` ❌ **commenté** (différé Sprint 17)
- `reactCompiler` ❌ **commenté** (différé Sprint 17)
- `output: "standalone"` ❌ **non activé** (recommandé Hetzner Docker)
- `productionBrowserSourceMaps` non précisé → défaut Next 16 = `false` ✅
- Headers de sécurité : minimaux (HSTS preload + X-Frame DENY + Referrer + Permissions-Policy + DNS-Prefetch + nosniff). **CSP nonce dynamique différé Sprint 16**

### Speculation Rules (production-only, dans `[locale]/layout.tsx`)

- `prerender` : `eagerness: moderate`, `where: /${locale}/*`
- `prefetch` : `eagerness: eager`, `where: /${locale}/*`
- ⚠️ `eager prefetch` sur **toutes les URLs locales** = risque sur 4 562 SSG : navigation viewport prefetch + speculation eager → bandwidth Cloudflare. À reconsidérer si CrUX p75 LCP dégrade.

### Lighthouse CI seuils (`lighthouserc.json`)

| Catégorie        | Seuil actuel |
| ---------------- | ------------ |
| performance ≥    | 0.95         |
| accessibility ≥  | 0.95         |
| best-practices ≥ | 0.95         |
| seo ≥            | 1.00         |
| LCP max          | 2 500 ms     |
| INP max          | 200 ms       |
| CLS max          | 0.1          |
| TBT max          | 200 ms       |

- Mobile preset : ❌ pas configuré (`preset: "desktop"` uniquement). Critère 1.8 _fail_ d'office.
- numberOfRuns : 3
- startServerCommand : `pnpm start`

### Tests scripts package.json

- `pnpm verify:all` enchaîne typecheck + lint + i18n + anti-siren + anti-hex + use-client + contrast + radius + test
- `pnpm bundle:check` (size-limit) avec budget **`100 KB` total chunks** (vs critère 6.1 cible 70 KB gzip route home — fail d'office)
- `pnpm bundle:analyze` = `ANALYZE=true next build` (webpack analyzer — peut ne pas fonctionner avec Turbopack v16)

---

## A.2 — Inventaire bundle (depuis `.next/diagnostics/route-bundle-stats.json`)

**69 routes uniques** (templates) — **4 562 prérenders** au total (`.next/prerender-manifest.json`).

### Distribution First Load JS uncompressed (cible 70 KB gzip ≈ ~230 KB uncompressed)

| Bracket               | Nb routes |
| --------------------- | --------- |
| < 200 KB uncompressed | 0         |
| 200–500 KB            | 0         |
| 500–800 KB            | 2         |
| 800 KB–1 MB           | 63        |
| > 1 MB                | **4**     |

### Top 15 routes les plus lourdes

| First Load (uncomp.) | Route                            |
| -------------------: | -------------------------------- |
|            1 022 125 | `/[locale]` (home) ⚠️            |
|            1 010 851 | `/[locale]/sections`             |
|            1 003 978 | `/[locale]/guide-ia`             |
|            1 002 905 | `/[locale]/contact` ⚠️           |
|              985 340 | `/[locale]/audit/demande`        |
|              941 728 | `/[locale]/reserver` ⚠️          |
|              923 830 | `/[locale]/roi`                  |
|              914 850 | `/[locale]/implementation` ⚠️    |
|              914 850 | `/[locale]/audit` ⚠️             |
|              913 244 | `/[locale]/presse`               |
|              913 244 | `/[locale]/interventions` ⚠️     |
|              901 763 | `/[locale]/components` (debug ?) |
|              901 285 | `/[locale]/stack-ia` ⚠️          |
|              901 285 | `/[locale]/methodologie` ⚠️      |
|              901 285 | `/[locale]/comparaisons` ⚠️      |

(⚠️ = pages stratégiques §3 du prompt)

### Pages stratégiques (Top 80/20) — First Load uncompressed

| Page                                       |     Bytes | Estimé gzip (~30 %) |                            Cible 70 KB |         Gap |
| ------------------------------------------ | --------: | ------------------: | -------------------------------------: | ----------: |
| `/[locale]` (home)                         | 1 022 125 |             ~310 KB |                                  70 KB | **+240 KB** |
| `/[locale]/interventions`                  |   913 244 |             ~275 KB |                                  70 KB |        +205 |
| `/[locale]/interventions/essentielle`      |   899 104 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/audit`                          |   914 850 |             ~275 KB |                                  70 KB |        +205 |
| `/[locale]/audit/flash`                    |   899 104 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/implementation`                 |   914 850 |             ~275 KB |                                  70 KB |        +205 |
| `/[locale]/cas-concrets`                   |   901 285 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/methodologie`                   |   901 285 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/comparaisons`                   |   901 285 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/stack-ia`                       |   901 285 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/implantations`                  |   887 031 |             ~265 KB |                                  70 KB |        +195 |
| `/[locale]/implantations/[region]`         |   887 031 |             ~265 KB |                                  70 KB |        +195 |
| `/[locale]/implantations/[region]/[ville]` |   899 104 |             ~270 KB |                                  70 KB |        +200 |
| `/[locale]/reserver`                       |   941 728 |             ~285 KB | 95 KB (cible doctrine pour calendrier) |        +190 |
| `/[locale]/contact`                        | 1 002 905 |             ~300 KB |                                  70 KB |        +230 |

**Conclusion baseline** : aucune page stratégique n'est même proche du budget. Estimation gzip pessimiste — la mesure réelle pourrait descendre à ~250 KB grâce à Brotli (~25 % de mieux que gzip). Reste un gap ~3-4× sur toutes les pages.

### Suspects bundle (à investiguer par Agent 5)

- **`@sentry/nextjs` 10.51.0** — SDK client + Replay add-on (~50–90 KB gz typique). Replay sample 1 % on-error mais code chargé.
- **`next-auth 5.0.0-beta.31`** — possiblement chargé sur routes non auth (à vérifier).
- **`@tanstack/react-query 5.100.9`** — provider client global ?
- **`@tiptap/*` 3.22.5** (pm + react + starter-kit) — éditeur texte, lourd, devrait être route-isolé `/admin` ou similar.
- **`motion 11.18.2`** — Framer Motion v11 (`motion/react`), ~15-25 KB gz.
- **`zustand 4.5.7`** — state global, OK.
- **`@vercel/og 0.11.1`** — generateur OG image, normalement Server-only.
- **`bullmq` + `ioredis`** — backend, normalement Server-only.
- **`prisma` + `argon2` + `otplib`** — backend, normalement Server-only.

À confirmer : `serverExternalPackages` non configuré dans `next.config.ts` → certaines deps backend pourraient leak vers le client si importées par erreur.

---

## A.3 — Bundle analyzer

⚠️ **Bundle analyzer existant (`@next/bundle-analyzer 16.2.4`)** est le plugin webpack. Next 16 utilisant **Turbopack** par défaut, ce plugin :

- Soit déclenche un fallback build webpack (lent + non représentatif du build prod Turbopack)
- Soit n'émet pas de rapport HTML

→ Recommandation Agent 5 : utiliser `pnpm next experimental-analyze` (Turbopack natif, v16.1+) avec `--output` pour archiver dans `.next/diagnostics/analyze`.

---

## A.4 — RUM + Speculation + Fonts wiring

### `/api/vitals/route.ts` — runtime mismatch ⚠️

```ts
export const runtime = "edge"; // ← Cible Vercel Edge, mais on déploie Hetzner Node.js !
```

**Conflit doctrine** : §0bis prompt impose Node.js runtime sur Hetzner. `runtime = "edge"` signifie Next.js compile la route avec contraintes Edge (subset Node API), mais `next start` self-hosted fait tourner cette route en **Node.js** quand même → l'annotation est trompeuse. À corriger en `runtime = "nodejs"` (default) ou supprimer + viser réponse < 50 ms (critère 5.2/1.3).

Persistance actuelle : `console.warn` en dev, **rien en prod**. Tous les payloads RUM sont jetés. → critère 1.6 fail.

### `WebVitals.tsx` payload — incomplet vs critère 1.4

Envoie : `id, name, value, rating, delta, navigationType, href`
Manque : `route`, `locale`, `connection.effectiveType`, `deviceMemory`

### Speculation Rules — déjà présentes mais agressives

- `prerender moderate` + `prefetch eager` sur tout `/${locale}/*` — sur 4 562 SSG, risque bandwidth Cloudflare + Hetzner egress.
- À monitorer post-déploiement pour décider si on passe `eager` → `moderate` ou si on cible Top 15 pages explicitement.

### Fonts — pas de preload `<link>`

- 3 familles `next/font/google` chargées via `variable` CSS — pas de `<link rel="preload" as="font">` dans `<head>`.
- Critère 8.8 fail.
- Critère 8.3 (`size-adjust` fallback) : aucun `@font-face` fallback déclaré → CLS lors du swap garanti.

### Hero LCP candidate

- Home : H1 texte (`display-editorial` Manrope) — pas d'image.
- HeroSchema SVG inline grand format dans `<aside hidden lg:block aria-hidden>` → desktop only.
- ⇒ LCP probable : H1 texte → préload font Manrope critique pour LCP ≤ 1 800 ms.

---

## A.5 — Lighthouse smoke baseline (3 pages, desktop, 1 run, Windows local)

✅ **Lancé en smoke pragmatique** sur 3 pages représentatives (FR, desktop preset, 1 run, Chrome headless local) — sur décision Will.

Rapports archivés : `_AUDIT/lighthouse-smoke-2026-05-08/{home-fr,reserver-fr,paris-fr}.report.{html,json}`

### Scores baseline (avant patches)

| Page                                    |   Perf | A11y |  BP | SEO |   LCP |       CLS |        TBT |   FCP |   TTFB |    SI |
| --------------------------------------- | -----: | ---: | --: | --: | ----: | --------: | ---------: | ----: | -----: | ----: |
| `/fr` (home)                            | **81** |   88 |  96 |  92 | 1,2 s |     **0** | **300 ms** | 0,6 s | 210 ms | 1,9 s |
| `/fr/implantations/ile-de-france/paris` | **98** |   96 |  96 |  92 | 1,1 s |         0 |      60 ms | 0,4 s |  20 ms | 1,0 s |
| `/fr/reserver`                          | **66** |   91 |  96 |  92 | 1,5 s | **0,552** |     210 ms | 0,4 s |  30 ms | 1,0 s |

### Constats vs seuils actuels `lighthouserc.json` (perf ≥ 95, LCP < 2 500 ms, INP < 200 ms, CLS < 0,1, TBT < 200 ms)

🔴 **`/reserver`** : CLS = **0,552** → 5,5× au-dessus du seuil Google. INP non mesurable en lab synthétique. **CI fail certain** sur cette page si activée.
🔴 **`/reserver`** : Perf 66 → **−29 pts vs seuil CI 95**. Cause probable : BookingCalendar 28 useState + autosave per-keystroke + lazy-load manquant (cf. Agent 1 P-007 et Agent 3 P-201/P-202).
🔴 **Home** : Perf 81 + TBT 300 ms → **CI fail**. Hot path JS bloquant longtemps avant interactivité (corrèle avec First Load 1 MB constaté A.2).
🟠 **A11y home 88** sous seuil 95 — Agent 6 / Agent 1 doivent diagnostiquer (probablement contraste sur certains badges + labels manquants).
🟠 **SEO 92 partout** sur les 3 pages (vs cible 100) → signal global, probablement un audit Lighthouse SEO qui rate sur le bulk (à diagnostiquer dans patch dédié — possiblement `meta description` longueur, `image alt` manquants ailleurs, `link text descriptive`, ou `crawlable-anchors`).
🟠 **Best Practices 96 partout** (vs cible 100) → 4 pts à récupérer (probablement HTTPS forcé manquant en local, ou CSP, ou source maps).
🟢 **CLS = 0** sur home et Paris ✅
🟢 **LCP < 1,5 s en lab Windows** ✅ pour les 3 pages — terrain Hetzner attendu meilleur (Brotli + Early Hints + CDN).
🟢 **Paris (ville pilote pSEO Sprint 14.9) Perf 98** — gold standard validé, sert de cible interne pour les 2 150 villes en industrialisation.

### Limites du smoke

- **1 run uniquement** (pas la médiane sur 3 runs prévue par le prompt) → variabilité ±5-10 pts perf possible.
- **Desktop preset uniquement** — mobile slow-4G non lancé (cf. critère 1.8 / patch Agent 5 P-406).
- **Windows + Turbopack `next start` local** ≠ Hetzner Linux + Caddy + Cloudflare prod. Les chiffres TTFB et TBT sont le plancher pessimiste en environnement local. La prod Hetzner devrait améliorer TTFB (Brotli + Early Hints) et TBT (Caddy HTTP/3).
- **Pas de validation FR + EN** — Lighthouse FR uniquement.
- **Lighthouse a planté sur cleanup temp Windows** (EPERM `chrome-launcher`) après chaque run — non bloquant, JSON+HTML écrits avant le crash.

### Cible recommandée Phase F (validation finale)

Run Lighthouse complet (15 pages × FR+EN × desktop+mobile × 3 runs) sur **staging Hetzner CPX32 + Caddy 2 + Cloudflare free** post-V1/V2/V3 patches. Résultats publiés dans `_AUDIT/AUDIT-WEB-VITALS-2026-VALIDATION-FINALE.md`.

---

## A — Résumé exécutif baseline

| Constat                                                                                    | Sévérité       |
| ------------------------------------------------------------------------------------------ | -------------- |
| First Load JS uncomp. ~900 KB–1 MB sur les 15 pages stratégiques (~270–310 KB gzip estimé) | 🔴 Élevée      |
| Aucune page sous 500 KB uncompressed                                                       | 🔴 Élevée      |
| `runtime = "edge"` sur `/api/vitals` incompatible Hetzner (annotation trompeuse)           | 🟡 Moyenne     |
| `/api/vitals` ne persiste rien en prod (RUM = poubelle)                                    | 🔴 Élevée      |
| Fonts : 3 familles, pas de preload, pas de `size-adjust` fallback → CLS swap               | 🟠 Notable     |
| Lighthouse CI mobile preset absent                                                         | 🟠 Notable     |
| Speculation Rules `eager` partout (4 562 SSG) → bandwidth Cloudflare                       | 🟡 Moyenne     |
| Pas de `Caddyfile`, pas de `Dockerfile` standalone, pas de Cloudflare config               | 🔴 Élevée (V5) |
| `output: "standalone"` non activé                                                          | 🟠 Notable     |
| `compress: true` Next + Caddy/CF planifié → double compression risque                      | 🟡 Moyenne     |
| 1 seul `loading.tsx` global → granularité streaming insuffisante                           | 🟠 Notable     |
| PPR + Compiler + ViewTransition off (différé Sprint 17)                                    | ⚪ Connu       |
| CSP nonce off (Sprint 16)                                                                  | ⚪ Connu       |
| Bundle analyzer = plugin webpack, mais Next 16 utilise Turbopack                           | 🟡 Moyenne     |

**Score préliminaire estimé sur la base bundle-only** (avant agents) : **~35–45 % de critères au vert** sur 150. Cible : 100 %.

---

## Inputs prêts pour Phase B+C (6 agents)

- **Build artifacts disponibles** : `.next/diagnostics/route-bundle-stats.json`, `prerender-manifest.json`, `routes-manifest.json`, `build-manifest.json`, `static/chunks/*`
- **Fichiers source critiques identifiés** : `next.config.ts`, `lighthouserc.json`, `src/app/[locale]/layout.tsx`, `src/app/api/vitals/route.ts`, `src/components/analytics/WebVitals.tsx`, `src/proxy.ts`, `src/instrumentation*.ts`, `src/sentry.*.config.ts`
- **Pages stratégiques** : 15 listées §3 prompt — toutes au-dessus de 800 KB First Load uncompressed

**Phase A close.** Lancement Phase B+C (6 agents parallèles).
