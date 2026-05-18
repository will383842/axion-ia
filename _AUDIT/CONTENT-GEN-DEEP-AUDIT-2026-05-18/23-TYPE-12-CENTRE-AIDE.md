# 23 — TYPE 12 : Centre d'aide

> Score : 72/100 — Status : 🟡 BON (3 routes vivantes, mais split DB/hardcode incohérent)

---

## 1. Description simple (Will-readable)

Centre d'aide produit. Articles courts répondant aux questions opérationnelles
client/prospect : préparer une intervention, périmètre d'un audit, phases
implémentation, TVA UE, sécurité données, support post-livraison.

**Différence vs FAQ** :

- FAQ (`/fr/faq`, `FAQ_GLOBAL` dans `transversal.ts:125`) = 5 questions
  marketing globales (« Qu'est-ce qu'Axion-IA ? », « 3 modules », « Données »,
  « Outils », « Facturation »). Format Q→A simple. JSON-LD `FAQPage`.
- Centre d'aide (`/fr/centre-aide`, `HELP_ARTICLES` dans `transversal.ts:217`)
  = articles long-form (~150 mots body) classés par catégorie. JSON-LD
  `Article` + TL;DR + breadcrumbs + voir aussi. Format quasi-blog.

Public cible centre d'aide : client signé + prospect chaud qui creuse le
détail opérationnel. FAQ = visiteur tiède en discovery.

**Constat au HEAD `9c1adaa`** :

- 3 routes publiques vivantes (index + détail + catégorie).
- Admin UI complète (list, new, edit) sur Prisma `HelpArticle`.
- **Incohérence majeure** : pages publiques lisent **hardcode `HELP_ARTICLES`**
  (`src/content/transversal.ts:217`), admin écrit en **DB `helpArticle`**
  (`src/features/admin-help/actions.ts:59`). **Aucune passerelle reader**
  comme pour le glossaire. Donc Will peut éditer en admin sans que la page
  publique change.

C'est le **gap P0** du type 12.

---

## 2. Diagramme Mermaid (flow complet)

```mermaid
flowchart TD
    subgraph PUBLIC[Surface publique]
        P1[/fr/centre-aide<br/>index categories + liste]
        P2[/fr/centre-aide/[slug]<br/>détail article]
        P3[/fr/centre-aide/categorie/[slug]<br/>liste par catégorie]
    end

    subgraph DATA[Sources]
        HC[HELP_ARTICLES hardcode<br/>src/content/transversal.ts:217<br/>6 articles SSOT]
        DB[(Prisma HelpArticle + HelpArticleTranslation<br/>schema.prisma:1190-1224)]
    end

    subgraph ADMIN[Admin UI]
        A1[/admin/help liste]
        A2[/admin/help/new création]
        A3[/admin/help/[id] édition]
        AC[src/features/admin-help/actions.ts]
    end

    P1 -->|getHelpArticlesByCategory| HC
    P2 -->|getHelpArticle slug| HC
    P3 -->|getHelpCategoryLabel| HC

    A1 -->|listHelpArticlesAction| AC
    A2 -->|createHelpArticleAction supposé| AC
    A3 -->|getHelpArticleDetailAction| AC
    AC -->|prisma.helpArticle.*| DB

    DB -.->|❌ AUCUN READER<br/>passerelle DB→public| P1
    DB -.->|❌ AUCUN READER<br/>passerelle DB→public| P2
    DB -.->|❌ AUCUN READER<br/>passerelle DB→public| P3

    style DB fill:#ffcc99
    style HC fill:#ccffcc
```

---

## 3. Inputs / Outputs (fichier:ligne)

### Routes publiques

| Route                              | Statut                                   | Fichier:ligne                                               |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `/fr/centre-aide` index            | ✅                                       | `src/app/[locale]/centre-aide/page.tsx:38`                  |
| `/fr/centre-aide/[slug]` détail    | ✅                                       | `src/app/[locale]/centre-aide/[slug]/page.tsx:63`           |
| `/fr/centre-aide/categorie/[slug]` | ✅                                       | `src/app/[locale]/centre-aide/categorie/[slug]/page.tsx:53` |
| `/en/help` index                   | ✅ alternates `centre-aide/page.tsx:34`  | mappé via next-intl routing                                 |
| `/en/help/[slug]`                  | ✅ alternates `[slug]/page.tsx:59`       | mappé via next-intl routing                                 |
| `/en/help/category/[slug]`         | ✅ alternates `categorie/page.tsx:46-49` | mappé via next-intl routing                                 |

Note : EN désactivé runtime (cf. `AGENTS.md` § « EN locale désactivé »). 301 vers FR via `src/proxy.ts`.

### Data sources

| Source                                                                                                                                            | Statut                                                                                                         | Fichier:ligne                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Hardcode SSOT `HELP_ARTICLES` (6 articles)                                                                                                        | ✅ Utilisé public                                                                                              | `src/content/transversal.ts:217-302` |
| Helpers hardcode (`getHelpArticle`, `getAllHelpSlugs`, `getAllHelpCategorySlugs`, `getHelpArticlesByCategory`, `getHelpCategoryLabel`, `slugify`) | ✅                                                                                                             | `src/content/transversal.ts:304-343` |
| Prisma `HelpArticle` (table)                                                                                                                      | ✅ Schéma présent, alimenté via admin                                                                          | `prisma/schema.prisma:1190-1205`     |
| Prisma `HelpArticleTranslation` (table)                                                                                                           | ✅ Schéma présent                                                                                              | `prisma/schema.prisma:1207-1224`     |
| Categorie via `Category` (back-ref `helpArticles`)                                                                                                | ✅                                                                                                             | `prisma/schema.prisma:1295`          |
| **Reader unifié `getHelpArticles()`** style glossaire                                                                                             | ❌ Inexistant — gap P0                                                                                         |
| Feature flag `KB_BACKEND_UNIFIED_HELP_ARTICLE`                                                                                                    | `**UNKNOWN — requires fact-check**` `Grep "KB_BACKEND_UNIFIED_HELP_ARTICLE" src/lib/knowledge/feature-flag.ts` |
| Enum `KbType.help_article`                                                                                                                        | ✅                                                                                                             | `prisma/schema.prisma:484`           |

### Admin UI

| Page               | Statut | Fichier                                                     |
| ------------------ | ------ | ----------------------------------------------------------- |
| Liste              | ✅     | `src/app/[locale]/(admin)/[adminPrefix]/help/page.tsx`      |
| Form composant     | ✅     | `src/app/[locale]/(admin)/[adminPrefix]/help/HelpForm.tsx`  |
| New                | ✅     | `src/app/[locale]/(admin)/[adminPrefix]/help/new/page.tsx`  |
| Edit `[id]`        | ✅     | `src/app/[locale]/(admin)/[adminPrefix]/help/[id]/page.tsx` |
| Server actions     | ✅     | `src/features/admin-help/actions.ts:46-97+`                 |
| V2 admin (refonte) | ✅     | `_v2/HelpV2.tsx`, `_v2/HelpEditV2.tsx`, `_v2/HelpNewV2.tsx` |

### JSON-LD

| Élément                             | Type                                                                                                 | Statut         | Fichier:ligne                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| Index                               | `ItemList`                                                                                           | ✅             | `src/app/[locale]/centre-aide/page.tsx:77-87`                                                       |
| Détail                              | `Article`                                                                                            | ✅ via factory | `src/app/[locale]/centre-aide/[slug]/page.tsx:81-90` (`buildArticleJsonLd`)                         |
| Détail (alternative recommandée)    | `TechArticle`                                                                                        | ❌ Pas utilisé | factory `buildTechArticleJsonLd` existe `src/lib/seo-content-gen-factories.ts:213` mais non appelée |
| Catégorie                           | `CollectionPage`                                                                                     | ✅             | `src/app/[locale]/centre-aide/categorie/[slug]/page.tsx:63-76`                                      |
| Disambiguation `isTutorial → HowTo` | ❌ champ `isTutorial` existe Prisma `schema.prisma:1194` mais non utilisé pour switcher JSON-LD type |

### Indexation & SEO

| Élément                               | Statut                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ | ------------------------- |
| `dynamicParams = false` anti-soft-404 | ✅ `[slug]/page.tsx:42` + `categorie/[slug]/page.tsx:25`                 |
| `generateStaticParams` pour SSG       | ✅ `[slug]/page.tsx:44-46` + `categorie/[slug]/page.tsx:27-31`           |
| Hreflang FR↔EN                        | ✅ tous `alternates: { fr, en }` présents                                |
| Sub-sitemap dédié                     | `**UNKNOWN — requires fact-check**` `Grep "centre-aide                   | help" src/app/sitemap.ts` |
| Alternate format markdown LLM         | ✅ `[slug]/page.tsx:110` → `/api/markdown/centre-aide/{slug}`            |
| TL;DR canonical answer (AEO)          | ✅ `[slug]/page.tsx:155-163` (`AnswerCard`)                              |
| AI disclaimer                         | ✅ `[slug]/page.tsx:183` (`AiContentDisclaimer`)                         |
| Speakable JSON-LD                     | ✅ via factory `buildArticleBase` `seo-content-gen-factories.ts:195-202` |

### Mesh

| Lien                                      | Statut                                                                                 | Fichier:ligne                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Index → catégorie cards                   | ✅                                                                                     | `centre-aide/page.tsx:163`                         |
| Index → article links                     | ✅                                                                                     | `centre-aide/page.tsx:204`                         |
| Détail → CTA contact                      | ✅                                                                                     | `centre-aide/[slug]/page.tsx:211`                  |
| Détail → "Voir aussi" same-category       | ✅                                                                                     | `centre-aide/[slug]/page.tsx:187-202` (4 articles) |
| Catégorie → article cards                 | ✅                                                                                     | `categorie/[slug]/page.tsx:140`                    |
| Header méga-menu link vers `/centre-aide` | `**UNKNOWN — requires fact-check**` `Grep "centre-aide" src/components/nav/Header.tsx` |
| Footer link vers `/centre-aide`           | ✅ Footer.tsx référencé (cf. grep)                                                     |
| Recherche Pagefind couvre articles        | `**UNKNOWN — requires fact-check**`                                                    |

---

## 4. Quality gates

| Gate                                                       | Statut                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `dynamicParams = false` (anti-soft 404)                    | ✅                                                                             |
| Hreflang round-trip                                        | ✅                                                                             |
| JSON-LD `Article` schema valid                             | ✅ via factory testée `seo-content-gen-factories.test.ts` (exists)             |
| Body markdown alternate `/api/markdown/centre-aide/[slug]` | ✅                                                                             |
| Doctrine-check banned phrases                              | `**UNKNOWN — requires fact-check**` `Grep "help                                | centre-aide" src/server/content-gen/quality/doctrine-check.ts` |
| Isolation-check pattern                                    | `**UNKNOWN — requires fact-check**` `Grep "help                                | centre" scripts/content-gen/isolation-check.ts`                |
| Web Vitals budget LCP ≤ 1800ms                             | `**UNKNOWN — requires fact-check**` (pas dans 15 pages stratégiques explicite) |

---

## 5. Tests existants

| Test                                                                      | Statut                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/lib/seo-content-gen-factories.test.ts` (couvre `buildArticleJsonLd`) | ✅ existe                                                                 |
| `src/lib/knowledge/legacy-mapping-help-article.ts`                        | ✅ existe                                                                 |
| `scripts/import-knowledge-from-help-article.ts`                           | ✅ existe (import legacy → KB)                                            |
| Test rendu `/centre-aide` index                                           | `**UNKNOWN — requires fact-check**` `Grep "centre-aide" src/**/*.test.ts` |
| Test rendu `/centre-aide/[slug]` détail                                   | `**UNKNOWN — requires fact-check**`                                       |
| Test admin actions `listHelpArticlesAction`                               | `**UNKNOWN — requires fact-check**`                                       |
| Test cohérence hardcode `HELP_ARTICLES` vs Prisma seed                    | ❌ Inexistant — incohérence non-testée                                    |

---

## 6. Tests manquants

- **Test cohérence DB ↔ hardcode** : si admin crée article DB, soit la
  page publique le sert (via reader unifié à créer), soit alerte clair.
- Test snapshot index `/centre-aide` (6 articles visibles)
- Test snapshot catégorie `/centre-aide/categorie/avant-l-intervention`
- Test JSON-LD `Article` valid schema.org
- Test `ItemList` JSON-LD index couvre tous les `HELP_ARTICLES`
- Test mesh "Voir aussi" : 4 articles same-category prioritaires
- Test `dynamicParams = false` → slug invalide 404
- Test alternate markdown route `/api/markdown/centre-aide/{slug}` 200
- Test `isTutorial=true` switch JSON-LD type → HowTo (gap actuel)

Effort : ~6-8h pour couverture complète.

---

## 7. Erreurs / edge cases

### P0 — Split DB / hardcode silencieux

```
Admin écrit dans Prisma helpArticle (actions.ts:59-78)
Public lit dans hardcode HELP_ARTICLES (transversal.ts:217)
→ Will peut créer 100 articles admin, page publique en montrera toujours 6
```

**Impact** : confusion business, perte de productivité éditoriale, fausse
sensation que la plateforme est CMS. **Fix** : reader unifié style glossaire
(`getHelpArticles()` dans `src/lib/knowledge/readers.ts` avec feature flag
`KB_BACKEND_UNIFIED_HELP_ARTICLE`). Effort ~4-6h.

### P1 — `isTutorial` field unused

`HelpArticle.isTutorial` (`schema.prisma:1194`) existe mais aucun usage
dans le rendu public ni JSON-LD. **Reco** : si `isTutorial=true`, switcher
`buildArticleJsonLd` → `HowTo` JSON-LD (steps mapping body sections).

### P1 — `category` optionnelle Prisma vs obligatoire hardcode

Prisma `categoryId String?` (`schema.prisma:1192`) = nullable. Hardcode
HELP_ARTICLES.category = string obligatoire (`transversal.ts:212`). Si DB
article avec `categoryId=null` → reader devra fallback `"Sans catégorie"`.

### P2 — slug uniqueness cross-locale

`HelpArticleTranslation.slug` (`schema.prisma:1213`) pas marqué `@unique`
sur (locale, slug). Risque collision deux articles FR avec même slug.
Vérifier index présent (lignes non lues).

### P2 — TL;DR fallback fragile

`deriveTldr` (`[slug]/page.tsx:29-39`) split par `(?<=[.!?])\s+(?=[A-ZÀÉÈÔÎÊ])`.
Body commençant par lower-case ou enchaînant minuscules après point
abbréviation (« etc. ») retournera vide. Reco : fallback minimum 1 sentence
même si pas de capitalisation.

### P2 — `splitTitleEm` sur titre court

`[slug]/page.tsx:115` (`splitTitleEm(copy.title)`) : si titre 1 mot, `em`
sera vide → JSX retournera fragment vide visuel. Pas testé.

---

## 8. Status global

**Score : 72/100 — 🟡 BON**

| Critère                                  | Note                       | Justification                                                                |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Routes publiques                         | 15/15                      | 3 routes propres FR + alternates EN                                          |
| Admin UI                                 | 10/10                      | Liste, new, edit, V2 refondu                                                 |
| Data model Prisma                        | 10/10                      | `HelpArticle` + translation + isTutorial + category FK                       |
| Reader unifié DB/hardcode                | 0/15                       | **Gap P0** — admin et public découplés                                       |
| JSON-LD                                  | 8/10                       | `Article` + `ItemList` + `CollectionPage` OK, mais `HowTo` switch absent     |
| AEO/GEO (TL;DR, speakable, markdown alt) | 9/10                       | excellent                                                                    |
| Mesh interne                             | 7/10                       | "Voir aussi" + CTA présents, sub-sitemap dédié à vérifier                    |
| Tests                                    | 5/10                       | factory JSON-LD testée, manque rendu + actions admin + cohérence DB/hardcode |
| Doctrine + isolation gates               | `**UNKNOWN**` → 3/5 estimé | À vérifier explicitement                                                     |
| AI Act art. 50 disclosure                | 5/5                        | `AiContentDisclaimer` + factory dispatch creator                             |

**Verdict** : type **largement fonctionnel** côté visiteur, mais
**verrou productivité interne** : admin et public ne sont pas connectés.
Sprint « Centre d'aide V2 — unification » recommandé :

1. **P0** : créer `getHelpArticles()` + `getHelpArticle(slug)` +
   `getHelpArticlesByCategory(slug)` + `getHelpCategoryLabel(slug)` dans
   `src/lib/knowledge/readers.ts` avec flag bascule DB/hardcode (pattern
   glossaire). Effort ~6h.
2. **P0** : seeder Prisma `prisma/seeds/help-articles.ts` qui importe
   `HELP_ARTICLES` hardcode → DB pour permettre flip flag. Effort ~2h.
3. **P1** : implémenter switch `isTutorial → HowTo JSON-LD` avec mapping
   body → steps. Effort ~4h.
4. **P1** : test cohérence DB ↔ hardcode (snapshot 6 articles
   identiques après seed). Effort ~2h.
5. **P2** : tests rendu + JSON-LD + mesh (cf. § 6). Effort ~6h.

Total estimé : ~20h pour passer 72 → 90+ (🟢 GREEN).

**Pas de P0 bloquant pour le visiteur**, mais P0 productivité interne
business si Will veut industrialiser le centre d'aide (5-10 articles/mois).

---

_Audit AUDIT-ONLY au HEAD `9c1adaa`. Aucune modification de code._
