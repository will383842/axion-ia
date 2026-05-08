# Audit Header & Navigation 2026 — AxionIA

> **Statut** : Accepté en bloc 2026-05-07 (Will valide les 8 recommandations consolidées). Implémentation **différée** — Will finit son frontend en cours avant. ADR 0003 → renommée `0005` au démarrage. ADR 0004 → renommée `0006`.
>
> **⚠️ Amendement périmètre 2026-05-07** : Will retient **TOUTES les villes >5 000 hab France V1 (~2 150 villes)** au lieu de la séquence Agent D (V1 = 1 160 villes >10 000 hab puis V2 = 2 150 à 6 mois). Décision « TOUT ou rien sur le SEO ». Coûts recalculés : Bas 3 200 € → Haut 12 000 € (vs 2 800-9 000 € initial). Effort Will : 36 h sur 12 semaines (vs 28 h). Voir `adr-0004-pseo-villes-PROPOSITION.md` §Coûts amendés.
>
> **⚠️ Clarification timing** : ce chantier ≠ Sprint 15 historique (qui = M8 Prisma backend, cf. `_AUDIT/PROMPT-CODAGE.md:990`). C'est un **chantier frontend final** à exécuter avant Sprint 15 Prisma. Voir `_AUDIT/PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md` (à créer) pour le plan d'exécution dédié.
> **Statut historique** : DRAFT — en attente validation Will (8 STOP & ASK ouverts)
> **Date** : 2026-05-07
> **Référence HEAD** : `a726ca9` (`feat(stack-ia): add /stack-ia + /ai-stack page (11 tools, 5 functions)`)
> **Working tree non commité** : oui — refonte `/stack-ia` (`page.tsx` +161/-119, `stack-ia.ts` +10, `Footer.tsx` +1, `StackHeroSchema.tsx` non tracké, `ToolLogo.tsx` non tracké). Audit prend HEAD comme référence ; working tree signalé en annexe §B.
> **Périmètre** : Header desktop + mobile + mega-menus + footer + breadcrumbs + pSEO régions/villes + ⌘K + SEO/AEO/GEO 2026.
> **Méthode** : 5 agents parallèles + agent principal de synthèse (~100-140 min comme prévu).
> **Cible** : scénario **PERFECTION 2026** (validé Will dans le lancement).
> **Doctrine de référence** : `AxionIA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` lignes 333-414 (le `axionia/CLAUDE.md` racine est un stub `@AGENTS.md` — confirmation Agent A et lecture HEAD).
> **Contraintes intouchables** : fond `bg-terracotta` du header + logo (badge ivoire + Axion-IA serif italique) — Will explicit.

---

## 0. Synthèse exécutive (1 page)

### Diagnostic

Le header actuel d'AxionIA (HEAD `a726ca9`) est un **Server Component à 4 items** (`/interventions`, `/audit`, `/implementation`, `/cas-concrets`) — pas 5 comme le commentaire de code et la doctrine §9.1 le prétendent (Agent A : `/blog` a été déplacé en footer). Il respecte strictement la doctrine **ZERO dropdown** (§9.2 du dossier source v10.1) — aucun `Popover`, `DropdownMenu`, `HoverCard` importé. Esthétique signature préservée : fond terracotta figé (commit `941a8e1`), logo serif italique, hairline mocha bottom, layout balanced split CTA centré.

Cependant, **3 forces de tension structurelle** rendent la navigation actuelle sous-dimensionnée pour la stratégie 2026 :

1. **Catalogue IA `/stack-ia`** (HEAD livré 2026-05-07, refonte working tree en cours) — page IA officielle AxionIA, **non liée depuis le header ni le footer** (Agent A : page orpheline, alors qu'elle est centrale éditorialement).
2. **Expansion pSEO villes & régions** prévue par Will : volume corrigé à **~2 150 villes >5 000 hab** par Agent D (vs 3 500 estimé initialement), V1 recommandée à **1 160 villes >10 000 hab + 5 DROM**.
3. **9 pages stratégiques orphelines** (Agent A : `/accessibilite`, `/comparaisons`, `/glossaire`, `/guide-ia`, `/methodologie`, `/politique-deplacement`, `/stack-ia`, +utilitaires privacy) — surface SEO/UX gâchée.

À cette échelle, **maintenir §9.2 ZERO dropdown stricto sensu force soit (a) un header sitemap (anti-pattern), soit (b) une architecture pure hub-spoke où chaque hub est une page atterrissage à 3 clics — incompatible avec la cible PERFECTION 2026 du brief**.

### Recommandation

- **ADR 0003 — Voie 2** : révision §9.2 avec garde-fous (mega-menus éditoriaux limités à 2, max 2 niveaux, hover-intent 150ms, axe-core CI). Recommandation Agent C avec 3 raisons. Compatible PERFECTION 2026.
- **ADR 0004 — pSEO villes/régions** : Option B hiérarchique `/implantations/[region]/[ville]`, V1 = 1 160 villes >10 000 hab + 5 DROM (exclure COM), pipeline 80/20 LLM/Will avec prompt caching Claude Sonnet 4.6, rollout 3 phases sur 12 semaines.
- **Header cible** : 7 items (logo + 1 lien + 2 mega-menus + CTA central avec badge 490 € + 1 lien + ⌘K + locale).
- **Footer cible** : 5 zones (correction §10.1) avec 5e zone « Implantations » + bandeau légal complet (OÜ, TVA EE, accessibilité — corrections Agent A).
- **⌘K** : Pagefind self-hosted (~12 KB gzip), articulation overlay → `/recherche?q=...` existante. **Reportable Sprint 16** si bandwidth tendu Sprint 15 (Agent B : ⌘K = bonus UX, pas signal SEO).

### Effort estimé

| Item                                             | Sprint cible     | Charge                    | Acteur                  |
| ------------------------------------------------ | ---------------- | ------------------------- | ----------------------- |
| Foundation (régions + factories SEO + mega-menu) | Sprint 15        | 5-8 j-h dev + 2h Will     | Équipe                  |
| Phase 1 villes (top 50, 100% review)             | Sprint 16        | 12.5h Will + 2 j-h dev    | Will + équipe           |
| Phase 2 villes (top 200, spot-check 20%)         | Sprint 17        | 7.5h Will + 1 j-h dev     | Will + équipe           |
| Phase 3 villes (1 160 total, spot-check 5%)      | Sprint 18-20     | 8h Will + 1 j-h dev       | Will + équipe           |
| ⌘K Pagefind + Sprint 15 moteur réel `/recherche` | Sprint 16-17     | 2 j-h dev                 | Équipe                  |
| **Total V1 (1 160 villes)**                      | **Sprint 15-20** | **~28h Will + 8 j-h dev** | —                       |
| **Refresh annuel INSEE**                         | An 2+            | 4h Will/an                | Will                    |
| **V2 conditionnelle (+990 villes >5 000 hab)**   | An 2             | +14h Will + 4 j-h dev     | si Search Console verts |

**Coût total V1 (~2 150 villes amendé)** : ~36 h Will sur 12 semaines + ~8.5 j-h dev équipe + ~130 € LLM. Budget global maîtrisé selon mode d'exécution (in-house vs externalisé). LLM Claude Sonnet 4.6 avec prompt caching = poste négligeable. **ROI break-even = 1 client B2B premium** signé sur le canal SEO local.

### Risques top 3

1. **Doorway pages Google HCU 2024** — mitigation : 80/20 review + sections non-clonables (démographie INSEE + secteurs porteurs + cas client proche + 5-8 villes proches Haversine + FAQ géolocalisée) + rollout 3 phases.
2. **Régression a11y mega-menus** — mitigation : garde-fous Voie 2 ADR 0003 (axe-core CI, Playwright keyboard tests, hover-intent 150ms, focus trap, ESC, prefers-reduced-motion respect strict).
3. **Inflation surface CMS sans gouvernance** — mitigation : `getAllRegionSlugs()` + `getAllVilleSlugs()` typés TS dans `src/content/`, doctrine `routing.pathnames` source unique de vérité (Agent E G1-G11).

### Décisions Will requises (8 STOP & ASK ouverts)

| #   | Question                                                                    | Recommandation audit                                          | Source                       |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| Q1  | `/stack-ia` : 11 outils sélectifs (HEAD) vs catalogue plus large (50-200) ? | **Conserver 11** + ADR explicite si extension future          | Agent E (doctrine arsenal)   |
| Q2  | Profondeur URL villes (A plat / B hiérarchique / C 3 niveaux) ?             | **Option B** `/implantations/[region]/[ville]`                | Agent D §URL                 |
| Q3  | Régions : métropole only / + DROM / + DROM-COM ?                            | **Métropole + 5 DROM**, exclure COM                           | Agent D §D1                  |
| Q4  | ADR §9.2 : Voie 1 maintien / Voie 2 révision / Voie 3 hybride ?             | **Voie 2** (mega-menus avec garde-fous)                       | Agent C §Décision            |
| Q5  | Pipeline pSEO : 100% review / 80/20 / 50/50 ?                               | **80/20** (phase 1 100%, phase 2 20%, phase 3 5%)             | Agent D §D5                  |
| Q6  | Phase 1 V1 : top 50 villes vs top 100 ?                                     | **Top 50** (12.5h Will, 2 semaines) — V1 totale = 1 160       | Agent D §D6                  |
| Q7  | Split sitemap (`sitemap-index.xml` + sous-sitemaps) ?                       | **Oui** (refactor non-trivial mais nécessaire à 1 160+ pages) | Agent E G6 + audit principal |
| Q8  | ⌘K Sprint 15 ou Sprint 16+ ?                                                | **Sprint 16** OK (bonus UX, pas signal SEO)                   | Agent B §⌘K                  |

---

## 1. État actuel par chapitre (1-10)

### Chapitre 1 — Header desktop

✅ **État actuel** (HEAD, Agent A §1) :

- 4 items visibles : `/interventions`, `/audit`, `/implementation`, `/cas-concrets` (le commentaire « 5 items » est faux, `/blog` est en footer).
- Layout : `[Logo] [Nav 1, 2] [CTA central /audit] [Nav 3, 4] [LocaleSwitcher]` — balanced split.
- Sticky : figé (depuis `941a8e1`, scroll-aware retiré).
- Backdrop : `bg-terracotta` + `supports-[backdrop-filter]:bg-terracotta/95`.
- Hairline mocha bottom — signature préservée.
- Logo : badge ivoire + texte serif italique « Axion-IA » (NB : Agent A signale écart §9.1 prescrivant un _monogramme 28-32 px sans nom_ — mais Will a explicitement interdit de toucher au logo, donc on **conserve l'existant**).
- CTA central `/audit` — **manque le badge prix « 490 € » prescrit §9.3** + manque tracking `cta_central_click` + aria-label sans prix.
- `NavLink` actif via underline + `aria-current="page"`.
- WCAG : contrast OK (terracotta + ivoire badge respect AAA sur logo).

🎯 **Standard 2026** (Agent B) :

- Convergence 4-6 items header sur sites premium B2B (Anthropic 5, Stripe 5, Vercel 4-5, Linear 4, Cohere 5, Mistral 4, Qonto 6, Deloitte 5).
- Apple à 9-12 = exception catalogue produit, non transposable B2B.
- Sticky condensation au scroll = pattern dominant 2026 (Stripe, Apple). AxionIA = sticky figé = équivalent UX, plus simple.

🟠 **Verdict** : Header solide mais sous-dimensionné pour la cible PERFECTION 2026. Doit absorber catalogue IA + hub Implantations sans déborder. Cible 7 items (logo + 5 « slots » + ⌘K + locale).

🛠️ **Patch proposé** (annexe §A.1) :

- Restructurer en 7 items (cf. `header-architecture.json`).
- Ajouter badge `490 €` au CTA central + tracking.
- Conserver fond terracotta + logo + sticky figé.

### Chapitre 2 — Mega-menus (résolution conflit §9.2)

✅ **État actuel** : ZERO dropdown strictement respecté (Agent A : aucun `Popover`/`DropdownMenu`/`HoverCard` importé).

🎯 **Standard 2026** (Agent B) : mega-menus 2-3 colonnes uniformes, profondeur 1-2 niveaux max. Vercel impose 3 cols partout = gold standard. Hover-intent ~150ms (Apple HIG) standard.

🔴 **Verdict** : Conflit doctrinal réel à la scale visée. **Voie 2 ADR 0003** (révision §9.2 avec garde-fous) recommandée par Agent C.

🛠️ **Patch proposé** : 2 mega-menus seulement (« IA & Solutions », « Implantations »), max 3 colonnes, max 2 niveaux, client component lazy borderline (le reste header reste RSC).

**Garde-fous a11y/perf obligatoires** (cohérence ADR 0003 §Garde-fous) :

- WCAG 2.2 AA strict : `aria-haspopup`, `aria-expanded`, `aria-controls`, focus trap, ESC pour fermer, keyboard nav (Tab/Arrows/Home/End/Esc).
- Hover-intent 150ms (Apple HIG).
- `prefers-reduced-motion` respect strict.
- Pas de mega-menu mobile (drawer accordéon à la place).
- Animations `transform` GPU only.
- Bundle client : ≤ 8 KB gzip pour les 2 mega-menus.

### Chapitre 3 — Page IA officielle `/stack-ia`

✅ **État actuel** (HEAD, Agent A + Agent E) :

- `/stack-ia` (FR) / `/ai-stack` (EN) livrée 2026-05-07.
- 11 outils sélectionnés en 5 catégories (`think` / `produce` / `capture` / `build` / `orchestrate`).
- `stack-ia.ts` 682 lignes, types `StackCategory` + `StackTool` + monogrammes + vendor + maturity.
- 4 entrées FAQ AEO.
- JSON-LD complet.
- Doctrine `/interventions` respectée (parity gold standard).
- **Working tree non commité** : `page.tsx` +161/-119, `stack-ia.ts` +10, nouveaux composants `StackHeroSchema.tsx` + `ToolLogo.tsx` non trackés.
- **Page orpheline** : non liée depuis header ni footer (Agent A § orphelines).

🎯 **Standard 2026** : page catalogue IA = navigation hub à 1 clic depuis header (Anthropic, OpenAI, Mistral). Filtres URL SEO-friendly (?categorie=rag) ou paths (`/ia/rag`).

🟠 **Verdict** : `/stack-ia` est éditorialement OK mais **stratégiquement orpheline**. Doit entrer au mega-menu « IA & Solutions » + colonne footer « IA & Solutions ».

🛠️ **Patch proposé** (annexe §A.5) :

- Ajouter au mega-menu « IA & Solutions » : `/stack-ia` + `/comparaisons` + `/guide-ia` + `/glossaire`.
- Ajouter au footer colonne 2 « IA & Solutions ».
- **Q1 STOP & ASK** : 11 outils sélectifs vs catalogue plus large — recommandation **conserver 11** (doctrine arsenal premium, ADR explicite si extension).
- **Pas de slug `/ia` ou `/catalogue-ia` séparé** (Will explicit dans le lancement).
- **`/stack-ia/[slug]`** (page par outil) optionnel — créer `getAllStackToolSlugs()` (gap E G3) si Will valide.

### Chapitre 4 — pSEO Régions

❌ **État actuel** : pages régions n'existent pas sur disque (confirmé Agent A + Agent E §G : aucun `app/[locale]/implantations/`, aucun `src/content/regions.ts`).

🎯 **Standard 2026** (Agent B Booking.com) : pattern hiérarchique `country/region/city`, slugs sémantiques kebab-case, breadcrumbs `Home > Hotels > France`, compteurs de densité.

🟢 **Verdict** : Architecture à concevoir. Voir ADR 0004 §Décision D1+D2.

🛠️ **Patch proposé** (annexe §A.7) :

- Créer `src/content/regions.ts` (~18 entrées : 13 métropole + 5 DROM, exclure COM — Q3 STOP & ASK).
- Créer `src/app/[locale]/implantations/page.tsx` (hub) + `[region]/page.tsx`.
- Schema.org : `Place` + `LocalBusiness` (areaServed = région) + `ItemList` (top villes) + `BreadcrumbList`.
- Sitemap `sitemap-regions.xml`.
- Mega-menu Implantations colonne « Régions » : top 6 par PIB (IDF, ARA, NAQ, OCC, HDF, GES) + lien « Toutes les régions ».

### Chapitre 5 — pSEO Villes (~2 150 vs 3 500 estimé)

❌ **État actuel** : pages villes n'existent pas. Volume initial Will = 3 500 estimé. **Volume réel INSEE Agent D = ~2 150 villes >5 000 hab** (~1 160 villes >10 000 hab pour V1 quality gate).

🎯 **Standard 2026** (Agent D §pièges) :

- Helpful Content Update 2024 + Core Updates 2024-2025 = pénalité forte sur doorway pages, near-duplicate, thin content, AI-generated mass content.
- Booking.com : 3M+ pages avec différentiation par compteurs de densité (« 23 978 hôtels »), reviews locales, photos uniques.
- Aleyda Solís school : ratio « unique content » > 40-60 % par page.

🟢 **Verdict** : Architecture à concevoir. Voir ADR 0004 §Décision D2-D8.

🛠️ **Patch proposé** (annexe §A.8) :

- Créer `src/content/villes.ts` (V1 = 1 160 villes + ~30 DROM) avec champ `dataSourceVersion` + `noindex?: boolean`.
- Créer `src/lib/geo.ts` (Haversine + `getNearbyVilles(slug, 8)`).
- Créer `src/app/[locale]/implantations/[region]/[ville]/page.tsx` (template avec sections **non-clonables** §ADR 0004).
- Schema.org : `LocalBusiness` (areaServed = ville) + `Place` + `FAQPage` + `BreadcrumbList`.
- Sitemap segmenté `sitemap-villes-[region].xml` (~18 fichiers).
- Pipeline 80/20 LLM/Will + prompt caching Claude Sonnet 4.6 (~65 € V1 LLM, dominant = 28h Will).
- Rollout 3 phases sur 12 semaines.

### Chapitre 6 — Command Palette ⌘K

❌ **État actuel** : pas de palette ⌘K globale au layout (Agent A §11). `/recherche` SSR existante mais moteur réel reporté Sprint 15 (placeholder + 4 liens fallback).

🎯 **Standard 2026** : ⌘K standard 2026 (Linear, Vercel, Stripe, Cmd+K Cloud). **MAIS** Agent B observe que ⌘K **invisible en HTML statique** (rendu JS) → c'est un bonus UX, pas un signal SEO.

🟠 **Verdict** : À ajouter, mais **non-bloquant pour pSEO villes**. Reportable Sprint 16-17.

🛠️ **Patch proposé** :

- Bibliothèque : **Pagefind** (self-hosted, build-time, gratuit, parfait pour ~2 150 pages SSG) ou `cmdk` (~12 KB gzip).
- **Articulation `/recherche` existante** : ⌘K = overlay rapide → lien « Voir tous les résultats » → `/recherche?q=...` (déjà SSR).
- Index FR + EN séparés.
- ARIA `combobox` + `listbox`, focus trap, ESC.
- Mobile : icône loupe en haut drawer → overlay full-screen.
- Indicateur visible dans header (chip « ⌘K » entre nav et locale).
- **Q8 STOP & ASK** : Sprint 15 ou Sprint 16+ — recommandation **Sprint 16** (Agent B + bandwidth).

### Chapitre 7 — Mobile Navigation

🟠 **État actuel** (Agent A §3) :

- Drawer slide-in droite, 1 niveau plat, h-20.
- 4 items uniquement (manque `/blog`, `/faq`, `/centre-aide`, `/a-propos`, `/contact` prescrits §9.4).
- **Pas de CTA bar permanente niveau 2** prescrit §9.4.
- Pas de coordonnées contact en bas.
- LocaleSwitcher position : à vérifier.

🎯 **Standard 2026** (Agent B Apple) : drawer impeccable avec hiérarchie multi-niveaux + CTA sticky + body scroll lock.

🔴 **Verdict** : Non conforme §9.4. Correction obligatoire Sprint 15.

🛠️ **Patch proposé** (annexe §A.2) :

- 11 items au drawer (cf. `header-architecture.json` §mobileNav).
- CTA bar permanente niveau 2 (sticky bottom drawer, primary `/audit` 490 €).
- Mega-menus → accordéons (pas mega-menu mobile).
- LocaleSwitcher haut drawer.
- Coordonnées contact (tel + email) en bas drawer.
- Body scroll lock `overflow:hidden` sur `<html>` quand drawer ouvert.
- Animation `transform` GPU + `prefers-reduced-motion` respect.
- ⌘K accessible aussi mobile (icône loupe haut drawer).

### Chapitre 8 — Footer (hub pSEO)

🟠 **État actuel** (Agent A §3) :

- 4 colonnes (vs 5 zones prescrites §10.1) — fonctionnellement correct (brand column = zone Identité fusionnée).
- Manques précis :
  - Liens : `/ia-custom`, `/guide-ia`, `/partenaires`, `/carrieres`.
  - Réseaux : YouTube + X remplacés par Facebook (LinkedIn + Facebook seulement).
- Bandeau bas manque :
  - Numéro registre OÜ.
  - TVA EE.
  - Email + téléphone contact.
  - Lien `/accessibilite`.
- Newsletter : non présente.

🎯 **Standard 2026** (Agent B) : footer = miroir du mega-menu (Stripe, Vercel, Anthropic, Qonto convergent sur 6-8 hubs colonnes). Newsletter footer rare mais différenciante (Cohere seul) — pour AxionIA premium = légitime et distinctif.

🔴 **Verdict** : Refonte complète obligatoire (5 zones + bandeau légal + newsletter).

🛠️ **Patch proposé** (annexe §A.3) :

- 5 zones : Identité (avec newsletter Stratégie IA + LinkedIn+Facebook+YouTube+X) + IA & Solutions + Cabinet + Ressources + **Implantations** (5e zone NEW).
- Bandeau bas complet : N° registre OÜ, TVA EE, email + tél, /accessibilite.
- Newsletter Stratégie IA : double opt-in, RGPD, Sprint 16+.
- Schema.org `Organization` + `ContactPoint` + `sameAs` LinkedIn/Facebook/YouTube/X — **injection au layout-level** (pas footer-only) pour héritage signal AEO/GEO 2026.

### Chapitre 9 — Breadcrumbs & maillage interne

🟠 **État actuel** (Agent A §4) : `Breadcrumbs.tsx` existe mais coverage à vérifier page par page.

🎯 **Standard 2026** : Toutes les pages > niveau 1 doivent avoir breadcrumbs avec `BreadcrumbList` JSON-LD.

🛠️ **Patch proposé** :

- Étendre `lib/seo.ts` avec `buildBreadcrumbJsonLd` (déjà présent — Agent E confirm `seo.ts:118-129`).
- Patterns breadcrumb par template :
  - Ville : `Accueil > Implantations > [Région] > [Ville]`.
  - Région : `Accueil > Implantations > [Région]`.
  - Stack tool : `Accueil > IA & Solutions > Stack IA > [Outil]` (si `/stack-ia/[slug]` activé).
  - Cas concret : `Accueil > Cas concrets > [Secteur] > [Cas]`.
  - Comparaison : `Accueil > IA & Solutions > Comparaisons > [Comparaison]`.
- Mobile compact : `…` intermédiaires si > 3 niveaux.
- Internal linking density cible : 3-5 liens contextuels par page longue.
- Anchor text varié, jamais 100 % « cliquez ici ».
- Matrice cross-section : cas-concrets ↔ interventions ↔ stack-ia ↔ villes (Sprint 18+).

### Chapitre 10 — SEO/AEO/GEO 2026

🟠 **État actuel** (Agent A §7+§8 + Agent E §3) :

- `JSON-LD layout-level minimal` : `Organization` (name + url + legalName seulement) + `WebSite` + `SearchAction` cohérent avec `/recherche`.
- Manques : logo, sameAs LinkedIn/Facebook/YouTube/X, address, vatID EE, foundingDate, foundingLocation Estonia.
- `lib/seo.ts` : factories `buildProductMetadata`, `buildServiceJsonLd`, `buildFaqJsonLd`, `buildBreadcrumbJsonLd` OK.
- Pas de `SiteNavigationElement` / `ItemList` au layout.
- `sitemap.ts` : pattern `buildDynamic` sophistiqué, 47 entries `routing.pathnames`, **bug Agent E G5** : `/implementation/par-fonction/[slug]` déclaré mais pas d'entry sitemap.
- `robots.ts` : EXCLUDED_FROM_INDEX OK.
- Speculation Rules production-only (prefetch eager + prerender moderate).

🎯 **Standard 2026** :

- AEO : structure FAQ par page ville/région pour citations SGE / Perplexity / Claude.ai.
- GEO : entités nommées explicites, `<address>`, `LocalBusiness` schema partout.
- Canonical strict, hreflang complet FR↔EN x-default = FR.
- Sitemap-index + sous-sitemaps.
- Core Web Vitals : LCP < 2.5s, INP < 200ms, CLS < 0.1.
- SSG strict pour 2 150 pages (SSR = coût hosting prohibitif).

🟠 **Verdict** : Foundation OK mais à étendre (4 factories à créer + Organization layout-level + sitemap split).

🛠️ **Patch proposé** (annexe §A.6 + §A.7) :

- Étendre `lib/seo.ts` : ajouter `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildOrganizationJsonLd` (gap E G1).
- Refactor `sitemap.ts` en `sitemap-index.xml` + sous-sitemaps via routes Next 16 `app/sitemap-[id]/route.ts` (Q7 STOP & ASK).
- Corriger bug E G5 : ajouter entry `/implementation/par-fonction/[slug]` à `buildDynamic`.
- Ajouter entry `/presse/[slug]` à `buildDynamic` (gap E G6).
- Étendre Organization JSON-LD layout-level.
- Tests : extension pattern existant (`utils.test.ts`, `JsonLd.test.tsx`, `press.test.ts`) — pour chaque nouvelle factory ajouter test unitaire validant structure JSON-LD (validator schema.org).
- Indexing API Google phase 1 villes (top 50) — quota gratuit 200 URLs/jour.

---

## 2. Architecture cible — 3 scénarios chiffrés

### Scénario MIN — Voie 1 ADR §9.2 strict (rejet user)

**Description** : Pas de mega-menu. Pages hub dédiées (`/implantations` = page complète avec carte cliquable + listes). Header reste 5-7 items. ⌘K basique. Pas de pSEO villes (juste régions).

| Item                       | Valeur                        |
| -------------------------- | ----------------------------- |
| Effort dev                 | ~2-3 jours                    |
| Effort Will                | ~5h                           |
| Coût total                 | ~600-1 500 €                  |
| Surface SEO ajoutée        | ~20 pages (régions seulement) |
| LCP impact                 | nul                           |
| Risque doorway             | nul                           |
| Compatible PERFECTION 2026 | ❌ NON                        |

**Verdict** : Rejeté par le brief Will (« Vise PERFECTION »). Documenté pour traçabilité.

### Scénario STANDARD — Voie 3 ADR §9.2 hybride (rejet user)

**Description** : 1-2 mega-menus minimalistes (3-5 liens max par mega, pas de preview cards), reste = pages hub dédiées. ⌘K complet. Breadcrumbs partout. Footer hub enrichi. Régions OK + V1 villes top 200.

| Item                       | Valeur                                    |
| -------------------------- | ----------------------------------------- |
| Effort dev                 | ~5-7 jours                                |
| Effort Will                | ~12h                                      |
| Coût total                 | ~1 500-3 500 €                            |
| Surface SEO ajoutée        | ~220 pages                                |
| LCP impact                 | minimal                                   |
| Risque doorway             | faible                                    |
| Compatible PERFECTION 2026 | ⚠️ partiellement (pas de V1 1 160 villes) |

**Verdict** : Rejeté par le brief Will (compromis vs. cible PERFECTION).

### Scénario PERFECTION 2026 — Voie 2 ADR §9.2 + ADR 0004 ✅ RECOMMANDÉ

**Description** :

- Mega-menus complets (Voie 2 ADR 0003) avec garde-fous : 2 mega-menus, max 3 colonnes, max 2 niveaux.
- ⌘K avancé Pagefind + articulation `/recherche` existante.
- pSEO V1 = 1 160 villes >10 000 hab + 5 DROM, pipeline 80/20 LLM/Will, rollout 3 phases sur 12 semaines.
- Schema.org partout (Organization layout-level + LocalBusiness + Place + ItemList + FAQPage + BreadcrumbList).
- Sitemap-index + sous-sitemaps.
- Footer 5 zones + bandeau légal complet + newsletter.
- Mobile drawer conforme §9.4 (CTA bar niveau 2, 11 items, accordéons).

| Item                       | Valeur                                                                |
| -------------------------- | --------------------------------------------------------------------- |
| Effort dev                 | ~8 j-h Sprint 15-20                                                   |
| Effort Will                | ~28h sur 12 semaines + 4h/an refresh                                  |
| Coût total V1              | 2 800 € (bas) à 9 000 € (haut)                                        |
| Surface SEO ajoutée V1     | ~1 200 pages indexables (× 24 surface actuelle)                       |
| LCP impact                 | < 50ms régression (mega-menus client lazy + ⌘K lazy + SSG strict)     |
| Risque doorway             | maîtrisé via 80/20 review + sections non-clonables + rollout 3 phases |
| Compatible PERFECTION 2026 | ✅ OUI                                                                |
| Conditions                 | Validation ADR 0003 + ADR 0004                                        |

**Verdict** : ✅ **RECOMMANDÉ** — seul scénario compatible cible PERFECTION 2026 du brief Will.

### Scénario PERFECTION+ (V2 conditionnelle, an 2)

**Description** : Extension à 2 150 villes (>5 000 hab) si Search Console signaux verts (CTR organique > 2 %, pages indexables > 90 %). Hreflang EN/FR complet villes (vs FR-only V1). Cas-concrets régionaux nouveaux.

| Item                  | Valeur                               |
| --------------------- | ------------------------------------ |
| Effort dev V2         | +4 j-h                               |
| Effort Will V2        | +14h                                 |
| Coût additionnel V2   | ~1 200-3 500 €                       |
| Surface SEO totale V2 | ~2 150 villes + EN parité éventuelle |

**Verdict** : Décision an 2, conditionnelle aux signaux V1.

---

## 3. Conflit doctrinal §9.2 — résolution proposée

Voir **`_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md`** (Agent C, 340 lignes) pour le draft ADR complet (sera renommée `axionia/docs/adr/0005-navigation-mega-menu.md` à la validation, puisque slots 0001-0004 occupés).

**Résumé** :

- §9.2 (ZERO dropdown) écrite pour 5 destinations — n'a pas anticipé catalogue IA + 15 régions + 1 160 villes.
- Voie 1 (maintien strict) → header sitemap ou pages hub à 3 clics → incompatible PERFECTION 2026.
- Voie 3 (hybride) → compromis design.
- **Voie 2 (révision avec garde-fous)** → recommandée par Agent C avec 3 raisons :
  1. Seule voie compatible PERFECTION 2026 (le prompt source ligne 442 cite littéralement « mega-menus complets (Voie 2 avec ADR) » comme contenu PERFECTION).
  2. Coût a11y/perf maîtrisable (axe-core CI + Playwright keyboard tests sur 2 client components borderline) vs coût UX du refus diffus et permanent.
  3. Aucun des 4 arguments §9.2 n'est invalidé : esthétique préservée par garde-fou ADR 0002 (terracotta + Fraunces + ivoire), UX préservée (RSC pour 5 entrées sur 7, hover-intent 150ms), mobile préservé (pas de mega sur mobile, drawer plat conservé), SEO link-juice préservé.

**Texte canon §9.2-bis ready-to-paste** : voir ADR 0003 §Plan de migration.

---

## 4. Roadmap d'implémentation

### Sprint 15 (immédiat post-audit) — Foundation

- ADR 0003 + ADR 0004 validation Will (8 STOP & ASK).
- Étendre `lib/seo.ts` : 4 factories (LocalBusiness, Place, ItemList, Organization).
- Créer `src/lib/geo.ts` (Haversine).
- Créer `src/content/regions.ts` (~18 entrées : 13 métropole + 5 DROM).
- Étendre `routing.pathnames` : `/implantations` + `/implantations/[region]` + `/implantations/[region]/[ville]` avec mapping EN.
- Créer hub `/implantations/page.tsx` + `/implantations/[region]/page.tsx`.
- Étendre `messages/{fr,en}.json` clés `nav.implantations`, `nav.iaSolutions`, `footer.implantations`, `breadcrumbs.implantations`.
- Refactor Header → 7 items + 2 mega-menus client lazy borderline.
- Correction mobile drawer §9.4 (CTA bar niveau 2 + 11 items + accordéons).
- Refonte Footer 5 zones + bandeau légal + Organization JSON-LD étendu layout-level.
- Bug bonus : entry `/implementation/par-fonction/[slug]` dans `buildDynamic` (gap E G5).
- Tests axe-core CI + Playwright keyboard pour mega-menus.
- **Livrable** : 18 régions indexables + header + footer + mobile conformes.

### Sprint 16 — Phase 1 villes (top 50) + ⌘K

- Créer `src/content/villes.ts` top 50 avec 9 sections par ville (sections non-clonables ADR 0004).
- Pipeline LLM Claude Sonnet 4.6 + prompt caching (system prompt 3 000 tokens caché).
- Quality gate Will : 50 villes × 15 min review = 12.5h.
- Soumission Indexing API Google.
- ⌘K Pagefind self-hosted + articulation `/recherche?q=...` existante.
- Moteur réel `/recherche` (Sprint 15 prévu, à confirmer).
- Tests : axe-core + schema.org validator + snapshot diff.
- **Livrable** : 50 villes indexables + ⌘K fonctionnel.

### Sprint 17 — Phase 2 villes (top 200) + maillage

- Génération 150 villes additionnelles + spot-check 20 % Will = 7.5h.
- Search Console monitoring weekly.
- Internal linking matrice cross-section (cas-concrets ↔ interventions ↔ stack-ia ↔ villes).
- **Livrable** : 200 villes indexables.

### Sprint 18-20 — Phase 3 villes (1 160 total)

- Génération mass + spot-check 5 % Will = 8h sur 6 semaines.
- Sitemaps split par région (`sitemap-villes-[region].xml`).
- Refresh trigger script (cron annuel).
- **Livrable** : 1 160 villes indexables (V1 complète).

### Sprint 21+ (an 2) — V2 conditionnelle

- Déclenchement si Search Console verts.
- +990 villes (>5 000 hab).
- Évaluation hreflang EN/FR villes.
- **Livrable** : 2 150 villes indexables (V2 complète).

---

## 5. Annexes

### A. Diffs proposés (lecture seule audit — diff conceptuel, à appliquer manuellement après validation)

#### A.1 `axionia/src/components/nav/Header.tsx`

```diff
 // Server Component à 4 items (HEAD) → 7 items + 2 mega-menus borderline (cible)
 export function Header() {
   return (
     <header className="sticky top-0 z-50 bg-terracotta backdrop-blur supports-[backdrop-filter]:bg-terracotta/95 border-b border-mocha/20">
       <div className="container mx-auto flex h-20 items-center justify-between px-12 lg:px-16">
         <Logo />
         <nav className="flex items-center gap-8">
           <NavLink href="/interventions">{t('nav.interventions')}</NavLink>
+          <MegaMenuTrigger label={t('nav.iaSolutions')} sections={iaSolutionsSections} />
           <CtaCentral
             href="/audit"
             label={t('cta.audit')}
+            badge="490 €"
+            tracking="cta_central_click"
           />
+          <MegaMenuTrigger label={t('nav.implantations')} sections={implantationsSections} />
           <NavLink href="/cas-concrets">{t('nav.casConcrets')}</NavLink>
+          <CommandPaletteTrigger />
           <LocaleSwitcher />
         </nav>
       </div>
     </header>
   );
 }
```

`MegaMenuTrigger` et `CommandPaletteTrigger` = client components borderline (lazy import).

#### A.2 `axionia/src/components/nav/MobileNav.tsx`

```diff
 // Drawer 1 niveau 4 items (HEAD) → drawer 2 niveaux 11 items + CTA bar (cible §9.4)
 export function MobileNav() {
   return (
     <Drawer>
+      <DrawerHeader>
+        <LocaleSwitcher />
+        <CommandPaletteTrigger />
+      </DrawerHeader>
       <DrawerBody>
         <NavLink href="/interventions">...</NavLink>
+        <Accordion title="IA & Solutions">
+          <NavLink href="/stack-ia">Stack IA (11 outils)</NavLink>
+          <NavLink href="/comparaisons">Comparaisons</NavLink>
+          <NavLink href="/guide-ia">Guide IA opérationnelle</NavLink>
+          <NavLink href="/glossaire">Glossaire</NavLink>
+        </Accordion>
+        <Accordion title="Implantations">
+          <NavLink href="/implantations">Toutes les implantations</NavLink>
+          {topRegions.map(...)}
+          {topVilles.map(...)}
+        </Accordion>
         <NavLink href="/cas-concrets">...</NavLink>
         <NavLink href="/blog">...</NavLink>
         <NavLink href="/faq">...</NavLink>
         <NavLink href="/centre-aide">...</NavLink>
         <NavLink href="/a-propos">...</NavLink>
         <NavLink href="/contact">...</NavLink>
       </DrawerBody>
+      <DrawerFooter className="sticky bottom-0">
+        <CtaPrimary href="/audit" label="Audit 490 €" />
+        <ContactInfo tel="..." email="..." />
+      </DrawerFooter>
     </Drawer>
   );
 }
```

#### A.3 `axionia/src/components/nav/Footer.tsx`

Refonte 4 cols → 5 zones + bandeau légal complet :

```diff
 export function Footer() {
   return (
     <footer>
       <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
-        {/* 4 cols actuelles */}
+        <BrandColumn>
+          <Logo />
+          <NewsletterStrategieIA />
+          <SocialLinks linkedin facebook youtube x />
+        </BrandColumn>
+        <FooterColumn title={t('footer.iaSolutions')}>
+          <FooterLink href="/stack-ia">Stack IA</FooterLink>
+          <FooterLink href="/comparaisons">...</FooterLink>
+          <FooterLink href="/guide-ia">...</FooterLink>
+          <FooterLink href="/glossaire">...</FooterLink>
+          <FooterLink href="/ia-custom">IA sur-mesure</FooterLink>
+        </FooterColumn>
+        <FooterColumn title={t('footer.cabinet')}>
+          <FooterLink href="/a-propos">...</FooterLink>
+          <FooterLink href="/methodologie">...</FooterLink>
+          <FooterLink href="/contact">...</FooterLink>
+          <FooterLink href="/presse">...</FooterLink>
+          <FooterLink href="/carrieres">Carrières</FooterLink>
+          <FooterLink href="/partenaires">Partenaires</FooterLink>
+        </FooterColumn>
+        <FooterColumn title={t('footer.ressources')}>
+          <FooterLink href="/blog">...</FooterLink>
+          <FooterLink href="/faq">...</FooterLink>
+          <FooterLink href="/centre-aide">...</FooterLink>
+          <FooterLink href="/cas-concrets">...</FooterLink>
+          <FooterLink href="/roi">...</FooterLink>
+        </FooterColumn>
+        <FooterColumn title={t('footer.implantations')}>
+          <FooterLink href="/implantations">Toutes les implantations</FooterLink>
+          {topVilles.slice(0, 12).map(...)}
+          <FooterLink href="/implantations#regions">Régions FR</FooterLink>
+          <FooterLink href="/implantations#drom">5 DROM</FooterLink>
+        </FooterColumn>
       </div>
+      <BottomBar>
+        © AxionIA OÜ — N° registre EE-XXXXXXX · TVA EE-XXXXXXXXX · {email} · {tel}
+        <FooterLink href="/mentions-legales">Mentions légales</FooterLink>
+        <FooterLink href="/conditions-generales">CGV</FooterLink>
+        <FooterLink href="/politique-confidentialite">Confidentialité</FooterLink>
+        <FooterLink href="/accessibilite">Accessibilité</FooterLink>
+        <FooterLink href="/preferences-cookies">Préférences cookies</FooterLink>
+      </BottomBar>
     </footer>
   );
 }
```

#### A.4 `axionia/messages/fr.json` + `axionia/messages/en.json`

```diff
 {
   "nav": {
     "interventions": "Interventions",
     "audit": "Audit",
+    "iaSolutions": "IA & Solutions",
+    "implantations": "Implantations",
+    "search": "Rechercher (⌘K)"
   },
+  "cta": {
+    "audit": "Demander un audit",
+    "audit490Aria": "Demander un audit, à partir de 490 €"
+  },
   "footer": {
+    "iaSolutions": "IA & Solutions",
+    "cabinet": "Cabinet",
+    "ressources": "Ressources",
+    "implantations": "Implantations",
+    "newsletter": {
+      "title": "Stratégie IA",
+      "subtitle": "1 fois par mois, 0 spam",
+      "rgpd": "Vos données sont protégées (RGPD)"
+    }
   },
+  "breadcrumbs": {
+    "home": "Accueil",
+    "implantations": "Implantations",
+    "stackIa": "Stack IA",
+    "iaSolutions": "IA & Solutions"
+  }
 }
```

(Mirror EN)

#### A.5 `axionia/src/i18n/routing.ts` — `routing.pathnames`

```diff
 export const routing = defineRouting({
   pathnames: {
     // ... entries existantes
+    '/implantations': {
+      fr: '/implantations',
+      en: '/locations'
+    },
+    '/implantations/[region]': {
+      fr: '/implantations/[region]',
+      en: '/locations/[region]'
+    },
+    '/implantations/[region]/[ville]': {
+      fr: '/implantations/[region]/[ville]',
+      en: '/locations/[region]/[city]'
+    }
   }
 });
```

(NB : décision FR-only V1 = mapping EN identique via fallback `next-intl` ou suppression entry EN.)

#### A.6 `axionia/src/lib/seo.ts` — 4 factories à ajouter (gap E G1)

```diff
 // Existant : buildProductMetadata, buildServiceJsonLd, buildFaqJsonLd, buildBreadcrumbJsonLd

+export function buildLocalBusinessJsonLd(opts: {
+  locale: 'fr' | 'en';
+  path: string;
+  name: string;
+  areaServed: { type: 'Place' | 'AdministrativeArea'; name: string };
+  address?: { city: string; region: string; country: string };
+  geo?: { latitude: number; longitude: number };
+  priceRange?: string;
+}) { /* ... */ }

+export function buildPlaceJsonLd(opts: {
+  locale: 'fr' | 'en';
+  path: string;
+  name: string;
+  geo: { latitude: number; longitude: number };
+  containedInPlace?: { name: string; url?: string };
+  population?: number;
+}) { /* ... */ }

+export function buildItemListJsonLd(opts: {
+  locale: 'fr' | 'en';
+  path: string;
+  name: string;
+  items: Array<{ url: string; name: string; position: number }>;
+}) { /* ... */ }

+export function buildOrganizationJsonLd(opts: {
+  locale: 'fr' | 'en';
+}) { /* ... layout-level — Estonia OÜ + sameAs LinkedIn/Facebook/YouTube/X + vatID + foundingDate + foundingLocation */ }
```

#### A.7 `axionia/src/app/sitemap.ts` — entries à ajouter (+ refactor split)

```diff
 const entries: DynamicSlug[] = [
   // ... entries existantes
+  {
+    fr: '/implantations/regions/:slug',
+    en: '/locations/regions/:slug',
+    slugs: getAllRegionSlugs(),
+    changeFrequency: 'monthly',
+    priority: 0.7
+  },
+  {
+    fr: '/implantations/:region/:ville',
+    en: '/locations/:region/:city',
+    slugs: getAllVilleSlugs(),
+    changeFrequency: 'monthly',
+    priority: 0.5
+  },
+  // Bug bonus E G5 : entry manquante
+  {
+    fr: '/implementation/par-fonction/:slug',
+    en: '/implementation/by-role/:slug',
+    slugs: getAllImplementationFonctionSlugs(),
+    changeFrequency: 'monthly',
+    priority: 0.6
+  },
+  // Gap E G6 : presse details
+  {
+    fr: '/presse/:slug',
+    en: '/press/:slug',
+    slugs: getAllPressArticleSlugs(),
+    changeFrequency: 'monthly',
+    priority: 0.5
+  }
 ];
```

**Refactor sitemap-index** (Q7 STOP & ASK) :

- `axionia/src/app/sitemap.ts` → `sitemap-index.xml` racine.
- Routes Next 16 : `app/sitemap-pages/route.ts`, `app/sitemap-blog/route.ts`, `app/sitemap-cas-concrets/route.ts`, `app/sitemap-comparaisons/route.ts`, `app/sitemap-faq/route.ts`, `app/sitemap-centre-aide/route.ts`, `app/sitemap-stack-ia/route.ts` (si activé), `app/sitemap-regions/route.ts`, `app/sitemap-villes-[region]/route.ts`, `app/sitemap-implementation-fonctions/route.ts`, `app/sitemap-presse-articles/route.ts`.

#### A.8 `axionia/src/content/regions.ts` (à créer)

```ts
export type Region = {
  slug: string;
  nameFr: string;
  nameEn: string;
  type: "metropole" | "drom";
  prefecture: string;
  pibRank: number;
  topVilles: string[]; // slugs
  dataSourceVersion: string; // ex: 'INSEE-2024-01'
};

export const REGIONS_ALL: Region[] = [
  { slug: "ile-de-france", nameFr: "Île-de-France" /* ... */ },
  { slug: "auvergne-rhone-alpes" /* ... */ },
  // ... 13 métropole + 5 DROM
];

export function getAllRegionSlugs(): string[] {
  return REGIONS_ALL.map((r) => r.slug);
}
export function getRegionBySlug(slug: string): Region | undefined {
  /* ... */
}
export function getDromRegions(): Region[] {
  return REGIONS_ALL.filter((r) => r.type === "drom");
}
```

#### A.9 `axionia/src/content/villes.ts` (à créer V1)

```ts
export type Ville = {
  slug: string; // kebab-case sans accent + suffixe dpt si homonymie
  nameFr: string;
  region: string; // slug région
  departement: string; // ex: '93'
  population: number;
  populationYear: number;
  geo: { lat: number; lon: number };
  topSecteursNaf: string[];
  distancesParis: { tgv?: number; aerien?: number; voiture: number };
  noindex?: boolean; // thin-content flag
  dataSourceVersion: string;
};

export const VILLES_V1: Ville[] = [
  /* 1 160 entrées >10 000 hab + ~30 DROM */
];

export function getAllVilleSlugs(): string[] {
  /* ... */
}
export function getVilleBySlug(slug: string): Ville | undefined {
  /* ... */
}
export function getVillesByRegion(regionSlug: string): Ville[] {
  /* ... */
}
```

#### A.10 `axionia/src/lib/geo.ts` (à créer)

```ts
import type { Ville } from "@/content/villes";

export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  /* ... */
}

export function getNearbyVilles(slug: string, n: number, villes: Ville[]): Ville[] {
  const center = villes.find((v) => v.slug === slug);
  if (!center) return [];
  return villes
    .filter((v) => v.slug !== slug)
    .map((v) => ({ v, d: haversineKm(center.geo, v.geo) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.v);
}
```

### B. Working tree non commité `/stack-ia` (signalement)

Au moment de l'audit (HEAD `a726ca9`), le working tree contenait :

```
 M src/app/[locale]/stack-ia/page.tsx          (+161 / -119)
 M src/components/nav/Footer.tsx                (+1)
 M src/content/stack-ia.ts                      (+10)
?? src/components/sections/StackHeroSchema.tsx  (nouveau, non tracké)
?? src/components/sections/ToolLogo.tsx          (nouveau, non tracké)
```

**L'audit a pris HEAD comme référence** (conformément au prompt source §3 et au lancement Will). Will doit décider après l'audit :

- (a) committer la refonte working tree → audit à re-passer post-commit pour valider la cohérence avec `header-architecture.json`.
- (b) stash → audit reste valide pour HEAD.
- (c) intégrer la refonte dans Sprint 15 avec les patches header/footer/mega-menus.

### C. ADR liées (renvois)

- **ADR 0003 — Navigation mega-menu** : `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` (Agent C, 340 lignes). À la validation, sera renommée `axionia/docs/adr/0005-navigation-mega-menu.md` (slot 0003 occupé par `0003-lift-formation-ban.md`).
- **ADR 0004 — pSEO villes/régions** : `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` (audit principal + Agent D, ce fichier). À la validation, sera renommée `axionia/docs/adr/0006-pseo-villes-regions-2026.md` (slot 0004 occupé par `0004-typography-baseline-upgrade-v3-1.md`).

### D. Bug bonus — sitemap.ts G5 (Agent E)

`routing.pathnames:74-77` déclare `/implementation/par-fonction/[slug]` mais `app/sitemap.ts` n'a aucune entry `buildDynamic` correspondante → ces pages ne sont pas dans le sitemap, donc pas crawlées efficacement par Google. **À corriger en bonus Sprint 15** (cf. annexe §A.7 diff).

### E. Gap bonus — sitemap.ts G6 (Agent E)

Pas d'entry sitemap pour `/presse/[slug]` (hub OK, détails pas encore wirés). **À corriger en bonus Sprint 15** (cf. annexe §A.7 diff).

### F. Cleanup léger — SITE_URL G7 (Agent E)

`SITE_URL` redéclaré dans `seo.ts:4` et `sitemap.ts:15`. **Cleanup mineur** : centraliser dans une constante partagée.

### G. Décisions Will requises — récapitulatif final (8 STOP & ASK)

1. **Q1 — `/stack-ia` : 11 outils sélectifs vs catalogue plus large ?** → recommandation **conserver 11**.
2. **Q2 — Profondeur URL villes ?** → recommandation **Option B `/implantations/[region]/[ville]`**.
3. **Q3 — Régions DROM-COM ?** → recommandation **métropole + 5 DROM, exclure COM**.
4. **Q4 — ADR §9.2 ?** → recommandation **Voie 2 (mega-menus avec garde-fous)**.
5. **Q5 — Pipeline pSEO ?** → recommandation **80/20 LLM/Will**.
6. **Q6 — Phase 1 V1 ?** → recommandation **top 50 villes** (V1 totale = 1 160).
7. **Q7 — Split sitemap ?** → recommandation **oui** (sitemap-index + sous-sitemaps).
8. **Q8 — ⌘K Sprint 15 ou 16+ ?** → recommandation **Sprint 16** OK.

**Statut** : DRAFT. Aucun code modifié. Aucun ADR mergé dans `axionia/docs/adr/`. Will valide → renommer ADR 0003→0005 et 0004→0006 + déplacer + appliquer patches Sprint 15.

---

**Fin de l'audit Header & Navigation 2026 · 2026-05-07.**
