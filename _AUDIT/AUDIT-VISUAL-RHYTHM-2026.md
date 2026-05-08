# Audit Visual Rhythm 2026 — Axion-IA

> **Statut** : ✅ **Sprint A + B LIVRÉ 2026-05-07** · build production clean · zéro régression
> **Date d'audit** : 2026-05-07
> **Date d'implémentation** : 2026-05-07 (cf. `_AUDIT/IMPLEMENTATION-STATUS-2026-05-07.md`)
> **HEAD de référence audit** : `c194caa` (post-pivot v3.1, palette v3.1 commitée)
> **Périmètre** : Top 20 pages stratégiques · style guide unifié · 53 prompts GPT-image · benchmarks 10 sites
> **Spec source** : `_AUDIT/PROMPT-VISUAL-RHYTHM-2026.md` v1.1.

---

## 0. Synthèse exécutive

**Diagnostic** : la grammaire visuelle d'Axion-IA tient sur **deux jambes solides** (5 HeroSchema éditoriaux gold-standard + iconographie Lucide 100% disciplinée, zéro hex hardcodé, zéro photo stock) et **une jambe absente** (rythme visuel des mid-sections + closings + 12/20 pages sans hero illustré). C'est une silhouette « consultant qui empile du contenu » sur la moitié des pages stratégiques, pas un cabinet IA premium 2026.

**Pages les plus problématiques** :

1. 🔴 `/methodologie` — page de réassurance majeure du tunnel Audit→Implémentation, **zéro visuel**, 280 mots, 4 numéros mono couleur primary, aucun ancrage. Priorité absolue.
2. 🔴 `/comparaisons` — enjeu AEO majeur, hero plain `<Section>`, aucun visuel.
3. 🟠 Sous-pages `ProductPageTemplate` (`/interventions/{slug}`, `/audit/{slug}`) — ~10-15 sous-pages héritent du template `ProductHero` sans schéma SVG. **Fix template = fix toute la collection.**

**Pages les plus saines** : `/`, `/audit`, `/stack-ia`, `/interventions`, `/implementation`, `/cas-concrets` (les 5 HeroSchema + Home SVG inline). Tout est déjà en place côté hero, il manque le closing visuel et 1-2 mid-sections sur `/`.

**Recommandation** : démarrer par scénario **MIN** (cf. § 4) — combler P0 critique uniquement, créer **3 nouveaux HeroSchema prioritaires** (`MethodologyHeroSchema`, patches `InterventionDetailHeroSchema` + `AuditDetailHeroSchema` dans `ProductPageTemplate`), générer **~8-10 illustrations GPT-image** sur les vrais blocages (pas les nice-to-have). Tester cohérence palette + style sur ce premier lot, puis arbitrer la suite (STANDARD ou PERFECTION) en connaissance de cause. Cette logique respecte la doctrine v1.1 « GPT-image en fallback ponctuel, pas pipeline systématique ».

**Effort cible MIN** : **~10h dev** + **~8-10 générations GPT-image** (~$2-3 OpenAI avec 30% retries inclus). Wall-clock **2-3 jours**.

**Effort total si on pousse à STANDARD** (P0+P1, recommandation ultérieure si MIN convainc Will) : 18-25h dev + ~30 illustrations + ~$6-8.

**Pas de PERFECTION par défaut** : le rapport documente la cible théorique 53 prompts pour exhaustivité, mais 7 « hero alternative » sur pages saines (`/`, `/audit`, `/implementation`, `/cas-concrets`, `/centre-aide`, `/contact`, `/reserver`, `/faq`) et 5 OG images (générables en Next 16 `ImageResponse` SVG sans bitmap) ne sont pas indispensables.

**Prompt préfixe brand** : validé v3.1 dans `_AUDIT/visual-style-guide.md` § 11 et tête de `_AUDIT/gpt-image-prompts.md`. Cite les 6 hex v3.1 EXACTS (`#c24a1b` / `#2a2520` / `#5e6c54` / `#faf8f3` / `#f0e9da` / `#1a1815`), aucune approximation tolérée.

**Données clés agrégées** :

- 5/20 pages strict avec HeroSchema (25%), 7/20 si on accepte variantes flow/stack/inline (35%).
- 36 fichiers consomment `lucide-react`, ~50 icônes distinctes, **0 fuite Heroicons/Phosphor**, **0 hex hardcodé sur icône**.
- `public/` : **0 image bitmap propriétaire**, 5 SVG démo Next à nettoyer, `press-kit/` vide.
- `buildImageObjectJsonLd` n'existe pas dans `lib/seo.ts` (gap GEO 2026).
- 1 seule route `/api/og/route.tsx` générique, **aucun `opengraph-image.tsx` per-page**.
- **Sparkles surutilisée** comme fourre-tout « innovation » sur 6 fichiers — dilue la sémantique.
- **`Building2` ×4 dans le matcher de `/audit`** — perte de différenciation visuelle.

---

## 1. Diagnostic global (synthèse chapitres 1-10)

> Les détails complets sont dans les 5 livrables agents : `visual-inventory.md` (Agent A), `heroschema-pattern-analysis.md` (Agent A), `benchmarks-visual-2026.md` (Agent B), `visual-style-guide.md` (Agent C), `gpt-image-prompts.md` (Agent C). Cette section ne fait que résumer pour la lecture exécutive.

### 1.1 Audit page-par-page (Ch.1)

- Cadence cible : **1 ancrage visuel tous les 1-2 écrans (~300-500 mots)**. Confirmée par benchmark Agent B (5-7 visuels narratifs par homepage, médiane sur 8 sites vérifiés).
- Réalité Axion-IA : `/methodologie` 0 visuel/280 mots, `/comparaisons` 0/80 mots chrome, `/blog` 0/50 mots chrome, `/centre-aide` 0/140 mots chrome → cadence **0** sur 10/20 pages.
- Pages en sur-densité d'icônes Lucide identiques : `/audit` (`Building2` ×4), `/stack-ia` (`Check` ×11+), `/centre-aide` (`ArrowUpRight` ×N). Doublons à varier ou contenir.

### 1.2 Hero & section openers (Ch.2)

- Pattern HeroSchema gold standard validé sur 5 fichiers (cf. `heroschema-pattern-analysis.md` §1). Invariants stricts : wrapper SSR `role="img"` + 3 halos + 1 grille + 1 mask vignette + 3 anneaux concentriques + liaisons pointillées + satellites halo-double + centre serif italique terracotta + 6 particules.
- 12/20 pages sans hero illustré (60% du périmètre). 5 HeroSchema déjà existants ; recommandation = **8 nouveaux HeroSchema** (1 critique + 5 important + 2 template ; cf. § 1.5 inventaire et table § 2 ci-dessous).
- Closing visuel avant CtaBlock final : **absent sur 20/20 pages**. Anti-pattern systématique → tous les CtaBlock terminent en texte mocha-rich.

### 1.3 Diagrammes & schémas (Ch.3)

- Pages éligibles diagrammes spécifiques (au-delà du HeroSchema orbital) : `/methodologie` (flow horizontal 4 étapes), `/audit` (déjà flow 3 actes ✅), `/roi` (sankey miniature), `/guide-ia` (taxonomie ramifiée), `/comparaisons` (matrice 2D).
- Pattern recommandé : **diagramme SVG codé en composant React** (pas image bitmap) pour scalabilité + cohérence palette + i18n labels via `messages/{fr,en}.json`. JAMAIS image bitmap GPT-image pour un diagramme — trop de risque texte parasite + uncanny valley sur UI.
- Composant cible recommandé : `<ProcessDiagram steps={[...]} variant="horizontal|vertical" accent="terracotta|primary|sage" />` paramétrable.

### 1.4 Illustrations narratives (Ch.4)

- 53 prompts GPT-image livrés (cf. `gpt-image-prompts.md` table maîtresse). Chacun cite hex v3.1 EXACTS, aspect ratio précisé, contraintes strictes (no text, no realistic faces, no stock corporate, no 3D iso).
- Préfixe brand unifié à coller en tête de chaque génération. Stratégie cohérence : seed=42 figé sur `gpt-image-1` API + workflow image-to-image à partir d'une référence absolue validée par Will (HOME-01-hero).

### 1.5 UI screenshots & dashboards (Ch.5)

- `/cas-concrets/[slug]` et `/comparaisons/[slug]` éligibles screenshots produit anonymisés (RGPD : flouter données nominatives, remplacer noms/emails par fictifs « Marie L. », `contact@exemple.fr`).
- Cadre stylisé recommandé : browser frame minimaliste, mocha border 1px, drop shadow subtle. Annotations en pointers SVG codés en overlay (i18n + a11y).
- Si pas de screenshot client disponible : **mock-up SVG codé en composant React** (jamais image bitmap GPT-image — uncanny valley sur UI).

### 1.6 Iconographie Lucide (Ch.6)

- **100% Lucide React** sur 36 fichiers, 0 fuite Heroicons/Phosphor/Tabler. Discipline parfaite.
- Stroke-width hétérogène mais **cohérent par contexte** : default 2 (nav/links), 2.25 (icônes module en pill/chip), 3 (Check dans chip circulaire). À documenter dans `Design.md`.
- Anti-patterns détectés : `Sparkles` surutilisée (à diversifier en `Award`/`Compass`/`Star` selon sémantique), `Building2` ×4 dans matcher `/audit` (à varier en `Building`/`Briefcase`/`Factory`/`Store`).
- `currentColor` respecté partout, **0 hex hardcodé** sur `<Icon className="text-..."`. ✅

### 1.7 Photos humaines (Ch.7)

- **STOP & ASK Will** : photo Will réelle (professionnelle, fond paper uni, filtre warm subtle 1:1 ou 4:5) ou portrait illustré GPT-image (silhouette stylisée non-réaliste, prompt `APROPOS-01-portrait`) ?
- Si photo réelle : pas de selfie iPhone, pas de LinkedIn corporate carré bleu. Production externe légère recommandée (~$200-400 photographe corporate FR ou amie photographe).
- Si illustrée : prompt prêt dans `gpt-image-prompts.md` (silhouette éditoriale 4:5).
- Anonymisation clients sur cas-concrets : pas de photo client réelle sans accord écrit signé. Préfère illustration GPT-image générique de la fonction (« CFO d'une PME industrielle »).

### 1.8 Image SEO / AEO 2026 (Ch.8)

- `buildImageObjectJsonLd` à créer dans `src/lib/seo.ts` : `{ url, caption, width, height, locale, representativeOfPage = true }`.
- `opengraph-image.tsx` per-page Top 20 via Next 16 `ImageResponse` (`next/og`). Réutiliser le SVG du HeroSchema en background, ajouter eyebrow + h1 + Axion-IA wordmark coin bas-droit. Format 1200×630.
- `<figure><img alt><figcaption>` plus puissant que `<img alt>` seul (signal sémantique GEO fort) — à appliquer sur les illustrations narratives clés.

### 1.9 Performance images (Ch.9)

- 0 image bitmap actuellement → impact perf nul, mais futur Sprint Visual Rhythm va introduire 53 illustrations AVIF (~30-80 KB chacune, ~2-4 Mo total).
- Préconisations : AVIF source primaire + WebP fallback, `next/image` partout (jamais `<img>` brut), `priority` uniquement sur hero, `placeholder="blur"` avec `blurDataURL` build-time via `plaiceholder` ou alternative pure-native.
- Sizing exact via `sizes` attribute (mobile ≠ desktop). Total page weight cible < 1 Mo sur pages standard.

### 1.10 Style guide & cohérence (Ch.10)

- Style guide unifié livré : `_AUDIT/visual-style-guide.md` (3909 mots, 11 sections). Couvre palette stricte par token avec usages autorisés/interdits, iconographie Lucide stroke 1.5/2/2.25/3, illustration éditoriale anti-patterns, photo Will, diagramme line-art, hiérarchie 4 niveaux, cohérence inter-pages, animation `prefers-reduced-motion`, naming `public/{illustrations|screenshots|portraits|og}/`, versioning `-v1`, cohérence multi-générations (5 stratégies cumulables).
- Cohérence inter-pages : 1 concept = 1 icône partout. À auditer ponctuellement (cas-concret = `<Briefcase>`, intervention = `<Mic>`, etc.).

---

## 2. Fiches prescriptives par page (Top 20)

> Format compact : verdict · word count chrome · gaps détectés · prescriptions P0/P1/P2 (type + composant cible + prompt ID + effort + alt text). Les prompts GPT-image complets (préfixe brand + sujet + composition + contraintes + checklist validation) sont dans `_AUDIT/gpt-image-prompts.md`.

---

### A. Pillar pages (5)

#### A1. `/` (home) — 🟢 sain (mais perfectible)

- **Inventaire** : hero SVG inline 600×680 (entreprise+3 services satellites), 8 sections mid (cards numérotées + metrics mocha-rich + cases + testimonials + FAQ), CtaBlock final texte mocha. Word count chrome ~2 100.
- **Gaps détectés** : (a) hero SVG inline non extrait → **pourrait être `HomeHeroSchema`** pour homogénéité avec les 5 autres ; (b) sections `Why`/`Method`/`Cases`/`Testimonials` plain (4 sections sans ancrage visuel propre — visuel collectif via numéros serif géants existe mais sans illustration) ; (c) closing visuel absent.
- **P0 — Closing illustration** : type GPT-image, slot `home-closing` 16:9, prompt **HOME-04-closing**, composant cible `<HomeClosingIllustration>` placé juste avant CtaBlock final. Effort dev 1.5h. Alt FR « Vue éditoriale d'un cabinet IA opérationnel en mouvement. »
- **P1 — Mid-section illustrations** : type GPT-image ×2, slots 1:1, prompts **HOME-02-mid** (compas architectural précision) + **HOME-03-mid** (vagues opérationnelles continues). Effort dev 2h.
- **P1 — Hero illustration alternative** : type GPT-image 16:9, prompt **HOME-01-hero** (architectural diagram). À garder en alternative au SVG inline si Will préfère illustration GPT-image plutôt que schéma SVG. Effort dev 1h (intégration `next/image priority`).
- **P2 — Extraction `HomeHeroSchema.tsx`** : type composant React, refactor du SVG inline 400 LOC en composant dédié homogène avec les 5 autres. Skeleton dans `heroschema-pattern-analysis.md` § 4. Effort dev 4h.
- **P2 — `opengraph-image.tsx` Home** : prompt **OG-HOME-01** (1200×630). Effort dev 1h (Next 16 `ImageResponse`).

#### A2. `/interventions` — 🟢 sain (gold standard parity)

- **Inventaire** : `InterventionsHeroSchema` (5 satellites orbital), 5 cards formats avec KPIs, Anti-fear 3 niveaux, CtaBlock dark texte. Word count ~1 800.
- **Gaps** : (a) section anti-fear plain (3 cards level/title/body) ; (b) closing visuel absent ; (c) `Check` ×5 et `ArrowRight` ×10+ sans hiérarchie.
- **P1 — Mid-section illustration** : prompt **INTERV-01-mid** (silhouettes équipe écoutant un signal). Slot 1:1 entre formats et anti-fear. Effort 1.5h.
- **P1 — Closing illustration** : prompt **INTERV-02-closing**. Effort 1.5h.
- **P2 — Diversifier `Check` bullets** : remplacer par mix `Check`/`Dot`/`PlusCircle` selon sémantique outcome vs feature. Effort 0.5h.
- **P2 — `opengraph-image.tsx /interventions`** : réutiliser le SVG `InterventionsHeroSchema` en background. Effort 1.5h.

#### A3. `/audit` — 🟢 sain (page la plus dense visuellement)

- **Inventaire** : `AuditHeroSchema` flow 3 actes, TrustBadges, matcher 8 options icônes, pyramide 4 niveaux avec price tag serif italique terracotta XL, table tarifs, quiz Q/A, WhyAxion-IA, SignatureCard, FAQ, anti-fear 3 stages, BeyondAuditBlock. Word count ~3 500.
- **Gaps** : (a) `Building2` ×4 dans matcher (perte différenciation) ; (b) sections quiz + tarifs + anti-fear plain ; (c) closing visuel absent.
- **P0 — Diversifier matcher icons** : 4 options « par taille » → `Building2` (TPE) / `Building` (PME) / `Briefcase` (ETI) / `Factory` (industrie). Effort 0.5h.
- **P1 — Hero illustration alternative AVIF** : prompt **AUDIT-01-hero** (cabinet d'architecte). Garder optionnellement avec le flow SVG. Effort 1h.
- **P1 — Process illustration mid** : prompt **AUDIT-02-process** 4:5. Slot avant pyramide. Effort 1.5h.
- **P1 — Closing illustration** : prompt **AUDIT-03-closing**. Effort 1.5h.
- **P2 — `opengraph-image.tsx /audit`** : prompt **OG-AUDIT-01** ou réutilisation SVG flow. Effort 1.5h.

#### A4. `/stack-ia` — 🟢 sain (monogrammes exemplaires)

- **Inventaire** : `StackHeroSchema` (6 satellites + cluster 11 dots centre), Manifeste 3 cards numérotées, 5 sections catégories avec `<ToolLogo>` monogrammes 14×14, Combos 6 articles, « Ce qu'on a écarté » 6 articles, FAQ. Word count ~3 200.
- **Gaps** : (a) Manifeste plain (3 cards numérotées sans illustration) ; (b) Combos plain ; (c) closing visuel absent ; (d) `Check` ×11+ (1 par outil × 3 use cases — patterns identiques sans hiérarchie).
- **P1 — Mid-section illustration Manifeste** : prompt **STACK-01-mid** (atelier d'outils éditorial). Effort 1.5h.
- **P1 — Closing illustration** : prompt **STACK-02-closing**. Effort 1.5h.
- **P2 — `opengraph-image.tsx /stack-ia`** : prompt **OG-STACK-01** + cluster monogrammes en réplique réduite. Effort 1.5h.

#### A5. `/methodologie` — 🔴 critique (priorité absolue)

- **Inventaire** : Hero plain `<Section>`, 1 section unique `<ol grid lg:grid-cols-4>` avec 4 numéros mono `text-primary text-2xl tabular-nums` + h2 + p, CtaBlock dark texte. Word count ~280. **Aucune icône, aucune illustration, aucun visuel sur la page.**
- **Gaps** : (a) hero zéro visuel ; (b) section 4 étapes zéro ancrage visuel ; (c) closing visuel absent ; (d) page de réassurance majeure du tunnel Audit→Implémentation traitée en sous-page d'about.
- **P0 — Créer `MethodologyHeroSchema.tsx`** : type flow horizontal 4 étapes (variante de `AuditHeroSchema`). Satellites = 4 (Diagnostic→Conception→Mise en œuvre→Mesure). Accents = terracotta→primary→sage→mocha. Skeleton dans `heroschema-pattern-analysis.md` § 5. Effort 5h.
- **P0 — Hero illustration alternative AVIF** : prompt **METHO-01-hero** 16:9 (cabinet d'architecte avec plan ouvert). À utiliser **en plus** du HeroSchema (le HeroSchema en colonne droite, l'illustration en `<figure>` après le H1). Effort 1.5h.
- **P1 — Mid-section diagramme processus** : prompt **METHO-02-mid** 1:1 (sablier opérationnel) + prompt **METHO-03-mid** 4:5 (cycle continu). Effort 3h.
- **P1 — Closing illustration** : prompt **METHO-04-closing**. Effort 1.5h.
- **P1 — Étendre la page** : ajouter section « Pourquoi cette méthodologie » (~300 mots) entre les 4 étapes et le CtaBlock, pour passer de 280 mots à ~600 mots et accueillir un mid-visual. Effort copy 2h (Will).
- **P2 — `opengraph-image.tsx /methodologie`** : prompt **OG-METHO-01**. Effort 1.5h.

---

### B. Listings pages (5)

#### B1. `/implementation` — 🟢 sain

- **Inventaire** : `ImplementationHeroSchema` desktop (8 satellites) + grid 2×4 mobile fallback, bandeau 4 pills Lucide, 2 portes, catalogue 8 fonctions, pricing 3 tiers, comparatif Make/Agence/Axion-IA (table 3 cols avec colonne mise en avant scale 1.04 ring + badge ★), scénarios 6 segments avant/après serif metric, ProcessSteps 5 étapes, FAQ. Word count ~3 800.
- **Gaps** : (a) catalogue 8 fonctions plain ; (b) pricing plain ; (c) ProcessSteps déjà visuel mais perfectible ; (d) closing visuel absent.
- **P1 — Mid-section illustration** : prompt **IMPL-02-mid** (atelier d'intégration). Effort 1.5h.
- **P1 — Closing illustration** : prompt **IMPL-03-closing**. Effort 1.5h.
- **P2 — Hero illustration alternative AVIF** : prompt **IMPL-01-hero** (en complément du HeroSchema). Effort 1h.

#### B2. `/cas-concrets` — 🟢 sain

- **Inventaire** : `CaseStudiesHeroSchema` variante stack 3 mini-cards, filtres pills industrie+taille, grille `CaseStudyCard`. Word count chrome ~280.
- **Gaps** : (a) section filtres plain ; (b) grille listing plain ; (c) closing visuel absent.
- **P1 — Hero illustration alternative AVIF** : prompt **CAS-01-hero** (étagère bibliothèque éditoriale). Effort 1h.
- **P1 — Mid-section illustration** : prompt **CAS-02-mid** (collection objets opérationnels). Effort 1.5h.
- **P2 — Listing illustration** : prompt **CAS-03-listing** 4:5 (vue tableau de bord magazine). Effort 1.5h.
- **P2 — `opengraph-image.tsx /cas-concrets`** : prompt **OG-CAS-01**. Effort 1.5h.

#### B3. `/comparaisons` — 🔴 critique

- **Inventaire** : hero plain `<Section>`, grille `<ArticleCard>` simple, **pas de CtaBlock final**. Word count chrome ~80.
- **Gaps** : (a) hero zéro visuel ; (b) listing zéro ancrage ; (c) aucun closing ; (d) enjeu AEO majeur (page comparaisons IA = canal de citation LLM critique).
- **P0 — Créer `ComparisonsHeroSchema.tsx`** : variante triangle 3-pôles (vous au centre, 2 alternatives en regard). Accents = terracotta · primary · sage. Effort 4h.
- **P0 — Hero illustration alternative AVIF** : prompt **COMP-01-hero** (balance/matrice éditoriale). Effort 1.5h.
- **P1 — Mid-section illustration matrix** : prompt **COMP-02-matrix** 1:1 (matrice 2D). Effort 1.5h.
- **P1 — Ajouter CtaBlock final** : pattern déjà éprouvé (cf. `/audit`). Effort 0.5h.

#### B4. `/blog` — 🟠 important

- **Inventaire** : hero plain `<Section>`, grille `<ArticleCard>`, CtaBlock texte. Word count chrome ~50.
- **Gaps** : (a) hero zéro visuel ; (b) cards article génériques ; (c) closing visuel absent.
- **P1 — Créer `BlogHeroSchema.tsx`** : variante stack 3 mini-articles (variante `CaseStudiesHeroSchema` avec date+tag+title). Effort 3h.
- **P1 — Hero illustration alternative AVIF** : prompt **BLOG-01-hero** (kiosque éditorial). Effort 1.5h.
- **P2 — Article generic illustration** : prompt **BLOG-02-article-generic** (pour `<ArticleCard>` sans cover dédiée). Effort 1.5h.

#### B5. `/centre-aide` — 🟠 important

- **Inventaire** : hero plain `<Section tone="halo-warm">`, grille thématiques `<Card>` avec ArrowUpRight, liste articles avec ArrowUpRight × N. Word count chrome ~140.
- **Gaps** : (a) hero zéro visuel ; (b) `ArrowUpRight` ×N (~50+ articles) sans variation ; (c) closing visuel absent.
- **P1 — Créer `HelpHeroSchema.tsx`** : constellation 5-7 thématiques (variante orbital, 6 satellites mocha). Effort 3.5h.
- **P1 — Hero illustration alternative AVIF** : prompt **AIDE-01-hero** (bibliothèque conseils ouverte). Effort 1.5h.
- **P2 — Section illustration** : prompt **AIDE-02-section**. Effort 1.5h.

---

### C. Produit/process pages (4)

#### C1. `/interventions/dirigeants` — 🟠 important (template)

- **Inventaire** : `ProductPageTemplate` → `ProductHero` plain (bg-halo-warm, border-l-4 accent, eyebrow, h1 serif, Price, CTAs, **pas de visuel à droite**), DayScheduleSection module 1 only, FeatureGrid, ProcessSteps, MetricsRow, FaqBlock, CtaBlock. Word count via data ~1 200.
- **Gaps** : (a) hero plain (pas de schéma SVG dans `ProductPageTemplate`) ; (b) ~10 sous-pages héritent — fix template = fix toute la collection.
- **P0 — Créer `InterventionDetailHeroSchema.tsx`** : daily timeline horizontale (matin/midi/après-midi) avec 3-4 timeline blocks accent du module. Skeleton dans `heroschema-pattern-analysis.md` § 5. Effort 5h.
- **P0 — Patcher `ProductPageTemplate`** : injecter `<InterventionDetailHeroSchema>` à droite du `ProductHero` en lg:grid-cols-2. Toutes les sous-pages bénéficient instantanément. Effort 1h.
- **P1 — Hero illustration alternative AVIF** : prompt **INT-DIR-01-hero**. Effort 1.5h.
- **P1 — Mid-section illustration** : prompt **INT-DIR-02-mid**. Effort 1.5h.

#### C2. `/interventions/equipes` — 🟠 important (template)

- Identique à dirigeants (même template).
- **P0** : couvert par patch `ProductPageTemplate` ci-dessus.
- **P1 — Hero illustration AVIF** : prompt **INT-EQ-01-hero**. Effort 1.5h.
- **P1 — Mid-section illustration** : prompt **INT-EQ-02-mid**. Effort 1.5h.

#### C3. `/audit/strategique-pme` — 🟠 important (template)

- Identique pattern `ProductPageTemplate`.
- **P0 — Créer `AuditDetailHeroSchema.tsx`** : 3 livrables empilés (variante stack). Accents = accent du niveau. Effort 4h.
- **P0 — Patcher `ProductPageTemplate` côté `/audit/{slug}`** : Effort 1h.
- **P1 — Hero illustration AVIF** : prompt **AUD-PME-01-hero**. Effort 1.5h.
- **P1 — Mid-section illustration** : prompt **AUD-PME-02-mid**. Effort 1.5h.

#### C4. `/guide-ia` — 🟠 important

- **Inventaire** : hero plain `<Section>`, sommaire 6 chapitres en `<ol>` avec `text-primary font-mono` numérotation, NewsletterForm. Word count chrome ~180.
- **Gaps** : (a) hero zéro visuel pour un lead magnet ; (b) sommaire pas illustré (taxonomie ramifiée serait pertinente) ; (c) closing visuel absent.
- **P1 — Hero illustration AVIF** : prompt **GUIDE-01-hero** (couverture livre éditorial ouvert). Effort 1.5h.
- **P1 — Mid-section taxonomie** : prompt **GUIDE-02-mid** 4:5 (arbre/réseau de chapitres). Effort 1.5h.
- **P1 — Closing illustration** : prompt **GUIDE-03-closing**. Effort 1.5h.
- **P2 — Composant `<TocDiagram>`** : taxonomie SVG codée à la place de l'illustration GPT-image (plus puissant pour cliquabilité chapitres). Effort 5h.

---

### D. Éditoriales pages (3)

#### D1. `/a-propos` — 🟠 important

- **Inventaire** : hero plain `<Section>`, `<TimelineBlock>` parcours, `<TeamGrid>` (next/image avatars), 3 paragraphes valeurs, CtaBlock. Word count chrome ~150.
- **Gaps** : (a) hero éditorial premium attendu sur « À propos » cabinet IA — actuellement plain ; (b) section valeurs plain.
- **P0 — Créer `AboutHeroSchema.tsx`** : timeline verticale `ABOUT_TIMELINE` (data déjà en place). 4-6 events, accent terracotta. Effort 4h.
- **P0 — Décision Will : photo réelle vs illustrée** : si réelle, production externe ~$200-400 ; si illustrée, prompt **APROPOS-01-portrait** silhouette éditoriale 4:5 prêt. **STOP & ASK** avant de figer.
- **P1 — Mid-section illustration valeurs** : prompt **APROPOS-02-mid** (atelier précis, traces de craie). Effort 1.5h.
- **P1 — Closing illustration** : prompt **APROPOS-03-closing**. Effort 1.5h.

#### D2. `/contact` — 🟢 sain (utilitaire)

- **Inventaire** : hero plain `<Section tone="halo-warm">`, 3 cards `<Card>` « Trois façons de nous joindre », ContactForm, CtaBlock. Word count chrome ~190.
- **Gaps** : page utilitaire, le formulaire domine légitimement. Mais hero pourrait être teasé visuellement.
- **P2 — Hero illustration AVIF discrète** : prompt **CONTACT-01-hero** (porte ouverte éditoriale). Optionnel. Effort 1.5h.
- **P2 — Mid-section illustration** : prompt **CONTACT-02-mid**. Effort 1.5h.

#### D3. `/presse` — 🟠 important

- **Inventaire** : hero plain `<Section>` avec 2 boutons (Download + Mail), pitch 2 colonnes serif + `<PressFacts>`, `<PressKit>`, `<PressReleases>`, `<PressSpokesperson>` (next/image avatars), `<MediaCoverage>`, `<PressContact>` mocha bandeau, `<FaqBlock>`. Word count chrome ~600.
- **Gaps** : (a) hero pauvre vs richesse mid-section (déséquilibre) ; (b) press-kit 6 placeholders (logo, palette, type, etc.) actuellement vides — gating critique pour cette page.
- **P0 — Créer `PressHeroSchema.tsx`** : stack 3 facts clés (`PRESS_FACTS` data déjà en place). Effort 3.5h.
- **P0 — Livrer press-kit** (Sprint 14.6) : 6 assets propriétaires (wordmark SVG + monogrammes + palette PDF + type spec + favicon/icons + screenshot homepage). Effort 4h. **Gating** sur Visual Rhythm complet sur `/presse`.
- **P1 — Hero illustration AVIF** : prompt **PRESSE-01-hero** (vitrine éditoriale magazine). Effort 1.5h.
- **P1 — Mid-section illustration** : prompt **PRESSE-02-mid**. Effort 1.5h.

---

### E. Utilitaires denses (3)

#### E1. `/roi` — 🟠 important

- **Inventaire** : hero plain `<Section>`, `<RoiSimulator>` composant client (Clock/Users/FileText/Mail/Sparkles), CtaBlock dark. Word count chrome ~150.
- **Gaps** : (a) hero ne teaser pas le simulator (zéro visuel) ; (b) 4 outputs du simulator pourraient être teasés en miniature.
- **P0 — Créer `RoiHeroSchema.tsx`** : 2 curseurs visuels miniatures (avant slider réel) avec sankey miniature dessous. Effort 4h.
- **P1 — Hero illustration sankey AVIF** : prompt **ROI-01-sankey** 16:9 (flux opérationnel canalisé). Effort 1.5h.
- **P1 — Closing illustration** : prompt **ROI-02-closing** 1:1. Effort 1.5h.

#### E2. `/reserver` — 🟢 sain (calendrier domine)

- **Inventaire** : hero compact py-12 plain (3.5rem clamp), `<BookingCalendar>` composant client domine, CtaBlock CGV. Word count chrome ~120.
- **Gaps** : page utilitaire, calendrier = élément visuel principal légitime. Mais hero peut être teasé doucement.
- **P2 — Hero illustration AVIF discrète** : prompt **RES-01-hero** (calendrier éditorial annoté). Effort 1.5h.
- **P2 — Mid-section illustration rassurante** : prompt **RES-02-mid**. Effort 1.5h.

#### E3. `/faq` — 🟢 sain (utilitaire)

- **Inventaire** : hero plain `<Section tone="halo-warm">`, `<FaqBlock>` accordion + section « Index » liste avec `ArrowUpRight` × N (~20-30 questions), CtaBlock. Word count chrome ~80.
- **Gaps** : page utilitaire, accordion domine. Mais hero peut être teasé.
- **P2 — Hero illustration AVIF discrète** : prompt **FAQ-01-hero** (questions éditoriales). Effort 1.5h.
- **P2 — Section divider illustration** : prompt **FAQ-02-divider**. Effort 1.5h.

---

## 3. Benchmark cross-sites (synthèse)

> Détail complet : `_AUDIT/benchmarks-visual-2026.md` (5 800 mots, matrice 10 sites + 10 fiches détaillées).

**3 patterns gagnants confirmés sur ≥7 sites** (Anthropic, Stripe, Linear, Vercel, Mistral, Pennylane, Arc, Cohere) :

1. **Illustration vectorielle propriétaire (UUID CDN ou SVG nommé court) > photo stock corporate** — 7/8 sites vérifiés. Photo stock corporate **0/8 sites** : pattern mort en 2026 premium B2B.
2. **Cadence « 1 visuel narratif = 1 idée/section »** plutôt que densité mécanique par paragraphe — 8/8 sites. Médiane **5-7 visuels narratifs par homepage** (range : 1 chez Anthropic minimaliste extrême → 60 chez Cohere maximaliste).
3. **Iconographie Lucide-style ou SVG inline propriétaire** (zéro icon-font 2010s) — 7/8 sites. Axion-IA déjà conforme ✅.

**3 anti-patterns confirmés** :

1. **Photo stock corporate générique** : 0/8 sites — confirmé mort.
2. **`alt=""` ou alt manquant** sur images narratives : Anthropic + Linear + Stripe le font (à éviter par Axion-IA pour différenciation a11y/AEO).
3. **Palette polluée par badges tiers + filenames SEO-stuffed** : Pennylane uniquement. Anti-pattern post-2020 à éviter.

**Limites Agent B** : openai.com (403 Forbidden 4 routes) et mckinsey.com (timeout 60s × 4 routes) non vérifiés directement par WebFetch — documentés comme tels dans le livrable, à inspecter manuellement par Will si besoin.

**Verdict transposable Axion-IA** : la doctrine actuelle (Lucide + SVG inline + 0 photo stock) est **alignée à l'état de l'art 2026**. Le gap n'est **pas** dans la nature des visuels, c'est dans la **cadence** (12/20 pages sans hero illustré, 20/20 sans closing visuel).

---

## 4. Scénarios chiffrés (3) — recommandation : démarrer par MIN

| Scénario                                          | Périmètre                                                                                                                                                           | Composants à créer                                                                                                                     | Prompts GPT-image                                    | Effort dev | Coût OpenAI | Effort copy Will                                        | Total wall-clock |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ----------- | ------------------------------------------------------- | ---------------- |
| **✅ MIN (recommandé)**                           | Combler P0 critique uniquement (= `/methodologie` + matcher `/audit` + 2 patches templates)                                                                         | 1 (`MethodologyHeroSchema`) + 2 patches (`InterventionDetailHeroSchema` + `AuditDetailHeroSchema` injectés dans `ProductPageTemplate`) | ~8-10 (METHO×3-4 + COMP×1-2 + INT-DIR×1 + AUD-PME×1) | **8-10h**  | **~$2-3**   | 2h (copy `/methodologie`)                               | **2-3 jours**    |
| **STANDARD** (itération suivante si MIN convainc) | P0 + P1 (rythme visuel correct partout, fiches prescriptives § 2 P0+P1)                                                                                             | 5 (`MethodologyHeroSchema`, `ComparisonsHeroSchema`, `BlogHeroSchema`, `HelpHeroSchema`, patches templates)                            | ~25-30 (toutes les P1 mid + closing du § 2)          | **18-25h** | **~$6-8**   | 2-3h                                                    | **5-8 jours**    |
| **PERFECTION 2026** (cible théorique max)         | P0 + P1 + P2 + 8 nouveaux HeroSchema + 53 illustrations + `buildImageObjectJsonLd` + `opengraph-image.tsx` per-page Top 20 + press-kit livré + style guide appliqué | **8** (tous les nouveaux + extraction `HomeHeroSchema`)                                                                                | **53** (toute la table maîtresse)                    | **38-50h** | **~$13-15** | 4-6h (copy `/methodologie` + press-kit + alt text i18n) | **10-15 jours**  |

**Recommandation officielle (post-discussion Will 2026-05-07)** : **démarrer par MIN, itérer ensuite**.

Justifications :

1. **Doctrine v1.1 du prompt** : « GPT-image en fallback ponctuel pour photos/illustrations narratives », pas pipeline systématique de 53 illustrations.
2. **Risque cohérence multi-générations** : 53 images générées, même avec seed=42 et image-to-image, présentent un risque de dérive style sur le lot. Tester sur 8-10 d'abord, valider la grammaire visuelle, puis décider d'amplifier.
3. **Vrais blocages business** = 3 chantiers : `/methodologie` (page de réassurance majeure du tunnel), `ProductPageTemplate` (10-15 sous-pages affectées par 1 fix), `/comparaisons` (enjeu AEO direct). Le reste est nice-to-have.
4. **Beaucoup de la valeur est gratuite** : 8 nouveaux HeroSchema = composants React SVG = $0 marginal. Les 53 prompts GPT-image sont **en complément**, pas en substitution.
5. **Les 5 OG images** sont mieux générées via Next 16 `ImageResponse` SVG-rendered (réutilise les HeroSchema existants en background) — pas besoin de bitmap GPT-image.

**Détail budget OpenAI MIN** :

- ~10 prompts × $0.19 (gpt-image-1 high quality) = **$1.90**
- +30% retries = **+$0.57**
- **Total : ~$2-3**

**Si DALL-E 3 ChatGPT Plus uniquement** (pas d'API) : coût marginal $0 (inclus abonnement Plus $20/mois), mais cohérence ~60-70% (pas de seed reproductible). Workflow recommandé : tout dans la même session ChatGPT, partir de `METHO-01-hero` validée comme référence absolue (la première du lot critique).

---

## 5. Roadmap d'implémentation — Sprint A + B livrés ✅

> **État au 2026-05-07** : Sprint A et Sprint B sont **livrés et validés** (build production clean, 96/96 tests passent, anti-hex clean, contrast WCAG AA). Sprint C reste optionnel. Détail complet dans `_AUDIT/IMPLEMENTATION-STATUS-2026-05-07.md`.

### ✅ Sprint Visual Rhythm A — LIVRÉ 2026-05-07

**Cible** : combler les 3 vrais blocages business (`/methodologie`, `ProductPageTemplate`, matcher `/audit`) avec un investissement minimal qui valide la grammaire visuelle.

1. **Patch matcher `/audit`** (0.5h) : `Building2` ×4 → mix `Building2` (TPE) / `Building` (PME) / `Briefcase` (ETI) / `Factory` (industrie). Fix immédiat sans dépendance.
2. **Créer `MethodologyHeroSchema.tsx`** (5h) : flow horizontal 4 étapes (variante de `AuditHeroSchema`). Skeleton TS prêt dans `heroschema-pattern-analysis.md` § 5. Accents = terracotta→primary→sage→mocha.
3. **Étendre `/methodologie`** (2h Will copy + 0.5h dev intégration) : section « Pourquoi cette méthodologie » +300 mots + intégration `<MethodologyHeroSchema>` à droite du H1 en lg:grid-cols-2.
4. **Créer `InterventionDetailHeroSchema.tsx`** + **`AuditDetailHeroSchema.tsx`** (factorisé : 4-5h ensemble si pattern partagé extrait dans `<DetailHeroSchema>` paramétré).
5. **Patcher `ProductPageTemplate`** (1h) : injecter slot `heroSchema` à droite du `ProductHero` en lg:grid-cols-2. Toutes les sous-pages `/interventions/{slug}` et `/audit/{slug}` bénéficient instantanément.
6. **Générer ~8-10 illustrations GPT-image P0** :
   - `METHO-01-hero` (référence absolue → faire valider par Will EN PREMIER avant la suite).
   - `METHO-02-mid` + `METHO-03-mid` + `METHO-04-closing`.
   - `COMP-01-hero` + `COMP-02-matrix`.
   - `INT-DIR-01-hero` + `AUD-PME-01-hero`.
   - Workflow : `gpt-image-1` API seed=42 + image-to-image à partir de `METHO-01-hero` validée.

**Critères de fin Sprint A** :

- `/methodologie` passe de 🔴 critique → 🟢 sain (hero schema + section étendue + 4 illustrations).
- `ProductPageTemplate` injecte un schéma visuel pour ~10-15 sous-pages.
- `/comparaisons` a son `ComparisonsHeroSchema` ou au minimum 2 illustrations GPT-image hero+matrix.
- Matcher `/audit` diversifié.
- Will a validé la cohérence palette + style sur le premier lot → décision STANDARD ou stop.

---

### ✅ Sprint Visual Rhythm B — LIVRÉ 2026-05-07

À déclencher seulement si Sprint A convainc Will que la grammaire visuelle GPT-image est on-brand.

1. **Créer `ComparisonsHeroSchema.tsx`** (si pas déjà fait en Sprint A), **`BlogHeroSchema.tsx`**, **`HelpHeroSchema.tsx`**, **`AboutHeroSchema.tsx`**, **`PressHeroSchema.tsx`**, **`RoiHeroSchema.tsx`** (compressible à ~12h en factorisant le pattern).
2. **Générer ~15-20 illustrations P1 supplémentaires** : mid + closing des pages pillar + listings + produit/process restantes.
3. **Ajouter CtaBlock final à `/comparaisons`** (0.5h).
4. **Diversifier `Check` bullets sur `/interventions`** (0.5h).
5. **Diversifier `Sparkles` overuse** sur `/audit` et `/implementation` (1h).
6. **Décision Will sur photo réelle vs illustrée `/a-propos`** → générer (`APROPOS-01-portrait`) ou commander production externe.
7. **Créer `buildImageObjectJsonLd`** dans `src/lib/seo.ts` (1h).

---

### Sprint Visual Rhythm C — PERFECTION (P2, optionnel, ~10-13h dev + $4-5 OpenAI)

À déclencher uniquement si Will veut pousser le polish au max et a budget temps disponible.

1. **Extraire `HomeHeroSchema.tsx`** depuis le SVG inline 400 LOC (4h).
2. **Générer `opengraph-image.tsx`** per-page Top 5 via Next 16 `ImageResponse` SVG-rendered (~3h via composant partagé `<OgTemplate>` réutilisant les HeroSchema existants — **pas besoin des 5 OG-prompts GPT-image bitmap**).
3. **Livrer press-kit 6 assets** (4h, gating Sprint 14.6).
4. **Composant `<TocDiagram>`** sur `/guide-ia` (5h, optionnel — alternative SVG codée à `GUIDE-02-mid`).
5. **Restantes ~10-15 illustrations P2** (closings + utilitaires utilitaires).
6. **Documenter stroke-width canon** (default 2 / 2.25 module / 3 Check pill) dans `Design.md` (0.5h).
7. **Nettoyage `public/`** : supprimer 5 SVG démo Next.js (`file.svg`/`globe.svg`/`next.svg`/`vercel.svg`/`window.svg`) (0.25h).
8. **Style guide appliqué** : audit final cohérence vs `_AUDIT/visual-style-guide.md`.

---

### Critères de fin globale (si on pousse jusqu'à PERFECTION)

- 20/20 pages avec hero visuel (HeroSchema ou illustration).
- 20/20 pages avec closing visuel avant CtaBlock final.
- Cadence ≥ 1 ancrage visuel par 500 mots sur chaque page.
- 100% des illustrations en AVIF + WebP fallback via `next/image`.
- 100% des illustrations narratives clés ont `<figure><img alt><figcaption>` + `ImageObject` JSON-LD.
- 0 `alt=""` sur image narrative.
- `buildImageObjectJsonLd` + `opengraph-image.tsx` per-page Top 5 livrés.

### Critères de fin minimale (Sprint A MIN seul)

- `/methodologie` passe à 🟢 sain.
- `ProductPageTemplate` injecte schéma visuel pour ~10-15 sous-pages.
- `/comparaisons` a hero visuel.
- Matcher `/audit` diversifié.
- 8-10 illustrations GPT-image générées, validées on-brand.
- Will décide en connaissance de cause s'il pousse vers Sprint B ou s'arrête là.

---

## 6. STOP & ASK ouverts (à valider avant de figer)

1. **Style illustration** : éditorial vectoriel light desaturated (recommandé, calibré sur préfixe brand v3.1) vs ligne pure noir/blanc (plus minimaliste type Anthropic recherche) ? **Recommandation** : éditorial vectoriel light avec accents terracotta sparingly (≤15% composition) + sage proof sparingly. Mood « Anthropic research × Stripe Press magazine ».
2. **Photo Will** : photo professionnelle réelle (production ~$200-400 photographe) vs portrait illustré GPT-image (silhouette stylisée non-réaliste, prompt `APROPOS-01-portrait` prêt) ? Décision impacte `/a-propos`, footer auteur articles, schema `Person`.
3. **Hero SVG inline du Home** : extraire en `HomeHeroSchema.tsx` (homogénéité avec les 5 autres) ou laisser inline (refactor risqué sur layout 2-col `/`) ? Recommandation : extraire dimensions identiques (600×680 paysage, tolérance variante du 560×760 portrait des autres).
4. **Stroke-width canonique** : standardiser à `2.25` pour tous les Lucide en pill/chip ou laisser default 2 + override 3 sur Check pill ? Recommandation : documenter la règle actuelle (default 2 nav, 2.25 module/chip, 3 Check pill) dans `Design.md`.
5. **`Sparkles` overuse** : remplacer par icônes spécifiques (`Award` premium, `Compass` doctrine, `Star` phare) ou assumer le pattern « Sparkles = signal IA / innovation » ? Recommandation : remplacer sur `/audit` et `/implementation` où la sémantique IA est implicite, garder sur `/stack-ia` et `/interventions` où c'est signal IA explicite.
6. **Press-kit gating** (Sprint 14.6) : 6 placeholders dans `PressKit.tsx` actuellement vides (logo, palette, type, etc.). Production avant Visual Rhythm C ou en parallèle ?
7. **Moteur GPT-image** : `gpt-image-1` API avec seed=42 (reproductibilité ~75-85%, $13-15) vs DALL-E 3 ChatGPT Plus (gratuit avec abonnement, cohérence ~60-70%, pas de seed) ? Recommandation : `gpt-image-1` API pour la collection Axion-IA — l'écart de cohérence justifie largement le $15.
8. **`/methodologie` extension copy** : 280 mots → 600 mots avec section « Pourquoi cette méthodologie » avant CtaBlock. Will est-il OK pour rédiger les ~300 mots additionnels ?

---

## 7. Index des livrables associés

Tous sous `_AUDIT/` :

| Livrable                                       | Auteur          | Mots    | Rôle                                                                                                                                                       |
| ---------------------------------------------- | --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`AUDIT-VISUAL-RHYTHM-2026.md`** (ce fichier) | Agent principal | ~5 200  | Rapport principal — fiches prescriptives Top 20 + scénarios + roadmap                                                                                      |
| **`IMPLEMENTATION-STATUS-2026-05-07.md`**      | Agent principal | ~1 800  | **État d'implémentation post-livraison** Sprint A+B — vérifications de bout en bout, composants créés, pages patchées, reste à faire Sprint C              |
| `visual-inventory.md`                          | Agent A         | ~5 600  | Inventaire visuel interne — 5 sections (pattern gold, pages, icônes, bitmap, SEO)                                                                          |
| `heroschema-pattern-analysis.md`               | Agent A         | ~3 800  | Spec complète pattern + skeleton TS prêt à dupliquer + table prescriptive nouvelle HeroSchema par page                                                     |
| `benchmarks-visual-2026.md`                    | Agent B         | ~5 800  | Matrice 10 sites + 10 fiches détaillées + synthèse cross-benchmark                                                                                         |
| `visual-style-guide.md`                        | Agent C         | ~3 909  | Style guide unifié — 11 sections (palette, icono, illustration, photo, diagramme, hiérarchie, cohérence, animation, naming, versioning, multi-générations) |
| `gpt-image-prompts.md`                         | Agent C         | ~13 870 | 53 prompts GPT-image prêts à coller — préfixe brand + table maîtresse + 53 fiches                                                                          |
| `visual-gaps-by-page.csv`                      | Agent principal | —       | Matrice exhaustive page × gap × priorité × prompt ID × effort                                                                                              |

**Lecture conseillée pour Will** :

1. Ce rapport (synthèse exécutive § 0 + fiches prescriptives § 2 + scénarios § 4 + STOP & ASK § 6).
2. `gpt-image-prompts.md` (section « Instructions cohérence multi-générations » + préfixe brand + 53 prompts).
3. `visual-style-guide.md` (référence permanente design system imagerie).
4. `heroschema-pattern-analysis.md` (référence dev pour les 8 nouveaux HeroSchema à créer).

---

**Fin du rapport — `AUDIT-VISUAL-RHYTHM-2026.md` (Agent principal · 2026-05-07)**
