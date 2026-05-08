# Annexe E — Performance / Core Web Vitals

**Source** : AGT-PERF + agent main (chap 18 + 22)

## Mesures bundle (build OK — Next 16.2.4 Turbopack)

| Métrique                                           | Cible              | Mesuré                                                           | OK                              |
| -------------------------------------------------- | ------------------ | ---------------------------------------------------------------- | ------------------------------- |
| `pnpm build` succès                                | 0 erreur 0 warning | ✅ exit 0, ~80 s                                                 | ✅                              |
| `pnpm typecheck`                                   | 0 erreur           | ✅ TS strict++ vert                                              | ✅                              |
| `pnpm lint`                                        | 0 erreur           | 0 erreur, 6 warnings (RHF watch + aria-pressed)                  | ⚠️                              |
| **Root main JS gzip** (rootMainFiles 5 fichiers)   | ≤ 100 KB           | **~197 KB gzip / ~661 KB brut**                                  | ❌ **P0**                       |
| Polyfills additionnels                             | indicatif          | 39 KB gzip / 110 KB brut (legacy targets)                        | —                               |
| **CSS total**                                      | ≤ 50 KB brut       | 49,77 KB brut / 9 KB gzip                                        | ⚠️ marge 0,2 KB (P2)            |
| **Fonts woff2** (Manrope 4 graisses + Inconsolata) | ≤ 100 KB           | **135 KB total**                                                 | ❌ P1                           |
| `display: swap` fonts                              | requis             | OUI (2/2)                                                        | ✅                              |
| `next/font` variable + preload                     | requis             | OUI (subsets latin, CSS variables)                               | ✅                              |
| `.next/static/chunks/` total                       | < 2 MB             | 1.5 MB                                                           | ✅                              |
| Plus gros chunk individuel                         | < 200 KB           | 447 KB (`0_ar.t5ci8lru.js` = React DOM + Next runtime)           | ❌ P1                           |
| Headers sécurité                                   | A+ scan            | X-Frame DENY · CTO nosniff · Referrer · Permissions · HSTS 2 ans | ⚠️ **CSP manquant** (Sprint 16) |
| `next.config.ts` images formats                    | AVIF + WebP        | `["image/avif", "image/webp"]`                                   | ✅                              |

> **Note méthodo** : Next 16.2.4 Turbopack ne publie plus `app-build-manifest.json` ni le tableau classique « First Load JS ». Le routage chunk-par-page n'est pas inspectable statiquement. Mesure réelle « first load par route produit » bloquée tant que `pnpm bundle:check` ne tourne pas (cf. PERF-005).

## Détails par axe (1-14)

| #   | Axe                                              | Statut                                                              |
| --- | ------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Bundle JS first load ≤ 100 KB / route            | ❌ P0 (root main 197 KB gzip déjà partagé sur toutes routes)        |
| 2   | `pnpm bundle:check` (size-limit)                 | ❌ P1 (puppeteer Chrome timeout)                                    |
| 3   | CSS ≤ 50 KB                                      | ⚠️ marge 0,2 KB                                                     |
| 4   | Fonts ≤ 100 KB woff2                             | ❌ P1 (135 KB ; Manrope 4 graisses)                                 |
| 5   | LCP image `fetchPriority="high"`                 | n/a (Hero textuel sans image)                                       |
| 6   | Below-fold `loading="lazy"` + `decoding="async"` | n/a (1 seul `<img>` TeamGrid, déjà tracké Sprint 5)                 |
| 7   | PPR (Partial Prerendering)                       | ❌ P1 (`experimental.ppr` non activé)                               |
| 8   | React Compiler activé                            | ❌ P1 (`experimental.reactCompiler` non activé)                     |
| 9   | View Transitions activées                        | ❌ P2 (aucun usage)                                                 |
| 10  | Speculation Rules eagerness moderate             | ❌ P2 (aucun script speculationrules)                               |
| 11  | RUM web-vitals beacon                            | ❌ **P0** (`/api/vitals` endpoint EXISTE mais aucun client appelle) |
| 12  | next/image AVIF/WebP                             | ✅ config OK                                                        |
| 13  | Sentry overhead                                  | ⚠️ P1 (~50 KB gzip injectés dès qu'un DSN est défini)               |
| 14  | Anti-SPA `'use client'` justifiés                | ✅ 26 occurrences toutes justifiées                                 |

## `next.config.ts` — flags experimental

```ts
experimental: {
  // Next.js 16 — flags revisited in later sprints after deeper docs read.
}
```

**Tous les flags experimental Next 16 sont DÉSACTIVÉS** (note Sprint 0 « reportés Sprint 1 ») :

- ❌ `reactCompiler`
- ❌ `viewTransition` / `unstable_ViewTransition`
- ❌ `useCache`
- ❌ `ppr` (Partial Prerendering)
- ❌ Speculation Rules

## Findings P0 (2)

**PERF-001 · Root main JS ~197 KB gzip > 100 KB cible**

- Cause probable : `next-intl` + Radix wrappers complets + `motion` (Framer) + `react-hook-form` + `zod` + Sentry + TanStack Query embarqués dans le shared chunk.
- Borne basse 197 KB gzip partagé sur **toutes** les routes → quasi certain de dépasser 100 KB par route.
- **Action** : split par route, lazy-load `motion`, lazy-load Radix non-above-fold, audit `@vercel/og` côté client. Viser ≤ 130 KB gzip puis ≤ 100 KB.
- **Effort** : ~6 h (à ouvrir Sprint 17/18 ou polish post-S14).

**PERF-002 · RUM web-vitals NON câblé côté client**

- `/api/vitals` (Edge) **présent et fonctionnel**, `web-vitals@5.2.0` installé, **mais rien n'appelle** `onCLS/onLCP/onINP/onFCP/onTTFB` ni `useReportWebVitals`.
- Aucun signal terrain ne remonte aujourd'hui → l'objectif Sprint 14 RUM est inopérant.
- **Action** : ajouter un Client component minimal qui POSTe vers `/api/vitals` via `navigator.sendBeacon`.
- **Effort** : ~1 h.

## Findings P1 (5)

| ID           | Titre                                                                                                                           | Effort          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **PERF-003** | `experimental.ppr` non activé — gain TTFB important sur pages mixtes statique/dynamique                                         | ~2 h test       |
| **PERF-004** | React Compiler non activé — bénéfice perf gratuit sur React 19.2 (`experimental.reactCompiler: true`)                           | ~2 h test       |
| **PERF-005** | Fonts woff2 = 135 KB > 100 KB. Réduire Manrope à 2 graisses (400, 600) au lieu de 4                                             | ~30 min, -50 KB |
| **PERF-006** | `pnpm bundle:check` puppeteer Chrome timeout — downgrader `@size-limit/preset-small-lib` ou fournir Chrome local                | ~1 h            |
| **PERF-007** | Sentry runtime client injecté inconditionnellement (~50 KB gzip si DSN défini) — envisager bundle conditionnel ou `tunnelRoute` | ~2 h            |

## Findings P2 (4)

| ID       | Titre                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| PERF-008 | CSS à 49,77 KB / 50 KB — marge 0,2 KB, surveiller chaque ajout                   |
| PERF-009 | `<img>` direct dans `TeamGrid.tsx` (déjà commenté Sprint 5 polish)               |
| PERF-010 | View Transitions API non utilisée — bonus UX/perf perçue à activer (Sprint 17)   |
| PERF-011 | Speculation Rules non injectées — pré-rendu prochaine page sur hover (Sprint 17) |

## Findings P3 (1)

PERF-012 · Anti-`'use client'` clean (26 occurrences toutes justifiées, aucune dans `app/**/page.tsx`).

## À mesurer Sprint 21 (runtime — non faisables ici)

1. **Lighthouse mobile** ≥ 95 sur 30 URLs (perf/SEO/a11y/best-practices).
2. **Lighthouse desktop** ≥ 98 sur 10 URLs critiques.
3. **CWV terrain** : LCP / INP / CLS / TTFB / FCP / TBT via beacon (post-PERF-002 fix).
4. **`ANALYZE=true pnpm build`** + bundle analyzer HTML — identifier top contributors `0_ar.t…` chunk.
5. **`pnpm bundle:check`** réparé en CI.
6. **securityheaders.com** scan A+ post-CSP (Sprint 16).
7. **Network throttling slow 3G** test.
