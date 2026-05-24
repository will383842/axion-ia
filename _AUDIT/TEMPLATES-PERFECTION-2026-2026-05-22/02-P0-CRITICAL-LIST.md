# P0 — Liste critique (tous bloquants dédupliqués)

**Date** : 2026-05-22 | **HEAD** : e7c4000

> Priorisés par ROI/effort. Chaque P0 = cause + impact + correctif exact + effort.

---

## GROUPE A — Admin security (1 fix = 109 pages) 🔴

### A1 — Admin V2 : 109 pages SANS robots noindex

**Fichier** : `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx`
**Cause** : Layout parent n'exporte pas `metadata.robots`
**Impact** : 87% pages admin indexables par Google/Claude.ai si URL découverte
**Fix** :

```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

**Effort** : 30 min | **Scope** : 109 pages protégées d'un coup | Status : NEW

---

## GROUPE B — AI Act art. 50 (deadline 2026-08-02) 🔴

### B1 — DPA non signés (3 providers principaux)

**Providers** : Anthropic, OpenAI, Perplexity
**Cause** : Administratif — clés API absentes en Coolify, DPA pending
**Impact** : Non-conformité art. 28 RGPD + art. 50 EU AI Act avant 2026-08-02
**Fix** : Will signe DPA via portails Anthropic/OpenAI/Perplexity | Action humaine | CRITICAL DEADLINE

### B2 — AiContentDisclaimer absent sur `/cas-concrets/secteur/[slug]`

**Fichier** : `src/app/[locale]/cas-concrets/secteur/[slug]/page.tsx`
**Cause** : Disclosure absent sur hub dérivé (présent sur [slug] détail)
**Impact** : Non-conformité AI Act art. 50 si synopsis IA-généré
**Fix** : Ajouter `<AiContentDisclaimer locale={loc} />` avant CtaBlock | 0.5h | NEW

---

## GROUPE C — SEO technique (titres/robots)

### C1 — Dev-only pages sans robots noindex (/sections, /design)

**Cause** : Pages de démo dev exposées sans generateMetadata
**Impact** : Crawl waste + duplicate EEAT signals
**Fix** : `generateMetadata() → { robots: { index: false } }` sur chaque page | 0.5h | NEW

### C2 — Titles > 60 caractères (conversion funnel)

**Pages** : `/reserver` (65c), `/demande-devis` (62c)
**Fix** : "Réserver intervention · calendrier · Axion-IA" (54c) + "Demande devis qualifiée · Axion-IA" (44c) | 10min | NEW

### C3 — ReservationAction / Order JSON-LD absents (funnel conversion)

**Pages** : `/reserver`, `/demande-devis`, `/demande-devis/confirmation`, `/confirmation`
**Impact** : 0 AEO signal LLMs pour les actions de conversion
**Fix** : Émettre `ReservationAction`, `Order` JSON-LD per page | 2.5h total | NEW

---

## GROUPE D — Web Vitals (Lighthouse CI gate)

### D1 — CLS > 0.05 sur `/audit` hub

**Cause** : Long page 500 lignes + animations sections (AGENTS.md L71 mentionne déjà ce bug)
**Impact** : Lighthouse CI fail, Rich Results eligibility
**Fix** : Profile Lighthouse live, appliquer `contain: layout` sections, lazy-load LocalCoverageSection | 4h | CONFIRMED

### D2 — LCP > 2000ms (hero SVG sans fetchPriority)

**Pages** : `/` (Home), `/a-propos`, `/methodologie`
**Cause** : SVG hero inline 770 lignes sans `fetchPriority="high"` ni `<link rel="preload">`
**Impact** : Lighthouse CI LCP gate fail (budget ≤ 1800ms)
**Fix** : `<link rel="preload" as="image" fetchPriority="high">` ou SVG externe + `priority` Next Image | 1.5h | NEW

### D3 — TBT risque > 150ms sur fiches ville

**Pages** : `/implantations/[region]/[ville]`, pSEO par-service
**Cause** : 9 sections + 5 JSON-LD schemas en parallèle
**Fix** : Lighthouse audit live requis pour confirmer + defer schemas `afterInteractive` si > 150ms | 3h | NEW

---

## GROUPE E — GEO local

### E1 — Hub `/implantations` sans Organization France

**Fichier** : `src/app/[locale]/implantations/page.tsx`
**Fix** : Ajouter `buildOrganizationJsonLd()` + `buildServiceJsonLd(..., areasServed: [{type: "Country", name: "France"}])` | 30min | NEW

### E2 — Adresse physique absente dans fiches ville

**Impact** : Google Maps local pack faible
**Fix** : Décision Will (WeWork Paris ?) + dev section "Localisation & accès" | BLOQUÉ Will

---

## GROUPE F — Image-bank pipeline

### F1 — Copyright default "Axion-IA OÜ" vs "Axion-IA"

**Fichier** : `prisma/schema.prisma:3386`
**Fix** : Migration data + update DEFAULT | 15min | NEW

### F2 — AVIF/thumbnail sans `.withMetadata()` EXIF strip

**Fichier** : `src/server/image-bank/services/image-import.service.ts:104,116`
**Fix** : Add `.withMetadata({ orientation: 1 })` × 2 | 5min | NEW

---

## GROUPE G — AEO (ItemList/Speakable manquants)

### G1 — ItemList JSON-LD manquant sur hubs KB (4 pages)

**Pages** : `/glossaire`, `/centre-aide/categorie/[slug]`, `/connaissances`, `/blog` (hubs)
**Impact** : Articles orphelins LLM discovery, -25% citation rate
**Fix** : Ajouter `buildItemListJsonLd()` après CollectionPage sur chaque hub | 3h | CONFIRMED

### G2 — Speakable cssSelector manquant (6 pages hubs)

**Pages** : `/connaissances`, `/centre-aide`, `/centre-aide/categorie/[slug]`, `/glossaire`, `/comparaisons`, `/faq`
**Fix** : Ajouter `speakable: { cssSelector: ['[data-aeo="..."]'] }` + attribut HTML | 3h | CONFIRMED

### G3 — FAQ manquante sur pages `/par-techno` et `/par-fonction` (9 pages)

**Impact** : AEO/SEO manqué sur pages à fort intent
**Fix** : Ajouter 3-5 Q/A + buildFaqJsonLd | 8h total | NEW

### G4 — hasOfferCatalog manquant sur hubs services (interventions, implementation)

**Fix** : Ajouter `hasOfferCatalog` node dans Service JSON-LD | 0.5h × 2 | NEW

---

## GROUPE H — REFONTE urgente

### H1 — `/sites-web-augmentes` orpheline (score 570/1000)

**Cause** : Duplique `/codage-developpement` sans areasServed, FAQ, HowTo, ItemList
**Fix** : Cloner structure codage-developpement + adapter contenu | 4-6h | NEW

---

## Récapitulatif effort

| Groupe                 | Effort         | Impact            |
| ---------------------- | -------------- | ----------------- |
| A — Admin noindex      | 30 min         | 109 pages         |
| B — AI Act DPA         | Action Will    | Compliance        |
| C — SEO titres/schemas | 3h             | Conversion funnel |
| D — Web Vitals         | 8.5h           | Lighthouse CI     |
| E — GEO local          | 30min (+ Will) | Local SEO         |
| F — Image-bank         | 20min          | RGPD/brand        |
| G — AEO schemas        | 14.5h          | LLM discovery     |
| H — Refonte            | 4-6h           | 1 page critique   |
| **TOTAL CODE**         | **~31h**       |                   |
| **ACTION WILL**        | DPA + adresse  | Compliance        |
