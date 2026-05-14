# Checklist SEO/AEO/GEO 2026 — 60+ items par URL publiée

> Pass B P2-12 — checklist exigée par master prompt § 9.7 mais non commitée.
> Source de vérité pour validation HTML automatisée + revue humaine tier-1.
> Toute publication tier-1 DOIT passer cette checklist à 100 %. Tier-2 peut
> tolérer ≤ 3 items WARN (jamais FAIL sur les bloquants `[BLOQUANT]`).

Référence master prompt : `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` § 9.7
(§ 9.7.1 → § 9.7.8 ; cf. budget Web Vitals § 9.10).

---

## A. Head & metadata (15 items)

- [ ] **A1 [BLOQUANT]** `<title>` 50-60 chars, includes keyword + brand
- [ ] **A2 [BLOQUANT]** `<meta name="description">` 140-160 chars, includes keyword + CTA implicit
- [ ] **A3 [BLOQUANT]** `<link rel="canonical">` absolu HTTPS, `axion-ia.com`, slug-lowercase
- [ ] **A4** `<meta name="robots">` cohérent avec `IndexationTier` (tier-1 = index,follow ; tier-2/3 = noindex)
- [ ] **A5 [BLOQUANT]** `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] **A6** `<meta charset="UTF-8">`
- [ ] **A7** `<html lang="fr">` (FR uniquement V1)
- [ ] **A8 [BLOQUANT]** `<link rel="alternate" hreflang="fr-FR">` + `x-default` (= FR)
- [ ] **A9** `<meta name="theme-color" content="#C45A3E">` (terracotta doctrine)
- [ ] **A10** `<meta name="author" content="Manon">` pour contenus générés
- [ ] **A11** `<meta name="publisher" content="Axion-IA">`
- [ ] **A12** `<meta name="copyright" content="© Axion-IA OÜ">`
- [ ] **A13** Preload font display=swap (LCP optimization)
- [ ] **A14** `<link rel="dns-prefetch">` ressources tierces (images.unsplash.com)
- [ ] **A15** Date format ISO 8601 toutes balises temporelles (`<time datetime="…">`)

## B. Open Graph (14 items)

- [ ] **B1 [BLOQUANT]** `og:title` (peut différer de `<title>`, optimisé pour partage)
- [ ] **B2 [BLOQUANT]** `og:description` (peut différer, accroche partage)
- [ ] **B3 [BLOQUANT]** `og:url` (canonical absolu)
- [ ] **B4 [BLOQUANT]** `og:image` 1200×630, AVIF + WebP + JPG fallback
- [ ] **B5** `og:image:width` / `og:image:height` explicites
- [ ] **B6** `og:image:alt` descriptif (anti-déficit accessibilité)
- [ ] **B7 [BLOQUANT]** `og:type` (`article` pour blog/news, `website` pour landings)
- [ ] **B8** `og:site_name` = "Axion-IA"
- [ ] **B9** `og:locale` = "fr_FR"
- [ ] **B10** `article:published_time` ISO 8601 (si type=article)
- [ ] **B11** `article:modified_time` ISO 8601 distinct de published (signal fraîcheur)
- [ ] **B12** `article:author` URL `#person` Manon (`/fr/equipe/manon#person`)
- [ ] **B13** `article:section` (catégorie thématique)
- [ ] **B14** `article:tag` 3-7 keywords thématiques

## C. Twitter Cards (7 items)

- [ ] **C1** `twitter:card` = `summary_large_image`
- [ ] **C2** `twitter:title`
- [ ] **C3** `twitter:description`
- [ ] **C4** `twitter:image` (même que og:image)
- [ ] **C5** `twitter:image:alt`
- [ ] **C6** `twitter:site` (handle Axion-IA si existe — sinon OMIS, jamais inventé)
- [ ] **C7** `twitter:creator` OMIS pour Manon (doctrine v2.1 zéro réseau social)

## D. Geo meta (4 items, landings villes uniquement)

- [ ] **D1 [BLOQUANT landings]** `geo.region` ISO 3166-2 (ex `FR-IDF` Paris)
- [ ] **D2 [BLOQUANT landings]** `geo.placename` (nom canonique INSEE)
- [ ] **D3 [BLOQUANT landings]** `geo.position` `lat;lng` chef-lieu
- [ ] **D4 [BLOQUANT landings]** `ICBM` `lat,lng` (variant historique, redondance volontaire)

## E. Hiérarchie headings (6 items)

- [ ] **E1 [BLOQUANT]** Exactement **1× H1** par page
- [ ] **E2 [BLOQUANT]** 3-8 H2 logiquement structurés
- [ ] **E3** H3 enfants de H2 uniquement (jamais H3 sans H2 parent)
- [ ] **E4** **0× H5+** (H4 max, doctrine 2026 anti-fragmentation)
- [ ] **E5 [BLOQUANT]** H1 inclut keyword principal
- [ ] **E6** Aucune saute de niveau (H2 → H4 sans H3 → KO)

## F. Semantic HTML5 (6 items)

- [ ] **F1 [BLOQUANT]** `<main>` unique entoure le contenu
- [ ] **F2** `<article>` pour contenus auto-suffisants (blog post, news, FAQ)
- [ ] **F3** `<aside>` pour TOC, related links, author card
- [ ] **F4** `<nav>` pour breadcrumbs + pagination
- [ ] **F5** `<header>` + `<footer>` au niveau page
- [ ] **F6** `<time datetime="ISO">` toujours wrappe les dates affichées

## G. Accessibilité WCAG 2.2 AA (6 items)

- [ ] **G1 [BLOQUANT]** Contraste texte ≥ 4.5:1 (large text ≥ 3:1)
- [ ] **G2 [BLOQUANT]** Tous les `<img>` ont `alt` non-vide (sauf décoratives explicites `alt=""`)
- [ ] **G3 [BLOQUANT]** Focus visible (outline) sur tous les éléments interactifs
- [ ] **G4** Touch targets ≥ 44×44 px (mobile)
- [ ] **G5** Aria-labels sur les boutons icon-only
- [ ] **G6** Pas de couleur seule comme porteuse d'info (texte + icône)

## H. JSON-LD structured data (8 items)

- [ ] **H1 [BLOQUANT]** `WebSite` + `Organization` au niveau racine (template global)
- [ ] **H2 [BLOQUANT]** Type spécifique selon contenu : `Article`, `NewsArticle`, `FAQPage`, `QAPage`, `HowTo`, `LocalBusiness` (landings villes)
- [ ] **H3 [BLOQUANT]** `BreadcrumbList` cohérent avec URL hierarchy
- [ ] **H4 [BLOQUANT]** `author` typé `Person` Manon `@id` `/fr/equipe/manon#person`
- [ ] **H5** `publisher` typé `Organization` Axion-IA avec `logo` ImageObject
- [ ] **H6** `dateModified` strictement différent de `datePublished` quand modifié
- [ ] **H7 [BLOQUANT pour FAQ/QA]** `Speakable` pour pages Q/R (AEO Google Assistant)
- [ ] **H8** Validation Rich Results Test PASS sur tous les blocs

## I. Direct answer + AEO formatting (5 items)

- [ ] **I1 [BLOQUANT tier-1]** Direct answer 40-80 mots dans les 200 premiers mots (réponse directe à la query)
- [ ] **I2** TL;DR encadré visible en haut de page
- [ ] **I3** Key Facts bloc (3-5 bullets) extrait par Featured Snippets
- [ ] **I4** TOC (Table of Contents) automatique si > 5 H2
- [ ] **I5** FAQ section embarquée + `FAQPage` JSON-LD (8 Q/R typique)

## J. Indexation + sitemap (5 items)

- [ ] **J1 [BLOQUANT tier-1]** URL incluse dans le sitemap split approprié (`sitemap-blog.xml`, `sitemap-news.xml`, `sitemap-faq.xml`, `sitemap-villes.xml`, etc.)
- [ ] **J2 [BLOQUANT]** Tier-1 → ping IndexNow post-publish (`POST /api/indexnow/ping`)
- [ ] **J3 [BLOQUANT tier-1]** Tier-1 → ping Google Indexing API (si OAuth configuré)
- [ ] **J4** llms.txt et `.md` machine-readable variante pour tier-1
- [ ] **J5** `<link rel="alternate" type="application/rss+xml">` sur hubs blog/actualites

---

## Workflow de validation

1. **Génération automatique** : workers content-gen produisent un brouillon
   avec toutes les balises ci-dessus. Tout item [BLOQUANT] manquant rejette
   le brouillon en `needs_review`.
2. **Review humaine** (review-queue admin) : reviewer coche cette checklist
   via composant `<Seo60Checklist>` (à brancher Sprint S6.3) sur l'item
   éditeur. Tous bloquants verts = bouton "Publier" actif.
3. **CI gate** : `pnpm seo:audit` (script existant) scanne les 60+ items sur
   les 5 URLs pilotes (Lighthouse + custom Cheerio rules). PR refusée si
   régression sur un bloquant.
4. **Pré-prod** : `pnpm seo:audit --tier=tier_1_indexable` exécute la
   checklist complète avant `pnpm build`.

## Maintenance

- Master prompt § 9.7 est la source de vérité doctrinaire. Cette checklist
  l'opérationnalise.
- Bumper la version `seo-aeo-60-items-checklist` à chaque ajout d'item
  (V2 prévue 2027 avec sources LLM citations directes).
- Référencer cette doc depuis CLAUDE.md → Content Generator section.

---

_Pass B P2-12 closed 2026-05-14. Référence § 9.7 master prompt v1.7._
