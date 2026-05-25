# D3 — Images Audit Report
## Sprint A Ville DRY — Post-Sprint E2E Audit
**Date:** 2026-05-25  
**Scope:** `src/components/services/**`, `src/components/ville/**`, `src/app/[locale]/implantations/**`  
**Auditor:** AUDIT AGENT D-3 (read-only)

---

## Executive Summary

| Metric | Value |
|---|---|
| Next.js `<Image>` components found (Sprint A scope) | 3 distinct usages |
| Raw `<img>` tags (Sprint A scope) | 2 (both justified) |
| `<img>` with missing alt | 0 — **100% alt coverage** |
| `<img>` with missing width/height (CLS risk) | 0 |
| `<Image>` with missing alt | 0 |
| LCP images with `priority` prop | Partial — see findings |
| `next.config.ts` image domains | 1 (images.unsplash.com) — trusted |
| Public PNG/JPG files | 10 |
| Public WebP/AVIF files | 336 |
| Large unoptimized images > 500 KB | 4 (PNG source files — see P1) |
| SVG logos | 23 (in `public/logos/`) |

**Overall verdict: GOOD — No P0 blockers. 2 P1 items, 2 WARN items.**

---

## 1. Next.js `<Image>` Usage — Sprint A Components

### 1.1 `src/components/ville/CaseStudyMarquee.tsx`

**Status: WARN (minor)**

```tsx
// lightboxEnabled=false branch
<Image
  src={demo.src}
  alt={isFr ? demo.altFr : demo.altEn}
  width={1280}
  height={720}
  sizes="(max-width: 640px) 220px, (max-width: 768px) 260px, 280px"
  loading="lazy"    // <-- redundant
  decoding="async"  // <-- redundant with next/image
  className="h-full w-full object-cover"
/>
```

- **alt**: PRESENT — bilingual `altFr`/`altEn` in `CaseStudyImage` interface. Correct.
- **width + height**: PRESENT — 1280×720. CLS = 0. Correct.
- **priority**: ABSENT — acceptable. Carousel is not the LCP element on these pages.
- **sizes**: PRESENT — `220px/260px/280px` breakpoints. Correct (matches rendered widths).
- **loading="lazy"**: REDUNDANT. Next.js `<Image>` applies lazy loading automatically for non-priority images. Not a bug — just unnecessary boilerplate. Does not cause CLS or performance regression.
- **decoding="async"**: REDUNDANT for same reason. Next.js manages this internally.

**Recommendation (P2 — cosmetic):** Remove `loading="lazy"` and `decoding="async"` from the `<Image>` component call (not the `<img>` call). Next.js handles this. Reduces confusion for future maintainers.

### 1.2 `src/components/ui/ImageLightbox.tsx` (used by CaseStudyMarquee lightboxEnabled=true branch)

**Status: OK**

- Thumbnail `<Image>`: alt/width/height via props, `loading="lazy"` (redundant but harmless), `sizes` present.
- Modal fullscreen `<Image>`: has `priority` (correct — image IS above fold when modal is open), `sizes="100vw"`, alt/width/height forwarded.
- The `alt` prop is required and non-optional in the interface.

### 1.3 `src/components/visual/Illustration.tsx` (used in service pages)

**Status: OK — Well-designed wrapper**

```tsx
<Image
  src={src}
  alt={alt}          // required prop
  width={width}      // derived from aspectRatio map
  height={height}    // derived from aspectRatio map
  priority={priority} // forwarded from props
  sizes={sizes ?? defaultSizes[aspectRatio]} // sensible defaults per ratio
  className="h-auto w-full"
/>
```

- `alt` is a required prop in `IllustrationProps`. Good.
- `priority` is exposed and forwarded. Hero usage (above-fold) can set `priority={true}`.
- `sizes` defaults are appropriate per aspect ratio (`16:9` → 1200px max, etc.).
- No issues.

---

## 2. Raw `<img>` Tags — Sprint A Scope

### 2.1 `src/components/ville/AiToolsStack.tsx` — SVG logos

**Status: OK — Justified use of raw `<img>`**

```tsx
/* eslint-disable @next/next/no-img-element -- SVG icons... */
<img
  src={tool.logo}           // e.g. "/logos/ai-tools/anthropic.svg"
  alt={`Logo de ${tool.name}`}  // PRESENT — descriptive
  width={28}
  height={28}               // PRESENT — CLS = 0
  loading="lazy"            // CORRECT for raw <img>
  decoding="async"          // CORRECT for raw <img>
  className="h-7 w-7 object-contain"
/>
```

**Justification (documented in file header):** `next/image` blocks SVG sources by default unless `dangerouslyAllowSVG: true` is set in `next.config.ts`. Using raw `<img>` for static SVG logos is the correct pattern here. The `eslint-disable` comment is present and justified.

- **alt**: PRESENT — `"Logo de {name}"` (French). No EN variant needed — logos are labelled in context by `<figcaption class="sr-only">`. Acceptable.
- **width/height**: PRESENT (28×28). CLS = 0.
- **loading/decoding**: Correctly set on native `<img>` (not redundant here unlike with `next/image`).

### 2.2 `src/components/knowledge/public/AuthorByline.tsx` — author avatar

**Status: OK — Justified use of raw `<img>`**

```tsx
/* eslint-disable @next/next/no-img-element */
<img
  src={authorAvatarUrl}                          // remote DB URL
  alt={isFr ? `Portrait de ${authorName}` : `Portrait of ${authorName}`}  // PRESENT bilingual
  width={56}
  height={56}                                     // PRESENT — CLS = 0
  loading="lazy"
  decoding="async"
/>
```

**Justification (documented in file):** `authorAvatarUrl` is an arbitrary remote URL from DB. `next.config.ts` `remotePatterns` only whitelists `images.unsplash.com`, not author avatar domains. Using `next/image` would require broadening `remotePatterns` (security concern) or using a wildcard.

- **alt**: PRESENT — bilingual descriptive text. Correct.
- **width/height**: PRESENT (56×56). CLS = 0.
- Not an LCP element; `loading="lazy"` is correct.

---

## 3. `next.config.ts` Image Configuration

```typescript
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    { protocol: "https", hostname: "images.unsplash.com" },
  ],
  minimumCacheTTL: 31536000,  // 1 year — correct for hashed URLs
}
```

**Analysis:**

- **formats**: AVIF + WebP — optimal for 2026 (AVIF first = best compression; WebP fallback).
- **remotePatterns**: Only `images.unsplash.com` is whitelisted. This is **trusted** (Unsplash CDN for testimonial portraits on home page). No overly broad patterns (`**` wildcards, etc.).
- **minimumCacheTTL = 31536000 (1 year)**: Correct for `next/image` optimized images whose URLs include content hashes. Documented rationale in config (Hetzner VPS I/O optimization).
- **dangerouslyAllowSVG**: NOT set. Correct — SVG optimization is handled via raw `<img>` with justified `eslint-disable` comments.

**Verdict: GOOD — No security concerns.**

---

## 4. LCP Image Handling

### Pages using Sprint A components (implantations routes)

The hero sections of all 5 service verticales (`AuditHero`, `InterventionsHero`, `ImplementationHero`, `UnAUnHero`, `SitesWebHero`) use **`ServiceHero`** or their own hero layout.

**Key finding:** None of the Sprint A service hero components (`src/components/services/*/`) use any `<Image>` component. Hero sections use:
- SVG `ImplementationHeroSchema` (orbital diagram — no bitmap)
- CSS `backgroundImage: "linear-gradient(...)"` for decorative grid overlay
- Text-only content

**This means: There is NO LCP image in the Sprint A service hero components.** The LCP element on these pages is likely the H1 text, which is optimal (text LCP loads fast and does not require `priority` hints).

**Verdict: NO P0. No LCP images missing `priority` in Sprint A components.**

### `src/components/visual/Illustration.tsx`

This wrapper **does expose `priority` prop** and correctly forwards it. Any Sprint A component that uses `<Illustration priority>` will correctly trigger LCP preload. Currently no Sprint A service components use `<Illustration>` (they use SVG orbital diagrams).

---

## 5. Public Directory Image Inventory

### Raster files (PNG/JPG)

| File | Size | Notes |
|---|---|---|
| `public/illustrations/home-hero-equipe.png` | **2,366 KB** | P1 — source PNG; WebP/AVIF equiv should be used |
| `public/images/axion-ia-architecture-groupe-international-*.png` | **1,848 KB** | P1 — source PNG; webp/avif variants exist |
| `public/illustrations/home-bandeau-team.png` | **1,587 KB** | P1 — source PNG |
| `public/auteurs/manon.png` | **1,513 KB** | P1 — author portrait, large |
| `public/images/axion-ia-pipeline-lead-ia-*.png` | **1,337 KB** | P1 — source PNG |
| `public/images/axion-ia-planning-chantier-gantt-ia-*.png` | **1,266 KB** | P1 — source PNG |
| `public/images/axion-ia-recrutement-ia-*.png` | **1,141 KB** | P1 — source PNG |
| `public/images/axion-ia-fondateur-williams-jullin-*.jpg` | **459 KB** | Below 500 KB threshold |
| `public/illustrations/home-founder-william.jpg` | **459 KB** | Below 500 KB threshold |
| `public/images/logo.png` | **91 KB** | OK |

**Total PNG/JPG count: 10**  
**PNG/JPG > 500 KB: 7 files** — all are source/source-equivalent files. WebP/AVIF variants exist for `public/images/` files (336 WebP/AVIF files in `public/`).

**Context:** The large PNGs in `public/illustrations/` and `public/auteurs/` are likely source files or fallback formats. Next.js `<Image>` automatically serves WebP/AVIF when the `formats` config includes them. The PNGs themselves are not directly served to modern browsers when routed through `next/image`.

### P1 findings

**P1-1:** `public/auteurs/manon.png` (1.5 MB) — If this portrait is served directly (e.g., via `<img src="/auteurs/manon.png">` without `next/image` optimization), it would be unoptimized. Check: `src/components/sections/TeamGrid.tsx` imports `next/image` and likely uses this file via the optimizer.

**P1-2:** `public/illustrations/home-hero-equipe.png` (2.3 MB) and `home-bandeau-team.png` (1.6 MB) — Same concern. These illustrations should be served through `next/image` with `formats: ["image/avif", "image/webp"]` to avoid large payload.

**Note:** These PNG files are **outside the Sprint A scope** (they belong to the home page). No Sprint A components reference these files directly.

### WebP/AVIF (336 files)

The `public/images/` directory has comprehensive WebP and AVIF variants for all marketing images. This is correctly aligned with the `next.config.ts` `formats: ["image/avif", "image/webp"]` configuration.

---

## 6. SVG Usage

### `public/logos/` (23 SVG files)

- **Client logos** (`public/logos/clients/`): 16 SVG files (Leclerc, Intermarché, AXA, etc.)
- **AI tool logos** (`public/logos/ai-tools/`): 7 SVG files (Anthropic, OpenAI, Gemini, etc.)

**Usage pattern:** `AiToolsStack.tsx` uses `<img src="/logos/ai-tools/*.svg">` with `width/height` and `loading="lazy"`. Correct pattern for SVG logos.

Client logos usage is in `src/components/home/LogosMarquee.tsx` (out of Sprint A scope). The comment in that file indicates `<img>` with alt texts is used — consistent with the SVG-as-img pattern.

**Verdict: GOOD — SVG logos are correctly served as static assets via `<img>`, not `next/image`.**

---

## 7. `CaseStudyMarquee` — P1 Note on `priority`

The `CaseStudyMarquee` component is a horizontal carousel that may appear early on ville pages. Its items are duplicated (`items × 2`) for the loop animation. If this carousel appears **above the fold** on any page, the first visible image should have `priority={true}`.

**Current state:** No `priority` is set on any `CaseStudyMarquee` images. The component does not expose a `priority` prop.

**Assessment:** Looking at the page assembly in `[ville]/page.tsx` and `[ville]/[verticale]/page.tsx`, `CaseStudyMarquee` is **not actually used** in the Sprint A implantations pages. It is defined in `src/components/ville/` but not imported/rendered in the page dispatchers reviewed. This reduces the risk.

**If `CaseStudyMarquee` is added to a ville page hero area in future:** Add a `priority` prop to the component and pass it to the first image (index 0 of `items`, not `tracks`).

---

## 8. Summary of Findings by Severity

### P0 — Blocking (must fix before production)
*None found.*

### P1 — Important (fix before next sprint)

| ID | Finding | Location | Effort |
|---|---|---|---|
| P1-1 | 7 PNG/JPG source files > 500 KB in `public/` (largest: 2.3 MB) | `public/illustrations/`, `public/auteurs/` | Verify these are only served via `next/image`; if served directly (og-image fallback, etc.), add WebP/AVIF conversions |
| P1-2 | `CaseStudyMarquee` has no `priority` prop — if used above fold, LCP image will not preload | `src/components/ville/CaseStudyMarquee.tsx` | Add `priority?: boolean` prop; pass to `index === 0 && priority` on first Image |

### WARN — Minor / Cosmetic

| ID | Finding | Location | Effort |
|---|---|---|---|
| W-1 | `loading="lazy"` and `decoding="async"` are redundant on `next/image <Image>` component | `CaseStudyMarquee.tsx` (line 103), `ImageLightbox.tsx` (line 69) | Remove 2 redundant props — cosmetic only, no perf impact |
| W-2 | `AiToolsStack.tsx` alt text for SVG logos is FR-only (`"Logo de {name}"`) — EN locale sees same FR string | `AiToolsStack.tsx` (line 126) | Add bilingual alt: `isFr ? "Logo de ${name}" : "${name} logo"` — minor a11y improvement for EN users |

### OK — No Issues

- All `<img>` tags have `alt` attributes (100% coverage)
- All image elements have `width`/`height` or `fill` (CLS = 0 for Sprint A components)
- `next.config.ts` `remotePatterns` limited to trusted `images.unsplash.com`
- `formats: ["image/avif", "image/webp"]` correctly configured
- `minimumCacheTTL: 31536000` correctly set for CDN efficiency
- `Illustration.tsx` wrapper is well-designed with sensible `priority`/`sizes` defaults
- `AuthorByline.tsx` and `AiToolsStack.tsx` raw `<img>` usage is correctly documented and justified

---

## 9. Alt Coverage Score

| Category | Count | With Alt | Alt Coverage |
|---|---|---|---|
| `next/image <Image>` (Sprint A ville+service scope) | 3 usages | 3 | **100%** |
| Raw `<img>` (Sprint A ville+service scope) | 2 | 2 | **100%** |
| SVG logos via `<img>` | 6 per render (AiToolsStack) | 6 | **100%** |
| **Total Sprint A scope** | **11** | **11** | **100%** |

---

## 10. next/image vs raw `<img>` Decision Audit

| Component | Tag | Reason | Justified? |
|---|---|---|---|
| `AiToolsStack` | `<img>` | SVG source; `next/image` blocks SVG without `dangerouslyAllowSVG` | YES — documented with eslint-disable comment |
| `AuthorByline` | `<img>` | Remote URL from DB; `remotePatterns` doesn't whitelist author CDN | YES — documented with eslint-disable comment |
| `ImageBankPicture` | `<img>` (inside `<picture>`) | Custom AVIF+WebP srcset pipeline; `next/image` would override srcset control | YES — correct HTML5 `<picture>` pattern with full variant control |
| `CaseStudyMarquee` | `<Image>` | Bitmap images from sprint case studies; remote or local paths | YES — correct use of `next/image` |
| `ImageLightbox` | `<Image>` | Bitmap images for lightbox; needs quality control | YES — correct |
| `Illustration` | `<Image>` | Standard bitmap illustration wrapper | YES — correct |
