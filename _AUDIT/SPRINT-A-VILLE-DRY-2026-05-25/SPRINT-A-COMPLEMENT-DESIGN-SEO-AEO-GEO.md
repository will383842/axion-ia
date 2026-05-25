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

## 10. Démarrage complément (à coller dans la conv Opus en cours)

```
COMPLÉMENT AU BRIEF SPRINT A : lis aussi le fichier
C:\Users\willi\Documents\Projets\Axion-IA\axionia\_AUDIT\SPRINT-A-VILLE-DRY-2026-05-25\SPRINT-A-COMPLEMENT-DESIGN-SEO-AEO-GEO.md
et intègre ces 3 sous-sprints supplémentaires (2D design system, 2E SEO/AEO/GEO + LLM extension, 2F Web Vitals + A11y) dans le plan global. Total sub-agents passe à ~70 vs 44. Critères de succès complément §8 doivent tous être ✅ avant Phase 10 commit final.
```

Bon Sprint A perfection extrême. 🎯
