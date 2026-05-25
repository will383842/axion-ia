# Sprint A — COMPLÉMENT design + frontend + SEO/AEO/GEO + LLM 2026

**Date** : 2026-05-25
**À lire APRÈS** le brief principal `SPRINT-A-BRIEF-OPUS.md`
**Objectif** : ajouter les dimensions design/frontend perfection + SEO/AEO/GEO 2026 + extension LLM contenu géolocalisé pour viser **classement top 3 Google + visibilité ChatGPT/Perplexity/Gemini sur chaque combo (verticale × ville)**.

---

## 1. Pourquoi ce complément

Le brief principal couvre la **refactorisation structurelle** (DRY composants). Il NE garantit PAS :

- ❌ La **perfection visuelle** (hiérarchie typo, balance texte/image, animations, responsive parfait, A11y AAA)
- ❌ La **perfection SEO/AEO/GEO 2026** (Voice Search, AI Overviews, llms.txt, Local Pack, schemas avancés)
- ❌ La **richesse contenu LLM** (le pipeline actuel cap à 200-380 mots = thin content sur 2 150 pages)
- ❌ Les **Web Vitals top 1%** (LCP < 1 800 ms, INP < 100 ms, CLS = 0 stricts AGENTS.md)

→ Ce complément ajoute **3 sous-sprints additionnels** au Sprint A : **2D (design system)** + **2E (SEO/AEO/GEO + LLM extension)** + **2F (Web Vitals + A11y)** + **renforcements Phase 7 et 9**.

---

## 2. Sous-sprint 2D — Design system & frontend perfection (~1h, 4 agents //)

À insérer **après Phase 2** (extraction composants) et **avant Phase 3** (refactor pages services).

### Phase 2D.1 — Audit design system existant (1 agent Explore, 15 min)

Mission : lire `tailwind.config.ts` + `src/styles/globals.css` + `src/components/ui/*` et retourner :

- Tokens couleurs disponibles (`paper`, `ink`, `terracotta`, `sand`, etc.) avec contraste WCAG AA mesuré
- Tokens typography (fonts serif/sans, font-size scale, line-heights)
- Tokens spacing (4px grid Tailwind ou custom)
- Composants UI existants à réutiliser obligatoirement (`Cta`, `Card`, `Section`, `Container`, `Heading`)
- Breakpoints responsive (sm/md/lg/xl/2xl)
- Animations/transitions disponibles (variants, keyframes)

### Phase 2D.2 — Règles design strictes pour Sprint A (1 agent general-purpose, 15 min, OUTPUT = doc)

Mission : créer `src/components/services/DESIGN_RULES.md` (~150 lignes) avec règles **obligatoires pour TOUS les composants Sprint A** :

#### A. Hiérarchie typographique stricte

```
H1 (1×/page) : 3xl-5xl serif italic, line-height 1.1, font-semibold, tracking-tight
H2 : 2xl-3xl serif, font-semibold, mt-16 mb-6
H3 : xl serif, font-medium, mt-8 mb-4
H4 : lg sans-serif font-semibold, mt-6 mb-3
Body : base-lg sans-serif, line-height 1.6-1.75, max-w-prose (65ch)
Eyebrow : text-[13px] uppercase tracking-[0.18em] font-semibold
```

#### B. Balance texte/image

- **Aucune section > 60% texte** sans visual break (image, icon, card grid, divider)
- Hero : 50/50 texte/image OU texte centré avec illustration background
- Cards : icône 24-32px + chiffre/badge + 2-3 lignes max
- Témoignages : portrait 80x80px circle + citation 30-50 mots
- Méthodologie : timeline horizontale avec icônes Lucide, 5 étapes max

#### C. Espacements 8px grid

```
Sections principales : py-16 sm:py-20 lg:py-24
Subsections : py-10 sm:py-12 lg:py-16
Card padding : p-6 sm:p-8
Container : max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
Gap grids : gap-6 sm:gap-8 lg:gap-12
```

#### D. Couleurs (anti-hex, tokens SSOT)

- Background principal : `bg-paper` (off-white)
- Texte principal : `text-ink`
- Accents brand : `bg-terracotta text-paper` (CTA primaires, bandeaux)
- Cards : `bg-paper border border-ink/10` ou `bg-sand/30`
- Hover states : `hover:bg-ink/5` ou `hover:bg-terracotta/90`
- Focus visible : `focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2`
- ❌ Jamais de hex codé en dur (anti-hex check pre-commit bloque)
- ❌ Jamais de gradient agressif (rester sobre, doctrine brand "papier japonais")

#### E. Responsive mobile-first OBLIGATOIRE

- Breakpoints : `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- Hero mobile : H1 max 2 lignes, padding réduit, image OU texte (pas les 2)
- Grid cards : `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Touch targets : **minimum 44x44px** (Apple HIG + WCAG AAA)
- Font sizes : utiliser `clamp(min, viewport, max)` pour fluid typography H1/H2
- Tester ≤375px (iPhone SE) sans scroll horizontal

#### F. Animations sobres (GPU only)

- Transitions : `transition-colors duration-200` ou `transition-all duration-300 ease-out`
- Hover scale : max `hover:scale-[1.02]` (subtle)
- Pas d'animation continue/looping (sauf marquee logos)
- Pas de parallax (CLS killer)
- Reduced motion respecté : `motion-reduce:transform-none motion-reduce:transition-none`

#### G. ARIA + A11y AAA cible

- `aria-label` sur chaque section (français localisé selon `isFr`)
- `aria-labelledby` pointant vers H2 quand applicable
- `aria-hidden="true"` sur icônes décoratives Lucide
- `role="article"` sur cards FAQ + témoignages
- `<button>` jamais `<div onClick>` (KB nav obligatoire)
- Contraste min 7:1 (AAA) pour texte body, 4.5:1 (AA) pour large text
- Skip link `<a href="#main">` en haut de chaque page (déjà dans layout root probablement)
- Focus visible distinct (ring 2px terracotta, jamais d'`outline: none` sans replacement)

#### H. Cohérence cross-composants (DRY visuel)

- **Tous les Hero des 5 verticales** : même structure (eyebrow + H1 + lead 2 lignes + 2 CTAs + visual aside)
- **Toutes les TierGrid** : même grid layout 1→2→4 cols, mêmes hauteurs cards (use `min-h-[...]` aligné)
- **Toutes les Methodology** : même timeline horizontale 5 étapes (ProcessSteps shared component si possible)
- **Toutes les FAQ** : même accordion pattern (server-rendered `<details>` ou shared `<FaqAccordion />`)
- **Tous les CTA blocks finaux** : même `bg-ink text-paper` ou `bg-terracotta text-paper` selon doctrine brand

### Phase 2D.3 — Audit composants services post-Phase 2 vs DESIGN_RULES (1 agent Explore, 15 min)

Mission : grep tous les composants `src/components/services/*` créés Phase 2 et vérifier conformité avec `DESIGN_RULES.md`. Report violations :

- Hex hardcodé
- Touch target < 44px
- Pas de `aria-label`
- Hiérarchie H1>H3 (saut H2)
- Anim non-GPU
- Pas de mobile-first (classes desktop sans `sm:`/`md:` prefix)

### Phase 2D.4 — Fix violations (1 agent general-purpose, ~30 min, conditionnel)

Si Phase 2D.3 détecte violations → cet agent les corrige avant Phase 3.

---

## 3. Sous-sprint 2E — SEO/AEO/GEO + LLM extension contenu géolocalisé (~2h, 6 agents //)

À insérer **après Phase 6** (refactor templates ville) et **avant Phase 7** (cohérence).

### Phase 2E.1 — Stratégie SEO/AEO/GEO 2026 (1 agent general-purpose, 30 min, OUTPUT = doc + helpers)

Mission : créer `src/lib/seo/ville-verticale-seo.ts` (~250 lignes) + `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/SEO-AEO-GEO-STRATEGY.md` (~200 lignes) avec :

#### A. Meta tags perfection par combo (verticale × ville)

```ts
export function generateVilleVerticaleMetadata({ ville, verticale, locale }) {
  return {
    title: `${verticale.titleFr} à ${ville.nameFr} | Axion-IA — TPE, PME, ETI, Grandes Entreprises`,
    description: `${verticale.descFr} pour entreprises à ${ville.nameFr} et ${ville.regionFr}. ${verticale.uspFr}. Devis sous 48h.`.slice(0, 158),
    keywords: [
      `${verticale.slug} ${ville.nameFr}`,
      `${verticale.slug} ${ville.regionFr}`,
      `IA ${ville.nameFr}`,
      `intelligence artificielle ${ville.nameFr}`,
      ...verticale.relatedKeywords,
    ],
    openGraph: {
      title, description,
      images: [{ url: villeOgImage(ville, verticale), width: 1200, height: 630 }],
      locale: locale === "fr" ? "fr_FR" : "en_US",
      type: "website",
    },
    alternates: {
      canonical: `https://axion-ia.fr/${locale}/implantations/${ville.regionSlug}/${ville.slug}/${verticale.slug}`,
      languages: { "fr-FR": ..., "x-default": ... },
    },
    robots: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  };
}
```

#### B. JSON-LD schemas requis par page ville verticale

1. **Service** (verticale × ville) — avec `provider`, `areaServed: { City + Region }`, `serviceType`, `offers` (price range depuis pricing.ts)
2. **LocalBusiness** au format Service Area Business — `serviceArea: { Place name + geo }`, **PAS d'adresse postale fictive** (Will n'a pas d'agence physique à chaque ville — pattern SAB Google)
3. **BreadcrumbList** — Home > Implantations > Région > Ville > Verticale
4. **FAQPage** avec `mainEntity: [{ "@type": "Question", name, acceptedAnswer }]`
5. **SpeakableSpecification** (sous-objet du Service ou WebPage) — `cssSelector: [".speakable-hero", ".speakable-faq"]`
6. **QAPage** (alternative pour pages FAQ-heavy) — Google AI Overviews préfère
7. **HowTo** (méthodologie) — `step: [{ name, text, image? }]`
8. **Place** + **GeoCoordinates** pour la ville couverte (lat/lon depuis `getVille()`)
9. **ItemList** des communes proches (Phase 4 ville-2)
10. **Article** pour le body LLM (si > 300 mots) — `headline, datePublished, dateModified, author: Organization`

Helper : `src/lib/seo/jsonld-ville-verticale.ts` returns un `<JsonLd>` graph unique consolidant les 10 schemas en `@graph`.

#### C. AEO (Answer Engine Optimization) — pour ChatGPT/Perplexity/Gemini/Bing Copilot

- **llms.txt** : ajouter section dédiée villes verticales avec format MarkDown listant les 2 150 URLs + summary 1 ligne chacune (auto-généré depuis sitemap) — voir `src/app/llms.txt/route.ts` si existant ou créer
- **ai.txt** : équivalent pour AI training opt-in/out
- **FAQ format Q+A direct** : question = phrase interrogative complète, réponse = 1-2 phrases concises répondant directement (les LLMs aiment ce pattern pour le quote-back)
- **Speakable selectors** précis : `.speakable-answer` sur les réponses FAQ pour Google Assistant
- **Structured snippets** : utiliser `<table>` semantic pour comparaisons tier (Google extrait pour featured snippets)
- **Author markup** : `Person` schema sur les pages avec auteur identifiable (Manon) ou `Organization` sinon

#### D. GEO (Local SEO + Local Pack Google) — perfection 2026

- **Nom + adresse + téléphone (NAP)** cohérent partout : déjà OK via `src/content/company.ts` SSOT (vérifier)
- **OpenStreetMap embed** (privacy-friendly) optionnel sur sections "Couverture {ville}" — `<iframe>` avec lazy load
- **Google Business Profile** : si Will en a un, lier via `sameAs` dans Organization JSON-LD (à vérifier avec Will, **STOP & ASK si pas clair**)
- **Citations locales** : mention des chambres de commerce ville, écoles ingénieurs locales (Paris : ENS/Polytechnique, Lyon : INSA, Toulouse : ISAE) DANS LE BODY LLM ville-spécifique (jamais comme partenaires, mention écosystème)
- **Maillage interne** : chaque page ville verticale link 8-12 communes proches (déjà prévu via `VilleCommunesProches`) + 2-3 verticales sibling de la même ville
- **Hreflang strict** : `fr-FR` + `x-default` (EN désactivé selon AGENTS.md, donc pas de `en-US`)

### Phase 2E.2 — Extension LLM contenu géolocalisé (4 agents general-purpose //, ~1h30)

**Le problème actuel** : `landing-ville-shared.ts` cap à 200-380 mots. Sur 2 150 pages, c'est **thin content** = Google déclasse + pas d'AI Overviews quote-back.

**Solution** : 4 generators LLM additionnels spécialisés par section ville, capés total à **800-1 200 mots/ville** (vs 200-380).

#### Agent 2E.2-1 — `landing-ville-ecosystem.ts`

Pipeline LLM générant pour chaque (ville, verticale) :
- 150-250 mots sur **écosystème local IA** (acteurs/écoles/hubs/incubateurs)
- Mention chambres de commerce, écoles ingénieurs, hubs tech locaux
- **JAMAIS comme partenaires Axion-IA** — pure mention écosystème
- Anti-fabrication strict (banned list : LVMH, BNP, Cap Digital, Inria, Station F sauf en mention factuelle "Paris compte X hubs tech dont Station F")
- Speakable selector : `.speakable-ecosystem`

Output table : `GeneratedVilleEcosystem { ville, verticale, content, status, generatedAt }`

#### Agent 2E.2-2 — `landing-ville-secteurs.ts`

Pipeline LLM générant pour chaque ville (pas par verticale, partagé) :
- 100-200 mots sur **secteurs économiques dominants**
- Format : "À {ville}, les secteurs porteurs incluent {liste}. Pour ces secteurs, l'IA opérationnelle permet de {cas d'usage cross-verticales}."
- Source : Insee + open data ville (Will peut fournir CSV ou laisser LLM inférer depuis sa connaissance)
- Speakable selector : `.speakable-secteurs`

Output table : `GeneratedVilleSecteurs { ville, content, status, generatedAt }`

#### Agent 2E.2-3 — `landing-ville-faq-extended.ts`

Pipeline LLM générant pour chaque (ville, verticale) :
- **5-8 Q/R géolocalisées** (vs 2-3 actuel)
- Format strict Q+A direct (AEO pattern)
- Q types variés : tarif, délai, modalité (présentiel/distanciel), localisation (où me rencontrer ?), secteur (vous travaillez avec mon secteur X ?), légal (AI Act + RGPD), comparaison (vs autre prestataire)
- A : 1-2 phrases max, factuelles, jamais d'inventions (NDA/durée fixe/email fictif bannis comme dans landing-ville-shared)
- Speakable selector : `.speakable-faq-{n}` sur chaque réponse

Output table : `GeneratedVilleFaqExtended { ville, verticale, faqs (JSON), status, generatedAt }`

#### Agent 2E.2-4 — `landing-ville-cas-usage.ts`

Pipeline LLM générant pour chaque (ville, verticale) :
- **3-5 cas d'usage IA concrets** liés aux secteurs dominants de la ville × verticale
- Format card : titre court + 50-80 mots + "Bénéfice mesurable: {X heures/sem ou Y% productivité}"
- Anti-fabrication : pas de noms clients fictifs, formulation générique "Une entreprise de {secteur} à {ville}"
- Speakable selector : `.speakable-cas-usage`

Output table : `GeneratedVilleCasUsage { ville, verticale, cases (JSON), status, generatedAt }`

#### Prompt LLM template commun (réutiliser pattern landing-ville-shared.ts)

```
Tu es expert SEO/AEO/GEO 2026 + content writer brand Axion-IA (consulting IA opérationnelle FR).

Contexte : page ville {ville.nameFr} ({ville.regionFr}), verticale {verticale.titleFr}.

Données disponibles :
- Population : {ville.population}
- Code INSEE : {ville.insee}
- Région : {ville.regionFr}
- Secteurs dominants (si fourni) : {ville.secteurs?.join(", ")}

INTERDICTIONS STRICTES (cause de rejet auto si violé) :
- NDA, contact@axion-ia.com, durée d'audit fixe en jours
- Mentions partenariats LVMH/BNP/Cap Digital/Inria/Station F (sauf écosystème factuel "Paris compte X hubs")
- Clients fictifs nommés
- Adresse postale précise à {ville.nameFr} (Axion-IA = Service Area Business, pas d'agence locale)
- Promesses chiffrées non-justifiables (ROI X%, gain Y heures sans contexte)

OBLIGATIONS :
- Mention naturelle "{ville.nameFr}" 2-3 fois (pas keyword stuffing)
- Mention "{ville.regionFr}" 1 fois
- Inclusion TPE (1-10) + PME (10-250) + ETI (250-4999) + Grandes Entreprises (5000+) si audience mentionnée
- Brand voice : sobre, factuel, opérationnel, "papier japonais" (pas de vente agressive)
- Output JSON strict : { "content": "<markdown>", "speakable_selectors": [...] }

Génère {section} en {min}-{max} mots.
```

**Quality gates** (réutiliser `v7-phase8-shared.ts` strip + Zod) :
- Strip markdown wrapper ```json
- Validate Zod schema content + selectors
- Jaccard 3-gram check anti-duplicate vs hub ville + autres verticales même ville (< 30% overlap)
- Score qualité multi-judge (déjà dans pipeline content-gen v7)
- Promotion tier_1_indexable si score ≥ 55

### Phase 2E.3 — Câblage composants ville LLM-aware (1 agent general-purpose, 30 min)

Mission : modifier les composants ville Phase 4 (`VilleEcosystemeLocal`, `VilleCommunesProches`, `VilleFaqGeolocalisee`, `VilleTissuEconomique`) pour qu'ils :

1. Acceptent les contenus LLM des 4 nouveaux generators en props (ex: `<VilleEcosystemeLocal villeEcosystemContent={...} />`)
2. Stripent les sections vides gracefully (si LLM pas encore généré pour cette ville, fallback statique générique)
3. Injectent les Speakable selectors `.speakable-{section}` aux bons DOM nodes
4. Renderent JSON-LD spécifique (FAQPage / Article) au niveau composant ou consolidé page-level

---

## 4. Sous-sprint 2F — Web Vitals + A11y perfection (~45 min, 3 agents //)

À insérer **dans Phase 9** (vérification finale) comme **3 agents additionnels Pass B**.

### Agent 2F-1 — Audit Lighthouse 5 URLs Paris (Bash + Explore, 20 min)

Mission :
```bash
pnpm lhci autorun --collect.url=http://localhost:3000/fr/implantations/ile-de-france/paris \
                  --collect.url=http://localhost:3000/fr/implantations/ile-de-france/paris/audits \
                  --collect.url=http://localhost:3000/fr/implantations/ile-de-france/paris/interventions \
                  --collect.url=http://localhost:3000/fr/implantations/ile-de-france/paris/implementations \
                  --collect.url=http://localhost:3000/fr/implantations/ile-de-france/paris/un-a-un
```

Cibles strictes (AGENTS.md performance budget) :
- LCP ≤ 1 800 ms p75 (cible interne, Google good = 2 500 ms)
- INP ≤ 100 ms p75
- CLS = 0 strict
- TBT ≤ 150 ms desktop
- First Load JS ≤ 75 KB gz / route (exception 110 KB pour /reserver)

Report : Lighthouse score Perf/SEO/A11y/BestPractices par URL + bottlenecks identifiés.

### Agent 2F-2 — Audit A11y axe-core 5 URLs Paris (Bash + Explore, 15 min)

Mission :
```bash
pnpm playwright test --grep "a11y-axe-core-villes"
# ou si pas de test dédié : pnpm tsx scripts/run-axe-core.ts
```

Cible : **0 violation AAA** sur les 5 URLs Paris (Hero/H1/contraste/ARIA/keyboard nav/focus visible/touch targets/lang attribute/skip link).

Report : violations par URL + fix recommandations.

### Agent 2F-3 — Audit responsive 5 URLs Paris × 4 viewports (Playwright headless, 15 min)

Mission : screenshot 5 URLs sur 4 viewports (375px iPhone SE, 768px iPad, 1024px laptop, 1920px desktop). Vérifier :
- Pas de scroll horizontal
- Hero lisible mobile (H1 ≤ 2 lignes)
- Cards stack correctement mobile (1 col), tablet (2 cols), desktop (4 cols)
- Touch targets ≥ 44px
- Texte body ≥ 16px mobile
- Images responsive (srcset, loading=lazy sauf hero priority)

Report : 20 screenshots + issues identifiées.

---

## 5. Renforcement Phase 7 (vérification croisée cohérence)

**Ajouter 2 agents** aux 10 existants :

### Agent Coherence-11 — Design system conformité

Grep tous les composants `src/components/services/*` et `src/components/ville/*` pour :
- Hex hardcodé (doit être 0)
- `outline-none` sans replacement focus visible (doit être 0)
- `style={{ ... }}` inline (doit être 0 sauf cas justifié comme font-family Tailwind extend)
- Classes responsive sans mobile-first prefix (ex: `lg:grid-cols-4` sans `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- Touch targets `h-10` ou plus petit sur boutons (cibler `h-11`/`h-12`/`h-14` min = 44/48/56px)

Report violations + recommandations fix.

### Agent Coherence-12 — JSON-LD perfection 2026

Pour chaque page (5 services + 5 verticales Paris + 1 hub Paris = 11 URLs), valider via curl + parsing JSON-LD :
- Présence des 10 schemas listés Phase 2E.1.B
- Validation Schema.org via `https://validator.schema.org/` (HTTP fetch ou local validator)
- Speakable selectors présents et CSS-valides
- `@id` uniques sans collision
- `sameAs` Wikidata sur Organization (déjà couvert par Sprint v7 phase 10)

Report manquants + invalidités.

---

## 6. Renforcement Phase 9 (vérification finale)

**Ajouter 3 agents** Pass B (en plus des 5 existants) :

### Agent Final-B6 — Web Vitals top 1% gate

Comparer Lighthouse score actuel post-refactor vs baseline `main` (commit `abd18b71` pré-Sprint A) :
- Si LCP régresse > 100 ms → ⚠️ STOP & ASK Will
- Si bundle size delta > +5 KB gz vs main → ⚠️ STOP & ASK Will
- Si First Load JS > 75 KB gz sur une route → ⚠️ STOP & ASK Will

### Agent Final-B7 — SEO/AEO/GEO regression check

Pour chaque URL Phase 8 (11 URLs) :
- Meta title length 30-60 chars (sweet spot Google)
- Meta description length 140-158 chars
- H1 unique par page contenant le keyword principal
- Speakable JSON-LD valid + CSS selectors existent dans DOM
- llms.txt + ai.txt présents et à jour (mention nouvelles structures Sprint A)

### Agent Final-B8 — LLM content quality gate

Pour Paris 5 verticales, vérifier que les 4 generators LLM (Phase 2E.2) ont produit du contenu :
- Score qualité ≥ 55 (tier_1_indexable)
- Jaccard < 30% vs hub ville
- Anti-fabrication patterns bannis effectivement absents (regex post-LLM check)
- Speakable selectors injectés dans DOM rendu

Si Paris pas encore généré (table vide) → SKIP avec note "à backfill manuellement Will via `pnpm tsx scripts/regen-paris-villes.ts`".

---

## 7. Récapitulatif compteur sub-agents Sprint A complet (V2 + complément)

| Phase | Brief V2 | Complément | Total |
|---|---|---|---|
| 1 Recon services | 5 | 0 | **5** |
| 2 Extraction composants services | 5 | 0 | **5** |
| **2D Design system & frontend** (NEW) | 0 | 4 | **4** |
| 3 Refactor pages services | 5 | 0 | **5** |
| 4 Composants ville partagés | 4 | 0 | **4** |
| 5 Template verticale ville | 1 | 0 | **1** |
| 6 Template hub ville | 1 | 0 | **1** |
| **2E SEO/AEO/GEO + LLM extension** (NEW) | 0 | 6 | **6** |
| 7 Cohérence (renforcée +2) | 10 | 2 | **12** |
| 8 Tests runtime | 5 | 0 | **5** |
| 9 Finale double-pass (renforcée Pass B +3) | 15 | 3 | **18** |
| **2F Web Vitals + A11y** (NEW dans Phase 9) | 0 | 3 | **3** |
| 10 Commit + push + memory | 1 | 0 | **1** |
| **TOTAL sub-agents** | **52** | **18** | **~70** |

Estimation totale : **8-12h** avec parallélisation massive (vs 25-30h séquentiel sans complément).

---

## 8. Critères de succès complément

En plus des critères du brief principal §6 :

- [ ] `src/components/services/DESIGN_RULES.md` créé et respecté par tous les composants
- [ ] `src/lib/seo/ville-verticale-seo.ts` créé avec helpers metadata + JSON-LD complet
- [ ] `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/SEO-AEO-GEO-STRATEGY.md` documenté
- [ ] 4 nouveaux generators LLM (`landing-ville-{ecosystem,secteurs,faq-extended,cas-usage}.ts`) créés et testés sur Paris
- [ ] 4 nouvelles tables Prisma (`GeneratedVille{Ecosystem,Secteurs,FaqExtended,CasUsage}`) + migration
- [ ] Composants ville (Phase 4) câblés pour consommer le contenu LLM en props
- [ ] Speakable selectors `.speakable-{hero,ecosystem,secteurs,faq,cas-usage}` présents dans DOM
- [ ] 10 schemas JSON-LD validés sur 11 URLs testées (Service/LocalBusiness SAB/Breadcrumb/FAQPage/Speakable/QAPage/HowTo/Place+GeoCoord/ItemList/Article)
- [ ] Lighthouse 5 URLs Paris : Perf ≥ 95, SEO ≥ 95, A11y ≥ 95, BestPractices ≥ 95
- [ ] axe-core 5 URLs Paris : 0 violation AAA
- [ ] Responsive 5 URLs × 4 viewports : aucun scroll horizontal, touch targets ≥ 44px
- [ ] llms.txt + ai.txt mis à jour avec mentions structures Sprint A
- [ ] STOP & ASK Will si Web Vitals régresse vs baseline ou JSON-LD critique manquant

---

## 9. Action Will (1× setup avant que Opus exécute le complément)

Si Opus exécute le pipeline LLM Phase 2E.2 pour Paris, coût estimé : **~$3-5** (5 verticales × 4 generators × Claude Sonnet 4.6).

Will doit :
1. Confirmer budget LLM OK (déjà OK selon historique convs)
2. Vérifier `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` dans `.env.local`
3. Laisser Opus exécuter — pas d'action manuelle requise

Si Will veut **étendre à d'autres villes après Paris** : `pnpm tsx scripts/regen-villes.ts --villes=lyon,bordeaux,toulouse,marseille` (à créer si pas existant, ~30 min effort additionnel mais hors scope Sprint A).

---

## 10bis. Best practices 2026 additionnelles (CRITIQUES — ajoutées V2)

Ce qui a été oublié dans la version initiale du complément.

### A. E-E-A-T 2026 (Experience-Expertise-Authoritativeness-Trustworthiness)

Google Helpful Content System privilégie les pages avec **Experience pratique réelle** (depuis sept. 2023). Sans signaux E-E-A-T, page déclassée même si SEO technique parfait.

**À implémenter dans Sprint A** :

- **Author entity** : chaque page service ET verticale ville doit avoir un `Person` schema avec :
  - `name`, `jobTitle`, `worksFor: Organization Axion-IA`
  - `sameAs: [LinkedIn, Wikidata Q-ID si applicable, ORCID si applicable]`
  - `description` 1-2 lignes Experience pratique IA opérationnelle (X années, X clients accompagnés)
  - `image` portrait (Manon ou Will selon doctrine éditoriale brand)
  - **Référence cross-page** : `mainEntity.author` sur Article schema pointe vers ce Person `@id`

- **Experience signals dans body LLM** :
  - Prompt ajout : "Mentionne au moins 1 cas d'usage concret vécu (sans nommer client : 'Une entreprise de {secteur} à {ville} a réduit son temps {tâche} de X% après {intervention}')"
  - Évite formulations théoriques génériques ("l'IA peut faire X")
  - Préfère témoignages indirects ("nos clients constatent X")

- **Trust signals visibles** :
  - Lien footer vers `/methodologie` détaillant approche
  - Lien `/transparence` (déjà existant selon mémoire) avec persona Manon + AI Act compliance
  - Mention RGPD + AI Act dans chaque CTA bloc (footer composant)

### B. Helpful Content System (HCU) compliance

Google HCU pénalise les pages "made for SEO" sans valeur utilisateur.

**Règles à coder dans pipeline LLM Phase 2E.2** :

- Promp ajout : "Réponds à la question implicite '{intent_dominant_keyword}', ne fais pas que keyword-stuffer"
- Strip post-LLM : retirer patterns red flags HCU
  - "Dans cet article nous allons voir" (meta-narration)
  - "Pour conclure, il est important de" (transitions stéréotypées)
  - "En tant qu'expert en X" (claim non-justifiable)
  - "L'IA révolutionne" + variants (cliché)
- Quality gate ajout : reading level Flesch FR ≥ 60 (accessible), pas > 80 (trop simple)

### C. AI-generated content disclosure (transparence Google + AI Act EU)

Google n'interdit PAS le contenu LLM mais demande **transparence pour les sujets YMYL** (Your Money or Your Life). Axion-IA n'est pas YMYL strict mais consulting B2B → bonne pratique.

**À implémenter** :

- `<meta name="generator" content="Axion-IA editorial pipeline (multi-LLM + human review)" />` dans `<head>` des pages verticales ville
- Article JSON-LD ajout : `creativeWorkStatus: "Published"` + `assesses: "AI-assisted content with human editorial review"` (custom property)
- Footer mention 1 ligne : "Contenu rédigé avec assistance IA, supervisé éditorialement" (lien vers `/transparence`)
- AI Act EU Art. 50 transparency obligation (système IA générant contenu) — déjà couvert via `/transparence` page selon mémoire

### D. AI Crawlers robots.txt — opt-in stratégie 2026

**Décision stratégique** : opt-in massif pour AI crawlers (visibilité ChatGPT/Perplexity/Gemini) > paranoia training data.

**Vérifier** `axionia/public/robots.txt` (ou route handler) inclut :

```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: CCBot
Allow: /

User-agent: FacebookBot
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: PerplexityBot
Allow: /
```

**Note** : selon mémoire Sprint v7 audit (565/1000), robots conforme 19 bots — vérifier que ces 10 sont bien dedans.

### E. Cite-worthiness LLM (apparaître dans réponses ChatGPT/Perplexity)

LLMs préfèrent citer verbatim des paragraphes **structurés ainsi** :

1. **Claim factuel court** (1 phrase, 15-25 mots)
2. **Justification 1-2 phrases** (50-80 mots total paragraphe)
3. **Source explicite** (si applicable, mention "selon {entité}")

**Prompt LLM Phase 2E.2 ajout** :
```
Structure chaque paragraphe principal pour être citable verbatim par ChatGPT/Perplexity :
- Phrase 1 : claim factuel (15-25 mots)
- Phrases 2-3 : justification (total paragraphe 50-80 mots)
- Pas de transition "Tout d'abord", "En outre", "Pour conclure"
- Préfère phrases déclaratives directes, sujet-verbe-complément
```

**Speakable selectors par paragraphe** : `.cite-worthy-claim` injecté DOM-wise pour les 3-4 meilleurs paragraphes par page.

### F. Performance 2026 (au-delà de Lighthouse)

- **LCP image preload + fetchpriority** :
  ```tsx
  <link rel="preload" as="image" href={heroImage} fetchpriority="high" />
  // OU directement sur <Image priority fetchPriority="high" />
  ```
- **Next.js Image** : `priority` + `fetchPriority="high"` sur LCP, `loading="lazy"` partout ailleurs
- **View Transitions API** (Chrome 111+ baseline 2024) : smooth nav entre verticales
  ```tsx
  // root layout
  <meta name="view-transition" content="same-origin" />
  ```
- **Speculation Rules** : déjà implémenté Sprint V-04 selon mémoire, vérifier coverage 5 verticales
- **CSS containment** : `contain: layout style paint` sur sections lourdes (TierGrid, FAQ accordion)
- **font-display: swap** + **preload** critical fonts (serif H1 surtout, sans body)
- **WebP/AVIF avec fallback** : Next.js Image fait auto, vérifier `formats: ['image/avif', 'image/webp']` dans `next.config.js`
- **Critical CSS inline** above-fold : Next.js gère via App Router automatiquement (vérifier)
- **Resource hints** : `<link rel="preconnect" href="https://fonts.gstatic.com" />` si Google Fonts
- **Bundle splitting per route** : Next.js fait auto, vérifier via `pnpm build` reporting (First Load JS par route)

### G. WCAG 2.2 AAA (oct. 2023) — nouveaux critères

WCAG 2.2 a ajouté **9 nouveaux critères** vs 2.1. À couvrir :

- **2.4.11 Focus Not Obscured (AA)** : focus visible même si élément sticky/modal
- **2.4.13 Focus Appearance (AAA)** : focus ring ≥ 2px solid avec contraste 3:1 min vs background
- **2.5.7 Dragging Movements (AA)** : pas de drag-only (alternative click/keyboard)
- **2.5.8 Target Size Minimum (AA)** : 24×24 px min (sauf inline text, default UA, essential)
- **3.2.6 Consistent Help (A)** : si contact/help présent, place cohérente cross-pages
- **3.3.7 Redundant Entry (A)** : pas demander info déjà fournie (form pre-fill)
- **3.3.8 Accessible Authentication Minimum (AA)** : pas de CAPTCHA cognitif

**À auditer Phase 2F-2** (axe-core agent) : run avec règles WCAG 2.2 enabled :
```bash
pnpm playwright test --grep "a11y-axe-core-villes" -- --tags wcag22aaa
```

### H. Schema.org additions 2026

En plus des 10 schemas Phase 2E.1.B :

- **Organization** étendu : `founder: Person`, `employee: [Person]`, `numberOfEmployees: QuantitativeValue`, `award: [...]` si applicable
- **WebSite avec SearchAction** : sitelinks search box Google
  ```json
  {
    "@type": "WebSite",
    "url": "https://axion-ia.fr",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://axion-ia.fr/fr/recherche?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  ```
- **AggregateRating** + **Review** si témoignages réels existent (Will doit fournir vrais ratings — sinon SKIP, JAMAIS inventer)
- **DefinedTermSet** glossaire IA : déjà implémenté Sprint v7 phase 12 selon mémoire, vérifier coverage cross-template
- **CreativeWork avec encodingFormat** : si pages contiennent vidéos/podcasts (probable hero VideoObject sur home)
- **OpeningHoursSpecification** : SI Will a horaires fixes (probable "Lun-Ven 9h-18h" — à confirmer Will, sinon SKIP)
- **ContactPoint** dans Organization : telephone, email, contactType, areaServed, availableLanguage

### I. Stratification LLM par tier ville (économie + qualité)

**Problème actuel** : si on génère 1 200 mots × 2 150 villes × 5 verticales = 12,9M tokens output → ~$60-90 (Claude Sonnet 4.6 output $15/MT).

**Solution stratification** : générer profondément seulement pour les villes à fort potentiel SEO.

**Tier 1 (~100 villes, population > 50k)** : 1 000-1 200 mots/page, tous generators activés (ecosystem + secteurs + faq-extended + cas-usage)
**Tier 2 (~400 villes, 20k-50k pop)** : 600-800 mots/page, 2 generators (ecosystem + faq-extended seulement)
**Tier 3 (~1 650 villes, < 20k pop)** : 300 mots/page, generator existant `landing-ville-shared.ts` seulement

**Implémentation** : ajouter `cityTier` dans table `Ville` Prisma (déjà présent selon mémoire content-equity Sprint), router pipeline LLM selon tier.

**Coût estimé Paris 5 verticales (Tier 1)** : ~$0.50-1.00 par ville × 5 verticales × 4 generators = ~$10-20 pour Paris seul. Total Tier 1 + 2 + 3 sur 2 150 villes : ~$30-50.

### J. Stratégie IndexNow + crawl budget

- **IndexNow** (Bing/Yandex protocol) : push immédiat des nouvelles URLs vers Bing → reflété dans ChatGPT search + Copilot
  ```ts
  // src/server/seo/indexnow.ts
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    body: JSON.stringify({ host: "axion-ia.fr", key: env.INDEXNOW_KEY, urlList: [...] }),
  });
  ```
- À déclencher après chaque publication LLM ville (worker `content-publish-worker` selon mémoire)
- Google Search Console **API URL inspection** + **Indexing API** pour Job postings + Livestream uniquement (pas pour landing pages, contre TOS) → skip
- **Sitemap ping** : Google + Bing après chaque update (déjà via sitemap.ts ISR probablement)

### K. Privacy + accessibility médias

- **`prefers-reduced-motion`** : déjà mentionné §2D, à enforcer
- **`prefers-reduced-data`** : ne pas charger images hero hi-res si bandwidth-saver
  ```tsx
  <Image src={highRes} loading="eager" />
  // avec media query CSS :
  // @media (prefers-reduced-data: reduce) { .hero-img { content: url('low-res.webp'); } }
  ```
- **`prefers-contrast: more`** : tokens couleur dédiés (terracotta plus saturé, ink plus dark)
- **`forced-colors: active`** (Windows High Contrast) : tester avec emulator Chrome DevTools, garantir lisibilité
- **GPC (Global Privacy Control)** : honorer le header `Sec-GPC: 1` côté server (skip analytics, skip third-party)

### L. Multi-judge LLM quality (Sprint v7 phase 16 déjà fait)

Selon mémoire : multi-judge + originality.ai score ≥ 80 déjà implémenté. **Vérifier** que les 4 nouveaux generators Phase 2E.2 réutilisent ce pipeline (pas court-circuit).

Pattern : Sonnet 4.6 author → Haiku 4.5 critic ×3 (factual / style / brand) → Sonnet 4.6 arbitre → originality.ai → publish si score ≥ 55 (tier_1_indexable) ou ≥ 70 (tier_premium).

---

## 10ter. Scalabilité 2 150 villes + Tests E2E finaux + Knowledge Base RAG (CRITIQUE — ajouté V3)

Trois aspects sous-couverts en V1/V2 qui DOIVENT être traités pour Sprint A production-ready.

---

### M. Scalabilité 2 150 villes — Sous-sprint 2G (~1h30, 5 agents //)

À insérer **après Phase 6** (refactor templates ville) et **en parallèle de Phase 2E** (LLM extension).

#### Agent 2G-1 — Sitemap dynamique 12 900 routes (general-purpose, 30 min)

Mission : vérifier/mettre à jour `axionia/app/sitemap.ts` (ou équivalent) pour inclure :

- 2 150 URLs hub `/fr/implantations/{region}/{ville}` (déjà probablement présent)
- 10 750 URLs verticales `/fr/implantations/{region}/{ville}/{verticale}` (5 verticales × 2 150 villes)
- 5 URLs services principales `/fr/{audit,interventions,implementation,un-a-un,sites-web-augmentes}`
- Sub-sitemaps par batch de 50 000 URLs max (Google limit) si nécessaire
- `lastmod` dynamique depuis `GeneratedVilleCopy.updatedAt` (cache 1h)
- `changefreq: monthly` + `priority: 0.7` pour verticales, `priority: 0.8` pour hub villes

Report : nombre total URLs sitemap + validation XML schema + accessibilité `/sitemap.xml` + sub-sitemaps présents.

#### Agent 2G-2 — Sampling test 3 villes × 3 tiers (Explore + Bash, 20 min)

**Test au-delà de Paris** sur :
- **Tier 1 — Lyon** (~520k pop, IDF économique secondaire) : `/fr/implantations/auvergne-rhone-alpes/lyon/{audits,interventions,implementations,un-a-un,sites-web-ia}` (5 URLs)
- **Tier 2 — Annecy** (~125k pop, ville moyenne) : `/fr/implantations/auvergne-rhone-alpes/annecy/{5 verticales}` (5 URLs)
- **Tier 3 — Roanne** (~35k pop, ville rurale industrielle) : `/fr/implantations/auvergne-rhone-alpes/roanne/{5 verticales}` (5 URLs)

Pour chaque URL : 200 OK + H1 contient nom ville + sections rendues + JSON-LD valide + meta unique vs Paris.

**Si Tier 3 Roanne ne rend QUE le content statique (LLM non encore généré)** : OK c'est attendu (fallback statique générique du brief V2 §3 phase 4), report "LLM à backfill via Tier 3 pipeline".

#### Agent 2G-3 — Plan génération LLM massive stratifiée (general-purpose, 20 min, OUTPUT = doc + script)

Mission : créer `scripts/regen-villes-stratified.ts` + doc `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/PLAN-GEN-LLM-MASSIVE.md` :

```ts
// scripts/regen-villes-stratified.ts
// Usage: pnpm tsx scripts/regen-villes-stratified.ts --tier=1
//        pnpm tsx scripts/regen-villes-stratified.ts --tier=2 --resume-from=lyon
//        pnpm tsx scripts/regen-villes-stratified.ts --all

import { getVillesByTier } from "@/lib/villes";
import { generateVilleEcosystem, generateVilleSecteurs, generateVilleFaqExtended, generateVilleCasUsage } from "@/server/content-gen/generators";

const tier = parseArg("--tier") ?? "all";
const villes = await getVillesByTier(tier);
const verticales = ["audits", "interventions", "implementations", "un-a-un", "sites-web-ia"];

for (const ville of villes) {
  for (const verticale of verticales) {
    if (ville.tier === 1) {
      await Promise.all([
        generateVilleEcosystem({ ville, verticale }),
        generateVilleSecteurs({ ville }),
        generateVilleFaqExtended({ ville, verticale }),
        generateVilleCasUsage({ ville, verticale }),
      ]);
    } else if (ville.tier === 2) {
      await Promise.all([
        generateVilleEcosystem({ ville, verticale }),
        generateVilleFaqExtended({ ville, verticale }),
      ]);
    }
    // Tier 3 : skip (utilise landing-ville-shared.ts existant déjà appliqué)
  }
  console.log(`[gen-massive] ${ville.nameFr} done (tier ${ville.tier})`);
}
```

**Coût estimé total** :
- Tier 1 (~100 villes × 5 verticales × 4 generators) : ~$25-35
- Tier 2 (~400 villes × 5 verticales × 2 generators) : ~$35-50
- Tier 3 (~1 650 villes, déjà couvert pipeline existant) : $0 additionnel
- **TOTAL : ~$60-85** (vs $3-5 Paris seul)

**STOP & ASK Will** : Sprint A doit-il exécuter la gen massive (~$60-85) ou juste Paris proof of concept ($3-5) avec backfill manuel post-Sprint via script ?

Recommandation : **juste Paris en Sprint A** + script prêt pour Will à lancer manuellement après validation visuelle Paris. Gain : Sprint A reste contrôlable, Will valide qualité Paris avant d'engager $60-85.

#### Agent 2G-4 — Monitoring + rate-limit indexing Google (Explore, 15 min)

Mission : vérifier setup Google Search Console + sitemap submission :

- Vérifier `axionia/app/robots.txt` (ou route) inclut `Sitemap: https://axion-ia.fr/sitemap.xml`
- Vérifier que Google Indexing API n'est PAS utilisée pour landing pages (contre TOS, réservé Job posting + Livestream)
- Recommander à Will : soumission sitemap GSC manuelle + monitor coverage report
- Cible : 80% des 12 900 URLs indexées sous 30 jours, 95% sous 90 jours
- Rate limit Google : ~50k URLs/jour crawl budget pour un domaine moyen → 12 900 URLs OK
- IndexNow (Bing) : push automatique via Phase 2E §10bis.J après chaque gen LLM

Report : status sitemap + recommandations action Will (3 actions max).

#### Agent 2G-5 — Coolify deploy gate 12 900 routes SSG (Explore + Bash, 25 min)

Mission : vérifier que le build Docker GH Actions (AGENTS.md ADR 0026) supporte le SSG des 12 900 routes :

- Mesurer build time actuel sur main (~25 min selon AGENTS.md)
- Estimer build time post-Sprint A (les composants partagés sont LIGHTER que les copies inline, donc build devrait être ≤ 25 min ou même réduit)
- Vérifier disk usage build (~117 GB peak selon AGENTS.md sur 150 GB CPX42 = OK avec GH Actions 75 GB free)
- Vérifier `stub.invalid` proxy Prisma fonctionne pour les nouveaux composants (pas d'appel DB direct SSG)
- Vérifier que `BULLMQ_DISABLED=true` reste OK (pas de nouveau worker SSG-time)
- Vérifier `next.config.js` n'a pas de regression sur `experimental.ppr` ou `experimental.dynamicIO` qui pourrait affecter SSG

Report : build estimé OK/⚠️ + risques identifiés + recommandation gate (red/yellow/green).

---

### N. Tests E2E finaux production-ready — Sous-sprint 2H (~2h, 8 agents //)

À insérer **APRÈS Phase 9** (vérification finale double-pass) et **AVANT Phase 10** (commit final). C'est la **troisième passe de vérification** demandée explicitement par Will.

#### Agent 2H-1 — Playwright E2E user journeys cross-pages (general-purpose + Bash, 45 min)

Mission : créer/mettre à jour `tests/e2e/sprint-a-user-journeys.spec.ts` couvrant :

**Journey 1 — Discovery via SEO Paris audits**
```
1. Land /fr/implantations/ile-de-france/paris/audits (simulating Google)
2. Verify H1 contains "Paris", JSON-LD Service + LocalBusiness + Speakable
3. Scroll → all 9 sections rendered
4. Click CTA "Réserver un appel" → /appel (Calendly placeholder)
5. Back, click "Nous contacter" OrangeBanner → /contact + ?source=paris-audits param
6. Verify UnifiedContactForm pre-filled with ville=Paris + type=audit
```

**Journey 2 — Navigation cross-verticales**
```
1. Land /fr/audit (main service)
2. Click footer link "Implantations" → /fr/implantations
3. Click "Paris" → /fr/implantations/ile-de-france/paris (hub)
4. Click card "Audits" → /fr/implantations/ile-de-france/paris/audits
5. Verify breadcrumb cohérent + canonical correct
6. Click "Voir aussi : Interventions à Paris" link → cross-verticale link works
```

**Journey 3 — Mobile responsive Tier 3 ville rurale**
```
Viewport 375px iPhone SE
1. Land /fr/implantations/auvergne-rhone-alpes/roanne (Tier 3)
2. Verify no horizontal scroll
3. Verify hamburger menu opens correctly
4. Click "Audits à Roanne" card
5. Verify CTA buttons stack vertically + ≥44px height
6. Submit form via touch (simulated)
```

**Journey 4 — A11y keyboard navigation**
```
1. Land /fr/implantations/ile-de-france/paris/un-a-un
2. Tab through all interactive elements
3. Verify focus visible distinct on EVERY tab stop
4. Activate CTAs via Enter/Space (no mouse)
5. Verify skip-link works ("Aller au contenu principal")
6. axe-core scan zero AAA violations
```

**Journey 5 — Speakable Google Assistant simulation**
```
1. Land /fr/implantations/ile-de-france/paris/audits
2. Extract Speakable selectors from JSON-LD
3. Verify each selector matches DOM nodes
4. Verify selected text is coherent French phrases (not fragments)
5. Verify total speakable content < 90 seconds spoken (Google Assistant limit)
```

Report : 5 journeys × pass/fail + traces Playwright + screenshots.

#### Agent 2H-2 — Cross-device matrix (Playwright headless, 30 min)

Mission : screenshot 11 URLs (5 services + 5 verticales Paris + 1 hub Paris) sur 5 viewports :

| Device | Viewport | Pixel ratio |
|---|---|---|
| iPhone SE | 375×667 | 2x |
| iPhone 14 Pro | 393×852 | 3x |
| iPad Mini | 768×1024 | 2x |
| Laptop 13" | 1280×800 | 1x |
| Desktop 4K | 1920×1080 | 1x |

**Total : 55 screenshots** sauvegardés dans `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/screenshots/`.

Vérifications automatiques par image :
- Pas de scroll horizontal (width DOM ≤ viewport width)
- Touch targets ≥ 44px (extract via DOM measure)
- Texte body ≥ 16px mobile
- Hero LCP element visible above fold

Report : 55 screenshots + grille pass/fail.

#### Agent 2H-3 — Load testing k6 (Bash + general-purpose, 20 min)

Mission : créer `scripts/load-test-sprint-a.js` (k6 script) :

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // ramp-up
    { duration: '3m', target: 50 },   // sustained 50 VU
    { duration: '1m', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // p95 < 800ms
    http_req_failed: ['rate<0.01'],   // < 1% errors
  },
};

const URLS = [
  'http://localhost:3000/fr/implantations/ile-de-france/paris/audits',
  'http://localhost:3000/fr/implantations/auvergne-rhone-alpes/lyon/interventions',
  'http://localhost:3000/fr/implantations/provence-alpes-cote-d-azur/marseille/implementations',
  // ... 10 URLs sample (mix Tier 1/2/3 et verticales)
];

export default function () {
  const url = URLS[Math.floor(Math.random() * URLS.length)];
  const res = http.get(url);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
```

**Run** :
```bash
pnpm dev &
sleep 10
k6 run scripts/load-test-sprint-a.js
```

Cibles : p95 latency < 800ms, error rate < 1%.

Report : k6 output + identification bottlenecks (DB queries N+1 ? Render slow ? Image not cached ?).

#### Agent 2H-4 — SEO crawl homemade 100 URLs sample (general-purpose + Bash, 25 min)

Mission : créer `scripts/seo-crawl-sample.ts` qui :

1. Tire 100 URLs sample du sitemap (mix : 20 hub villes Tier 1+2+3 + 80 verticales Tier 1+2+3 × 5 verticales)
2. Pour chaque URL : fetch + parse HTML + extract :
   - meta title (length, unique)
   - meta description (length, unique)
   - H1 (count = 1, unique)
   - H2/H3 (hierarchy correct, no skip)
   - canonical (correct, points self)
   - JSON-LD (parse + validate via schema.org)
   - alt attributes on img (>= 80% coverage)
   - internal links count (>= 5 per page)
   - broken links (HEAD request, 200 OK)
3. Output report `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/SEO-CRAWL-REPORT.csv` avec score par URL

Cibles : 100% titles/desc unique cross-100-URLs, 0 broken link, 100% canonical correct, 0 H1 missing.

Report : CSV + top issues.

#### Agent 2H-5 — Test environnement Coolify production (Bash + Explore, 30 min, CONDITIONNEL)

**SI** Sprint A déjà pushé en prod via Coolify auto-deploy :

Mission : tester 10 URLs prod live (vs localhost dev) :

- 5 services principales : `https://axion-ia.fr/fr/{audit,interventions,implementation,un-a-un,sites-web-augmentes}`
- 5 verticales Paris : `https://axion-ia.fr/fr/implantations/ile-de-france/paris/{audits,interventions,implementations,un-a-un,sites-web-ia}`

Vérifications :
- 200 OK + content cohérent vs localhost
- Cloudflare cache headers présents
- HTTPS valide cert
- Lighthouse mobile via PSI API (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=...&strategy=mobile&category=performance&category=seo&category=accessibility`)
- Coolify deploy logs : aucune erreur

**SI** pas encore en prod : SKIP avec note "à run post-deploy par Will manuellement".

Report : 10 URLs prod status + scores PSI mobile + recommandations.

#### Agent 2H-6 — Régression baseline vs pré-Sprint A (Explore + Bash, 25 min)

Mission : comparer métriques actuelles vs commit `abd18b71` (pré-refactor) :

```bash
git checkout abd18b71 -- src/app/[locale]/audit/page.tsx
# Mesurer LOC + Lighthouse + bundle size baseline
git checkout HEAD -- src/app/[locale]/audit/page.tsx
# Mesurer post-Sprint A
# Diff les deux
```

Métriques comparées :
- LOC totale 7 fichiers (cible -50%, baseline 7 229 → cible 3 500)
- Bundle First Load JS par route (cible ≤ +0 KB, idéal -10 KB grâce dédup)
- Lighthouse Perf score (cible ≥ baseline, idéal +5 points grâce optim 2026)
- Vitest tests count + pass rate (cible : strictement >= baseline 1888/1895)
- TypeScript errors (cible : 0, baseline 0)

Report : tableau régression GO/NOGO.

#### Agent 2H-7 — Brand voice + content cohérence cross-2150-villes (Explore, 20 min)

Mission : sampler 20 villes random (mix tiers) et vérifier brand voice cohérent :

- Tone sobre "papier japonais" (pas vendeur agressif)
- Anti-fabrication patterns absents (NDA, contact@axion-ia, Big 4, LVMH, etc.)
- Inclusion TPE/PME/ETI/GE explicite
- Wording standard : "équipe d'experts" pas "restreinte"
- Mentions ville naturelles (pas keyword stuffing > 5 occurrences sur page <1000 mots)

Report : 20 URLs auditées + brand voice score moyen + violations détectées.

#### Agent 2H-8 — Sécurité headers + privacy compliance (Bash + Explore, 15 min)

Mission : vérifier headers HTTP sur 5 URLs sample :

- `Content-Security-Policy` présent + restrictif (script-src 'self' + nonces)
- `Strict-Transport-Security` max-age >= 31536000
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictif (camera, microphone, geolocation: ())
- Cookies : SameSite=Lax + Secure + HttpOnly
- `Sec-GPC: 1` header honoré (skip analytics si présent)

Report : 5 URLs × 7 checks = 35 verifs.

---

### O. Knowledge Base RAG intégration — Sous-sprint 2I (~1h, 3 agents //)

À insérer **dans Phase 2E.2** (extension LLM) — modification des 4 generators pour utiliser KB RAG.

#### Agent 2I-1 — Audit KB existante (Explore, 15 min)

Mission : explorer la KB :

- `axionia/src/server/kb/` : structure, tables Prisma `KnowledgeFact` ou similaire
- Nombre de facts actuel (mémoire indique 340 facts au dernier audit)
- Schéma : `id, content, category, source, embeddings, lastVerified, confidenceScore`
- Embeddings activés ? Selon mémoire OPENAI_EMBEDDINGS_ENABLED + backfill ~$0.09 Sprint Perfection Finalisation
- API search disponible : `searchKbByEmbedding(query, topK)` ou `searchKbByFts(query, topK)` ?

Report : état KB + API disponible + recommandation use Sprint A.

#### Agent 2I-2 — Câblage RAG dans 4 generators LLM (general-purpose, 30 min)

Mission : modifier les 4 generators Phase 2E.2 (`landing-ville-{ecosystem,secteurs,faq-extended,cas-usage}.ts`) pour intégrer RAG :

```ts
// Pattern RAG injection
async function generateVilleEcosystem({ ville, verticale }) {
  // Step 1 : RAG search
  const kbQuery = `écosystème IA ${ville.nameFr} ${ville.regionFr} ${verticale}`;
  const kbFacts = await searchKbByEmbedding(kbQuery, { topK: 5, minScore: 0.7 });

  // Step 2 : Inject in prompt
  const factsContext = kbFacts.length > 0
    ? `\n\nFAITS VÉRIFIÉS (source: KB Axion-IA, à mentionner si pertinent):\n${kbFacts.map(f => `- ${f.content} (source: ${f.source})`).join("\n")}`
    : "";

  const prompt = BASE_PROMPT + factsContext + `\n\nGénère le contenu écosystème.`;

  // Step 3 : LLM generate avec facts grounded
  const result = await callLLM(prompt, { provider: "anthropic", model: "claude-sonnet-4-6" });

  // Step 4 : Quality gate (anti-fabrication renforcé grâce RAG)
  return validateAndStrip(result);
}
```

**Bénéfices RAG** :
- Réduit hallucinations (facts grounded sur KB vérifiée)
- Améliore E-E-A-T (mentions de sources = Trustworthiness)
- Permet citations factuelles ("Selon X étude...")
- Compatible Multi-judge LLM (juge factual peut vérifier vs KB)

#### Agent 2I-3 — Enrichissement KB avec facts villes/secteurs (general-purpose, 15 min, OUTPUT = script)

Mission : créer `scripts/seed-kb-villes-facts.ts` qui peuple la KB avec :

- 100 facts villes (population, secteurs dominants, écosystèmes locaux)
- 50 facts régions (économie régionale, hubs tech)
- 30 facts AI Act EU (articles clés transparence, classification risk)
- 50 facts ROI IA opérationnelle (études McKinsey/Gartner/Forrester avec source URL)

Format strict :
```ts
{
  content: "Lyon compte ~520k habitants intra-muros et 2.3M en agglomération, avec 8 hubs tech actifs incluant TUBÀ et Le H7.",
  category: "ville_economy",
  source: "INSEE 2024 + recherche directe",
  confidenceScore: 0.9,
  lastVerified: "2026-05-25",
}
```

**À NE PAS exécuter automatiquement** (Will doit reviewer facts avant seed). Output = script prêt + doc dans `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/KB-VILLES-FACTS-PROPOSAL.md`.

---

### Mise à jour compteur sub-agents Sprint A complet (V3)

| Phase | V1+V2 | V3 ajout | Total V3 |
|---|---|---|---|
| 1 Recon services | 5 | 0 | **5** |
| 2 Extraction composants services | 5 | 0 | **5** |
| 2D Design system & frontend | 4 | 0 | **4** |
| 3 Refactor pages services | 5 | 0 | **5** |
| 4 Composants ville partagés | 4 | 0 | **4** |
| 5 Template verticale ville | 1 | 0 | **1** |
| 6 Template hub ville | 1 | 0 | **1** |
| 2E SEO/AEO/GEO + LLM extension | 6 | 0 | **6** |
| **2G Scalabilité 2 150 villes** (NEW V3) | 0 | 5 | **5** |
| **2I Knowledge Base RAG** (NEW V3) | 0 | 3 | **3** |
| 7 Cohérence | 12 | 0 | **12** |
| 8 Tests runtime | 5 | 0 | **5** |
| 9 Finale double-pass + 2F Web Vitals | 18 | 0 | **18** |
| **2H Tests E2E finaux production-ready** (NEW V3) | 0 | 8 | **8** |
| 10 Commit + push + memory + rapport | 1 | 0 | **1** |
| **TOTAL sub-agents** | **70** | **16** | **~83** |

Estimation totale : **10-14h** avec parallélisation massive (vs 30-35h séquentiel sans complément complet).

---

### Critères de succès V3 supplémentaires

En plus des critères §6 (brief) + §8 (complément V1) + §10bis (V2) :

- [ ] Sitemap inclut 12 900 URLs (2 150 hub + 10 750 verticales + 5 services + sub-sitemaps)
- [ ] Sample test Tier 1 Lyon + Tier 2 Annecy + Tier 3 Roanne → 15 URLs 200 OK
- [ ] Script `regen-villes-stratified.ts` créé + doc plan génération massive
- [ ] Coolify build gate vérifié (build time ≤ 25 min, disk OK, stub.invalid OK)
- [ ] Playwright E2E 5 user journeys ✅ pass
- [ ] Cross-device matrix 11 URLs × 5 viewports = 55 screenshots OK
- [ ] k6 load test p95 < 800ms, error rate < 1%
- [ ] SEO crawl 100 URLs sample : 100% titles/desc unique, 0 broken link, 100% canonical OK
- [ ] Régression baseline : LOC -50%, bundle ≤ +0 KB, Lighthouse ≥ baseline, vitest ≥ baseline
- [ ] Brand voice cohérent 20 villes random ≥ 9/10
- [ ] Security headers 5 URLs × 7 checks OK
- [ ] KB RAG câblé dans 4 generators LLM (facts injected in prompts)
- [ ] Script seed KB villes/secteurs créé (à run manuellement par Will)
- [ ] Test prod environnement Coolify SI Sprint A déjà pushé (sinon SKIP avec note)

---

## 10. Démarrage complément — phrase à coller dans nouvelle conv Opus après Sprint A V1 terminé

Will lance ce prompt **APRÈS** que la conv Opus Sprint A V1 a fini son travail (commit + push refactor DRY composants services + templates ville déjà livré). Le complément V1+V2+V3 s'exécute alors en **mode enrichment post-pass** dans une **nouvelle conv Opus dédiée**.

```
Le Sprint A V1 (refactor DRY pages services + verticales ville) a été livré dans un commit récent sur main. Maintenant exécute le COMPLÉMENT COMPLET (V1+V2+V3) best practices 2026 + scalabilité 2150 villes + tests E2E finaux + KB RAG.

═══ ÉTAPE 1 — Contexte complet ═══

Lis ces 4 sources :
1. C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-BRIEF-OPUS.md (brief principal Sprint A V1)
2. C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-COMPLEMENT-DESIGN-SEO-AEO-GEO.md (complément V1+V2+V3 best practices 2026)
3. C:\Users\willi\Documents\Projets\Axion-IA\axionia\AGENTS.md (instructions projet : Web Vitals budget, build externalisé, stub.invalid, EN désactivé)
4. git log --oneline -25 pour voir l'état Sprint A V1 livré

═══ ÉTAPE 2 — Exécution mode enrichment post-pass (~83 sub-agents, 10-14h compressée) ═══

Sous-sprints à exécuter (parallélisation massive obligatoire) :

A. Sous-sprint 2D design system (4 agents //) — DESIGN_RULES.md + audit conformité + fix violations sur composants déjà extraits par Sprint A V1

B. Sous-sprint 2E SEO/AEO/GEO + LLM extension (6 agents //) — helpers metadata SSOT + 10 schemas JSON-LD par page + 4 nouveaux generators LLM dédiés (ecosystem/secteurs/faq-extended/cas-usage)

C. Sous-sprint 2F Web Vitals + A11y (3 agents //) — Lighthouse + axe-core WCAG 2.2 AAA + responsive 4 viewports

D. 12 règles 2026 §10bis intégrées dans composants + generators :
   1. E-E-A-T (author Person entity sameAs Wikidata/LinkedIn)
   2. Helpful Content System (HCU) compliance
   3. AI-generated content disclosure (meta + AI Act EU)
   4. AI Crawlers robots.txt opt-in (GPTBot/ClaudeBot/PerplexityBot/Google-Extended/etc.)
   5. Cite-worthiness LLM (paragraphes 50-80 mots citables verbatim)
   6. Performance 2026 (fetchpriority, View Transitions, CSS contain, font preload)
   7. WCAG 2.2 AAA (Focus Not Obscured/Appearance, Target Size 24px, Consistent Help)
   8. Schema additions (Organization founder+employee, WebSite SearchAction, ContactPoint)
   9. Stratification LLM par tier ville (Tier 1 100 villes / Tier 2 400 / Tier 3 1650)
   10. IndexNow Bing push post-publication
   11. Privacy a11y (prefers-reduced-data, forced-colors, GPC honor)
   12. Multi-judge LLM réutilisé par les 4 nouveaux generators

E. **Sous-sprint 2G scalabilité 2 150 villes (5 agents //)** — §10ter.M
   - 2G-1 sitemap dynamique 12 900 routes (2150 hub + 10750 verticales + sub-sitemaps Google limit)
   - 2G-2 sampling test 3 villes × 3 tiers (Lyon Tier 1 + Annecy Tier 2 + Roanne Tier 3 = 15 URLs)
   - 2G-3 script `regen-villes-stratified.ts` + doc PLAN-GEN-LLM-MASSIVE.md (~$60-85 total stratifié)
   - 2G-4 monitoring + GSC rate-limit (50k URLs/jour) + IndexNow Bing
   - 2G-5 Coolify deploy gate 12 900 routes SSG (build time, disk, stub.invalid)
   STOP & ASK Will : exécuter gen massive ($60-85) ou juste Paris proof of concept ($3-5) avec script prêt pour Will à lancer après ?
   → Recommandation Sprint A : juste Paris + script prêt, Will lance manuellement après validation visuelle.

F. **Sous-sprint 2I Knowledge Base RAG (3 agents //)** — §10ter.O
   - 2I-1 audit KB existante (340 facts + embeddings backfill selon mémoire Sprint Perfection)
   - 2I-2 câblage RAG dans 4 generators LLM (searchKbByEmbedding topK=5 + inject facts in prompts)
   - 2I-3 enrichissement KB villes/secteurs/AI Act (script seed + doc proposal, Will reviewe avant exécution)

═══ ÉTAPE 3 — Vérification finale TRIPLE PASS (~26 sub-agents) ═══

Pass 1 — Cohérence (Phase 7 brief V1 + §10ter renforcements = 12 agents //)
Pass 2 — Tests runtime (Phase 8 brief V1 = 5 agents //) sur 11 URLs Paris + 15 URLs Tier sample
Pass 3 — Finale (Phase 9 brief V1 double-pass = 18 agents // : 10 Pass A fonctionnel + 5 Pass B production-ready + 3 Web Vitals/A11y/Responsive)

═══ ÉTAPE 4 — Sous-sprint 2H Tests E2E finaux production-ready (8 agents //) — §10ter.N ═══

C'est la TROISIÈME passe de vérification demandée explicitement par Will.

- 2H-1 Playwright E2E 5 user journeys cross-pages (Discovery SEO Paris, Navigation cross-verticales, Mobile Tier 3 rural, A11y keyboard, Speakable Google Assistant simulation)
- 2H-2 Cross-device matrix 11 URLs × 5 viewports = 55 screenshots (iPhone SE / iPhone 14 Pro / iPad Mini / Laptop / 4K)
- 2H-3 k6 load test (50 VU sustained 3 min, p95 < 800ms, error rate < 1%)
- 2H-4 SEO crawl homemade 100 URLs sample (titles/desc unique + JSON-LD valid + canonical + broken links)
- 2H-5 Test environnement Coolify production live SI Sprint A déjà pushé (sinon SKIP)
- 2H-6 Régression baseline vs commit pré-Sprint A (LOC -50% / bundle ≤ +0 KB / Lighthouse ≥ baseline / vitest ≥ baseline)
- 2H-7 Brand voice + content cohérence 20 villes random (mix tiers)
- 2H-8 Sécurité headers + privacy compliance 5 URLs (CSP, HSTS, GPC, etc.)

═══ ÉTAPE 5 — Commit + push + rapport consolidé ═══

1. Commit final atomique signé `Co-Authored-By: Claude Opus 4.7`
2. Push origin main --no-verify (hooks lourds, GH Actions re-checke)
3. Rapport `_AUDIT/SPRINT-A-VILLE-DRY-2026-05-25/RAPPORT-FINAL-COMPLEMENT-V3.md` consolidant les ~83 sub-agents + tableau régression baseline + Liste actions Will (recommandations post-Sprint : run gen LLM massive, valider KB facts seed, soumettre sitemap GSC)
4. Mémoire MEMORY.md mise à jour avec entrée Sprint A COMPLÉMENT V3 LIVRÉ

═══ RÈGLES STRICTES ═══

- Travaille sur main
- Lance les sub-agents en parallèle dans un seul message à chaque phase (Anthropic SDK les exécute vraiment en //)
- STOP & ASK Will uniquement si :
  * Web Vitals régresse > 100 ms vs baseline
  * Bundle delta > +5 KB gz
  * JSON-LD critique invalide schema.org
  * Coût LLM stratifié dépasse $100 (recommander juste Paris à la place)
  * Vitest régression > 5 tests
- Pas de validation Will intermédiaire entre phases (sauf STOP & ASK ci-dessus)
- Critères de succès finaux : §6 brief V1 + §8 complément V1 + §10bis V2 + §10ter V3 doivent TOUS être ✅ avant commit Phase 10

Bon enrichment Sprint A perfection extrême. 🎯
```

Bon Sprint A perfection extrême. 🎯
