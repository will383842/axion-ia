# ADR 0004 — pSEO villes & régions FR : engagement scale + pipeline éditorial (PROPOSITION)

- **Statut** : Accepté en bloc 2026-05-07 + amendement périmètre 2026-05-07 (volume V1 ramené à TOUTES villes >5 000 hab France = ~2 150 communes, pas 1 160 >10 000 hab — décision Will « TOUT ou rien sur le SEO »). Décisions consolidées : Q1 11 outils conservés, Q2 URL hiérarchique Option B, Q3 métropole + 5 DROM exclure COM, Q4 Voie 2 mega-menus, Q5 80/20 LLM/Will, Q6 phase 1 top 50, Q7 split sitemap, Q8 ⌘K post-pSEO. Implémentation **différée** — Will finit le frontend en cours avant. Sprint 15 backend (Prisma) reste un chantier distinct. Renommage en `axionia/docs/adr/0006-pseo-villes-regions-2026.md` reporté au démarrage du chantier.
- **Statut historique** : DRAFT
- **Date** : 2026-05-07
- **Auteur** : Agent principal (audit Header & Navigation 2026) + Agent D (stratégie pSEO)
- **Référence** : Cette ADR engage Axion-IA sur une expansion durable de la surface SEO. Elle dépend de l'**ADR 0003** (mega-menus avec garde-fous, à valider en parallèle) pour rendre les pages atterrissables depuis le header.
- **Audit source** : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md` + `_AUDIT/pseo-strategy.md` + `_AUDIT/stack-fit-analysis.md` (2026-05-07).
- **Note slot** : les slots ADR 0001-0004 sont **déjà occupés** dans `axionia/docs/adr/` (stack initial, design pivot, lift formation, typography baseline). À la validation, ce fichier sera renommé `axionia/docs/adr/0006-pseo-villes-regions-2026.md` (l'ADR navigation §9.2 prendra `0005`).

---

## Contexte

Will prépare une **expansion de surface de visibilité SEO majeure** pour Axion-IA :

1. **Pages régions** FR (~13-18 régions selon décision DROM-COM).
2. **Pages villes** FR > 5 000 habitants (volume initial estimé 3 500 par Will, **corrigé à ~2 150 par Agent D** — sources INSEE COG + populations légales).
3. **Page « Toutes les IA »** déjà livrée sous `/stack-ia` (HEAD `a726ca9`+, refonte working tree non commitée 2026-05-07).

Le `CLAUDE.md` v6 de référence (`Axion-IA_Dossier_FINAL_ABSOLU_v10.1/CLAUDE.md` lignes 333-414) ne couvre pas le pSEO programmatique à cette échelle. Aucune ADR n'a encore engagé Axion-IA sur :

- Le **volume cible** (>5 000 hab vs >10 000 hab vs métropoles only).
- La **profondeur URL** (plat vs hiérarchique).
- Le **périmètre géographique** (métropole vs +DROM vs +COM).
- Le **pipeline éditorial** (100% LLM vs 80/20 vs 50/50).
- Le **rollout** (big bang vs phasé).
- La **gouvernance** (refresh annuel INSEE, indexation conditionnelle thin-content).

L'absence de cadre crée 4 risques majeurs :

- **R1 — Doorway pages Google** : Helpful Content Update 2024 et Core Updates 2024-2025 pénalisent durement les fermes de pages clones. Sites jeunes spécialement à risque (crawl budget réduit).
- **R2 — Inflation surface CMS sans gouvernance** : sans `getAllRegionSlugs()` / `getAllVilleSlugs()` typés TS dans `src/content/`, le contenu dérive en MDX éparpillés ou JSON parallèles (anti-pattern Agent E).
- **R3 — Budget non maîtrisé** : sans estimation token + temps Will, exposition à drift de coût × 5-10 sur 12 semaines.
- **R4 — Régression performance** : 2150 pages SSR = coût hosting prohibitif (~10× SSG) — **SSG strict obligatoire**.

## Décision

Adopter la **stratégie pSEO villes/régions PERFECTION 2026** issue de l'audit Agent D, structurée en 8 décisions atomiques :

| Décision                               | Option retenue                                                                          | Alternatives                                           | Justification courte                                                                                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1 — Périmètre géographique**        | **Métropole + 5 DROM** (Guadeloupe, Martinique, Guyane, Réunion, Mayotte) — exclure COM | Métropole only / +COM                                  | ROI nul B2B sur COM (Polynésie, Nouvelle-Calédonie, Wallis-et-Futuna, Saint-Pierre-et-Miquelon, Saint-Martin) + risque thin content. DROM = clients B2B francophones, marché Axion-IA pertinent.                                                                                        |
| **D2 — Volume V1 (amendé 2026-05-07)** | **TOUTES les ~2 150 villes >5 000 hab France métropole + ~30 communes DROM**            | V1 dégradée = 1 160 villes (>10 000 hab) / top 50 only | Décision Will : couverture maximale dès V1. Quality gate par phasage progressif (top 50 → top 200 → exhaustif sur 12 semaines), pas par seuil de population. Grands gagnants côté SEO : moteurs de recherche locaux indexent les noms de communes même petites.                         |
| **D3 — Profondeur URL**                | **Option B hiérarchique** : `/implantations/[region]/[ville]`                           | A plat / C 3 niveaux                                   | Meilleur PageRank flow (région → ville). Crawl segmentation propre. URLs lisibles. Évite 3 niveaux (URLs longues).                                                                                                                                                                      |
| **D4 — Slug ville**                    | **kebab-case sans accent**, gestion homonymes via suffixe code postal département       | Slug brut INSEE                                        | `paris`, `lyon`, `boulogne-billancourt`, `saint-denis-93` (Seine-Saint-Denis) vs `saint-denis-974` (Réunion).                                                                                                                                                                           |
| **D5 — Pipeline éditorial**            | **80/20 LLM/humain** (Claude Sonnet 4.6 + prompt caching)                               | 100% review / 50/50                                    | Phase 1 = 100% review Will (50 villes test = quality gate). Phase 2 = spot-check 20%. Phase 3 = spot-check 5%. Différentiation éditoriale par sections **non-clonables** : démographie INSEE + secteurs porteurs + cas client proche + 5-8 villes proches Haversine + FAQ géolocalisée. |
| **D6 — Rollout**                       | **3 phases** sur 12 semaines                                                            | Big bang                                               | Phase 1 (top 50 — sem 1-2) → Phase 2 (top 200 — sem 3-5) → Phase 3 (1 160 — sem 7-12). Search Console monitoring entre chaque. Évite signal manipulation Google.                                                                                                                        |
| **D7 — Refresh**                       | **Annuel** sur recensement INSEE                                                        | Trimestriel / jamais                                   | Champ `dataSourceVersion` typé dans `src/content/villes.ts`. Refresh = ~4h/an Will.                                                                                                                                                                                                     |
| **D8 — Indexation**                    | **Conditionnelle thin-content**                                                         | Tout indexé / rien indexé                              | Flag `noindex: true` dans data + `metadata.robots.index = false` côté page pour villes proches du seuil. Promotion progressive (noindex → index quand contenu enrichi).                                                                                                                 |

### Architecture technique (cohérente avec Agent E — anti-réinvention)

**Fichiers à CRÉER** :

- `axionia/src/content/regions.ts` — type `Region` + `getAllRegionSlugs()` + `getRegionBySlug()` + `getDromRegions()` + const `REGIONS_ALL`.
- `axionia/src/content/villes.ts` — type `Ville` + `getAllVilleSlugs()` + `getVilleBySlug()` + `getVillesByRegion()` + champ `dataSourceVersion` + champ `noindex?: boolean`.
- `axionia/src/lib/geo.ts` — Haversine + `getNearbyVilles(slug, n)`.
- `axionia/src/app/[locale]/implantations/page.tsx` — hub FR (carte cliquable + top régions + lien « toutes les villes »).
- `axionia/src/app/[locale]/implantations/[region]/page.tsx` — page région.
- `axionia/src/app/[locale]/implantations/[region]/[ville]/page.tsx` — page ville (template avec sections non-clonables).
- `axionia/src/app/sitemap-villes-[region]/route.ts` — sitemap segmenté par région (Next 16 pattern).
- `axionia/src/app/sitemap-regions/route.ts` — sitemap régions.
- `axionia/src/app/sitemap.ts` réécrit en `sitemap-index.xml` pointant vers sous-sitemaps.

**Fichiers à ÉTENDRE** :

- `axionia/src/lib/seo.ts` — ajouter `buildLocalBusinessJsonLd`, `buildPlaceJsonLd`, `buildItemListJsonLd`, `buildOrganizationJsonLd` (gaps E G1).
- `axionia/src/i18n/routing.ts` — ajouter entries `/implantations`, `/implantations/[region]`, `/implantations/[region]/[ville]` avec mapping EN `/locations/[region]/[city]`. **Décision i18n V1** : pages villes/régions FR-only (recommandation Agent D — coût rédactionnel EN = ×2 pour ROI B2B incertain).
- `axionia/src/app/robots.ts` — whitelist explicite des nouveaux paths.
- `axionia/messages/fr.json` + `axionia/messages/en.json` — clés `nav.implantations`, `footer.implantations`, `breadcrumbs.implantations`.
- `axionia/src/components/nav/Footer.tsx` — ajouter colonne « Implantations » (5e zone §10.1).
- `axionia/src/components/nav/Header.tsx` — ajouter mega-menu « Implantations » (dépend ADR 0003).

**Fichiers à NE PAS toucher (rappel doctrine)** :

- `axionia/src/components/marketing/JsonLd.tsx` — signature stable, ne pas variantiser.
- `axionia/src/app/globals.css` — typo doctrine v3.1 (ADR 0004 existante) inchangée.
- Logo et fond `bg-terracotta` du header — interdits absolus Will.

### Pipeline éditorial — sections non-clonables obligatoires par ville

1. **Hero localisé** : « Cabinet IA opérationnel à [Ville] · [Département] » + CTA `/audit` 490 €.
2. **Démographie + tissu économique** (data INSEE Sirene + recensement) : population, nb entreprises, top 3 secteurs NAF.
3. **Distance gare TGV / aéroport / temps trajet Paris** (data SNCF + OpenStreetMap).
4. **Cas client proche** (rayon ~50km via Haversine `getNearbyCases(ville, 50)`) si existe, sinon cas régional.
5. **5-8 villes proches** (Haversine `getNearbyVilles(slug, 8)`) — maillage interne.
6. **FAQ géolocalisée** : 4-6 questions dont « Combien coûte un audit IA à [Ville] ? », « Avez-vous des cas clients à [Ville] ? », « Quels secteurs sont prioritaires à [Ville] ? ».
7. **CTA réservation** avec champ ville pré-rempli (réutilise `auditRequestStep3Schema` `forms.ts:67-73` — déjà a `city` + `country`, gap E G7).

**Différentiation cible** : ≥ 40-60 % de contenu unique par ville (vs. seuil HCU). Mesuré par cosine similarity Bag-of-Words sur 100 paires aléatoires phase 1.

### Schema.org par page

- **Hub `/implantations`** : `ItemList` (régions) + `Place` (FR).
- **Région** : `Place` + `LocalBusiness` (areaServed = région) + `ItemList` (top villes) + `BreadcrumbList`.
- **Ville** : `LocalBusiness` (areaServed = ville) + `Place` + `FAQPage` + `BreadcrumbList`.

### Sitemap — split

`sitemap-index.xml` (racine) pointant vers :

- `sitemap-pages.xml` (statiques)
- `sitemap-blog.xml` (déjà OK)
- `sitemap-cas-concrets.xml` (déjà OK)
- `sitemap-regions.xml` (~18 URLs)
- `sitemap-villes-ile-de-france.xml`, `sitemap-villes-auvergne-rhone-alpes.xml`, etc. (~13 fichiers métropole + 5 fichiers DROM = ~18 sitemaps)

Limite Google 50 K URLs/sitemap : largement respectée (région la plus dense = IDF avec ~250 villes >10 000 hab).

### Indexation phase 1 — Indexing API Google

- Phase 1 (top 50) : soumission Indexing API Google pour accélérer crawl initial (job hebdomadaire scripté).
- Phase 2-3 : crawl naturel via sitemap + maillage interne.

## Coûts estimés (V1 = ~2 150 villes >5 000 hab France métropole + ~30 DROM)

> **Périmètre amendé 2026-05-07** : Will retient toutes les villes >5 000 hab dès V1 (au lieu de la séquence 1 160 → 2 150 sur 6 mois). Coûts recalculés proportionnellement. **Sitemap-index split déjà livré** (commit `acd8080`) supporte le volume sans refactor additionnel.

### Tokens LLM (Claude Sonnet 4.6 + prompt caching)

- 2 150 villes × ~3 000 tokens output × $15/M = ~97 €.
- - system prompt ~3 000 tokens caché (90 % économie via prompt caching) ≈ 10 €.
- - itérations Will phase 1 quality gate (50 villes × 2 itérations) ≈ 8 €.
- - régénérations spot-check phases 2-3 (~10 % retours) ≈ 15 €.
- **Total LLM V1 ≈ 130 €** (négligeable). **Refresh annuel** ≈ 100 €/an.

### Temps Will (poste dominant — 80/20 LLM/humain)

- Phase 1 (top 50 villes : chefs-lieux + métropoles) : 50 × 15 min = **12.5 h** (review 100 %).
- Phase 2 (top 200 villes) : 150 × 3 min = **7.5 h** (spot-check 20 %).
- Phase 3 (1 950 villes restantes) : 1 950 × ~30 s = **16 h** (spot-check 5 % + corrections ciblées sur signaux Search Console).
- **Total temps Will V1 ≈ 36 h** sur 12 semaines (~3 h/sem en moyenne).
- - 6 h/an refresh INSEE (recensement annuel populations légales).

### Dev (équipe technique, hors Will)

- Scripts INSEE COG + Sirene API + Haversine + LLM loop : 3 j-h.
- Templates Next.js SSG (régions + villes + hub) : 2 j-h.
- Sitemaps : déjà fait (`acd8080`) — juste 2 ids `regions` + `villes-[region]` à ajouter à `generateSitemaps()` (~30 min).
- Indexing API Google submission script : 0.5 j-h.
- Tests (axe-core, schema validators, snapshot diff) : 1 j-h.
- Mega-menus header (cohérent ADR 0003) : 1-2 j-h.
- Brancher 5 factories `LocalBusiness/Place/ItemList/Faq/Breadcrumb` (déjà disponibles `lib/seo.ts`) sur le template ville/région : 1 j-h.
- **Total dev V1 ≈ 8.5 j-h** (factories AEO/GEO sont DÉJÀ en place — gain ~1 j-h vs estimation initiale).

### Outils optionnels

- INSEE COG / Sirene API : **gratuit**.
- data.gouv.fr référentiel communes : **gratuit**.
- DataForSEO ou Ahrefs (volumes recherche) : ~50-200 €/mois (optionnel — recommandé phase 2 pour prioriser les villes les plus recherchées).
- Hosting **Hetzner CPX32 Frankfurt + Coolify + Cloudflare gratuit** (Sprint 22, cf. `_AUDIT/PROMPT-CODAGE.md`) : SSG strict, ~2 150 pages × ~25 KB HTML compressé ≈ 55 MB build, bien sous les limites du serveur. Pas de coût additionnel hosting au-delà du serveur Axion-IA déjà prévu.
- Indexing API Google : gratuit (quota 200 URLs/jour → top 50 phase 1 soumis en 1 jour).

### Total V1

Charges principales : ~36 h Will sur 12 semaines (review + spot-check) + ~8.5 j-h dev équipe + ~130 € LLM + outils optionnels. Hosting Hetzner + Coolify (Sprint 22) absorbe les ~2 200 pages SSG sans coût additionnel. Budget global maîtrisé selon mode d'exécution (in-house vs externalisé). ROI break-even = 1 client B2B premium signé sur le canal SEO local.

### ROI attendu

1 client B2B premium Axion-IA = 15-50 K€ TTC sur 12 mois. **Break-even = 1 client.** ROI 12 mois cible 15× à 60×.

## Conséquences

### Positives

- **Surface SEO multipliée** : ~50 pages indexables → ~1 200 pages indexables V1 (× 24).
- **Maillage interne dense** : chaque ville → région + 5-8 villes proches + cas client proche → flow PageRank propre.
- **AEO/GEO 2026** : `LocalBusiness` + `FAQPage` partout → citations Claude.ai / Perplexity / SGE.
- **Doctrine éditoriale préservée** : sections non-clonables forcent différentiation, anti-doorway by design.
- **Gouvernance typée** : `getAllVilleSlugs()` + `dataSourceVersion` = refresh maîtrisé.
- **Cohérent avec ADR 0003** : mega-menu Implantations donne accès UX au catalogue de pages.

### À surveiller (Sprint 17+ post-rollout phase 3)

- **Search Console signaux qualité** : si « pages avec problèmes » > 5 % en phase 2, geler phase 3 jusqu'à diagnostic.
- **Core Web Vitals villes** : LCP cible < 2.5s — risque sur images cas-clients géolocalisés. SSG + `next/image` lazy.
- **Crawl budget** : Search Console → si « crawled but not indexed » > 30 %, ajouter contenu à valeur ajoutée par ville (vidéos témoignage régionales, datasets INSEE intégrés).
- **Inflation cas-concrets** : si Will ne produit pas de cas-concrets régionaux nouveaux, le maillage `getNearbyCases(50)` retombera en cas régional global → différentiation moindre.
- **Indexation conditionnelle drift** : sans refresh annuel, villes thin-content stagnent en `noindex`. Inclure script de re-évaluation phase 4 (an 2).

### Rollback

- **Phase 1 (sem 1-2)** : rollback = revert commits + `noindex` sur 50 villes. Aucun coût Search Console (top 50 = chefs-lieux, retrait OK).
- **Phase 2-3** : rollback = `noindex` mass + retrait sitemap. Crawl Google va redécouvrir le retrait en ~30 jours.
- **Pas de migration DB** : tout est SSG content-based. Suppression = revert + rebuild.

## Alternatives rejetées

1. **V1 immédiat à 2 150 villes (>5 000 hab)** — rejetée : risque doorway sur villes 5 000-10 000 hab où tissu économique trop faible pour différentier (cibler V2 dans 6 mois).
2. **Pages 100% LLM sans review** — rejetée : Helpful Content Update 2024 explicit sur « unhelpful AI-generated mass content ». Risque pénalité élevé.
3. **Big bang 2 150 villes en 1 publication** — rejetée : signal manipulation Google, crawl saturation, impossibilité de quality gate.
4. **URL plate `/villes/[ville]`** — rejetée : pas de hiérarchie SEO ville→région, dilue link equity.
5. **URL 3 niveaux `/implantations/[region]/[departement]/[ville]`** — rejetée : URLs trop longues + complexité maintenance + pas de gain SEO mesurable vs Option B.
6. **Algolia Cloud pour ⌘K et recherche** — rejetée : 500 €/mois récurrent vs Pagefind self-hosted gratuit (build-time, parfait pour ~2 150 pages SSG).
7. **MDX par ville** — rejetée : anti-pattern stack Axion-IA (TS typé strict via `src/content/`).
8. **JSON `data/villes.json`** — rejetée : anti-pattern stack Axion-IA (TS typé, pas JSON).
9. **Inclure COM (Polynésie, Nouvelle-Calédonie, Wallis-et-Futuna, Saint-Pierre-et-Miquelon, Saint-Martin)** — rejetée : ROI B2B nul + risque thin content (économie locale insuffisante pour différentiation).
10. **EN parité villes V1** — rejetée : coût rédactionnel × 2 pour ROI B2B incertain. Décision FR-only V1, EN évaluée V2 si signaux internationaux Search Console (Hreflang `x-default` = `fr`).

## Plan de migration et phasage (amendé 2026-05-07)

> **Note de timing** : ce chantier ≠ Sprint 15 historique (Prisma backend, `_AUDIT/PROMPT-CODAGE.md:990`). C'est un travail **frontend final**, à exécuter en fin de phase frontend (avant Sprint 15 Prisma) une fois le visual rhythm + les hero schemas stabilisés. Il dépend de l'ADR 0003 (mega-menus) et utilise les factories AEO/GEO 2026 déjà livrées (`lib/seo.ts` commits `acd8080` + `eda574b` + `5d9d527`).

### Étape 1 — Foundation (jour 1-3)

- Créer `src/content/regions.ts` (~18 entrées : 13 métropole + 5 DROM).
- Créer `src/content/villes.ts` (squelette avec ~2 150 entrées INSEE >5 000 hab + ~30 DROM).
- Créer `src/lib/geo.ts` (Haversine + `getNearbyVilles(slug, n)`).
- Étendre `routing.pathnames` : `/implantations`, `/implantations/[region]`, `/implantations/[region]/[ville]`.
- Étendre `app/sitemap.ts` `generateSitemaps()` avec ids `regions` + `villes-[region]` (sitemap-index déjà en place — commit `acd8080`).
- Créer hub `app/[locale]/implantations/page.tsx` + `[region]/page.tsx`.
- Mega-menus Header (cohérent ADR 0003) + colonne footer Implantations.
- **Livrable** : 18 régions indexables, hub fonctionnel, mega-menus livrés.

### Étape 2 — Phase 1 villes (top 50, semaines 1-2)

- Renseigner `src/content/villes.ts` top 50 villes (chefs-lieux + métropoles) avec 9 sections par ville.
- Pipeline LLM Claude Sonnet 4.6 + prompt caching pour rédaction des sections non-clonables (démographie INSEE + secteurs NAF + cas client proche + 5-8 villes proches Haversine + FAQ géolocalisée).
- Quality gate Will : 50 villes review 100 % (12.5 h).
- Soumission Indexing API Google (top 50 en 1 jour, quota 200/jour).
- Tests : axe-core + schema.org validator + snapshot diff.
- **Livrable** : 50 villes indexables.

### Étape 3 — Phase 2 villes (top 200, semaines 3-5)

- Génération 150 villes additionnelles (population décroissante).
- Spot-check 20 % Will (~7.5 h).
- Search Console monitoring weekly.
- **Livrable** : 200 villes indexables.

### Étape 4 — Phase 3 villes (exhaustif 2 150, semaines 7-12)

- Génération mass des 1 950 villes restantes (>5 000 hab).
- Spot-check 5 % Will (~16 h sur 6 semaines).
- Sitemaps split par région : `sitemap-villes-ile-de-france.xml`, `sitemap-villes-auvergne-rhone-alpes.xml`, etc. (≈ 18 sub-sitemaps).
- Refresh trigger script (cron annuel sur recensement INSEE).
- **Livrable V1 complète** : 2 150 villes indexables + 18 régions + hub.

### V2 (an 2+) — Expansion internationale conditionnelle

> Amendement 2026-05-07 : V1 couvre déjà les ~2 150 villes >5 000 hab. La V2 historique (passage 10 000 → 5 000 hab) est intégrée dans V1.

V2 redéfinie = expansion internationale, déclenchée seulement si Search Console FR signaux verts ET demande qualifiée hors France :

- **Belgique francophone** : ~30 villes Wallonie + Bruxelles. Slug `fr-BE` ou même slug FR avec `hreflang="fr-BE"`.
- **Suisse romande** : ~20 villes (Genève, Lausanne, Neuchâtel, Fribourg, Sion, etc.).
- **Québec** : ~50 villes (Montréal, Québec, Sherbrooke, etc.).
- **EN parité villes FR principales** : top 50 villes traduites pour audience anglophone professionnelle.
- **Hreflang `langue + région`** activé (`fr-FR`, `fr-BE`, `fr-CA`, `fr-CH`, `en-FR` international, etc.) — voir documentation hreflang dans `_AUDIT/STRATEGIE-AEO-GEO-2026.md`.

## Liens

- ADR 0003 (parallèle, dépendance UX) : `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` (sera renommée `0005` à validation).
- ADR 0002 (doctrine v3) : `axionia/docs/adr/0002-design-pivot-editorial-v3.md` — préservée intégralement.
- ADR 0004 (typo v3.1) : `axionia/docs/adr/0004-typography-baseline-upgrade-v3-1.md` — préservée intégralement.
- Stratégie pSEO source : `_AUDIT/pseo-strategy.md` (Agent D, ~580 lignes, 10 STOP & ASK).
- Fit stack : `_AUDIT/stack-fit-analysis.md` (Agent E, ~1 130 lignes, gaps G1-G11).
- Inventaire actuel : `_AUDIT/01-A-inventaire-nav.md` (Agent A, ~830 lignes, 9 pages orphelines).
- Benchmarks : `_AUDIT/benchmarks-2026.md` (Agent B, 11/13 sites).
- Rapport principal : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`.

## Décisions Will requises avant validation finale

1. **D1 — Périmètre** : approuver métropole + 5 DROM, exclure COM ?
2. **D2 — Volume V1** : approuver 1 160 villes >10 000 hab (vs 2 150 >5 000 hab) ?
3. **D3 — URL** : approuver Option B `/implantations/[region]/[ville]` ?
4. **D5 — Pipeline** : approuver 80/20 LLM/Will ?
5. **D6 — Phase 1** : approuver top 50 (12.5h Will, 2 semaines) ?
6. **D7 — Refresh** : approuver annuel + champ `dataSourceVersion` ?
7. **Budget** : approuver fourchette 2 800 € à 9 000 € V1 ?
8. **i18n** : approuver FR-only V1 (pas de parité EN) ?

À la validation : renommer `0006-pseo-villes-regions-2026.md` + déplacer dans `axionia/docs/adr/`.
