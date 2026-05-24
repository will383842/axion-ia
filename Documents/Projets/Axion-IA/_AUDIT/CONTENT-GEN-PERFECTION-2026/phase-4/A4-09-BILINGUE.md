# A4-09 : Bilingue FR/EN Qualité
## Score : 34/70

---

### Pipeline traduction

**Score partiel : 10/25**

#### Architecture générale

Il n'existe **aucun dossier `i18n/` dans `src/server/content-gen/`**. La gestion de la traduction est fragmentée en trois couches indépendantes qui ne se parlent pas :

1. **Couche UI (next-intl)** — `src/messages/fr.json` + `src/messages/en.json` : traductions manuelles des labels de l'interface (nav, CTA, footer, home page copy). Qualité élevée, écrits nativement EN par Will. Ces textes sont **non générés par LLM**.

2. **Couche contenu éditorial statique** — `src/content/interventions.ts`, `src/content/audit-detail-configs.ts`, etc. : chaque fichier expose explicitement `fr: { ... }` et `en: { ... }`. Traduction **manuelle par Will** côté contenus de service. Qualité culturellement adaptée (ex. `metaSeo.title` EN = `"Essential AI session · Axion-IA consultancy · €490"` vs FR `"Intervention IA Essentielle · cabinet Axion-IA · 490 €"`).

3. **Couche content-gen (articles générés)** — `src/server/content-gen/generators/` : **zéro traduction EN**. Doctrine v1.2 explicite : FR uniquement en V1. Tous les générateurs (`blog-article.ts`, `blog-from-keywords.ts`, `landing-ville.ts`, `guide-pilier.ts`) produisent exclusivement du contenu FR. Le `content-publish-worker.ts` (ligne 275) commente explicitement : `// Translation FR (en V1 — EN exclu doctrine v1.2)`.

#### Mécanisme de traduction EN

- **Pour le contenu généré automatiquement (actualités, guides, articles factory)** : **aucune traduction EN n'existe**. Les articles publiés en DB ne créent qu'une `ArticleTranslation` avec `locale: "fr"`. La route `/en/actualites/[slug]` redirige vers FR avec un `redirect('/fr/actualites/${slug}')`.
- **Pour les contenus statiques de service** : traduction manuelle dans les fichiers TypeScript, adaptée culturellement (pas une traduction littérale).
- **Pour la KB** : `src/lib/knowledge/locale-policy.ts` implémente un toggle `KB_LOCALE: fr_only | fr_en`, actuellement `fr_only` par défaut. La politique EN est architecturalement prête mais non activée.

#### Qualité des traductions EN disponibles (statiques)

Points positifs observés :
- `en.json` inclut une directive éditoriale : `"_": "EN mirror of fr.json. Never use the banned French word for 'training' — keep Axion-IA wording 'intervention/session'"`.
- Le mot "formation" n'apparaît pas dans `en.json` (aligné doctrine ADR 0008).
- Termes culturellement adaptés : "PME" → "SME", "ETI" → "mid-market", "TPE" → "micro-business / artisan", prix FR `"490 € HT"` → EN `"€490"`.
- Exemple `ia-custom-quand-vraiment.ts` : FR "fine-tuning" reste "fine-tuning" EN (terme anglophone universal, pas de faux-anglicisme).
- Adaptations URLs correctes : `/interventions/demarrage-ia-express` → `/interventions/ai-express-kickoff`, non une translittération.

Points faibles :
- **Aucun pipeline de génération EN automatique**. 100% du contenu blog/actualités généré (potentiellement des milliers d'articles) reste FR-only. Il n'y a pas de file BullMQ, pas de worker, pas de prompt template pour la traduction.
- **Absence totale de contrôle qualité traduction** : pas de `pnpm i18n:check` pour valider la parité FR/EN sur les contenus éditoriaux statiques (la directive dans `en.json` mentionne `pnpm i18n:check` mais cela n'est pas confirmé dans la config).
- Les 3 articles FS (`3-quick-wins-2026.ts`, `ia-custom-quand-vraiment.ts`, `pourquoi-auditer-avant-implementer.ts`) ont une copie EN dans le type `BlogPost.en: BlogPostCopy`, mais sans `directAnswer`, sans `faq`, et avec des `body` très courts (stubs). La qualité EN = stub non finalisé.

---

### Hreflang cohérence

**Score partiel : 13/20**

#### Architecture hreflang globale

La fonction `buildProductMetadata()` dans `src/lib/seo.ts` est le point central. Elle :
1. Résout les chemins localisés via `resolveLocalizedPath()` qui consulte `routing.pathnames` pour mapper `/fr/interventions/collectives` → `/en/interventions/team-trainings`.
2. Construit `alternates.languages = { fr: "/fr/...", en: "/en/...", "x-default": "/fr/..." }` uniquement si `isEnLocaleDisabled()` retourne `false`.
3. Le `layout.tsx` racine déclare `fr`, `en` et `x-default: "/fr"` au niveau global.

**Point critique** : depuis le 2026-05-16, `EN_LOCALE_ENABLED !== "true"` par défaut → **tous les hreflang `en` sont omis des metadata** des pages en production. Le code le commente explicitement (ligne 118 de `seo.ts`) : `"EN locale désactivé (2026-05-16) → omettre hreflang='en' pour ne pas signaler à Google une alternate EN qui répond 301"`.

#### Hreflang sur pages statiques de service

Correctement câblé côté code :
- `getIntervention("essentielle")[locale].metaSeo.{title,description}` → titre différent FR vs EN.
- `alternates: { fr: intervention.pathFr, en: intervention.pathEn }` passé explicitement.
- Gestion des routes FR ≠ EN : `/interventions/collectives` ↔ `/interventions/team-trainings` mappé dans `routing.ts`.

#### Hreflang sur articles générés (actualités/blog factory)

- Les articles actualités FR-only (doctrine v1.2) **ne propagent pas de hreflang EN** — correct techniquement (pas d'URL EN disponible).
- `loadBlogArticleForView()` dans `blog/loader.ts` retourne un article avec `slug` unique, et `buildProductMetadata({ path: "/blog/${slug}" })` résout les alternates via le mapping standard (slug identique FR/EN = `/blog/[slug]`).
- Les articles DB n'ont qu'une `ArticleTranslation` FR → hreflang EN pointerait vers une 404. L'absence de hreflang EN est donc **correcte** dans l'état actuel mais **non gérée explicitement** (dépendance implicite du flag `EN_LOCALE_ENABLED`).

#### Sitemap bilingue

- `filterEnIfDisabled()` dans `app/sitemap.ts` filtre automatiquement toutes les URLs `/en/*` et nettoie les `alternates.languages.en` quand `EN_LOCALE_ENABLED !== "true"`.
- Quand EN est activé : `buildDynamic()` génère 2 entrées (FR + EN) avec cross-référencement `alternates.languages.{ fr, en, "x-default": frUrl }`.
- L'image bank (`sitemaps/images-fr.xml`, `images-en.xml`) gère des hreflang `xhtml:link` complets incluant `x-default` pointant vers FR.

**Problème structurel identifié** : le `layout.tsx` racine (ligne 108-113) déclare toujours `languages: { fr: "/fr", en: "/en", "x-default": "/fr" }` **indépendamment du flag EN_LOCALE_DISABLED**. Cela signifie que même quand EN est désactivé, la page de base root pointe un hreflang EN vers une URL qui 301. Inconsistance avec la logique de `buildProductMetadata` et du sitemap qui eux respectent le flag.

#### x-default

Correctement positionné vers FR dans tous les points vérifiés (`seo.ts`, `sitemap.ts`, `images-fr.xml`).

---

### Meta EN audit

**Score partiel : 11/25**

#### Meta title EN

Pour les contenus de service statiques (interventions, audit) :
- **Meta title EN différent du FR** : confirmé. Exemple Essentielle : FR `"Intervention IA Essentielle · cabinet Axion-IA · 490 €"` vs EN `"Essential AI session · Axion-IA consultancy · €490"` — adaptation culturelle réelle, non traduction littérale. ✅
- La longueur n'est pas contrôlée séparément par locale dans le code — `buildProductMetadata()` accepte un `title: string` sans validation longueur distincte FR/EN.
- Les keywords EN ciblés dans `GeneratorBaseInput` : le `GeneratorOutput` ne contient pas de champ `primaryKeywordEn` — la pipeline de génération est FR-only donc la question ne se pose pas pour les articles générés.

Pour les contenus générés (articles factory, actualités) :
- **Aucun meta title EN** n'est généré. Le `content-publish-worker.ts` n'upsert qu'une `ArticleTranslation` locale `"fr"`. Les articles factory n'ont pas de version EN.

#### Meta description EN

- Pour les pages de service (statique) : descriptions EN distinctes et adaptées au marché anglophone. Exemple EN: `"A one-day on-site AI training (2 to 30 people): tool discovery, hands-on workshops, AI usage ideas. Standardised toolbox provided."` vs FR: `"Une journée de formation IA sur site (2-8 personnes) : découverte des outils, ateliers pratiques, idées d'usages IA opérationnels."` ✅
- Appel à l'action adapté : EN utilise "Book", "Discover", "Get started" ; FR utilise "Réserver", "Découvrir", "Démarrer". ✅
- Pour les articles générés : **aucune meta description EN**. ❌

#### Open Graph EN

- `buildProductMetadata()` dans `seo.ts` ligne 147 : `locale: locale === "fr" ? "fr_FR" : "en_US"` → og:locale `en_US` (pas `en_GB`). La cible internationale EN est US. ✅
- `og:title` et `og:description` partagent les mêmes `title` et `description` passés à `buildProductMetadata` — donc si la page EN passe un titre EN différent du FR, l'OG EN sera aussi distinct.
- La génération d'image OG dynamique (`/api/og?title=...`) est locale-agnostique : le titre EN sera encodé dans l'URL. ✅

#### H1 EN et keyword ciblage EN

- Pages de service : le H1 EN est extrait de `copy.title` / `copy.titleEm` depuis `interventions.ts` → adapter culturellement. Ex : FR "L'intervention IA Essentielle" → EN "The Essential AI session". ✅
- Absence de stratégie de keyword EN spécifique dans le content-gen : les 747 seeds (`src/content/keywords/g1-audit.ts` etc.) sont 100% FR. Aucun seed EN n'a été créé.
- La KB retrieve dans les générateurs force `locale: "fr"` → même si un article EN était généré, la RAG retrieve se ferait en FR. ❌

---

### Comparaison sample FR vs EN

**Corpus FS analysé (3 articles disponibles) :**

| Critère | FR | EN | Verdict |
|---|---|---|---|
| Title `3-quick-wins-2026` | "3 quick-wins IA opérationnels en 2026" | "3 operational AI quick-wins in 2026" | Adaptation correcte ✅ |
| Title `ia-custom-quand-vraiment` | "IA Custom : quand est-ce vraiment nécessaire ?" | "Custom AI: when is it really necessary?" | Correct ✅ |
| Title `pourquoi-auditer-avant-implementer` | "Pourquoi auditer avant d'implémenter" | "Why audit before you implement" | Correct ✅ |
| Excerpt longueur FR vs EN | ~120-150 chars | ~100-130 chars | Légèrement plus court EN, OK |
| Body longueur | ~130 mots | ~110 mots | Stub — les deux trop courts |
| directAnswer | Absent FR | Absent EN | Manquant sur les deux ❌ |
| FAQ | Absent FR | Absent EN | Manquant sur les deux ❌ |
| og:image alt EN | Non défini | Non défini | Manquant ❌ |
| primaryKeywords EN | Non défini | Non défini | Absent dans BlogPostCopy.primaryKeywords EN ❌ |

**Verdict sample** : Les 3 articles FS sont des stubs `indexationTier: "tier-2-noindex-follow"`. Le contenu EN suit les mêmes insuffisances que le FR (body court, pas de FAQ, pas de directAnswer). L'adaptation linguistique de base est correcte mais insuffisante pour du tier-1 indexable EN.

**Corpus DB (articles factory)** : 0 article EN en DB. La doctrine v1.2 n'a généré aucun article EN depuis le début du pipeline content-gen. Impossible de comparer.

---

### Recommandations

#### P0 — Bloquants

1. **Incohérence hreflang root layout** : `src/app/[locale]/layout.tsx` ligne 108-113 déclare `en: "/en"` dans `alternates.languages` sans conditionner au flag `isEnLocaleDisabled()`. Corriger pour aligner avec le comportement de `buildProductMetadata` et `sitemap.ts`.
   - Fichier : `axionia/src/app/[locale]/layout.tsx`
   - Fix : entourer le `languages.en` d'un `if (!isEnLocaleDisabled())`.

2. **Absence totale de pipeline traduction EN pour le content-gen** : Les articles générés (actualités, guides, blog factory) n'ont aucune version EN. Quand `EN_LOCALE_ENABLED=true` sera activé, les `/en/actualites/[slug]` et `/en/guides/[slug]` tomberont en 404 ou seront redirigés FR → signal négatif pour Google et les LLMs indexant la version EN.
   - Priorité dès réactivation EN : créer un worker `content-translate-worker.ts` ou ajouter un step de traduction dans `content-publish-worker.ts` utilisant Claude avec instructions d'adaptation culturelle (pas traduction littérale).

#### P1 — Sprint EN re-activation

3. **Stratégie keyword EN absente** : Les 747 seeds keywords sont 100% FR. Avant de générer du contenu EN, définir 50-100 seeds EN pour les verticaux prioritaires (audit, interventions, implementation). Cibles : `"AI training for SMEs"`, `"AI audit small business"`, `"AI implementation company"`.

4. **meta title length distinct FR/EN** : Ajouter validation longueur distincte dans `buildProductMetadata` (FR 50-65 chars, EN 50-60 chars — Google truncate en fonction du pixel width qui varie selon les caractères FR/EN). Actuellement aucune validation.

5. **primaryKeywords EN manquants dans BlogPost.en** : Le type `BlogPostCopy` expose `primaryKeywords?: ReadonlyArray<string>` mais les 3 articles FS ne l'utilisent pas (ni FR ni EN). Aligner le scoring qualité EN sur des keywords EN spécifiques.

6. **`pnpm i18n:check`** : La directive dans `en.json` mentionne cette commande mais elle n'est pas confirmée dans `package.json`. Vérifier existence et ajouter au CI si absente.

#### P2 — Améliorations V2

7. **og:locale `en_US` vs `en_GB`** : Le marché cible d'Axion-IA est Europe/international. `en_GB` serait plus approprié pour l'audience EU anglophone. Actuellement `en_US` dans `seo.ts` ligne 147. Décision éditoriale à trancher.

8. **Slug EN des articles générés** : La doctrine v1.2 utilise un slug FR pour les articles EN (`/en/actualites/formation-ia-pme-paris`). Quand les articles EN seront générés, les slugs devraient être traduits/adaptés EN pour le SEO (`/en/actualites/ai-training-sme-paris`). Le système le supporte (`ArticleTranslation.locale + slug unique par locale`) mais le workflow admin/publish ne gère pas encore ce cas.

9. **KB retrieve EN** : Les générateurs forcent `locale: "fr"` dans `kbRetrieve()`. Si un article EN est généré demain, la RAG retrieve se fera en FR → contexte potentiellement non adapté EN. Passer `locale` dynamiquement depuis l'input du générateur.

---

### Bilan global

| Dimension | Score | Max |
|---|---|---|
| Pipeline traduction | 10 | 25 |
| Hreflang cohérence | 13 | 20 |
| Meta EN optimisés | 11 | 25 |
| **Total** | **34** | **70** |

**Verdict** : 🟠 SPRINT CORRECTIF — La structure bilingue est architecturalement solide (next-intl, routing.ts, Prisma `ArticleTranslation.locale`, `buildProductMetadata` avec `resolveLocalizedPath`), mais la doctrine v1.2 FR-only bloque tout contenu EN généré automatiquement. Les meta EN des pages de service statiques sont bien écrites et culturellement adaptées (non des traductions littérales). Le bug hreflang du root layout est le seul P0 bloquant côté code existant. Le reste est un gap de roadmap (pas encore implémenté) plutôt qu'un bug.
