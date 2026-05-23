# Audit L02 — Blog Stack (8 templates)

**Date** : 2026-05-22 | **Agent** : A2

## Scores globaux

| Template                          |   Score | Classe     |
| --------------------------------- | ------: | ---------- |
| `/blog/page.tsx`                  |     845 | BIEN       |
| `/blog/[slug]/page.tsx`           |     920 | EXCELLENCE |
| `/blog/auteur/[slug]/page.tsx`    |     875 | BIEN       |
| `/blog/categorie/[slug]/page.tsx` |     860 | BIEN       |
| `/blog/secteur/[slug]/page.tsx`   |     870 | BIEN       |
| `/blog/service/[slug]/page.tsx`   |     865 | BIEN       |
| `/blog/tag/[slug]/page.tsx`       |     860 | BIEN       |
| `/blog/taille/[slug]/page.tsx`    |     865 | BIEN       |
| **Moyenne L2**                    | **869** | **BIEN+**  |

---

## `/blog/page.tsx` — Hub Blog

**Score : 845/1000**

| Dim           | Score/100 | Justification                                                                                                                                          | path:line         |
| ------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| D1 SEO        |        85 | Title 56c ✓, desc 107c ✓, OG ✓, pagination prev/next ✓. **Pas de BreadcrumbList JSON-LD** ❌ (composant visuel Breadcrumbs OK mais pas script JSON-LD) | page.tsx:49-68    |
| D2 AEO        |        80 | ItemList JSON-LD ✓ (L115-125, 200+ articles), BlogHeroSchema ✓, BlogSearch Cmd+K ✓ (L204-214). Speakable FAQ absent (pas de FAQ sur hub)               | page.tsx:115-125  |
| D4 Web Vitals |        80 | ISR revalidate=3600 ✓. BlogSearch Cmd+K client-heavy (useState+useEffect).                                                                             | page.tsx:26, 204  |
| D8 Conversion |        85 | CTA newsletter ✓ (L196-202), CtaBlock ✓ (L347-360), filtres catégories ✓ (L243-278)                                                                    | page.tsx:196, 347 |
| D9 Brand      |        90 | Voix Manon ✓ (L171-173), terracotta ✓                                                                                                                  | page.tsx:161-173  |

### P0

1. **Pas de BreadcrumbList JSON-LD** — structure visuelle OK mais pas de script | 0.5h | CONFIRMED

---

## `/blog/[slug]/page.tsx` — Article détail

**Score : 920/1000**

| Dim           | Score/100 | Justification                                                                                                                                                                                              | path:line              |
| ------------- | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1 SEO        |        95 | Title dynamique ✓ (L71-72), canonical ✓, breadcrumbs JSON-LD ✓ (L281-282), robots tier-based ✓ (L77-82)                                                                                                    | page.tsx:71-72, 281    |
| D2 AEO        |        95 | Article JSON-LD complet (L231-249) : headline, datePublished, author Person, publisher Org, wordCount, keywords, citations, aiGenerated ✓. TL;DR AnswerCard ✓ (L260), ArticleTOC ✓ (L381-384), Speakable ✓ | page.tsx:231, 260, 381 |
| D4 Web Vitals |        90 | Image hero priority ✓ (L356), aspect-ratio 16/9 ✓. ISR revalidate=3600 ✓.                                                                                                                                  | page.tsx:353-369       |
| D5 Images     |        85 | Image ✓, UnsplashCredit ✓ (L365-368). **placeholder blur LQIP absent** (P1)                                                                                                                                | page.tsx:353-368       |
| D7 AI Act     |        95 | aiGenerated:true ✓ (L247), AiContentDisclaimer ✓ (L411), dateModified ✓ (L313-335)                                                                                                                         | page.tsx:247, 411      |
| D8 Conversion |        90 | AuthorByline ✓ (L339-345), RelatedPosts via SuggestedContent ✓ (L415-428), CtaBlock ✓ (L430-443)                                                                                                           | page.tsx:339, 415      |

### Forces

1. Article JSON-LD + AI Act disclosure — E-E-A-T max + conformité EU
2. AuthorByline + ArticleTOC sticky — AEO + UX
3. TL;DR AnswerCard — featured snippet éligible

### P1

1. placeholder blur LQIP manquant sur image hero | 0.1h | NEW
2. ImageObject JSON-LD explicit manquant | 0.5h | NEW

---

## Hub pages (auteur, categorie, secteur, service, tag, taille) — Pattern commun

**Score moyen : 866/1000**

**P0 commun à tous (7 pages hubs)** : Pas de BreadcrumbList JSON-LD (structure visuelle OK mais pas script)

- Fix : ajouter `<JsonLd data={buildBreadcrumbJsonLd({...})} />` après `<Breadcrumbs>` sur chaque hub
- Effort total : 3h | CONFIRMED

### `/blog/auteur/[slug]` (875)

- Forces : Person + ProfilePage JSON-LD ✓, denylist Manon ✓
- P1 : BreadcrumbList JSON-LD manquant

### Hubs catégorie/secteur/service/tag/taille (860-870)

- Pattern : CollectionPage JSON-LD ✓, tier-1 anti-doorway ✓
- P1 : BreadcrumbList JSON-LD manquant

---

## Synthèse L2

### Top 3 P0 dédupliqués

1. **BreadcrumbList JSON-LD manquant** (7 pages hubs) — Impact AEO LLM discovery | 3h | CONFIRMED
2. **placeholder blur LQIP** article hero — CLS potentiel | 0.2h | CONFIRMED
3. **ImageObject JSON-LD explicit** — citation Google Images | 0.5h | NEW

**Benchmark** : Axion-IA L2 excellence sur Article/Author/AI Act vs peers FR (Maddyness/JDN). Seul gap : BreadcrumbList (3h fix → score 905+)

**Effort total** : ~4h
