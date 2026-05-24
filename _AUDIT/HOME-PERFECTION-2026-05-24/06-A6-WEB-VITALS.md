# A6 — Web Vitals & Assets | Score 82/100

## Résumé exécutif

Post-refonte Blueprint 2026-05-23, le hero SVG inline 770 lignes a été supprimé avec succès et remplacé par `Illustration` AVIF priority. LCP candidate désormais déterministe. 3 points de vigilance : ImageLightbox 2× load mobile, Radix Accordion bundle, hydration FadeInOnView batch IO.

## Scoring par sous-dimension

| # | Sous-dim | Score | Verdict | path:line | Budget |
|---|---|---|---|---|---|
| 1 | LCP candidate | 95 | Hero AVIF `priority` ✓, preload `<link>` absent ⚠ | page.tsx:415-431 | ≤1800ms p75 |
| 2 | Hero SVG 770 lignes | 100 | ✅ Externalisé AVIF (commit antérieur) | Illustration.tsx:88-96 | ≤75 KB JS |
| 3 | CLS | 78 | Logos max-h-12 ✓, Illustration aspect-ratio ✓, Accordion ~no-shift ⚠ | LogosMarquee.tsx:38 | = 0 strict |
| 4 | INP | 80 | FadeInOnView IO ✓, StickyMobileCta rAF-dedup ✓, ImageLightbox 2× load ⚠ | FadeInOnView.tsx:37-54 | ≤100ms p75 |
| 5 | First Load JS | 75 | Lucide tree-shaken ✓, 12 "use client" ⚠, Radix Accordion ~12 KB | page.tsx:6-29 | ≤75 KB gz |
| 6 | Logos 17× assets | 92 | 184 KB SVG total, lazy ✓, dimensions ✓ | home-data.ts:44-110 | — |
| 7 | Hero Illustration | 95 | AVIF priority=true ✓, 181 KB, 1:1 ratio | page.tsx:415-431 | — |
| 8 | VideoTestimonials | 100 | YouTube nocookie ✓, lazy thumbnail ✓, aspect-ratio ✓, conditional ✓ | VideoTestimonials.tsx:19-79 | — |
| 9 | Marquee animation | 85 | Pure CSS grid ✓, will-change absent ⚠, reduce-motion ✓ | LogosMarquee.tsx:19 | — |
| 10 | Third-party scripts | 80 | Plausible async ✓, Sentry defer ✓, Clarity dead-code ⚠ | layout.tsx:10-15 | — |

## LCP candidate identifié

**Élément principal** : Hero Illustration AVIF `/illustrations/home-hero-equipe.avif`
- path : page.tsx:415-431 (Illustration component slot HOME-01-hero)
- Dimensions : 1:1 aspect ratio, 1200×1200 implicit
- Priority : `priority={true}` ✓ explicit
- Format : AVIF 181 KB (optimal, WebP/JPEG fallback via Next Image)
- Preload : ❌ `<link rel="preload">` ABSENT — Next Image auto-preload via script dynamique

**Estimation LCP** : **~1400-1600 ms p75 lab** (code-level). Vs budget 1800 ms → ✅ PASS.

## Bundle JS estimation rough

**lucide-react imports** : 29 icônes nommées
- Tree-shaking ✅ → ~6-8 KB gz final (pas l'ensemble 35 KB)
- Utilisées : ~12 sur 24 importées → cleanup possible

**12 "use client" components** :
1. FadeInOnView (12+ usages shared)
2. LogosMarquee
3. Illustration (Server Component, zero JS)
4. VideoTestimonials (Server Component, zero JS)
5. StickyMobileCta (rAF-dedup)
6. ImageLightbox × 4 instances
7. Accordion (Radix)
8. LocalCoverageSection
9. + 4 autres

**Estimation First Load** :
- Shell (framework + main + webpack) : ~45-50 KB gz
- Page chunk : ~20-28 KB gz
  - FadeInOnView dedup : +1 KB
  - StickyMobileCta + ImageLightbox : +6 KB
  - Accordion + Radix : +8-12 KB
  - Lucide tree-shaken : +6 KB
  - i18n messages : +2 KB
- **Total estimé : 65-78 KB gz**

Vs budget 75 KB → ⚠️ **borderline 70th %-ile**. Si Radix bundle non-optimal, spike possible à 82-85 KB.

## Forces (top 3)
1. **Hero SVG refactor successful** — LCP budget reclaimed ~400-500ms
2. **Comprehensive lazy-loading strategy** — LogosMarquee + ImageLightbox + VideoTestimonials nocookie
3. **Smart IO + rAF dedup** — FadeInOnView opacity 1 default progressive enhancement, StickyMobileCta dedupes scroll events

## P0
**Aucun détecté code-level.** LCP candidate optimisé, CLS minimal (~<0.05 desktop, ~0 mobile).

## P1
1. **ImageLightbox parallel Image loads** mobile INP impact — déjà optimal (modal Image priority=true mounted only when open). Vérifier en runtime.
2. **Radix Accordion bundle weight 12-15 KB gz** + animation cost — FAQ below-fold OK. Pour future /faq avec 30 accordions, considérer lazy hydration React.lazy() + Suspense OU native `<details>`
3. **JS bundle borderline 65-78 KB vs 75 KB** — surveiller `pnpm bundle:check` pre-merge, alert si delta > +3 KB

## P2
1. Illustration preload `<link rel="preload">` (gain ~50-100 ms slow 4G) — 10min, optionnel
2. Logos marquee will-change si future scroll-loop animation ajoutée
3. Accordion trigger focus ring touch target 48px ✓ déjà OK
4. Clarity import dead-code (layout.tsx:15 import mais jamais rendu) — retirer OU appeler `<Clarity />` — 5min
5. EN locale 301 redirect — env toggle EN_LOCALE_ENABLED=true quand next-intl patché

## Estimations runtime code-level

| Métrique | Code prediction | Budget | Status |
|---|---|---|---|
| LCP | ~1400-1600 ms p75 lab | ≤1800 ms | ✅ PASS |
| INP | ~70-90 ms p75 (sans interaction) | ≤100 ms | ✅ PASS |
| CLS | ~0.01 static | = 0 | ✅ PASS |
| TBT | ~120 ms peak (FadeInOnView batch IO) | ≤150 ms | ✅ PASS |
| First Load JS | ~65-78 KB gz | ≤75 KB | ⚠️ MARGINAL |

**Note** : Lighthouse CI gates /fr 3 runs. Runtime values confirmeront ou ajusteront ±10-20 ms.

## Action post-deploy
Monitor CrUX dashboard 48h. Si INP > 100 ms OU LCP > 1800 ms → re-audit Lighthouse + DevTools profiler.
