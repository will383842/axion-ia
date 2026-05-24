# Patterns récurrents — Anti-patterns détectés sur ≥5 templates

**Date** : 2026-05-22

---

## ANTI-PATTERN 1 — Speakable cssSelector absent sur hubs

**Occurrences** : 6/10 hubs KB/guides/FAQ/comparaisons/glossaire/connaissances
**Impact** : -25% citation rate AI Overviews 2026 (Google Assistant / Alexa / Perplexity)
**Pattern correct** : `/guides/page.tsx` a `data-aeo="guides-hub-intro"` + Speakable cssSelector ✓
**Fix systématique** :

1. Ajouter `data-aeo="[page]-intro"` sur le bloc description hero
2. Ajouter `speakable: { cssSelector: ['[data-aeo="[page]-intro"]'] }` au JSON-LD principal
   **Effort** : 30min/page

---

## ANTI-PATTERN 2 — BreadcrumbList JSON-LD manquant sur hubs blog

**Occurrences** : 7 pages (`/blog`, `/blog/auteur`, `/blog/categorie`, `/blog/secteur`, `/blog/service`, `/blog/tag`, `/blog/taille`)
**Impact** : Google/LLMs ne relient pas la nav hiérarchique → perte structured data
**Pattern correct** : `/blog/[slug]` a le BreadcrumbList JSON-LD ✓
**Fix** : `<JsonLd data={buildBreadcrumbJsonLd({...})} />` après `<Breadcrumbs>` visuel
**Effort** : 0.5h/page (3.5h total)

---

## ANTI-PATTERN 3 — revalidate ISR manquant (default silencieux)

**Occurrences** : ~15 pages (audit/tiers, interventions/demande, par-techno, etc.)
**Impact** : ISR silencieux → incohérence cache entre pages (hub 86400s vs détail default 3600s)
**Fix** : Ajouter `export const revalidate = 3600` (ou 86400 selon critère freshness)
**Effort** : 1 ligne/page — 5min/fichier

---

## ANTI-PATTERN 4 — Zéro hero image/photo sur pages service

**Occurrences** : `/audit/*` (5 tiers), `/codage-developpement/*` (2), `/un-a-un` (1)
**Impact** : Branding faible, D5 score 65-70/100 → -10pts sur score global
**Pattern correct** : `/galerie/[slug]`, `/equipe/[slug]` ont des images avec priority+intrinsic
**Fix** : Illustrer chaque tier avec photo ou Illustration AVIF (budget visuel)
**Effort** : 1 sprint day design + dev

---

## ANTI-PATTERN 5 — hasOfferCatalog absent sur hubs services

**Occurrences** : `/interventions`, `/implementation` (et potentiellement `/audit`)
**Impact** : LLMs n'annoncent pas les sous-offres disponibles pour une recherche contextuelle
**Fix** : Ajouter `hasOfferCatalog` node dans `buildServiceJsonLd()` | 0.5h/hub

---

## ANTI-PATTERN 6 — Formulaires sans feedback Sentry

**Occurrences** : `/audit/demande`, `/interventions/demande`, actions server-side
**Impact** : Erreurs de soumission silencieuses → perte leads non trackée
**Fix** : Wrapper submitAction dans try/catch avec `Sentry.captureException()` | 30min/form

---

## ANTI-PATTERN 7 — JSON-LD schemas absent sur pages conversion

**Occurrences** : `/reserver` (ReservationAction), `/demande-devis` (Order), `/confirmation` (Order/Reservation)
**Impact** : 0 signal AEO pour LLMs sur les actions de conversion les plus importantes
**Fix** : Émettre schemas `ReservationAction`, `Order` per page | 30-60min/page

---

## ANTI-PATTERN 8 — Descriptions meta > 160 caractères

**Occurrences** : 5 pages hubs familles interventions (210c), hub audit (trop long)
**Impact** : Truncation SERP, parsing AEO moins performant
**Fix** : Réduire à 120-160c max | 15min/page

---

## ANTI-PATTERN 9 — aria-invalid / aria-describedby absents sur formulaires

**Occurrences** : `/audit/demande`, `/interventions/demande`, potentiellement `/demande-devis`
**Impact** : WCAG 2.2 AA fail sur erreurs de formulaire
**Fix** : Mapper Zod `formState.errors` → `aria-invalid` + `aria-describedby` sur Input | 2h/form

---

## ANTI-PATTERN 10 — Titres H1 avec prose intro > 22 mots

**Occurrences** : Hub interventions intro (47 mots), hubs familles collectives (78 mots), sous-titres audit (35 mots)
**Impact** : Speakable parsing sous-optimal pour AI Overviews
**Fix** : Split en phrases ≤ 22 mots avec `<br>` ou séparation paragraphes | 15min/page

---

## Patterns POSITIFS confirmés (à ne pas casser)

1. **buildArticleJsonLd factory** — cohérence aiGenerated + creator + disambiguatingDescription sur tous articles ✓
2. **Anti-doorway HCU 2024** — robots noindex si thin content (glossaire < 80 mots, presse < 60 mots) ✓
3. **ISR 86400 sur fiches ville** — scaling correct pour 2280 villes ✓
4. **RFC 8058** confirmation newsletter + désabonnement ✓
5. **Stub proxy** prisma.ts + redis.ts — build GH Actions protégé ✓
6. **SSOT pricing** — IMPLEMENTATION_TIERS/INTERVENTION_TIERS centralisés ✓
7. **Image pipeline Sharp** — AVIF+WebP+LQIP+watermark+rate-limit ✓
8. **CC BY 4.0 visible** partout image-bank ✓
