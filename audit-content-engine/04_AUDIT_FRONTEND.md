# 04 — AUDIT FRONTEND (Next.js 16 App Router + React)

> Globalement **EXCELLENT** : rendu sémantique sanitisé, ISR, JSON-LD en `<head>`, CWV soignés. Peu de défauts.

## 4.1 — Rendu des contenus générés

- ✅ **ISR** : `blog/[slug]`, `guides/[slug]`, `actualites/[slug]` → `revalidate=3600` + `dynamicParams=true`.
- ✅ **Sanitisation au rendu** : `sanitizeContentGenHtml(view.body)` AVANT `dangerouslySetInnerHTML` (blog:288→549, actualites:297, guides:159). DOMPurify whitelist, FORBID h1/script/iframe, rel trust-tier (defense-in-depth avec la sanitisation en génération — cf. 01.5).
- ✅ **HTML sémantique** : H1 page-level (`<Section titleAs="h1">`), H2 avec ancres injectées (`buildToc`), pas de markdown brut. JSON-LD injecté en tête (`<JsonLd>`), **PAS dans le body** (confirmé : body sans `@type`). Types émis : `BlogPosting` (+ `aiGenerated:true` / `AIGeneratedContent` — IA Act art. 50), `HowTo`/`Article` (guides), `NewsArticle` (actualités), `Person` Manon, `BreadcrumbList`, `FAQPage`, `ImageObject`, `SpeakableSpecification` (`.tldr-answer`, `[data-aeo=tldr]`, `.faq-answer`, `[data-aeo=answer]`).
- ✅ **Métadonnées via `generateMetadata`** (head), robots dérivés du tier (tier-2/3 → noindex). Soft-404 + Tombstone + 301 slug-history.
- ✅ **Breadcrumbs** : `<nav aria-label="breadcrumb"><ol>` + `aria-current="page"` (Breadcrumbs.tsx:42-62).

```
[MAJEUR] | blog/[slug]/page.tsx (~424 + ~692-696) | Double émission POTENTIELLE de BreadcrumbList : le composant `<Breadcrumbs>` émet son JSON-LD par défaut, et la page ne passe pas `emitJsonLd={false}`. À VÉRIFIER (deux <script> BreadcrumbList même @id). | Rich Results « schema ambigu » ; pas de pénalité mais signal d'intégration. Fix : `emitJsonLd={false}` sur l'un des deux.
[MINEUR] | html-sanitizer.ts (FORBID h1) | un <h1> émis par erreur par un générateur est silencieusement supprimé (pas de log). | Perte silencieuse de titre (risque très faible). Reco : log d'avertissement.
```

## 4.2 — Performance / Core Web Vitals (budget : LCP≤1800, INP≤100, CLS=0, JS≤75KB)

- ✅ **Images** : `next/image` (WebP/AVIF auto), hero `priority` + `sizes` responsives + `aspect-[16/9|16/10]` réservé → **CLS=0**. Body images alt auto.
- ✅ **Polices** : `display:"swap"` (Manrope, Fraunces) + `adjustFontFallback` ; Inconsolata `preload:false`.
- ✅ **Composants conditionnels** guardés (`return null` si vide) → 0 layout shift (ArticleFaq/KeyTakeaway/ExpertQuote/PAA/PrevNext/Sources/AnswerCard).
- ✅ Analytics (Plausible/Clarity) deferred ; pas de script bloquant en `<head>` ; pagination (pas d'infinite scroll) pour le crawl budget.
- ✅ Composants de contenu = Server Components (pas de coût d'hydratation). Lighthouse CI gate 5 URLs prod.

→ **Aucun problème CWV identifié.** (Mesure live = job lhci ; le code est budget-friendly.)

## 4.3 — Accessibilité & SEO frontend

- ✅ Alt sur toutes les images (`featuredImageAlt ?? title`), SVG décoratifs `aria-hidden`. Liens descriptifs (PrevNext = titre, PAA = question, Sources = nom+domaine) — **pas de « cliquez ici »**. Hiérarchie Hn respectée. Focus visible (`focus-visible:ring`). Landmarks (`<article>`, `<nav>`, `<section>`), `main` délégué au layout (pas de doublon). Pas de texte-dans-image.

```
[MINEUR] | (a11y contraste) | Les valeurs de couleur (terracotta/sand/ink) non auditées ici (design system). | À valider via Lighthouse a11y (probablement OK).
```

## 4.4 — Composants

- ✅ 9 composants dédiés `components/content-gen/` (ArticleFaq, KeyTakeaway, ExpertQuote, Sources, PeopleAlsoAsk, PrevNext, ShareBar, TransparencyBlock, NewsletterInline) — tous Server Components, data via props, fallback `null` si vide. Tombstone pour archivés. Aucun composant mort content-gen détecté (reco : linter `unimported` pour confirmer).

```
[MINEUR] | blog/[slug]/page.tsx (~286) | byline article DB → `/equipe/{author}` ; 404 si le profil persona Manon n'est pas publié. | Lien interne cassé possible (corrigé P1-4 2026-06-15 ; surveiller).
[MINEUR] | composants content-gen | Pas d'error boundary runtime (Server Components échouent au build/ISR, pas au runtime). | Risque très faible (données DB + sanitisées).
```

### Bilan Étape 4

**0 CRITIQUE.** 1 MAJEUR (double BreadcrumbList à confirmer). Rendu/perf/a11y/SEO de très bonne facture — c'est la couche la plus saine du système.
