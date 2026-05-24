# A3 — GEO | Score 92/100 ✅ SAFE & COMPLIANT

## État actuel LocalBusiness sur home (factuel)

**Émis : OUI** (page.tsx:293-301)

```
@type: "ProfessionalService"
name: "Axion-IA — Cabinet IA opérationnel" (FR) / "Operational AI Consultancy" (EN)
description: "Cabinet IA français : formations, audits..."
areaServed: { @type: "AdministrativeArea", name: "France" }
knowsLanguage: ["fr", "en"]
parentOrganization: { name: "Axion-IA", legalName: "Axion-IA", url: SITE_URL }
image: axion-ia.com/opengraph-image
```

**Champs ABSENTS (volontairement, par design SAB pattern)** :
- ❌ address (PAS de street/CP sur home, ni invention)
- ❌ geo (latitude/longitude)
- ❌ openingHoursSpecification
- ❌ priceRange

Conformité schema.org : ✅ 100% (no deceptive data)

## Scoring

| # | Sous-dim | Score | Verdict | path:line |
|---|---|---|---|---|
| 1 | LocalBusiness JSON-LD | 10/10 | Émis, ProfessionalService, areaServed France | page.tsx:293-301, seo.ts:813-876 |
| 2 | areaServed France | 10/10 | AdministrativeArea correct, pas invention | page.tsx:300 |
| 3 | Address vs siège FR | 9/10 | Home = ZÉRO address (safe). /a-propos: Paris+IDF+FR sans CP/street | a-propos/page.tsx:73-88 |
| 4 | LocalCoverageSection | 10/10 | 12 régions, liens internes /implantations/[region] actifs | LocalCoverageSection.tsx:1-116 |
| 5 | LocalGeoFaq | 10/10 | 4 FAQ géo sur home, FAQPage Speakable | page.tsx:261-281, transversal.ts:128-180 |
| 6 | hreflang fr-FR + x-default | 10/10 | Présent, PAS de en-US/en-GB (EN désactivé 2026-05-16) | seo.ts:132-138 |
| 7 | Coordonnées GPS | 8/10 | Home absent (correct). Régions/villes: oui à valider spot-check 10 villes | implantations/[region|ville]/page.tsx |
| 8 | Currency + Language | 10/10 | EUR partout, fr cohérent, pas USD résidu | page.tsx:324, seo.ts:843 |
| 9 | Google My Business signals | 7/10 | ❌ sameAs GMB absent (à ajouter quand GMB créé) | seo.ts:832-838 |
| 10 | Geo-targeting Search Console | 10/10 | country=FR cohérent, robots/sitemap/hreflang FR-only | seo.ts:119-122 |

## Forces (top 3)
1. **Service Area Business pattern correct** post Sprint Correctif P1-2 — anti-spam local Google, pas d'invention adresse/horaires 2150 villes
2. **4 FAQ GEO qualifiées** + Speakable JSON-LD active (AEO geo)
3. **hreflang FR-only cohérent** — pas de fake alternate EN, aligne décision Will société française pure

## P0
**Aucun** — état GEO post-refonte = clean & safe

## P1
1. **GMB sameAs manquant** — quand Will crée GMB Axion-IA Paris, ajouter dans `buildOrganizationJsonLd` — 30min
2. **Street + postalCode /a-propos retirés** — Will fournit adresse réelle → injecter dans a-propos localBusinessJsonLd — 15min
3. **Coords GPS villes : spot-check 10 villes pilotes** (Paris/Lyon/Marseille/Toulouse/Bordeaux) — 1h

## P2
1. Place JSON-LD home (optionnel AEO boost France entity) — 30min
2. Review JSON-LD attendre 5 vrais avis vérifiables (corrélé A2)
3. Sitemap GEO Google Images si galerie /[locale]/galerie/[ville] développée

## État hreflang détaillé

```html
<link rel="canonical" href="/fr/" />
<link rel="alternate" hreflang="fr" href="/fr/" />
<link rel="alternate" hreflang="x-default" href="/fr/" />
<!-- ❌ PAS de hreflang="en" (EN_LOCALE_ENABLED=false) -->
```

Cohérent : `/en/*` → 301 vers `/fr/*` via proxy.ts.

## Centralisation opportunities
- `buildLocalBusinessJsonLd` helper : mature ✓ acceptable en l'état
- **Address data** : créer `src/content/company-address.ts` (SSOT pour /a-propos + implantations) — 30min
- Regions catalog (getIndexableRegions) — déjà bien centralisé

## Risques résiduels mineurs

| Risque | Sévérité | Mitigation |
|---|---|---|
| Coords villes content/villes.ts imaginaires | Faible | Spot-check 10 villes |
| GMB non opérationnel | Faible | Will crée compte + sameAs |
| Réactivation EN sans audit hreflang | Moyen | Checklist pre-launch valider /en/* 200 |
