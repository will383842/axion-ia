# DESIGN_RULES.md — Axion-IA Service & Ville Components

Rules for ALL components in src/components/services/_ and src/components/ville/_

## A. Typography hierarchy (strict)

- H1 (1×/page): text-3xl sm:text-4xl lg:text-5xl font-serif italic leading-tight font-semibold tracking-tight
- H2: text-2xl sm:text-3xl font-serif font-semibold mt-16 mb-6
- H3: text-xl font-serif font-medium mt-8 mb-4
- H4: text-lg font-semibold mt-6 mb-3
- Body: text-base lg:text-lg leading-relaxed max-w-prose
- Eyebrow: text-[13px] uppercase tracking-[0.18em] font-semibold

## B. Text/image balance

- No section > 60% text without visual break (image/icon/cards/divider)
- Cards: icon 24-32px + stat/badge + 2-3 lines max
- Methodology: horizontal timeline with Lucide icons, max 5 steps

## C. Spacing 8px grid

- Main sections: py-16 sm:py-20 lg:py-24
- Subsections: py-10 sm:py-12 lg:py-16
- Cards: p-6 sm:p-8
- Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Grid gaps: gap-6 sm:gap-8 lg:gap-12

## D. Colors (no hardcoded hex — use Tailwind tokens)

- bg-paper (white), text-ink (main text)
- bg-terracotta text-paper (CTA primary, banners)
- bg-sand/30 or border-ink/10 (cards subtle)
- hover:bg-ink/5 or hover:bg-terracotta/90
- focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2
- NEVER hardcode hex (#c24a1b etc.)
- NEVER use aggressive gradients

## E. Responsive mobile-first REQUIRED

- Mobile first: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
- Touch targets: minimum 44×44px (h-11 min on buttons)
- Font: fluid scaling via clamp or text-responsive classes
- Test ≤375px (iPhone SE) no horizontal scroll

## F. Animations (GPU-only, subtle)

- transition-colors duration-200 or transition-all duration-300 ease-out
- hover:scale-[1.02] max
- No continuous/looping animations (except marquee logos)
- No parallax (CLS killer)
- motion-reduce:transform-none motion-reduce:transition-none REQUIRED

## G. ARIA + A11y AAA target

- aria-label on every section (fr: French, en: English based on isFr)
- aria-labelledby pointing to H2 when applicable
- aria-hidden="true" on decorative Lucide icons
- role="article" on FAQ/testimonial cards
- Never <div onClick> — use <button> for keyboard nav
- Contrast 7:1 (AAA) for body text, 4.5:1 (AA) for large text
- Focus visible: ring 2px terracotta, never outline:none without replacement

## H. Cross-component consistency (DRY visual)

- All 5 service Heroes: same structure (eyebrow + H1 + lead 2 lines + 2 CTAs + visual)
- All TierGrids: same 1→2→4 cols, same card heights (min-h aligned)
- All Methodology: same timeline pattern
- All FAQs: same <details> accordion or FaqAccordion shared component
- All CTA blocks: bg-ink text-paper or bg-terracotta text-paper

## I. Server Components only (no 'use client' without justification)

## J. Imports

- Link: from "@/i18n/navigation" NOT next/link
- Pricing: from "@/content/pricing" ALWAYS (never hardcode prices)
- Speakable: use buildSpeakableSpecification helper
