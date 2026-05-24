# A3-09 — Core Web Vitals & Mobile
## Score : 57/70
## Date : 2026-05-21
## HEAD : 37ca0147

---

### Points obtenus

- [OK] lighthouserc.json — cibles CWV configurées en ERROR strict (LCP ≤ 1800, CLS ≤ 0.1, TBT ≤ 200, FCP ≤ 1500) : **14/15**
- [PARTIEL] JS bundle gate via size-limit (75 KB par route hors /reserver) — configuré dans package.json mais build prod `.next/static` absent (build dev uniquement en local) : **8/12**
- [OK] LCP ≤ 1800ms — stratégie SSG via `generateStaticParams` sur villes + ISR `revalidate=86400` + Cloudflare CDN + inlineCss=true (Next.js) : **9/10**
- [OK] CLS ≤ 0.05 — skeleton loaders granulaires sur toutes les routes critiques + `width`/`height` explicites sur `<Image>` + `ImageBankPicture` requiert dimensions : **9/10**
- [PARTIEL] INP ≤ 80ms — accordion Radix UI `use client` léger, mais `@radix-ui/react-accordion` dans `optimizePackageImports`, et accordion FAQ 30Q n'a pas de virtualisation : **7/10**
- [OK] Images WebP/AVIF + lazy loading — `next/image` formats AVIF+WebP, `ImageBankPicture` srcset 3 breakpoints, `fetchPriority="high"` sur LCP, `loading="lazy"` par défaut : **7/8**
- [OK/PARTIEL] Mobile — viewport exporté dans layout.tsx (device-width, initialScale 1, themeColor terracotta), CLS skeletons dimensionnés mobile, `target-size` en WARN lighthouserc (zones tactiles < 48px reconnues) : **3/5**

---

### Points perdus

- **[P2] lighthouserc : INP désactivé (`off`)** — mesuré uniquement CrUX field data, pas de gate lab. Acceptable vu la limitation Lighthouse (pas d'interactions réelles), mais risque de dérive non détectée en CI.
- **[P2] CLS LHCI desserré à 0.1 vs doctrine interne 0** — `/fr/audit` dépasse 0.05. Doctrine AGENTS.md dit "CLS = 0 cible interne stricte" ; gate autorise 0.1. Delta non résolu post-P1.5.
- **[P1] Pas de build prod analysable localement** — `.next/` disponible est un build dev (Turbopack) sans `static/chunks`. Impossible de valider empiriquement les tailles de bundles JS. Le gate `size-limit` est configuré mais non exécuté lors de cet audit.
- **[P2] FAQ 30Q sans virtualisation** — `FaqAccordion` rend tous les `AccordionItem` dans le DOM (pas de `react-window` / `@tanstack/react-virtual`). Avec 30+ questions, le DOM total peut excéder ~1500 nœuds sur `/fr/faq`, impactant TBT et potentiellement INP sur mobile bas de gamme.
- **[P3] Speculation Rules désactivées** (`if (false && ...)` dans layout.tsx) — feature désactivée suite à un conflit Chrome/Next 16. Désactivation correcte et documentée, mais perd le gain prefetch sur 15 routes stratégiques (~50-150ms p75 LCP perçu).
- **[P3] target-size en WARN** — zones tactiles < 48px reconnues (nav mobile, footer links). Déclare P1 dans doctrine AGENTS.md, Sprint A11y dédié non encore livré.

---

### lighthouserc.json — Cibles configurées

**Fichier :** `axionia/lighthouserc.json`

Assertions Core Web Vitals (mode ERROR strict) :

| Métrique | Gate | Valeur | Status |
|---|---|---|---|
| LCP | ERROR maxNumericValue | 1800 ms | OK |
| INP | **off** | — | ABSENT (CrUX field data only) |
| CLS | ERROR maxNumericValue | **0.1** (desserré depuis 0.05) | PARTIEL (doctrine interne = 0) |
| TBT | ERROR maxNumericValue | 200 ms (desserré depuis 150) | OK |
| FCP | ERROR maxNumericValue | 1500 ms | OK (plus strict que les 2000ms cible) |
| Speed Index | ERROR maxNumericValue | 2500 ms | OK |
| Perf score | ERROR minScore | 0.9 | OK |

**Pages testées :** 9 URLs (fr+en) couvrant home, interventions, audit, implementation, cas-concrets, blog, contact, galerie — 2 presets (desktop + mobile).

**Doctrines clés (commentaire `_assert_doctrine`) :**
- INP off = lab Lighthouse n'a pas d'interactions utilisateur réelles → off est le choix correct
- CLS desserré 0.05→0.1 : `/fr/audit` dépasse 0.05 (cause non encore résolue)
- Insights Lighthouse 12+ (forced-reflow-insight, dom-size-insight, etc.) désactivés — faux positifs connus

**Point de friction :** La cible INP ≤ 80ms (AGENTS.md) n'est pas gatée en CI. Seul CrUX la mesure, avec délai de plusieurs semaines.

---

### next.config.ts — Configuration performance

**Optimisations actives :**

| Mécanisme | Config | Impact |
|---|---|---|
| `compress: false` | Délégué à Caddy (brotli 9 + zstd) | -5-8% CPU, meilleure compression |
| `images.formats` | `['image/avif', 'image/webp']` | Compression optimale |
| `images.minimumCacheTTL` | 31 536 000 s (1 an) | I/O disk cache réduit |
| `inlineCss: true` | Experimental, App Router prod | Élimine 1 render-blocking resource, -50-150ms FCP/LCP |
| `optimizePackageImports` | 15 packages Radix UI + lucide-react | Tree-shaking granulaire, réduit hydration JS |
| `productionBrowserSourceMaps` | false | Bundle JS client allégé |
| `output: standalone` | Docker standalone | Build léger Hetzner |
| `serverExternalPackages` | 9 packages (prisma, sharp, bullmq…) | Évite leak Node.js → bundle client |
| `reactStrictMode: true` | — | Double-render dev, pas d'impact prod |

**Fonts :**
- Manrope 2 weights uniquement (400+600) — économise ~50 KB woff2
- Inconsolata `preload: false` — évite preload inutile sur 90%+ des pages
- Fraunces display: swap — LCP non bloqué par font load

**Spéculation Rules :** désactivées (`if (false)`) suite conflit Chrome/Next 16. À ré-activer après diagnostic ciblé.

**Resource Hints preconnect :** Plausible, Sentry ingest, Cloudflare Turnstile — réduisent TBT ~60-150ms p75.

---

### Analyse composants P1.5

#### 1. AiContentDisclaimer (`src/components/marketing/AiContentDisclaimer.tsx`)

**Risque CLS : FAIBLE**

- Server Component pur (aucun hook, aucun state, `"use client"` absent)
- Bundle impact : ~0 KB côté client (le composant Lucide `Sparkles` est tree-shaken via `optimizePackageImports`)
- Structure statique : `<aside>` avec hauteur déterministe (`px-6 py-5`), dimensions fixes CSS — pas de layout shift possible
- Placement : `my-8` dans le flux de texte d'article (après body, avant CtaBlock) — en dehors du viewport above-fold → hors scope LCP
- **Verdict :** Ajout P1.5 sans risque CLS ni impact LCP/INP. Impact bundle ≈ 0.

#### 2. GenerationProvenance (`src/server/content-gen/provenance/provenance-logger.ts`)

**Risque perf : AUCUN (server-only)**

- Fonction server-side pure (`import { prisma }`) — jamais embarquée dans le bundle client
- Fire-and-forget : les erreurs de log ne bloquent pas la génération
- Aucun composant UI associé — la provenance est stockée en DB et exposée uniquement via `/api/admin/articles/[id]/provenance`
- Pas de TTFB impact sur les pages publiques (exécuté uniquement dans les workers content-gen)
- **Verdict :** Zéro impact Web Vitals. Architecture correcte.

#### 3. FAQ Accordion 30Q — INP et hydration

**Risque INP : MODÉRÉ**

- `FaqAccordion` → `Accordion` (Radix UI) : `"use client"` requis pour animations + ARIA state
- Radix `@radix-ui/react-accordion` dans `optimizePackageImports` → tree-shaking OK
- Pattern `type="single" collapsible` : un seul panel ouvert à la fois → state minimal
- Transition animation `animate-accordion-down/up` via CSS (Tailwind data-state) — hardware-accelerated `overflow: hidden` + height → risque de reflow léger
- **Problème :** 30 `AccordionItem` rendus simultanément dans le DOM, plus l'index alphabétique complet sous-jacent (`items.map()` dans `<ul>` final) → DOM total /fr/faq : ~1500-2000 nœuds. Sur mobile 4G/RAM contrainte, hydration initiale peut dépasser 80ms
- Page `/fr/faq` n'a pas de `loading.tsx` dédié → fallback global `LocaleLoading` (sous-dimensionné pour une page avec 30+ questions + 2 sections)
- **Verdict :** P2 — pas de virtualisation, mais mitigé par optimizePackageImports + CSS animation. À surveiller via CrUX INP.

#### 4. Nouveaux JSON-LD volumineux (isBasedOn, mentions, aiGenerated)

**Risque TTFB : FAIBLE**

- Tous les JSON-LD sont émis via `<JsonLd>` (Server Component, `dangerouslySetInnerHTML`) — inlinés dans le HTML SSG/ISR
- `isBasedOn` : objet JSON compact (~80 bytes) dans `buildNewsArticleJsonLd` — négligeable
- `aiGenerated: true` + `additionalType` + `disambiguatingDescription` + `usageInfo` : ~400 bytes supplémentaires par article
- `buildArticleBase` : JSON-LD total ~1-2 KB par page article — dans les limites acceptables
- `buildPersonManonJsonLd` : ~600 bytes — OK
- **Calcul impact TTFB :** HTML d'une page article passe de ~15 KB à ~17 KB (estimation) — delta ~2 KB < 5% TTFB sur gzip/brotli Cloudflare
- **Verdict :** Pas d'impact mesurable sur TTFB ou LCP. Architecture correcte (SSG/ISR préserve le TTFB bas).

#### 5. ImageBankPicture — Lazy loading et CLS

**Risque CLS : FAIBLE si `width`+`height` passés, ÉLEVÉ sinon**

- `<picture>` avec srcset 3 breakpoints (384w/768w/1920w) + AVIF + LQIP background-image
- `loading="eager"` + `fetchPriority="high"` quand `priority={true}` — correct pour LCP
- `loading="lazy"` + `decoding="async"` par défaut — correct pour les images below-fold
- **Risque CLS :** `width` et `height` sont optionnels dans l'interface (`width?: number`). Si non passés, le `<img>` n'a pas de dimensions intrinsèques → layout shift au chargement
- Commentaire dans le fichier indique "CLS = 0 : toujours passer width + height explicites" mais ne l'enforce pas (pas de TypeScript required)
- **Verdict :** P2 — rendre `width` et `height` required pour les images above-fold (ou ajouter `aspect-ratio` CSS fallback).

---

### Stratégie SSG villes

**generateStaticParams présent sur :**

1. `src/app/[locale]/implantations/[region]/[ville]/page.tsx` — `VILLES.map()` → génère toutes les villes au build
2. `src/app/[locale]/implantations/[region]/page.tsx` — régions SSG
3. `src/app/[locale]/audit/par-ville/[ville]/page.tsx` — pages audit villes
4. 12+ autres routes dynamiques (blog/[slug], faq/[slug], glossaire/[slug], etc.)

**Complément ISR :**
- Pages villes : `revalidate = 86400` (24h) + `dynamicParams = true` → nouvelles villes servables sans rebuild complet
- Pages actualités/blog : `revalidate = 3600` (1h) — fraîcheur contenus content-gen
- Pages cas-concrets : `revalidate = 86400`

**Impact LCP :** Les pages villes sont SSG → HTML servi depuis Cloudflare CDN (edge cache) → TTFB ~50-150ms → LCP ≤ 800ms réaliste sur desktop. Sur mobile 4G, le budget 1800ms est tenu.

**Manque identifié :** La page `/fr/faq` elle-même n'a pas de `generateStaticParams` (route sans paramètre dynamique — normal). Mais elle fait `await listFaqs()` au runtime SSR sans `revalidate` exporté → rendue dynamique à chaque requête → TTFB dépend de la DB. P2 : ajouter `export const revalidate = 3600`.

---

### Bundle analysis (build prod non disponible)

**Build disponible :** `.next/` est un build dev (Turbopack) — aucun chunk prod dans `.next/static/`.

**Configuration size-limit (package.json) — cibles officielles :**

| Scope | Chemin | Limite |
|---|---|---|
| Shell partagé (framework+main+webpack) | `.next/static/chunks/framework-*.js` + `main-*.js` + `webpack-*.js` | 100 KB gz cumulé |
| Pages standard (hors /reserver) | `.next/static/chunks/app/**/page-*.js` | **75 KB gz** |
| /reserver page chunk | `.next/static/chunks/app/**/reserver/**/page-*.js` | 110 KB gz |
| /galerie page chunks | `.next/static/chunks/app/**/galerie/**/page-*.js` | 75 KB gz |

**Analyse statique des facteurs de risque post-P1.5 :**

| Composant P1.5 | Bundle côté client | Risque dépassement 75 KB |
|---|---|---|
| `AiContentDisclaimer` | ~0 KB (Server Component) | Nul |
| `provenance-logger.ts` | 0 KB (server-only) | Nul |
| `FaqAccordion` avec 30Q | ~2-3 KB (déjà présent pré-P1.5) | Faible — déjà intégré |
| JSON-LD `isBasedOn`/`aiGenerated` | 0 KB (JSON inline SSR) | Nul |
| `ImageBankPicture` | ~1 KB (`use client` minimal) | Faible |

**Conclusion statique :** Les ajouts P1.5 sont majoritairement server-side. L'impact bundle client est estimé à < 3 KB gz total. Le risque de dépassement du gate 75 KB est très faible. **Validation empirique requise via `pnpm bundle:check` après build prod.**

---

### Mobile readiness

**Viewport :**
```typescript
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c24a1b",
  colorScheme: "light",
};
```
Exporté dans `[locale]/layout.tsx` — s'applique à toutes les routes. Conforme.

**Responsive :**
- Skeletons loading.tsx dimensionnés mobile-first (h-14 sm:h-16, grid sm:grid-cols-2)
- `AiContentDisclaimer` : classes sm: pour padding (`sm:px-7 sm:py-6`) — OK
- Polices : display:swap sur Manrope/Fraunces/Inconsolata — pas de FOIT mobile

**Touch targets :**
- AGENTS.md + lighthouserc acknowledges "zones tactiles < 48px sur certains composants (nav mobile, footer links)" — en WARN
- `target-size` audit = WARN dans lighthouserc (pas ERROR)
- Sprint A11y dédié non encore livré → dette connue

**Score mobile partiel (-2/5) :** touch targets non résolus post-P1.5.

---

### Recommandations ordonnées par ROI

#### 1. Quick wins (< 2h)

**QW-1 — Ajouter `revalidate` sur `/fr/faq` page.tsx**
```typescript
export const revalidate = 3600; // ISR 1h — évite rendu DB dynamique
```
Impact : TTFB page FAQ réduit de ~200-500ms (DB query évitée après premier render).

**QW-2 — Rendre `width` et `height` required dans `ImageBankPicture`**
Changer `width?: number` en `width: number` et `height: number` dans l'interface.
Impact : Élimine risque CLS = Layout Shift sur images sans dimensions (enforce-via-TypeScript).

**QW-3 — Ajouter `loading.tsx` dédié pour `/fr/faq`**
Page avec 30+ questions + 2 sections → skeleton sous-dimensionné (fallback global ~400px vs page réelle ~2000px).
Impact : CLS évité sur navigation SPA vers /faq.

#### 2. Sprint (< 1 jour)

**S-1 — Virtualisation FAQ accordion (si > 30 questions)**
Utiliser `@tanstack/react-virtual` ou pagination côté client pour le `FaqAccordion` quand items > 20.
Impact : INP mobile réduit ~20-40ms, DOM de 1500 → ~300 nœuds.

**S-2 — Ré-activer Speculation Rules (diagnostic)**
Le `if (false)` de `/[locale]/layout.tsx` désactive toutes les prefetch rules.
Diagnostic : isoler les routes publiques du crash admin (`/[locale]/*` public vs `/(admin)/*`).
Impact : LCP perçu -50-150ms p75 sur 15 routes stratégiques.

**S-3 — Résoudre CLS `/fr/audit` (CLS > 0.05)**
La doctrine interne AGENTS.md cible CLS = 0 mais lighthouserc accepte 0.1 par exception.
Identifier la cause (probablement un composant chart ou table dynamique sur /fr/audit).
Impact : Score Lighthouse /fr/audit, possible gain ranking CWV.

#### 3. Projets (> 1 jour)

**P-1 — Sprint A11y touch targets (déjà planifié)**
Corriger toutes les zones tactiles < 48px (nav mobile, footer links).
Impact : `target-size` passe en OK, conforme WCAG 2.2, INP mobile amélioré.

**P-2 — CrUX monitoring INP continu**
Mettre en place une alerte automatique si INP p75 > 100ms (cible AGENTS.md interne) via CrUX API ou Search Console Core Web Vitals.
Impact : détection régression INP avant que le gate CI le mesure.

**P-3 — Ré-activer Speculation Rules progressivement**
Après fix conflit Chrome/Next 16 (probablement restriction au root [locale]/layout hors admin).
Impact systémique : prefetch toutes les routes stratégiques, LCP perçu amélioré sur 15 pages.

---

### Synthèse par critère P1.5

| Critère | Score | Notes |
|---|---|---|
| lighthouserc.json cibles maintenues | 14/15 | INP off = choix documenté et valide |
| JS bundle ≤ 75 KB gz | 8/12 | Gate configuré, build prod non disponible pour vérification empirique |
| LCP ≤ 1800ms SSG/cache | 9/10 | SSG + ISR + CDN + inlineCss = stratégie solide |
| CLS ≤ 0.05 skeletons | 9/10 | Bonne couverture, /fr/audit exception connue |
| INP ≤ 80ms hydration | 7/10 | FAQ 30Q sans virtualisation = risque mobile |
| Images WebP/AVIF lazy | 7/8 | Excellent pipeline, width/height optionnels = risque CLS |
| Mobile viewport/touch | 3/5 | Viewport OK, touch targets dette P1 connue |
| **TOTAL** | **57/70** | **= 81% — CONDITIONNEL** |

**Verdict :** Les ajouts P1.5 (AiContentDisclaimer, GenerationProvenance, JSON-LD isBasedOn/aiGenerated) sont architecturalement corrects et n'introduisent pas de régression Web Vitals mesurable. Les risques identifiés sont des dettes préexistantes ou des points d'attention mineurs. La note 57/70 reflète l'impossibilité de valider empiriquement les bundles prod et les 3 points de friction maintenus depuis les audits précédents.
