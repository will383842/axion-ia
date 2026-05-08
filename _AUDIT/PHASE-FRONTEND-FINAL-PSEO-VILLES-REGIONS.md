# Phase Frontend Final — pSEO Villes/Régions FR + Mega-menus + Foundation AEO/GEO 2026

> **Date plan** : 2026-05-07 (amendé V1 = 2 150 villes >5 000 hab)
> **Statut** : ⏳ Planifié — **NON LANCÉ**. Will finit le frontend en cours (visual rhythm + hero schemas + illustrations) avant.
> **Position roadmap** : entre **Sprint 14.7** (typo v3.1, livré) et **Sprint 15** (Prisma backend, M8). Ce chantier fait partie du « frontend final », pas du backend.
> **Cible** : devenir **#1 en France dans chaque ville et chaque région** sur les requêtes IA opérationnelle B2B (lancement France-only V1).
> **Décisions sources** : ADR 0003 (mega-menus, à renommer 0005) + ADR 0004 (pSEO villes/régions, à renommer 0006) — toutes deux acceptées en bloc 2026-05-07.

---

## 0. Pourquoi ce document existe

Le « Sprint 15 » historique d'AxionIA = **M8 Prisma + migrations + seeders** (cf. `_AUDIT/PROMPT-CODAGE.md:990`). C'est du backend pur.

Le chantier décrit ici (mega-menus + foundation AEO/GEO + pSEO 2 150 villes) est un travail **frontend final** indépendant qui :

- Vient AVANT Sprint 15 Prisma (la base de données n'est pas requise pour les pages pSEO SSG).
- Exploite les **factories AEO/GEO 2026 déjà livrées** (commits `acd8080` + `eda574b` + `5d9d527`).
- Active la cible « #1 ville/région » sur laquelle Will mise stratégiquement.

L'appellation « Sprint 15 » dans les ADR 0003/0004 antérieurs est **trompeuse** — ce document remplace la référence pour le chantier réel.

---

## 1. Pré-requis (à valider avant lancement)

### Pré-requis Will

- [ ] **Frontend visual rhythm fini** : `Design.md` synchronisé, hero schemas Top 20 livrés, illustrations stabilisées.
- [ ] **Working tree propre** côté `axionia/` (pas de modifications non commitées sur les pages).
- [ ] **Validation finale ADR 0003 (mega-menus)** : confirmation Voie 2 (mega-menus avec garde-fous WCAG 2.2 AA + hover-intent 150 ms).
- [ ] **Validation finale ADR 0004 (pSEO villes)** avec amendement V1 = 2 150 villes >5 000 hab (au lieu de 1 160).
- [ ] **Données légales Estonia** disponibles : `vatID` (`EE-XXXXXXXXX`) + `registrikood` (à passer en option `buildOrganizationJsonLd` dans `layout.tsx`). NB : le chantier peut démarrer sans, mais idéalement complétées avant publication phase 1.

### Pré-requis techniques (déjà en place ✅)

- [x] **Sitemap-index** Next 16 via `generateSitemaps()` — `_AUDIT/STRATEGIE-AEO-GEO-2026.md` §1. Ajouter 2 ids (`regions` + `villes-[region]`) = 5 lignes.
- [x] **5 factories AEO/GEO 2026** prêtes dans `src/lib/seo.ts` :
  - `buildLocalBusinessJsonLd` (ProfessionalService + areaServed + geo)
  - `buildPlaceJsonLd` (Place + geo + population)
  - `buildItemListJsonLd` (catalogue, listings, villes proches)
  - `buildFaqSpeakableJsonLd` (voice agents)
  - `buildBreadcrumbJsonLd` (breadcrumbs)
- [x] **`Organization` JSON-LD enrichi** layout-level (logo + sameAs + foundingDate + foundingLocation Estonia + areaServed + contactPoint).
- [x] **`Person` Will** câblé sur `/a-propos` (E-E-A-T 2026).
- [x] **`Article` JSON-LD complet** sur `/blog/[slug]` (dateModified + Person author + wordCount).
- [x] **Hreflang** émis partout (FR, EN, x-default = FR) via `routing.pathnames`.
- [x] **`SITE_URL` source unique** depuis `lib/seo.ts` (importé par 8+ fichiers).
- [x] **IndexNow protocol** opérationnel (Bing/Yandex).
- [x] **`llms.txt` + `llms-full.txt`** Edge runtime (Claude/Perplexity/ChatGPT).
- [x] **3 RSS feeds** (blog, cas-concrets, FAQ) — Bing Copilot.
- [x] **Bug sitemap G5** (`/implementation/par-fonction/[slug]`) corrigé.
- [x] **Tarifs audit** alignés sur la pyramide actuelle (FAQ + press release + pitch).
- [x] **OG image** doctrine v3 (`#1a4dd9` au lieu de `#146ef5` Webflow).
- [x] **Doublon Organization homepage** supprimé.
- [x] **Tokens CSS Webflow** purgés (`--ease-out-webflow` → `--ease-out-editorial`).

---

## 2. Architecture cible

### Routes FR (`routing.pathnames`)

```ts
'/implantations': { fr: '/implantations', en: '/locations' },
'/implantations/[region]': { fr: '/implantations/[region]', en: '/locations/[region]' },
'/implantations/[region]/[ville]': { fr: '/implantations/[region]/[ville]', en: '/locations/[region]/[city]' },
```

Décision FR-only V1 (Agent D) : EN sera évalué V2 selon Search Console.

### Hub `/implantations`

- Carte FR cliquable (SVG inline, départements colorés selon densité).
- Top régions par PIB (cards : IDF, ARA, NAQ, OCC, HDF, GES, +DROM).
- Lien « Toutes les villes » → page liste alphabétique paginée.
- Schema.org : `ItemList` (régions) + `Place` (FR).

### Pages régions `/implantations/[region]/page.tsx` (~18)

Sections obligatoires :

1. Hero localisé + breadcrumb.
2. Carte SVG région (départements interactifs).
3. Démographie + secteurs économiques INSEE NAF top 5.
4. Top 10 villes de la région (cards).
5. Régions limitrophes (maillage).
6. FAQ régionale (Speakable).
7. CTA `/audit` 490 €.

Schema.org empilé :

- `Place` + `LocalBusiness` (areaServed = région) + `ItemList` (top villes) + `BreadcrumbList` + `FaqSpeakable`.

### Pages villes `/implantations/[region]/[ville]/page.tsx` (~2 150)

Sections **non-clonables obligatoires** (anti-doorway pages Google HCU 2024) :

1. Hero localisé : « Cabinet IA opérationnel à [Ville] · [Département] ».
2. Démographie INSEE (population, INSEE Sirene nb entreprises, top 3-5 secteurs NAF).
3. Distance gare TGV / aéroport / temps trajet Paris (data SNCF + OpenStreetMap).
4. Cas client proche (rayon ~50 km via Haversine `getNearbyCases(ville, 50)`) si existe, sinon cas régional.
5. 5-8 villes proches (Haversine `getNearbyVilles(slug, 8)`) — maillage interne dense.
6. FAQ géolocalisée (4-6 Q : « Combien coûte un audit IA à [Ville] ? », « Avez-vous des cas clients à [Ville] ? », « Quels secteurs sont prioritaires à [Ville] ? »).
7. CTA réservation avec champ ville pré-rempli (réutilise `auditRequestStep3Schema` `forms.ts:67-73` qui a déjà `city` + `country`).

Schema.org empilé (5 schemas par page ville) :

- `LocalBusiness` (areaServed = ville) + `Place` (geo + population) + `BreadcrumbList` + `FaqSpeakable` + `ItemList` (villes proches).

### Mega-menus Header (Voie 2 ADR 0003)

2 mega-menus client borderline (lazy-loaded) ajoutés au Header :

- **« IA & Solutions »** : 3 colonnes — Stack IA (catalogue 11 outils) / Comparaisons / Méthodologie.
- **« Implantations »** : 3 colonnes — Régions top 6 par PIB / Métropoles top 8 / Hub carte.

Garde-fous :

- WCAG 2.2 AA strict (`aria-haspopup`, `aria-expanded`, `aria-controls`, focus trap, ESC, keyboard nav Tab/Arrows/Home/End).
- Hover-intent 150 ms (Apple HIG).
- `prefers-reduced-motion` respect strict.
- Mobile : drawer accordéons (pas mega-menus).
- Bundle client : ≤ 8 KB gzip pour les 2 mega-menus.

### Footer 5e zone (cohérent ADR 0003)

Colonne « Implantations » ajoutée :

- Lien hub `/implantations`.
- Top 12 villes par poids économique.
- Lien « Régions FR » (#regions).
- Lien « 5 DROM » (#drom).

---

## 3. Étapes d'exécution dans l'ordre

### Étape 1 — Foundation (jour 1-3)

**Code à créer** :

```
src/content/regions.ts                                      [NOUVEAU]
  ├── type Region (slug, nameFr, nameEn, type, prefecture, pibRank, topVilles, dataSourceVersion)
  ├── const REGIONS_ALL (~18 entrées)
  └── exports getAllRegionSlugs(), getRegionBySlug(), getDromRegions()

src/content/villes.ts                                       [NOUVEAU — squelette V1]
  ├── type Ville (slug, nameFr, region, departement, population, populationYear, geo, topSecteursNaf, distancesParis, noindex?, dataSourceVersion)
  ├── const VILLES_V1 (~2 150 entrées, populées via script INSEE)
  └── exports getAllVilleSlugs(), getVilleBySlug(), getVillesByRegion()

src/lib/geo.ts                                              [NOUVEAU]
  ├── haversineKm(a, b): number
  └── getNearbyVilles(slug, n, villes): Ville[]

src/i18n/routing.ts                                         [ÉTENDRE]
  └── 3 entrées /implantations + variantes EN

src/app/sitemap.ts                                          [ÉTENDRE]
  └── 2 ids dans generateSitemaps : regions + villes-[region]

src/app/[locale]/implantations/page.tsx                     [NOUVEAU — hub]
src/app/[locale]/implantations/[region]/page.tsx            [NOUVEAU]

src/components/nav/Header.tsx                               [ÉTENDRE — 2 mega-menus]
  └── client borderline lazy-loaded (uniquement les triggers + panneaux)

src/components/nav/Footer.tsx                               [ÉTENDRE — 5e zone]

messages/{fr,en}.json                                       [ÉTENDRE]
  └── nav.implantations + nav.iaSolutions + footer.implantations + breadcrumbs.implantations
```

**Scripts data** :

```
scripts/import-insee-villes.ts                              [NOUVEAU]
  └── Charge data.gouv.fr COG + INSEE populations légales + INSEE Sirene
      → produit src/content/villes.ts squelette typé.
```

**Vérifications** :

- `pnpm typecheck` ✅
- `pnpm lint` ✅
- `pnpm i18n:check` (4 nouvelles keys parité FR/EN)
- Build production : 18 régions + 1 hub doivent prerender en SSG.

**Livrable étape 1** : 18 régions + 1 hub `/implantations` indexables. Mega-menus livrés (Header + Footer). Sitemap-index étendu avec entries vides pour villes (encore aucune ville).

**Commit suggéré** : `feat(foundation): mega-menus + /implantations hub + 18 regions + scaffolds villes`

### Étape 2 — Phase 1 villes (top 50, semaines 1-2)

**Liste top 50** : chefs-lieux des 18 régions (~18) + métropoles principales (~30) + DROM principaux (~5).

**Pipeline LLM Claude Sonnet 4.6** :

```
scripts/generate-ville-content.ts                           [NOUVEAU]
  ├── Input  : ville Ville (depuis villes.ts)
  ├── Prompt : système ~3 000 tokens (cached, 90 % économie) avec doctrine
  │           éditoriale + format strict + ban des phrases clones.
  ├── Variables :
  │   - démographie INSEE (population, nb entreprises Sirene, top 3-5 NAF)
  │   - distances gare/aéroport/Paris
  │   - cas client proche (Haversine 50 km dans CASE_STUDIES)
  │   - 5-8 villes proches (Haversine `getNearbyVilles(slug, 8)`)
  └── Output : 9 sections markdown FR + JSON-LD Faq géolocalisée.
```

Quality gate Will : 50 villes review 100 % (~12.5 h).

Soumission **Indexing API Google** : top 50 en 1 jour (quota 200 URLs/jour).

**Vérifications post-phase 1** :

- Schema.org Validator : tester 5 villes random (LocalBusiness + Place + Breadcrumb + FaqSpeakable + ItemList).
- Rich Results Test Google : valider FAQ + LocalBusiness + Breadcrumb.
- Speakable Test (PageSpeed Insights → section Speakable).
- axe-core CI : pages villes pass WCAG 2.2 AA.
- Cosine similarity Bag-of-Words : sur 100 paires aléatoires de villes phase 1, similarité moyenne < 60 % (seuil anti-doorway).

**Critère go phase 2** :

- ✅ 50 villes indexées dans Search Console (vérifier sous 7-14 jours).
- ✅ Aucune pénalité « unhelpful AI-generated content » signalée.
- ✅ CTR > 0.5 % sur les requêtes « cabinet IA + ville » top 10.

**Livrable étape 2** : 50 villes indexables.

**Commit suggéré** : `feat(pseo): phase 1 — top 50 villes France (chefs-lieux + métropoles)`

### Étape 3 — Phase 2 villes (top 200, semaines 3-5)

Génération 150 villes additionnelles (population décroissante).

Spot-check 20 % Will (~7.5 h sur 3 semaines).

Search Console monitoring weekly. Si > 5 % de pages signalées « problèmes » → geler phase 3 jusqu'à diagnostic.

**Livrable étape 3** : 200 villes indexables.

**Commit suggéré** : `feat(pseo): phase 2 — top 200 villes (population décroissante)`

### Étape 4 — Phase 3 villes (exhaustif 2 150, semaines 7-12)

Génération mass des 1 950 villes restantes (>5 000 hab).

Spot-check 5 % Will (~16 h sur 6 semaines).

**Sitemaps split par région** : `sitemap-villes-ile-de-france.xml`, `sitemap-villes-auvergne-rhone-alpes.xml`, etc. (~18 sub-sitemaps). Pattern Next 16 `generateSitemaps()` accepte des ids dynamiques.

**Refresh trigger** : cron annuel sur recensement INSEE (`scripts/refresh-villes.sh` à créer).

**Indexation conditionnelle thin-content** : flag `noindex: true` dans data + `metadata.robots.index = false` côté page pour villes proches du seuil 5 000 hab où le tissu économique est insuffisant pour différencier.

**Critère go fin V1** :

- ✅ ≥ 90 % des villes V1 indexables sous 30 jours après publication.
- ✅ « Pages avec problèmes » < 3 % dans Search Console.
- ✅ ≥ 5 % CTR organique sur les requêtes top 200 villes.

**Livrable étape 4** : V1 complète = 18 régions + ~2 150 villes indexables.

**Commit suggéré** : `feat(pseo): phase 3 — V1 complète France >5000 hab (~2150 villes + 18 régions + DROM)`

### Étape 5 — Renommage ADR + sync doctrine (au plus tard fin phase 1)

- Renommer `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` → `axionia/docs/adr/0005-navigation-mega-menu.md` (statut « Accepté »).
- Renommer `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` → `axionia/docs/adr/0006-pseo-villes-regions-2026.md` (statut « Accepté »).
- Mettre à jour `axionia/CLAUDE.md` §9.2 → §9.2-bis (révision mega-menus, texte canon dans ADR 0003 §Plan de migration).
- Mettre à jour `axionia/Design.md` §Navigation avec les patterns mega-menus.
- Mettre à jour `_AUDIT/PROMPT-CODAGE.md` ou créer `PROMPT-CODAGE-PSEO.md` avec le DoD du chantier.

---

## 4. Pipeline LLM — détail prompts

### System prompt (cached ~3 000 tokens)

```
Tu rédiges la fiche d'une ville française pour AxionIA, cabinet IA opérationnel B2B premium (OÜ estonienne).

Doctrine éditoriale : ton sobre, professionnel, sans superlatifs creux. Pas de mots interdits :
"révolutionnaire", "incontournable", "leader", "innovant" (sans preuve), "expert" (laisse les
clients le dire), "passionné", "à la pointe".

Tu ne dois JAMAIS inventer de données chiffrées non vérifiables. Toutes les données INSEE
fournies en input sont sourcées — utilise-les. Si une donnée n'est pas fournie, ne l'invente pas.

Structure 9 sections obligatoires (voir input). Différentiation forcée par les data fournies.

Format de sortie : JSON strict avec 9 clés. Pas de markdown. Pas de commentaires.

Cible AEO/GEO 2026 : chaque réponse FAQ doit être autonome (40-80 mots) pour citation Google
AI Overviews / Perplexity / Claude.ai sans contexte additionnel.
```

### User prompt (variable par ville)

```
{
  "ville": {
    "nom": "Lyon",
    "departement": "69 (Rhône)",
    "region": "Auvergne-Rhône-Alpes",
    "population": 522969,
    "anneePop": 2024,
    "nbEntreprises": 65000,
    "topSecteurs": ["Banque/Finance", "Pharmacie", "Numérique"],
    "distances": {
      "tgvParis": "1h57",
      "aeroport": "Lyon Saint-Exupéry (LYS) - 25 km centre",
      "voitureParis": "4h30 (465 km)"
    },
    "casClientProche": {
      "slug": "ace-comptable-360",
      "ville": "Lyon",
      "secteur": "Cabinet comptable"
    },
    "villesProches": [
      { "slug": "villeurbanne", "nom": "Villeurbanne", "distance": "5 km" },
      { "slug": "vénissieux", "nom": "Vénissieux", "distance": "8 km" },
      ...
    ]
  }
}

Génère le JSON 9 sections.
```

### Coût prompt caching

- System prompt 3 000 tokens × $0.3/M input cached = négligeable.
- User prompt ~500 tokens × 2 150 villes × $3/M input = ~3 €.
- Output ~3 000 tokens × 2 150 villes × $15/M = ~97 €.
- **Total LLM V1 ≈ 100-130 €** (avec retours).

---

## 5. Garde-fous qualité

### Anti-doorway pages

- **Cosine similarity** Bag-of-Words sur 100 paires random villes phase 1 : moyenne < 60 % (sinon pénalité Google HCU).
- **Différentiation forcée** par data INSEE (chaque ville a un mix unique de population + secteurs NAF + cas client proche + villes proches).
- **Sections non-clonables** : 7 sections sur 9 dépendent de la donnée locale (impossible de copier-coller entre villes).

### Quality gate Will

- Phase 1 : review 100 % (50 villes × 15 min).
- Phase 2 : spot-check 20 % (~30 villes × 3 min).
- Phase 3 : spot-check 5 % (~98 villes × ~30 s, focus sur signaux Search Console anomalies).

### Search Console monitoring

- Soumettre sitemap-index dans Search Console.
- Surveiller weekly :
  - Couverture (Indexées / Crawled but not indexed / Excluded).
  - Performance (impressions, clicks, CTR par requête).
  - Core Web Vitals par page.
- Alerte si « pages avec problèmes » > 5 % → freeze phase 3.

### Tests automatisés

- `axe-core` CI sur pages villes/régions échantillon (Sprint 21 prévu, à anticiper sur ce chantier).
- Schema.org Validator (validator.schema.org) — script de validation par lot.
- Snapshot diff Vitest sur 5 villes random (détecte régression visuelle/structurelle).

### Indexation conditionnelle

Pour villes thin-content (proches du seuil 5 000 hab + tissu économique faible) :

- Flag `noindex: true` dans `Ville` data.
- `metadata.robots.index = false` côté page.
- Promotion progressive (noindex → index quand contenu enrichi par data Sirene plus récente).

---

## 6. KPIs cible 12 mois post-V1

| KPI                                                         | Baseline pré-V1             | Cible V1 + 12 mois                       |
| ----------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| Pages indexables Google FR                                  | ~150                        | ≥ 2 200 (régions + villes + reste)       |
| Citations AI Overviews / mois                               | 0 (mesure baseline à faire) | ≥ 80/mois                                |
| Citations Perplexity / mois                                 | 0                           | ≥ 50/mois                                |
| Citations Claude.ai / mois                                  | 0                           | ≥ 30/mois                                |
| CTR organique toutes requêtes                               | TBD                         | ≥ 4 %                                    |
| Position moyenne « cabinet IA + ville » FR (top 200 villes) | TBD                         | top 3 sur ≥ 70 % des villes top 200      |
| Position moyenne « cabinet IA + ville » FR (autres villes)  | TBD                         | top 5 sur ≥ 50 % des villes hors top 200 |
| Position « cabinet IA opérationnel France »                 | TBD                         | top 3                                    |
| Crawl budget Google (pages/jour)                            | TBD                         | ≥ 200                                    |
| Search Console « pages avec problèmes »                     | N/A                         | < 3 %                                    |

---

## 7. Critères d'arrêt / rollback

### Rollback partiel

- **Phase 1 (50 villes)** : revert commits + `noindex` sur les 50 villes. Aucun coût Search Console (top 50 = chefs-lieux, retrait OK).
- **Phase 2 (200 villes)** : `noindex` mass + retrait sitemap. Crawl Google redécouvre le retrait en ~30 jours.
- **Phase 3 (2 150)** : idem mais impact crawl plus long (~60 jours pour repropagation).

### Critères d'arrêt automatique

Geler phase suivante si l'un de ces signaux apparaît :

- Search Console « unhelpful content » signalé sur ≥ 1 page.
- « Pages avec problèmes » > 5 %.
- Core Web Vitals LCP > 3 s sur > 10 % des pages.
- Cosine similarity moyenne > 70 % entre paires random.
- Plainte d'un client B2B sur la qualité éditoriale.

### Pas de migration DB

Tout est SSG content-based. Suppression = revert + rebuild. Aucun impact Sprint 15 Prisma.

---

## 8. Liens

- ADR 0003 (mega-menus) : `_AUDIT/adr-0003-navigation-mega-menu-PROPOSITION.md` — accepté en bloc 2026-05-07.
- ADR 0004 (pSEO villes) : `_AUDIT/adr-0004-pseo-villes-PROPOSITION.md` — accepté en bloc + amendement V1 = 2 150 villes.
- Audit Header & Nav : `_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md`.
- Stratégie AEO/GEO 2026 : `_AUDIT/STRATEGIE-AEO-GEO-2026.md`.
- Stratégie pSEO Agent D : `_AUDIT/pseo-strategy.md` (recommandation initiale 1 160 villes — amendée par Will à 2 150).
- Audit obsolescences/conflits : `_AUDIT/AUDIT-OBSOLESCENCES-CONFLITS-2026-05-07.md` (purge effectuée).
- Sprint 15 backend (Prisma) : `_AUDIT/PROMPT-CODAGE.md:990` — chantier distinct.

---

## 9. Phrase canonique pour relancer dans une nouvelle session

> « Lance le chantier Frontend Final pSEO Villes/Régions selon `_AUDIT/PHASE-FRONTEND-FINAL-PSEO-VILLES-REGIONS.md` (V1 = 2 150 villes >5 000 hab France métropole + 5 DROM, ADR 0003+0004 acceptées en bloc). Démarre par l'étape 1 Foundation : import INSEE + scaffolds régions/villes + mega-menus Header + 2 ids sitemap + 18 régions indexables. Mode auto. STOP & ASK avant chaque commit. Ne lance pas Sprint 15 Prisma (chantier distinct). »

---

**Statut du document** : 2026-05-07. À mettre à jour à chaque jalon (étape 1 livrée, phase 1 livrée, etc.).
