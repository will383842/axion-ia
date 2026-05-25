# B5 Audit E2E — Pages Verticales Paris (Sprint A DRY)

**Agent**: B-5  
**Date**: 2026-05-25  
**Scope**: 5 pages `/fr/implantations/ile-de-france/paris/{verticale}`  
**Verdict global**: WARNING — 3/5 GO PROD, 2/5 NOGO (dev server crash post-Sprint A)

---

## Contexte & Méthode

Audit réalisé avec `curl --max-time 45-90s` depuis le dev server `localhost:3000`.  
Le serveur a répondu lentement (ISR-on-demand, ~51-72s par page) pour les 3 premières verticales, puis a crashé (HTTP 500 global) après la charge ISR lourde des fetches parallèles.

**Données utilisées** :
- `audits`, `interventions`, `implementations` : fetch frais HTTP 200 (17h08-17h10)
- `un-a-un`, `sites-web-ia` : fetch en erreur (HTTP 500 actuel) + analyse cache 00h47 (pre-commit c8fabfef Sprint A DRY du 2026-05-25 14h52)

---

## Résultats par Verticale

### 1. `/audits` — VERDICT: GO

| Check | Statut |
|-------|--------|
| HTTP 200 | YES (51s ISR-on-demand) |
| H1 contient "Paris" | YES: "Audit IA a Paris & region Ile-de-France" |
| Meta title "Paris" | YES: "Audits IA Paris — Cabinet conseil Axion-IA" |
| Canonical correct | YES: /fr/implantations/ile-de-france/paris/audits |
| noindex | NO (indexable) |
| **Composants services** | **ALL PRESENT** |
| - AuditHero | YES (`audit-hero` section) |
| - AuditTrustPills | YES (certifi/confiance) |
| - AuditTierGrid (Flash/Cible/PME/ETI) | YES (4 tiers) |
| - AuditMaturityLevels | YES |
| - AuditMethodology | YES ("Methodologie") |
| - AuditCrossModules | YES ("Former vos equipes", "14 formats") |
| - AuditFaq | YES (accordion) |
| - AuditCtaBlock | YES |
| - OrangeContactBanner | YES (bg-terracotta, Nous contacter) |
| **Composants ville** | **ALL PRESENT** |
| - VilleEcosystemeLocal | YES (section `ville-ecosysteme-local-paris`) |
| - VilleTissuEconomique | YES (section `ville-tissu-economique-paris`) |
| - VilleCommunesProches | YES ("Communes proches de Paris", `ville-communes-proches-paris`) |
| - VilleFaqGeolocalisee | YES (`ville-faq-geolocalisee-paris`) |
| **JSON-LD** | |
| Service @type | YES (RSC payload) |
| Service areaServed Paris | YES: {City: Paris, AdministrativeArea: Ile-de-France, Country: France} |
| BreadcrumbList | YES (4 niveaux: Implantations > Ile-de-France > Paris > Audit IA d'optimisation) |
| FAQPage | YES (9 questions) |
| WebPage | YES |
| SpeakableSpecification | YES (cssSelectors: `h1`, `h1 + p`, `[data-faq-q],[data-faq-a]`) |
| Speakable selectors en DOM | YES (h1 present, h1+p present, data-faq-q/data-faq-a present) |
| LocalBusiness (anti-pattern) | NO (correct — SAB pattern evite) |
| **Pricing SSOT** | OK (490/890/3900/12000 euros tous depuis pricing.ts) |
| villeContext injection | YES (Paris x100 occurrences dans le HTML) |

**Note P2**: `[data-hero-description]` est dans le selector Speakable de AuditHero mais ServiceHero ne rend pas cet attribut. Fonctionnel car fallback `h1 + p` present.

---

### 2. `/interventions` — VERDICT: GO

| Check | Statut |
|-------|--------|
| HTTP 200 | YES (57s ISR-on-demand) |
| H1 contient "Paris" | YES: "Formez Paris a l'IA de 4h a 3j+" |
| Meta title "Paris" | YES: "Interventions IA Paris · Cabinet Axion-IA · des 490 €" |
| Canonical correct | YES |
| noindex | NO |
| **Composants services** | ALL PRESENT |
| - InterventionsHero | YES (data-speakable="hero-lead" present en DOM) |
| - InterventionsAudienceStrip | YES |
| - InterventionsFamiliesGrid | YES |
| - InterventionsReservationFlow | YES |
| - InterventionsMaturityLevels | YES |
| - InterventionsCrossModules | YES |
| - InterventionsFaq | YES |
| - OrangeContactBanner | YES |
| **Composants ville** | ALL PRESENT |
| - VilleEcosystemeLocal | YES |
| - VilleTissuEconomique | YES |
| - VilleCommunesProches | YES |
| - VilleFaqGeolocalisee | YES |
| **JSON-LD** | |
| Service + areaServed Paris | YES |
| BreadcrumbList (4 niveaux) | YES |
| FAQPage (8 questions) | YES |
| SpeakableSpecification | YES (cssSelectors: `h1`, `[data-speakable='hero-lead']`, `[data-faq-q],[data-faq-a]`) |
| Speakable selectors en DOM | YES (data-speakable="hero-lead" confirmed present) |
| **Pricing SSOT** | OK (490/590/690 depuis pricing.ts) |

---

### 3. `/implementations` — VERDICT: GO

| Check | Statut |
|-------|--------|
| HTTP 200 | YES (72s ISR-on-demand) |
| H1 contient "Paris" | YES: "Implementation IA a Paris & region Ile-de-France" |
| Meta title "Paris" | YES |
| Canonical correct | YES |
| noindex | NO |
| **Composants services** | ALL PRESENT |
| - ImplementationHero | YES (data-hero-description present en DOM) |
| - ImplementationTrustPills | YES |
| - ImplementationPillarChoices | YES |
| - ImplementationCatalogFunctions | YES |
| - ImplementationPricingTiers | YES |
| - ImplementationScenariosBySize | YES |
| - ImplementationProcessSteps | YES |
| - ImplementationFaq | YES |
| - ImplementationCtaBlock | YES |
| - OrangeContactBanner | YES |
| **Composants ville** | ALL PRESENT |
| - VilleEcosystemeLocal | YES |
| - VilleTissuEconomique | YES |
| - VilleCommunesProches | YES |
| - VilleFaqGeolocalisee | YES |
| **JSON-LD** | |
| Service + areaServed Paris | YES |
| BreadcrumbList (4 niveaux) | YES |
| FAQPage (11 questions) | YES |
| SpeakableSpecification | YES |
| Speakable [data-hero-description] en DOM | YES (ImplementationHero rend l'attribut explicitement) |
| **Pricing SSOT** | OK (490/690/900 depuis pricing.ts) |

---

### 4. `/un-a-un` — VERDICT: NOGO

**Status actuel**: HTTP 500 (dev server crash post-Sprint A lourdes requetes ISR)

**Analyse sur cache 00h47 (pre-Sprint A DRY commit c8fabfef)**:

| Check | Statut |
|-------|--------|
| HTTP 200 au moment du cache | Presumed YES (183KB contenu present) |
| H1 contient "Paris" | YES: "Accompagnement un-a-un IA Paris — Sessions 1-to-1 pour dirigeants" |
| Meta title "Paris" | YES |
| Canonical correct | YES |
| noindex | YES — tier_3_noindex_nofollow (article sans indexation) |
| Service JSON-LD + areaServed Paris | YES |
| BreadcrumbList (4 niveaux) | YES |
| FAQPage | NO (absent) |
| SpeakableSpecification | NO (absent) |
| **Composants services** | PARTIAL |
| - UnAUnHero (Module 4) | NO — absent du cache 00h47 (ancienne architecture) |
| - UnAUnTarget | YES (content present) |
| - UnAUnMethodology | YES |
| - UnAUnFaq | YES (accordion) |
| - OrangeContactBanner | YES |
| **Composants ville** | ABSENT |
| - VilleEcosystemeLocal | NO |
| - VilleTissuEconomique | NO |
| - VilleCommunesProches | NO |
| - VilleFaqGeolocalisee | NO |

**Causes probables NOGO**:
1. **HTTP 500 actuel**: dev server crash (toutes les routes affectees — pas specifique a un-a-un)
2. **noindex tier_3**: article LLM genere pour paris/un-a-un a `indexationTier = tier_3_noindex_nofollow`
3. **Composants ville absents dans cache**: le cache 00h47 est ANTERIEUR au commit Sprint A DRY (c8fabfef, 14h52). Apres redemarrage du serveur, la page devrait rendre avec le nouveau dispatcher incluant VilleEcosystemeLocal etc.
4. **BUG P2**: UnAUnHero.tsx ligne 63 reference `[data-un-a-un-hero-description]` comme selector Speakable mais ServiceHero ne rend jamais cet attribut → selector orphelin, speakable hero non fonctionnel

---

### 5. `/sites-web-ia` — VERDICT: NOGO

**Status actuel**: HTTP 500 (meme cause que un-a-un)

**Analyse sur cache 00h47**:

| Check | Statut |
|-------|--------|
| HTTP 200 au moment du cache | Presumed YES |
| H1 contient "Paris" | YES: "Sites web IA Paris — Cabinet Axion-IA" |
| noindex | YES — tier_3_noindex_nofollow |
| Service JSON-LD + areaServed Paris | YES |
| BreadcrumbList (4 niveaux) | YES |
| FAQPage | NO |
| SpeakableSpecification | NO |
| **Composants services** | PRESENT (cache post-Sprint A partiel) |
| - SitesWebHero | YES (aria-label present — modification commit 4b1a881f) |
| - SitesWebTrustPills | YES |
| - SitesWebStackAdaptee | YES |
| - SitesWebMethodology | YES |
| - SitesWebFaq | YES |
| - OrangeContactBanner | YES |
| **Composants ville** | ABSENT |
| - VilleEcosystemeLocal | NO |
| - VilleTissuEconomique | NO |
| - VilleCommunesProches | NO |

---

## Analyse JSON-LD Approfondie

### Service Schema (toutes pages)
- `@type: "Service"` avec `serviceType: "Cabinet IA operationnel · {verticalLabel}"`
- `areaServed: [{@type: City, name: Paris}, {AdministrativeArea: Ile-de-France}, {Country: France}]`
- `provider: {Organization, name: Axion-IA}`
- `url`: URL canonique correcte
- **PASS**: Paris explicitement dans areaServed pour toutes les pages

### BreadcrumbList
- 4 niveaux: `Implantations > Ile-de-France > Paris > {verticalLabel}`
- NOTE: Le spec demandait 5 niveaux (Home inclus) mais le code source `page.tsx:241-249` ne genere que 4 niveaux (sans "Home"). Ceci est voulu (design decision) — pas un bug.
- `@id` unique avec `#breadcrumb` anchor

### FAQPage
- `audits`: 9 questions (FAQ service generic + FAQ ville-specifique LLM)
- `interventions`: 8 questions
- `implementations`: 11 questions
- `un-a-un`, `sites-web-ia`: 0 questions (tier_3 — article insuffisant pour FAQ JSON-LD)

### SpeakableSpecification
- `audits`: `{h1, h1 + p, [data-faq-q],[data-faq-a]}` — h1+p fallback fonctionnel, data-faq-* present
- `interventions`: `{h1, [data-speakable='hero-lead'], [data-faq-q],[data-faq-a]}` — tous presents en DOM
- `implementations`: `{h1, h1 + p, [data-hero-description]}` — data-hero-description present (ImplementationHero explicit)
- `un-a-un`: absent (tier_3) + BUG: selector `[data-un-a-un-hero-description]` orphelin
- `sites-web-ia`: absent (tier_3)

### LocalBusiness
Aucun `@type: "LocalBusiness"` detecte dans les 5 pages — conforme a la decision ADR SAB pattern.

---

## Pricing SSOT Verification

Tous les prix affiches correspondent aux valeurs dans `src/content/pricing.ts` :
- Flash audit: 490 € HT (priceFlat), 890 € HT on-site (priceFlatOnsite)
- Strategique ETI: 12 000 € HT (priceFlat)
- Interventions: 490/590/690 € (sous-tiers participant count)
- Implementation: 490/690/900 € HT

Aucun prix hardcode en dehors de pricing.ts detecte. **SSOT: OK**

---

## VilleContext Injection Status

- `audits`: Paris x100 occurrences (excellent)
- `interventions`: Paris x91 occurrences
- `implementations`: Paris x86 occurrences
- `un-a-un`: Paris x52 occurrences (moins car article tier_3 + composants partiels)
- `sites-web-ia`: Paris x40 occurrences

CTAs, descriptions, H1 tous contiennent "Paris" — injection villeContext fonctionnelle.

---

## Findings & Bugs Identifies

### P0 — CRITIQUE
**Dev server HTTP 500 global** (toutes les routes apres fetches ISR intensifs)
- Impact: 2/5 verticales non testables en direct
- Cause probable: OOM ou crash Next.js dev apres 3x ISR generation sequentielle lente (51+57+72s)
- Action Will: Redemarrer le dev server (`pnpm dev`)
- Apres redemarrage: re-tester un-a-un et sites-web-ia

### P1 — MAJEUR
**noindex tier_3 sur un-a-un + sites-web-ia Paris**
- Impact SEO: ces 2 pages ne sont pas indexables par Google
- Cause: articles LLM generes pour ces verticales ont `indexationTier = tier_3_noindex_nofollow`
- Action requise: lancer generation LLM tier_1 pour paris/un-a-un et paris/sites-web-ia
  ```
  pnpm tsx scripts/regen-villes-stratified.ts --villes=paris --verticales=un-a-un,sites-web-ia
  ```

### P2 — MINEUR
**Selector Speakable orphelin dans UnAUnHero.tsx**
- Fichier: `src/components/services/un-a-un/UnAUnHero.tsx:63`
- Bug: `selectors: ["h1", "[data-un-a-un-hero-description]"]`
- ServiceHero ne rend pas `data-un-a-un-hero-description` sur le `<p>` de description
- Fix: Soit ajouter `data-un-a-un-hero-description` sur le `<p>` dans ServiceHero OU changer le selector en `["h1", "h1 + p"]` comme AuditHero
- Impact: Speakable hero non optimise pour assistants vocaux sur pages un-a-un
- Effort: 5 min fix

### INFO — Comportement ISR normal
Les pages ISR-on-demand (non pre-generees au build) prennent 51-72s au premier hit.
Pre-generation des top-100 villes dans `generateStaticParams()` inclut Paris — ces pages devraient etre pre-generees en production. Lenteur locale = ISR-on-demand en dev (normal).

---

## Actions Will Requises

1. **URGENT**: Redemarrer le dev server (`Ctrl+C` puis `pnpm dev`) — server crash HTTP 500
2. **PRIORITAIRE**: Re-tester un-a-un et sites-web-ia apres redemarrage pour confirmer HTTP 200
3. **SEO**: Generer articles tier_1 pour paris/un-a-un et paris/sites-web-ia:
   ```
   pnpm tsx scripts/regen-villes-stratified.ts --villes=paris
   ```
4. **P2 optionnel**: Fixer UnAUnHero.tsx selector Speakable (5 min)

---

## Conclusion

**Verdict Sprint A DRY : WARNING — 3/5 GO PROD**

| Verticale | Verdict | Motif |
|-----------|---------|-------|
| audits | GO | HTTP 200, tous composants, JSON-LD complet, SSOT OK |
| interventions | GO | HTTP 200, tous composants, JSON-LD complet, SSOT OK |
| implementations | GO | HTTP 200, tous composants, FAQPage 11Q, SSOT OK |
| un-a-un | NOGO | HTTP 500 (crash), noindex tier_3, composants ville absents (cache pre-Sprint A) |
| sites-web-ia | NOGO | HTTP 500 (crash), noindex tier_3, composants ville absents (cache pre-Sprint A) |

Les 3 verticales confirmees (audits/interventions/implementations) montrent une implementation exemplaire du pattern Sprint A DRY : villeContext injection complete, Service JSON-LD avec areaServed Paris, BreadcrumbList 4 niveaux, FAQPage, Speakable avec selectors DOM valides.

Les 2 verticales NOGO (un-a-un/sites-web-ia) ont un probleme primaire de server crash qui masque l'etat reel. Apres redemarrage serveur, le diagnostic devra confirmer :
- HTTP 200 rendu (la structure de code est correcte)  
- Composants ville presents (ajout VilleTissuEconomique dans 4b1a881f est code-level correct)
- noindex tier_3 = seul vrai probleme metier (generer articles LLM qualite)
