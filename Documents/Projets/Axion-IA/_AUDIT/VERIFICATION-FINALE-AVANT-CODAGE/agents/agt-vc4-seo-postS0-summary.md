# AGT-VC4 Post-S0 — SEO/AEO/GEO Summary

**Score** : 80.5 → **87/100** (+6.5) — **Verdict** : 🟢 GO

## Fixes confirmés

| Fix | Statut | Source |
|---|---|---|
| /sitemap.xml 404 → 301 redirect | ✅ FIXED | `axionia/next.config.ts:129-139` |
| og:image SITE_URL force prod fallback | ✅ FIXED | `axionia/src/lib/seo.ts:19-23` |
| Twitter handle Manon retiré | ✅ DONE | master prompt × 4 ancrages |
| Photo Manon IA disclosed + 4 disclaimers | ✅ DONE | seed `manon-profile.md` § 2 |
| Anti-AI signals § 9.6.6 | ✅ SPEC STABLE | implémentation Sprint 1 Day 3 |
| Google Indexing API V1 | ✅ COHERENT | grey-area accepté Will |

## P1 résiduels (Sprint 1)

- buildPersonJsonLd() Manon guard `sameAs:[]` — 2 h
- Photo disclaimers UI (AuthorByline/Card/page) — 2 h
- pnpm sitemap:validate XSD — 1 h (Sprint 5)

Aucun bloqueur Sprint 1.
