# A05 — Templates 7 types de contenu
**Audit phase 1 / Agent A05** — HEAD `2b98a7067d7eae701dec42a2c5d6e859364e0e64` — 2026-05-21

---

## Mission

Auditer l'existence et la qualité des templates React/MDX + helpers génération pour chacun des 7 types de contenu :
`article_titre_manuel` / `article_keywords` / `longue_traine_intention` / `comparatif` / `pilier` / `qr_auto_genere` / `article_rss`

Vérifier différenciation par type, audience (tpe/pme/eti), verticale et ville.

---

## Méthode

Lecture directe des fichiers suivants (cités fichier:ligne) :

- `axionia/src/server/content-gen/generators/*.ts` (9 générateurs + types + index + templates)
- `axionia/src/server/content-gen/shared/editorial-mix-rules.ts`
- `axionia/src/app/[locale]/blog/[slug]/page.tsx`
- `axionia/src/app/[locale]/guides/[slug]/page.tsx`
- `axionia/src/app/[locale]/faq/[slug]/page.tsx`
- `axionia/src/app/[locale]/actualites/[slug]/page.tsx`
- `axionia/src/app/[locale]/comparaisons/[slug]/page.tsx`
- `axionia/src/components/marketing/{AiContentDisclaimer,AnswerCard}.tsx`
- `axionia/src/lib/seo-content-gen-factories.ts` (via grep)
- `axionia/src/lib/knowledge/toc-generator.ts`
- `axionia/prisma/schema.prisma` (enum ContentType)
- Tests : `src/lib/__tests__/seo-content-gen-factories.spec.ts`, `src/lib/seo-content-gen-factories.test.ts`

**Mode AUDIT-ONLY STRICT** — 0 modification de code.

---

## État observé

### Mapping Enum Prisma → Générateur → Route publique

| ContentType Prisma | Nom audit "7 types" | Générateur | Route publique | Statut |
|---|---|---|---|---|
| `blog_from_title` | article_titre_manuel | `blog-from-title.ts` | `/blog/[slug]` | STUB — délègue à `landing-ville` |
| `blog_from_keywords` | article_keywords | `blog-from-keywords.ts` | `/blog/[slug]` | IMPLÉMENTÉ PROPRE |
| `blog_article` | longue_traine_intention | `blog-article.ts` | `/blog/[slug]` | IMPLÉMENTÉ PROPRE |
| `comparison` | comparatif | `comparison.ts` | `/comparaisons/[slug]` (FS-only) | STUB — délègue à `landing-ville` |
| `guide_pilier` | pilier | `guide-pilier.ts` | `/guides/[slug]` | IMPLÉMENTÉ 2-step |
| `qa_derived` | qr_auto_genere | `qa-derived.ts` | pas de route dédiée DB | STUB — délègue à `landing-ville` |
| `blog_from_rss` | article_rss | `blog-from-rss.ts` | `/actualites/[slug]` | STUB V1 — délègue à `landing-ville` |
| `landing_ville` | (hors scope 7 types) | `landing-ville.ts` | `/*/par-ville/[ville]` | RÉFÉRENCE — 4 variants |
| `faq_standalone` | (hors scope 7 types) | `faq-standalone.ts` | `/faq/[slug]` | IMPLÉMENTÉ PROPRE |

**Note** : Le scope audit parle de 7 types nommés `article_titre_manuel` / `article_keywords` / `longue_traine_intention` / `comparatif` / `pilier` / `qr_auto_genere` / `article_rss`. Ces noms correspondent aux valeurs Prisma `blog_from_title` / `blog_from_keywords` / `blog_article` / `comparison` / `guide_pilier` / `qa_derived` / `blog_from_rss`. La 8e verticale `faq_standalone` et `landing_ville` sont en dehors du scope des 7 types audités.

---

### Détail par type

#### 1. `article_titre_manuel` (`blog_from_title`)
- **Fichier** : `axionia/src/server/content-gen/generators/blog-from-title.ts`
- **Implémentation** : STUB total — 18 lignes, délègue intégralement à `landingVilleGenerator.generate()` avec `contentType: "blog_from_title"` substitué (ligne 13-18).
- **Différenciation** : Aucune. Utilise le system prompt `landing-ville` + variant résolu, qui exige `anchorVilleSlug` non nul. Si `anchorVilleSlug` absent : `throw new Error("landing_ville requires anchorVilleSlug")` (`landing-ville.ts:34-35`). Résultat : un job `blog_from_title` sans ville crashe à l'exécution.
- **Route publique** : `/blog/[slug]` — même template que tous les articles blog (page.tsx générique).
- **JSON-LD** : Émet `Article`/`BlogPosting` — pas de type spécifique article-depuis-titre.
- **Tests** : 0 test dédié à ce générateur.

#### 2. `article_keywords` (`blog_from_keywords`)
- **Fichier** : `axionia/src/server/content-gen/generators/blog-from-keywords.ts`
- **Implémentation** : Complète — quality loop 3 passes, KB retrieve hybride (k=8), prompt system dédié, doctrine v2.5.
- **System prompt** : `axionia/src/server/content-gen/generators/blog-from-keywords.ts:33-41` — cible FAQ 6-8 Q/A, minimum 500 mots, `primaryKeyword` obligatoire (throw si absent, ligne 51-53).
- **Différenciation vs `blog_article`** : `primaryKeyword` obligatoire (vs optionnel) ; user prompt inclut `secondaryKeywords` (jusqu'à 5, ligne 99) ; target 8 FAQ (vs 6-8) ; word count minimum 500 (vs 600 pour `blog_article`).
- **Audience** : `safeAudienceSize` injecté dans user prompt ligne 101 — valeur TPE/PME/ETI passée au LLM comme contexte de ton.
- **Route publique** : `/blog/[slug]` — même template générique.
- **JSON-LD** : `Article`/`BlogPosting` via `buildArticleJsonLd`.
- **Tests** : 0 test dédié au générateur lui-même (unit). Tests factories JSON-LD existent (`seo-content-gen-factories.spec.ts`).

#### 3. `longue_traine_intention` (`blog_article`)
- **Fichier** : `axionia/src/server/content-gen/generators/blog-article.ts`
- **Implémentation** : Complète — quality loop 3 passes, KB retrieve hybride (k=8), synthesis topic automatique si `primaryKeyword` absent.
- **System prompt** : `axionia/src/server/content-gen/generators/blog-article.ts:25-33` — angle opérationnel, minimum 600 mots, 6-8 FAQ.
- **Différenciation vs `blog_from_keywords`** : `primaryKeyword` optionnel (synthèse depuis `anchorVilleSlug` + `templateVariant`, lignes 41-56) ; angle "mise en pratique / retour terrain" documenté dans le JSDoc ; word count minimum 600 (vs 500) ; `contentType: "blog_article"` dans le call LLM.
- **Audience** : `safeAudienceSize` injecté (ligne 68, 112). Synthesis topic inclut ` pour TPE` / ` pour PME` / ` pour ETI/GE` (lignes 46-50) — seul générateur à différencier le topic synthesized par audience.
- **Route publique** : `/blog/[slug]` — template identique à `blog_from_keywords`.
- **JSON-LD** : `Article`/`BlogPosting`.
- **Tests** : 0 test dédié générateur.

**P1** : `blog_article` et `blog_from_keywords` partagent le même rendu `/blog/[slug]`. Aucun badge type visible, aucune différenciation UI. Le lecteur ne distingue pas un article long-traîne d'un article keywords.

#### 4. `comparatif` (`comparison`)
- **Fichier** : `axionia/src/server/content-gen/generators/comparison.ts`
- **Implémentation** : STUB total — 14 lignes, délègue à `landingVilleGenerator.generate()` (ligne 9-12). Commentaire JSDoc ligne 5 indique `<table> obligatoire (intent commercial_investigation)` mais **non implémenté**.
- **Route publique** : `/comparaisons/[slug]` — route FS-only (`dynamicParams = false`, `src/app/[locale]/comparaisons/[slug]/page.tsx:19`). Les articles `comparison` générés par la factory n'ont PAS de route dédiée live. Le template `/comparaisons/[slug]` consomme `src/content/comparaisons` (FS statique), pas la table `Article` DB.
- **ClaimReview JSON-LD** : Absent. La route `/comparaisons/[slug]` émet un `Article` JSON-LD générique (`page.tsx:56-63`), sans `ClaimReview`.
- **Tableau comparatif HTML** : Absent dans le générateur (stub). La route FS `/comparaisons/[slug]` affiche des `Card` hardcodées (pas de table dynamique).
- **Tests** : 0 test dédié.

#### 5. `pilier` (`guide_pilier`)
- **Fichier** : `axionia/src/server/content-gen/generators/guide-pilier.ts`
- **Implémentation** : Complète et différenciée — pipeline 2-step (outline + N sections), seul générateur avec pipeline multi-LLM-call.
- **Step 1 (outline)** : 8-15 sections, `clampSections` hard cap 6-15 (ligne 105-111), `SYSTEM_PROMPT_OUTLINE` dédié (ligne 48-72).
- **Step 2 (sections)** : Appels LLM séquentiels par section, 250-450 mots/section, `SYSTEM_PROMPT_SECTION` dédié (ligne 74-83), soft-fail avec placeholder si erreur.
- **Assembly** : Marqueurs `## Étape N : Title` HTML (ligne 221-226), reconnus par `parseStepsFromBody` du loader `/guides/[slug]` → déclenche JSON-LD HowTo automatique.
- **Word count** : Cible ≥ 2000 mots (8 sections × 300 mots) — correspond à la spec skyscraper.
- **Route publique** : `/guides/[slug]` — template DÉDIÉ différencié. Badge "Guide pilier" visible (ligne 227-228 de `guides/[slug]/page.tsx`). Rendu en sections `<section aria-labelledby>` (lignes 245-259). JSON-LD HowTo si steps structurées (ligne 79 `buildHowToJsonLd`), sinon Article avec `speakable`.
- **TOC** : ABSENT. La `toc-generator.ts` existe dans `src/lib/knowledge/` mais n'est pas importée dans `guides/[slug]/page.tsx`. Les H2 générés ont des `id="etape-N"` mais aucun sommaire visible n'est rendu.
- **Ville** : Injection contexte économique local (`ECONOMIC_DATA_BY_SLUG`) dans les prompts outline + sections (lignes 119-164).
- **Tests** : 0 test dédié générateur. Tests `buildHowToJsonLd` dans `seo-content-gen-factories.spec.ts` (non vérifiés en détail).

#### 6. `qr_auto_genere` (`qa_derived`)
- **Fichier** : `axionia/src/server/content-gen/generators/qa-derived.ts`
- **Implémentation** : STUB total — 14 lignes, délègue à `landingVilleGenerator.generate()`. Le JSDoc (lignes 7-13) décrit un pipeline en 3 étapes (parse FAQ parent, enrichit contexte, émet QAPage JSON-LD + Speakable) mais **rien n'est implémenté**.
- **Route publique** : AUCUNE route dédiée pour `qa_derived` en DB. La route `/faq/[slug]` est FS-only (`listFaqs()` depuis KB legacy). Les jobs `qa_derived` publiés ne sont pas accessibles publiquement.
- **Recyclage contenu** : Non implémenté. Le JSDoc dit "pas d'appel LLM nouveau (utilise FAQ déjà générée)" mais le stub appelle quand même `landingVilleGenerator.generate()` qui fait un appel LLM complet.
- **QAPage JSON-LD + Speakable** : Non émis par le générateur. La factory `buildQAPageJsonLd` existe et est testée (`seo-content-gen-factories.spec.ts:14-76`) mais n'est pas appelée depuis `qa-derived.ts`.
- **Tests** : 0 test dédié.

#### 7. `article_rss` (`blog_from_rss`)
- **Fichier** : `axionia/src/server/content-gen/generators/blog-from-rss.ts`
- **Implémentation** : STUB V1 — délègue à `landingVilleGenerator.generate()` (ligne 30-35). Mais possède un **helper post-génération** `enrichOutputWithNewsArticleJsonLd` (lignes 44-86) qui construit le JSON-LD `NewsArticle` avec `isBasedOn` source RSS.
- **isBasedOn JSON-LD** : Implémenté dans le helper `enrichOutputWithNewsArticleJsonLd` via `buildNewsArticleJsonLd` (`seo-content-gen-factories.ts`). La route `/actualites/[slug]` l'appelle côté page (`page.tsx:196-227`).
- **Route publique** : `/actualites/[slug]` — template DÉDIÉ différencié. Badge "Source" affiché si `rssSource` tracée (vérifié dans page.tsx:196). JSON-LD `NewsArticle` Schema.org. `AnswerCard` TL;DR présente.
- **Citation source originale** : Présente dans `buildNewsArticleJsonLd` via `isBasedOn: { "@type": "NewsArticle", url: sourceUrl, name: sourceName }` (factory ligne confirmée via grep). La page affiche `sourceUrl` visuellement si disponible.
- **Tests** : `buildNewsArticleJsonLd` testé dans `seo-content-gen-factories.spec.ts`.

---

### Composants React — différenciation par type

#### Template de rendu (React pages)

| Route | ContentType(s) servis | Composant dédié ? | Différenciation visible |
|---|---|---|---|
| `/blog/[slug]` | `blog_from_title`, `blog_from_keywords`, `blog_article` | Non (1 page générique) | Badge catégorie uniquement |
| `/guides/[slug]` | `guide_pilier` | Oui (page dédiée) | Badge "Guide pilier", rendu sections, HowTo JSON-LD |
| `/faq/[slug]` | `faq_standalone` (FS) | Oui (page dédiée) | QAPage JSON-LD, `data-aeo="answer"` |
| `/actualites/[slug]` | `blog_from_rss` | Oui (page dédiée) | NewsArticle JSON-LD, `isBasedOn`, badge source |
| `/comparaisons/[slug]` | FS-only (pas `comparison` DB) | Oui (page dédiée) | Rendu card vs-split, pas table comparatif |
| (aucune) | `qa_derived` | Non | Pas de route publique |

**Composants spécialisés présents** :
- `AiContentDisclaimer` — présent sur `/blog/[slug]`, `/guides/[slug]`, `/actualites/[slug]` (conformité AI Act art. 50 visible humain).
- `AnswerCard` — présent sur `/blog/[slug]` (si excerpt ≥ 1 char) et `/actualites/[slug]` (TL;DR AEO).
- `JsonLd` — présent sur toutes les routes publiques ciblées.
- `Tombstone` — présent sur `/blog/[slug]` pour articles archivés.

**Composants ABSENTS** :
- Composant dédié `<ComparatifTable>` pour le type `comparison`.
- Composant `<QADerived>` ou route publique pour `qa_derived`.
- Composant `<TOC>` (Table des matières) sur `/guides/[slug]`.
- Composant `<SuggestedContent>` dédié : les articles connexes sur `/blog/[slug]` restent FS-only (2 cards hardcodées FS, ligne 249-264 `blog/[slug]/page.tsx`), ne couvrent pas les articles DB.

---

### Schemas Zod — validation output LLM

Aucun schéma Zod de validation runtime du JSON LLM n'est implémenté dans les générateurs. Le commentaire dans `landing-ville.ts:133` indique explicitement : `"// 3. Parse output (V1 minimal — V2 Zod strict)"`. La validation est limitée à :
- Un `try { JSON.parse(lastOutput) } catch { ... }` dans chaque générateur.
- La quality loop réagit aux scores faibles mais ne valide pas la structure du JSON retourné.
- Il n'existe aucun `z.object({ title: z.string(), ... })` pour valider les champs obligatoires de `GeneratorOutput`.

Les tests Zod/schema couvrent uniquement les **factories JSON-LD** (`buildQAPageJsonLd`, `buildNewsArticleJsonLd`, `buildArticleJsonLd`, `buildHowToJsonLd`) — pas les outputs LLM des générateurs eux-mêmes.

---

### Variants audience (tpe/pme/eti)

| Générateur | Audience dans prompt | Différenciation réelle |
|---|---|---|
| `blog-from-keywords` | `safeAudienceSize` injecté dans user prompt | Niveau prompt uniquement — LLM reçoit "Audience cible : TPE/PME/ETI" |
| `blog-article` | `safeAudienceSize` injecté + synthesis topic suffix | Synthesis topic différencié par audience (` pour TPE`, ` pour PME`, ` pour ETI/GE`) |
| `faq-standalone` | `safeAudienceSize` injecté dans user prompt | Niveau prompt uniquement |
| `guide-pilier` | `safeAudienceOrganisation` injecté | `OrganisationType` (pas `CompanySize`) — angle org-type plutôt que taille |
| `landing-ville` | `safeAudienceSize` + `safeOrgType` | Les 2 dimensions injectées + variants CTA distincts par module |
| `blog_from_title` | Hérite `landing-ville` | Idem |
| `comparison` | Hérite `landing-ville` | Idem |
| `qa_derived` | Hérite `landing-ville` | Idem |
| `blog_from_rss` | Hérite `landing-ville` | Idem |

**Constat** : La différenciation audience est **uniquement prompt-side** — aucun composant React ne s'adapte selon l'audience. Le ton et les exemples générés par le LLM sont potentiellement différents mais non vérifiables sans exécution réelle. Aucun test snapshot ne vérifie que le contenu TPE diffère du contenu ETI.

---

### Variants verticale (interventions / audits / implementations / sites_web_augmentes)

- `landing-ville` : variants `focus_audit`, `focus_interventions`, `focus_implementation` via `landing-ville-templates.ts` — 4 system prompts distincts avec CTA, KPIs, sections obligatoires différents.
- `blog_article` : le `templateVariant` influence la synthesis topic (lignes 42-48 : "audit IA" / "implémentation IA" / "formation IA").
- `blog_from_keywords` : `safeModule` injecté dans le user prompt (ligne 55, 96).
- `faq-standalone` : `templateVariant` influence le topic synthesized (lignes 36-43).
- **Verticale `sites_web_augmentes`** : **AUCUNE trace** dans les générateurs. Non déclarée dans `landing-ville-templates.ts`, non mentionnée dans `editorial-mix-rules.ts`, non dans les system prompts. La 5e verticale annoncée 2026-05-21 n'est pas encore câblée dans la génération de contenu.

---

### Variants ville vs global

- **Générateurs avec différenciation ville** : `landing-ville` (obligatoire), `guide-pilier` (contexte économique local optionnel), `blog-article` (synthesis topic géo), `faq-standalone` (topic géo).
- **Section "Pourquoi à [Ville]"** : Absente en tant que section structurée obligatoire. La différenciation géo est injectée dans les prompts LLM comme contexte (`## Contexte économique local`) via `ECONOMIC_DATA_BY_SLUG`. La production d'une section titrée "Pourquoi à [Ville]" dépend du LLM — non vérifiable sans exécution.
- **Route dédiée ville** : Les pages `/*/par-ville/[ville]` (`interventions/par-ville/[ville]`, `audit/par-ville/[ville]`, `implementation/par-ville/[ville]`, `un-a-un/par-ville/[ville]`) existent comme routes. Le generator `landing_ville` les alimente.

---

### Suggested content / Articles connexes

- **Composant ArticleCard** : Existe dans `src/components/marketing/ArticleCard.tsx`.
- **Suggested content sur /blog/[slug]** : Les "articles connexes" sont filtrés depuis `BLOG_POSTS` (FS, hardcodé 3 articles), pas depuis la table `Article` DB. Max 2 cards. Aucune logique sémantique ou par type — tri par catégorie puis par date.
- **Suggested content sur /guides/[slug]** : Absent (aucun bloc "à lire aussi" dans `guides/[slug]/page.tsx`).
- **Suggested content sur /actualites/[slug]** : Non vérifié explicitement mais absent dans le template lu.
- **Composant `<SuggestedContent>` dédié** : N'existe pas. Pas de logique de sélection basée sur `contentType`, audience ou verticale.

---

## Findings

### Tableau P0 / P1 / P2

| # | Sévérité | Type | Finding | Fichier:ligne |
|---|---|---|---|---|
| F01 | P0 | Stub bloquant | `blog_from_title` délègue à `landing-ville` qui exige `anchorVilleSlug` — un job `article_titre_manuel` sans ville crash à l'exécution | `generators/blog-from-title.ts:13-18`, `generators/landing-ville.ts:34-35` |
| F02 | P0 | Stub bloquant | `qa_derived` délègue à `landing-ville` — le JSDoc décrit recyclage FAQ parent sans nouveau LLM call mais exécute un call LLM complet, coûte autant qu'un article normal et n'émet pas QAPage JSON-LD | `generators/qa-derived.ts:9-12` |
| F03 | P0 | Route manquante | Aucune route publique DB pour les jobs `qa_derived` publiés — ils sont invisibles publiquement | n/a |
| F04 | P0 | Stub sans table | `comparison` délègue à `landing-ville` ; la route `/comparaisons/[slug]` est FS-only (`dynamicParams=false`) — les articles `comparison` générés en DB ne sont jamais servis publiquement | `generators/comparison.ts:9-12`, `app/[locale]/comparaisons/[slug]/page.tsx:19` |
| F05 | P1 | Zod absent | Aucun schéma Zod ne valide la structure JSON retournée par le LLM dans aucun des 7 générateurs — champs obligatoires (`title`, `slug`, `bodyHtml`, `faq`) peuvent être absents silencieusement | `generators/landing-ville.ts:133` (commentaire "V2 Zod strict") |
| F06 | P1 | ClaimReview absent | `comparison` ne génère pas de JSON-LD `ClaimReview` — requis pour intent `commercial_investigation` ; la route FS `/comparaisons` non plus | `generators/comparison.ts:5` (commentaire non implémenté) |
| F07 | P1 | Table comparatif absente | `<table>` obligatoire mentionné dans le JSDoc `comparison` mais non implémenté dans le stub ni dans la route FS | `generators/comparison.ts:5` |
| F08 | P1 | TOC absent sur guides | `toc-generator.ts` existe (`src/lib/knowledge/toc-generator.ts:37`) mais n'est pas importé dans `guides/[slug]/page.tsx` — les guides piliers 2000+ mots n'ont pas de sommaire navigable | `app/[locale]/guides/[slug]/page.tsx` (0 import toc) |
| F09 | P1 | Snaphots tests absents | 0 snapshot test Vitest par type de générateur — impossible de détecter régressions prompt ou structure output | `src/server/content-gen/generators/` (0 *.spec.ts) |
| F10 | P1 | Suggested content FS-only | Articles connexes sur `/blog/[slug]` sourcés FS uniquement (3 posts hardcodés) — les centaines d'articles DB générés par content-gen ne remontent jamais comme suggestions | `app/[locale]/blog/[slug]/page.tsx:249-264` |
| F11 | P1 | Verticale 5 non câblée | `sites_web_augmentes` annoncée 2026-05-21 absente de `landing-ville-templates.ts`, `editorial-mix-rules.ts`, system prompts | `generators/landing-ville-templates.ts` entier |
| F12 | P1 | blog_from_rss — stub | La génération RSS délègue à `landing-ville` (même contenu qu'une landing ville) — le ton actualité/source est absent à la génération ; seul le JSON-LD `NewsArticle` est différencié post-publication par `enrichOutputWithNewsArticleJsonLd` | `generators/blog-from-rss.ts:30-35` |
| F13 | P2 | blog_from_title — prop anchorVilleSlug | Le générateur n'a pas de fallback sans ville — ajouter un chemin alternatif basé sur `primaryKeyword` seul (comme `blog_article`) | `generators/blog-from-title.ts` |
| F14 | P2 | Audience — différenciation prompt-only | Aucun variant React (composant ou section) ne s'adapte à l'audience TPE/PME/ETI — différenciation limitée au ton LLM non vérifiable | tous générateurs |
| F15 | P2 | "Pourquoi à [Ville]" — non structuré | Section géo différenciatrice non imposée en tant que section H2 obligatoire — dépend du LLM | `generators/landing-ville.ts:105-108` |
| F16 | P2 | CTA non différencié par type | La route `/blog/[slug]` affiche un CTA unique "Voir l'Essentielle 490€" pour tous types (`blog_from_title`, `blog_from_keywords`, `blog_article`) indépendamment du sujet ou du type | `app/[locale]/blog/[slug]/page.tsx` (CtaBlock identique) |
| F17 | P2 | `blog_article` vs `blog_from_keywords` — indistinguables en rendu | Même page `/blog/[slug]`, même badge catégorie, même JSON-LD — lecteur et LLM ne distinguent pas les deux types | `app/[locale]/blog/[slug]/page.tsx` |
| F18 | P2 | `faqJson` non typé Zod | `guide-pilier.ts` stocke `{ outline, sectionFailures, faq }` dans `faqJson` (type `Json?` Prisma) sans schéma — fragile à la re-génération partielle V2 | `generators/guide-pilier.ts:253-259` |

---

## Scoring /45

### 1. Existence templates par type /20 (~3 pts/type × 7)

| Type | Générateur | Route publique | JSON-LD dédié | Score /3 |
|---|---|---|---|---|
| article_titre_manuel | Stub (délègue landing) | Non dédié (/blog) | Non | 1/3 |
| article_keywords | Implémenté propre | Non dédié (/blog) | Non | 2/3 |
| longue_traine_intention | Implémenté propre | Non dédié (/blog) | Non | 2/3 |
| comparatif | Stub + route FS non câblée | Non (FS-only incompatible) | Non | 0.5/3 |
| pilier | Implémenté 2-step | Dédié (/guides) | HowTo JSON-LD | 3/3 |
| qr_auto_genere | Stub + pas de route | Absent | Non | 0/3 |
| article_rss | Stub + helper post-pub | Dédié (/actualites) | NewsArticle + isBasedOn | 2/3 |

**Sous-total : 10.5/20**

### 2. Qualité différenciation /10

- `guide_pilier` : pipeline 2-step distinct, badge dédié, HowTo JSON-LD, contexte économique local — **3/3**
- `blog_from_rss` : JSON-LD NewsArticle + route dédiée + AnswerCard — mais génération stub — **1.5/3**
- `blog_from_keywords` : system prompt dédié, secondaryKeywords, strict keyword required — **2/3**
- `blog_article` : synthesis topic différencié, angle opérationnel distinct — **1.5/3**
- `comparison`, `blog_from_title`, `qa_derived` : stubs sans différenciation réelle — **0/3** (partagé)

**Sous-total : 5/10**

### 3. Schemas Zod + tests /8

- Factories JSON-LD testées (QAPage speakable, NewsArticle isBasedOn, HowTo, Article) : **3/8**
- Zod validation output LLM : 0 implémenté (`landing-ville.ts:133` "V2 Zod strict") : **0/8**
- Tests snapshot générateurs : 0 : **0/8**
- Tests loader blog/guide (existent) : **1/8**

**Sous-total : 4/8**

### 4. Variants audience/verticale/ville /7

- Audience : injecté dans prompts pour 5 générateurs, synthesis topic différencié pour `blog_article` : **2/7**
- Verticale : `landing-ville` 4 variants + `blog_article`/`blog_from_keywords`/`faq-standalone` via `templateVariant` ; verticale 5 absente : **2/7**
- Ville : contexte économique local injecté pour `landing-ville` + `guide-pilier` + `blog-article` + `faq-standalone` : **2/7**
- Section "Pourquoi à [Ville]" structurée : non garantie : **0/7**

**Sous-total : 5/7** (sur base proratisée)

---

### Score total : **25/45 (55.5 %)** — ROUGE — SPRINT CORRECTIF

---

## Délégations

**Non audité par cet agent (déléguer à agent dédié si nécessaire)** :
- Contenu généré réellement (test exécution live) — aucune exécution LLM faite.
- Route `/faq/[slug]` DB-driven pour `faq_standalone` — le slug `page.tsx` audité est KB-reader (FS), pas DB `Article`.
- Qualité contenu pilier réel (word count ≥ 2000 validé) — dépend de l'exécution LLM.
- Speakable dans buildHowToJsonLd détail (factory présente, non lue complètement).

---

## UNKNOWNs

| UNKNOWN | Raison |
|---|---|
| Est-ce que `qa_derived` a une route publique ailleurs ? | Grep non exhaustif — possible route admin uniquement |
| Le `enrichOutputWithNewsArticleJsonLd` est-il appelé systématiquement par le worker pour tous jobs `blog_from_rss` ? | Non vérifié dans `content-publish-worker.ts` |
| Les variantes audience TPE/ETI produisent-elles du contenu réellement distinct ? | Non vérifiable sans exécution LLM |
| La 5e verticale `sites_web_augmentes` est-elle déclarée dans le Prisma `ServiceSector` enum ? | `editorial-mix-rules.ts:SERVICE_SECTORS` ne l'inclut pas — probable absence Prisma aussi |

---

## Références

| Fichier | Rôle |
|---|---|
| `axionia/src/server/content-gen/generators/types.ts` | Contrat commun `Generator<TInput, TOutput>` |
| `axionia/src/server/content-gen/generators/index.ts` | Registry 9 générateurs |
| `axionia/src/server/content-gen/generators/blog-from-keywords.ts` | Article keywords — implémenté |
| `axionia/src/server/content-gen/generators/blog-article.ts` | Longue traîne — implémenté |
| `axionia/src/server/content-gen/generators/guide-pilier.ts` | Guide pilier 2-step — implémenté |
| `axionia/src/server/content-gen/generators/faq-standalone.ts` | FAQ standalone — implémenté |
| `axionia/src/server/content-gen/generators/landing-ville.ts` | Référence + base des stubs |
| `axionia/src/server/content-gen/generators/landing-ville-templates.ts` | 4 variants landing-ville |
| `axionia/src/server/content-gen/generators/blog-from-title.ts` | STUB |
| `axionia/src/server/content-gen/generators/comparison.ts` | STUB |
| `axionia/src/server/content-gen/generators/qa-derived.ts` | STUB |
| `axionia/src/server/content-gen/generators/blog-from-rss.ts` | STUB V1 + helper NewsArticle |
| `axionia/src/server/content-gen/shared/editorial-mix-rules.ts` | Mix editorial 7 types |
| `axionia/src/app/[locale]/blog/[slug]/page.tsx` | Template blog (générique 3 types) |
| `axionia/src/app/[locale]/guides/[slug]/page.tsx` | Template guide pilier (dédié) |
| `axionia/src/app/[locale]/faq/[slug]/page.tsx` | Template FAQ (FS-only) |
| `axionia/src/app/[locale]/actualites/[slug]/page.tsx` | Template actualités/RSS (dédié) |
| `axionia/src/app/[locale]/comparaisons/[slug]/page.tsx` | Template comparatif (FS-only) |
| `axionia/src/components/marketing/AiContentDisclaimer.tsx` | Mention AI Act art. 50 |
| `axionia/src/components/marketing/AnswerCard.tsx` | TL;DR AEO/GEO |
| `axionia/src/lib/knowledge/toc-generator.ts` | TOC (non utilisé sur /guides) |
| `axionia/src/lib/__tests__/seo-content-gen-factories.spec.ts` | Tests JSON-LD factories |
| `axionia/src/lib/seo-content-gen-factories.test.ts` | Tests JSON-LD factories (v2) |
| `axionia/prisma/schema.prisma:2453-2462` | Enum ContentType (9 valeurs) |
