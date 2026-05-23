# A08 — Maillage interne / externe / Suggested Content
**Agent** : A08 | **Date** : 2026-05-21 | **HEAD audité** : `2b98a70`  
**Mode** : AUDIT-ONLY STRICT — citations fichier:ligne, 0 invention

---

## Mission

Auditer la stratégie de liens internes, la politique de liens externes et le composant Suggested Content. Mesurer topology cluster, diversité anchor text, gouvernance externe.

---

## Méthode

Lectures réalisées :

1. `axionia/src/server/content-gen/generators/*.ts` — 6 generators (blog-article, blog-from-keywords, guide-pilier, landing-ville, faq-standalone, comparison)
2. `axionia/src/server/content-gen/quality/seo-score.ts` — scoring des liens internes
3. `axionia/src/server/content-gen/shared/html-sanitizer.ts` — politique `rel` sur externes
4. `axionia/src/server/content-gen/shared/faq-sanitizer.ts` — idem FAQ
5. `axionia/src/app/[locale]/blog/[slug]/page.tsx` — rendu + section "Articles connexes"
6. `axionia/src/app/[locale]/guides/[slug]/page.tsx` — rendu guides piliers
7. `axionia/src/app/[locale]/centre-aide/[slug]/page.tsx` — "Voir aussi"
8. `axionia/src/app/[locale]/faq/[slug]/page.tsx` — "Autres questions"
9. `axionia/src/app/[locale]/implantations/[region]/[ville]/page.tsx` — maillage ville (Haversine + articles liés)
10. `axionia/src/server/content-gen/blog/loader.ts` + `get-articles-by-ville.ts`
11. `axionia/src/lib/geo.ts` — `getRelatedBlogPosts`, `getNearbyVilles`
12. `axionia/prisma/schema.prisma` — recherche models `Link`, `ExternalLinkSource`
13. `axionia/src/server/queue/workers/content-monitoring-worker.ts` — maintenance
14. `axionia/src/content/knowledge/editor-snippets.ts` — snippets éditeur KB

Recherches Grep complémentaires sur patterns : `internalLinkCount`, `ExternalLink`, `linkbase`, `nofollow`, `dofollow`, `broken link`, `orphan`, `SuggestedContent`, `RelatedArticles`.

---

## État observé

### Liens internes

**Génération** : Les 4 generators principaux (`blog-article.ts`, `blog-from-keywords.ts`, `guide-pilier.ts`, `landing-ville.ts`) **délèguent entièrement la production des liens internes au LLM**. Le prompt système instruits le LLM via la consigne SEO "Internal links 3+" encodée dans `seo-score.ts:119-124` mais **aucune injection déterministe** d'URLs internes n'est réalisée côté code.

- `seo-score.ts:31` — le champ `internalLinkCount?: number` existe dans `SeoScoreInput`
- `seo-score.ts:212` — il est scoré (3+ = 6/6 pts, 1-2 = 3/6, 0 = 0/6)
- **Problème majeur** : dans tous les appels `computeSeoScore()` des generators, `internalLinkCount` n'est JAMAIS passé en paramètre (`blog-article.ts:155-167`, `blog-from-keywords.ts:156-167`, `landing-ville.ts:163-176`, `guide-pilier.ts:280-291`). Le score internal links vaut donc systématiquement **0/6** (la valeur par défaut `count ?? 0`).

**Comptage réel** : `internalLinkCount` n'est ni extrait du `bodyHtml` LLM ni persisté dans `Article`. Il n'existe pas de champ `internalLinkCount` dans `prisma/schema.prisma` (confirmé par grep exhaustif). Le nombre de liens internes par article publié est **inconnu** — aucune mesure instrumentée.

**Anchor text** : Entièrement déterminé par le LLM. Pas de dictionnaire d'anchors canoniques, pas de règle de diversité imposée dans les prompts system (`SYSTEM_PROMPT` de `blog-article.ts:25-33` ou `blog-from-keywords.ts:34-40`). Le mot "formation" est banni par doctrine (doc `doctrine-check.ts`) mais aucune contrainte explicite sur le style d'anchor (keyword-rich vs générique). Aucun test unitaire ne valide la diversité anchor.

**Topologie cluster** :
- **Ville → Verticale** : `landing-ville.ts` ancre l'article sur une ville mais ne génère pas automatiquement de lien vers la page verticale correspondante (`/audit`, `/interventions`, `/implementations`). Le `variant.recommendedCtaHref` (ex: `/audit`) est injecté dans le prompt mais comme CTA, pas comme lien éditorial contextuel.
- **Pillar → Cluster** : `guide-pilier.ts` ne génère pas de liens vers les articles de blog du même secteur. L'assembly à la ligne `guide-pilier.ts:263-268` concatène les sections sans injection cross-link.
- **Article → Hub ville** : `blog/[slug]/page.tsx` n'inclut pas de liens retour vers le hub ville même si `mentionedCities[]` est renseigné.
- **Maillage ville ↔ ville** : **Excellent** — `implantations/[region]/[ville]/page.tsx:622-658` produit jusqu'à 8 villes proches via `getNearbyVilles` (Haversine), avec étendu en 3 dimensions : ≤30 km, même département, même région 60 km. 100% déterministe.

**Snippets éditeur** : `src/content/knowledge/editor-snippets.ts:50-59` fournit 2 CTAs internes `/audit` et `/reserver` avec `rel="noopener"` (sans `nofollow`). Utilisables manuellement via slash-command, non injectés automatiquement par les generators.

---

### Liens externes

**Table ExternalLinkSource** : **ABSENTE** — grep exhaustif sur `schema.prisma` (3078 lignes) confirme l'absence de `model Link`, `model ExternalLinkSource`, `model LinkSource`, `model ExternalSource`. **P1 bloquant.**

**Politique `rel` sur externes** :
- `html-sanitizer.ts:88,117-122` : force `rel="noopener noreferrer"` sur tout `<a target="_blank">` via regex post-DOMPurify. Couvert par test unitaire `html-sanitizer.test.ts:94-105`.
- `faq-sanitizer.ts:97-122` : même logique via marqueur intermédiaire `data-x-target-blank-marker` pour survivre au strip DOMPurify. Couvert par test `faq-sanitizer.test.ts:58-61`.
- **Nofollow** : AUCUNE règle `rel="nofollow"` n'est appliquée aux liens externes. `ALLOWED_ATTR` dans `html-sanitizer.ts:67-81` inclut `rel` mais aucun middleware n'injecte `nofollow` sur les `href` externes. Les LLMs peuvent générer `<a href="https://externe.com">texte</a>` sans `nofollow` et le sanitizer le laisse passer tel quel.
- **Nofollow conditionnel (dofollow si validated)** : stratégie absente. Pas de table de validation de domaines, pas de DA/DR/Trust score.

**DA / DR / Trust score** : 0 implémentation. Aucune dépendance externe (Ahrefs, Moz, SemRush API) n'est référencée dans `package.json` ou les workers. Les sources KB (`kb-feeder.ts`, `kb-client.ts`) ne stockent pas de métadonnée d'autorité de domaine.

**Nombre d'externes par article** : non mesuré, non cappé. Pas de constante `MAX_EXTERNAL_LINKS_PER_ARTICLE`. Le LLM peut théoriquement générer N liens externes sans contrainte.

---

### Suggested Content / Related Articles

**Composant dédié** : Pas de composant React `<SuggestedContent />` ni `<RelatedArticles />`. La logique est inlinée dans chaque route page.

**Par type de contenu** :

| Route | Section suggested | Algorithme | Nombre | Rendu |
|---|---|---|---|---|
| `/blog/[slug]` | "À lire aussi" | Same category first, then recent, FS-only (`BLOG_POSTS`) | max 2 cards | SSR (Server Component) |
| `/centre-aide/[slug]` | "Voir aussi" | Same category first (`slugify` compare), FS-only | max 4 liens | SSR |
| `/faq/[slug]` | "Autres questions" | Filter slug ≠ current, sequential, FS-only | max 4 liens | SSR |
| `/implantations/[region]/[ville]` | "Articles & ressources" | Tags match + relatedCities (`getRelatedBlogPosts`), FS-only pour legacy; DB-based (`getBlogArticlesByVille`) pour articles factory | max 3 cards | SSR |
| `/guides/[slug]` | **Absent** | — | 0 | — |

Code sources :
- `blog/[slug]/page.tsx:245-253` — tri category + publishedAt
- `centre-aide/[slug]/page.tsx:113-118` — tri slugify(category)
- `faq/[slug]/page.tsx:87-88` — slice naïf sans tri sémantique
- `geo.ts:95-108` — match tags/relatedCities pour articles ville

**Algorithme "2 same city + 2 same vertical + 2 cluster"** : ABSENT. Aucun generator ou route n'implémente ce pattern multi-dimensionnel recommandé. La logique suggérée est au mieux mono-dimension (catégorie OU tags), au pire séquentielle sans pertinence thématique.

**Position** : bas d'article uniquement. Pas de sidebar sticky, pas de "floating suggested" en lecture.

**Tracking analytics** : aucun `data-track`, `data-analytics`, `onClick` d'event tracking n'est ajouté sur les liens "related" ou "suggested" (`ArticleCard.tsx:24-55`, `centre-aide/[slug]/page.tsx:206-215`). Plausible ne reçoit pas de signal spécifique sur les clics suggested.

**Coverage articles DB** : `/blog/[slug]` et `/centre-aide` n'interrogent pas la DB pour les related — uniquement FS `BLOG_POSTS` (3 articles hardcodés). Les milliers d'articles générés par la factory content-gen (table `Article`) ne sont jamais surfacés comme "related" dans le blog (sauf via le hub ville avec `getBlogArticlesByVille`).

---

### Maintenance

**Broken link check** : `content-monitoring-worker.ts:15-17` décrit un "link-checker daily-ish" soft-404 par HEAD requests. Implémenté à la ligne `121-168` : sample 10 URLs tier_1, HEAD + body length < 2000 bytes → alerte Telegram. **Scope limité** : vérifie seulement que les URLs internes Axion-IA répondent avec un body non vide, ne check pas les liens externes dans les articles.

**Orphan detection** : 0 implémentation. Pas de worker, pas de requête SQL qui détecte les articles sans aucun lien entrant (`inboundLinks = 0`). Pas de champ `inboundLinkCount` dans `Article`.

**Cron links externes** : aucun cron ne vérifie le statut HTTP des URLs externes référencées dans les `Article.bodyHtml` DB. Le `content-monitoring-worker` ne crawle que les URLs internes du site.

---

## Findings — Tableau P0 / P1 / P2

| # | Sévérité | Finding | Fichier:ligne | Impact |
|---|---|---|---|---|
| F01 | **P0** | `internalLinkCount` jamais passé à `computeSeoScore()` → score liens internes = 0/6 systématiquement → qualityScore sous-estimé ou articles promus sans lien interne réel | `blog-article.ts:155-167`, `blog-from-keywords.ts:156-167`, `landing-ville.ts:163-176`, `guide-pilier.ts:280-291` | SEO : 0 link juice garanti ; scoring faussé |
| F02 | **P1** | Table `ExternalLinkSource` / `Link` ABSENTE de `schema.prisma` → aucune gestion base de données des sources externes validées | `prisma/schema.prisma` (entier) | DA/Trust = inconnu ; dofollow par défaut sur tout externe |
| F03 | **P1** | Liens externes sans `rel="nofollow"` par défaut — seul `noopener noreferrer` sur `target=_blank` → transfert de PageRank vers sources LLM non validées | `html-sanitizer.ts:67-81`, `faq-sanitizer.ts:97-122` | PageRank leak ; risque pénalité spam Google |
| F04 | **P1** | Algorithme "suggested" articles DB absent dans `/blog/[slug]` — uniquement FS 3 articles hardcodés → les milliers d'articles factory ne sont jamais recommandés | `blog/[slug]/page.tsx:245-253`, `loader.ts:entier` | 0 maillage entre articles DB ; CTR post-article = 0 |
| F05 | **P1** | Composant `<SuggestedContent/>` inexistant → logique dupliquée et incohérente en 4 routes (blog/centre-aide/faq/guides) avec algorithmes différents | 4 fichiers `page.tsx` | Maintenance impossible ; incohérence UX |
| F06 | **P1** | Guides piliers (`/guides/[slug]`) sans section "related" ou "suggested" → dead-end total après lecture | `guides/[slug]/page.tsx:entier` | Bounce rate maximal sur content-gen le plus coûteux |
| F07 | **P1** | Pas de nofollow conditionnel : le modèle dofollow-par-défaut donne du crédit à toutes les URLs LLM, y compris potentiellement des concurrents ou sources faibles | `html-sanitizer.ts:67-81` | Risque netlinking sortant non contrôlé |
| F08 | **P1** | Aucun DA/DR/Trust score pour sélectionner les sources externes → qualité inconnue | `schema.prisma` | Sources externes potentiellement faibles |
| F09 | **P2** | Anchor text non contraint côté code → risque over-optimisation (même anchor répété) ou anchors génériques non keyword-rich | Tous `SYSTEM_PROMPT` generators | Over-optimisation ou sous-optimisation anchor |
| F10 | **P2** | Topologie article → hub ville absente dans `/blog/[slug]` malgré `mentionedCities[]` DB disponible | `blog/[slug]/page.tsx`, `get-articles-by-ville.ts` | Link juice ville → article non bi-directionnel |
| F11 | **P2** | Tracking analytics sur clics "suggested" absent → impossible de mesurer CTR et valeur du maillage | `ArticleCard.tsx`, `page.tsx` sections related | Données analytics = zéro sur maillage |
| F12 | **P2** | Broken link check scope limité : pas de vérification des URLs externes dans `Article.bodyHtml` → liens morts non détectés | `content-monitoring-worker.ts:121-168` | Liens morts = UX + SEO dégradé |
| F13 | **P2** | Orphan detection absente → articles DB sans aucun lien entrant non identifiables | `schema.prisma`, aucun worker | Articles "perdus" dans le graphe |
| F14 | **P2** | Nombre d'externes par article non cappé → LLM peut produire link stuffing (théorique) | Generators `SYSTEM_PROMPT` | Potentiel link stuffing non contrôlé |
| F15 | **P2** | Editor snippets (`editor-snippets.ts`) avec `rel="noopener"` sans `noreferrer` → manque de cohérence avec la politique html-sanitizer | `editor-snippets.ts:53,59` | Inconsistance politique `rel` |

---

## Scoring /40

| Dimension | Max | Score | Justification |
|---|---|---|---|
| **Internes count + diversity** | /12 | **3/12** | F01 bloquant : `internalLinkCount` jamais mesuré ni transmis ; 0/6 systématique en scoring. Anchor non contraint. Seul point positif : `seo-score.ts` déclare le critère et le prompt inclut la consigne. |
| **Topology cluster** | /8 | **4/8** | Maillage ville ↔ ville excellent (Haversine 3D + `mentionedCities[]`). Article → pillar et pillar → cluster absents. Guides = dead-end total. |
| **Externes table existe + politique** | /10 | **2/10** | Table ExternalLinkSource absente (F02). `noopener noreferrer` présent sur `target=_blank` (seul point). Pas de nofollow, pas de DA/DR, pas de dofollow conditionnel. |
| **SuggestedContent existe + algo** | /7 | **2/7** | Logique inlinée en 4 routes avec algos différents. Guides = dead-end. Articles DB non surfacés. Algorithme multi-dimension "2+2+2" absent. Tracking = zéro. |
| **Maintenance broken check + orphans** | /3 | **1/3** | Soft-404 HEAD sur tier-1 internes = partiel. Externes non checkés. Orphan detection absente. |

**TOTAL : 12/40 — ROUGE NO-GO**

---

## Délégations

Aucune délégation inter-agents requise pour cet audit. Tous les éléments ont pu être observés directement depuis le code source.

Interactions avec d'autres domaines :
- **A03 (Quality criteria)** : F01 impacte directement le qualityScore car `internalLinkCount` non passé = pénalité silencieuse -6 pts sur `/100`.
- **A07 (SEO scoring)** : même impact F01.
- **A12 (Analytics)** : F11 = zéro donnée sur le maillage post-article.

---

## UNKNOWNs

| # | Inconnu | Raison | Impact si négatif |
|---|---|---|---|
| U01 | Nombre réel de liens internes dans les articles publiés en DB | Aucun champ persisté, aucun log extractable en statique | Possiblement 0 lien interne sur la majorité des articles |
| U02 | Qualité anchor text réel produit par le LLM | Dépend du modèle et de la temperature — non testé | Over-optimisation ou anchors "cliquez ici" |
| U03 | Coverage `rel="nofollow"` vs `dofollow` sur externes existants en DB | Historique articles déjà publiés non inspecté | Potentiel PageRank leak massif sur articles existants |
| U04 | URLs externes générées par le LLM : sont-elles valides ? | SSRF-safe-fetch non appliqué au moment de la génération | Liens morts dès la publication |
| U05 | Nb moyen d'externes par article (requête SQL nécessaire) | Données DB non accessibles en AUDIT-ONLY | Risque link stuffing inconnu |

---

## Références

- `axionia/src/server/content-gen/quality/seo-score.ts` — scoring /100 incluant `scoreInternalLinks`
- `axionia/src/server/content-gen/generators/blog-article.ts:155-167` — appel `computeSeoScore` sans `internalLinkCount`
- `axionia/src/server/content-gen/generators/blog-from-keywords.ts:156-167` — idem
- `axionia/src/server/content-gen/generators/landing-ville.ts:163-176` — idem
- `axionia/src/server/content-gen/generators/guide-pilier.ts:280-291` — idem
- `axionia/src/server/content-gen/shared/html-sanitizer.ts:67-122` — politique `rel` externes
- `axionia/src/server/content-gen/shared/faq-sanitizer.ts:97-122` — idem FAQ
- `axionia/src/app/[locale]/blog/[slug]/page.tsx:245-253` — algorithme "related" FS-only
- `axionia/src/app/[locale]/centre-aide/[slug]/page.tsx:113-118` — "Voir aussi" same-category
- `axionia/src/app/[locale]/faq/[slug]/page.tsx:87-88` — "Autres questions" naïf
- `axionia/src/app/[locale]/implantations/[region]/[ville]/page.tsx:622-710` — maillage ville Haversine + articles
- `axionia/src/server/content-gen/blog/get-articles-by-ville.ts` — DB filter `mentionedCities`
- `axionia/src/lib/geo.ts:95-108` — `getRelatedBlogPosts` FS-based
- `axionia/src/server/queue/workers/content-monitoring-worker.ts:121-168` — soft-404 HEAD check
- `axionia/src/content/knowledge/editor-snippets.ts:50-59` — CTAs internes KB
- `axionia/prisma/schema.prisma:874-955` — model `Article` (absence de `Link`/`ExternalLinkSource`)
- `axionia/src/components/marketing/ArticleCard.tsx` — composant rendu cards related (sans tracking)
