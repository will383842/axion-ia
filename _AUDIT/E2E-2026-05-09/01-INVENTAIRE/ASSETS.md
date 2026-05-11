# 01-INVENTAIRE — ASSETS

## `public/`

```
file.svg     (~1 KB)
globe.svg    (~1 KB)
next.svg     (~1 KB)
press-kit/   (sous-dossier)
vercel.svg   (~1 KB)
window.svg   (~1 KB)
```

**Total `public/` : 19 KB.**

→ ⚠️ Minimal. La majorité des SVGs hero/illustrations sont **inlinés** dans les composants `src/components/visual/` + `src/components/sections/HeroSchema*` (cf. mémoire `axionia_visual_rhythm_sprint_AB_2026-05-07`).

## Fonts (`next/font`)

`src/app/layout.tsx` ou `src/app/[locale]/layout.tsx` utilise `next/font/google` ou `next/font/local`. À confirmer AGT-03 (poids fonts dans bundle).

## Favicons + manifest

- `src/app/icon.tsx`, `src/app/apple-icon.tsx` (Next 13+ metadata routes)
- `src/app/manifest.ts` (PWA basique)

## OG default + per-page

- `src/app/opengraph-image.tsx` (root default)
- Possiblement per-route OG dynamic (AGT-04 confirme).
- ⚠️ Memory `axionia_bugs_seo_preexistants_2026-05-09` flag : `og:image` pointe `localhost:3000` en prod ; statut à re-confirmer Phase 4.

## Logo

- `m_horizontal_white_2.png` (logo blanc Header terracotta) — doctrine § 0.1. Présent dans `public/press-kit/` ou inline dans composant Header (à vérifier).

## Citations

- `public/` listing direct (5 SVG + 1 sous-dossier)
- `src/components/sections/Hero*` (SVG inline)
- Memory `axionia_visual_rhythm_sprint_AB_2026-05-07` (Hero schema React SVG + ~10 illustrations GPT-image)
