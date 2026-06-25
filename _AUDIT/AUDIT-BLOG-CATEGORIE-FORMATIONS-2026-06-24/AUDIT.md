# Audit — page `/fr/blog/categorie/blog-formations-ia` (2026-06-24)

Worktree dédié : `axionia-wt-blog-cat` · branche `audit/blog-categorie-formations` (base `origin/main`).
Fichier route : `src/app/[locale]/blog/categorie/[slug]/page.tsx`.

## 1. « Tous les contenus générés doivent-ils être ici ? » → NON (par design)

La page est une **vue filtrée**, pas le catalogue global. La requête
(`getDbArticlesByCategorySlug`) ne remonte que les articles :

- `categoryId` = la catégorie **`blog-formations-ia`** (= secteur `interventions_formations`,
  cf. `category-mapper.ts`) ;
- `status = "published"` ;
- `isNews = false`.

Conséquence — répartition voulue du contenu généré :

| Contenu | Destination |
|---|---|
| Articles secteur **Formations IA**, publiés, non-news | **cette page** |
| Actualités (`isNews = true`) | `/actualites` |
| Guides (`slug guide-*`) | `/guides` |
| Articles des **4 autres secteurs** (audits, un-à-un, implémentations, sites web) | leur propre hub `/blog/categorie/<slug>` |
| **Tout** (vue d'ensemble paginée) | `/blog` |

C'est correct : concentrer le crawl-budget par thématique, éviter le doorway (HCU 2024).
**Aucun article « formations » publié non-news ne manque** ici (cap `take: 100`).
Rien à corriger sur ce point.

## 2. Miniatures sans photo → CORRIGÉ

**Constat** : `ArticleCard` n'acceptait ni ne rendait d'image → miniatures titre + extrait
uniquement. Or le champ **`Article.featuredImage`** (hero Unsplash, ajouté 2026-06-16) **existe
en DB** et est déjà rendu sur la page article détaillée (`/blog/[slug]`), mais :
- `category-loader.getDbArticlesByCategorySlug` ne **sélectionnait pas** `featuredImage` ;
- `ArticleCard` n'avait pas de prop image.

**Correctif** (décision Will : photo si dispo, sinon carte texte — **pas** de placeholder générique) :
- `ArticleCard` : props optionnelles `imageUrl` / `imageAlt`, miniature `next/image` 16/9
  `object-cover`, `loading="lazy"`, `sizes` adaptés à la grille 3-col. Rendue **uniquement**
  si une photo existe → CLS = 0, aucun bloc vide.
- `category-loader` : sélection `featuredImage` + `featuredImageAlt{Fr,En}` (alt per-locale).
- Câblé aussi sur **`/blog`** (index) pour cohérence : `ArticleSummary` + `listPublishedArticles`
  (legacy Article path, `include` → champ déjà chargé) + `loadBlogIndexForView`.
- Les 11 autres pages partageant `ArticleCard` (secteur/tag/auteur/villes…) restent **inchangées**
  (carte texte) tant qu'aucune photo ne leur est passée.

Note SSG/ISR : au build stub (`stub.invalid`) la DB renvoie `[]` → pas d'image ; l'ISR
(`revalidate=3600`) repeuple avec les vraies heros sous 1 h. `images.unsplash.com` est déjà
whitelisté dans `next.config.ts` (`remotePatterns`).

## 3. Doublon `BreadcrumbList` JSON-LD → CORRIGÉ

**Constat (bug SEO)** : la page émettait **deux** `BreadcrumbList` avec le **même `@id`**
(`…/blog/categorie/<slug>#breadcrumb`) :
1. via `<Breadcrumbs>` (correct : `Accueil > Blog > <label>`, positions 1-2-3) ;
2. via `<JsonLd data={buildBreadcrumbJsonLd(...)}>` (malformé : `Blog > <label>` sans Accueil,
   positions ré-indexées à 1).

Deux nœuds au même `@id` = schéma ambigu pour Google/LLM.

**Correctif** : suppression du second bloc (lignes ~204-213) + import `buildBreadcrumbJsonLd`
devenu inutile. `<Breadcrumbs>` reste la **source unique** du BreadcrumbList. `CollectionPage`
JSON-LD conservé.

## Vérifications

- `pnpm typecheck` : **OK** (0 erreur).
- `pnpm vitest run src/server/content-gen/blog` : **19/19 OK** (test propagation image ajouté).
- `pnpm eslint` (fichiers modifiés) : **OK**.

## 4. Hub de navigation des catégories (A) + maillage croisé (C) → AJOUTÉ

**Constat** : il n'existait **aucune page-hub** regroupant les catégories. Seul un bloc
« Thématiques » dynamique (≥1 article requis) au milieu de `/blog`, absent du menu/footer.

**A — Page hub dédiée `/blog/categorie`** (`page.tsx`) :
- Liste **stable des 5 catégories** (depuis `BLOG_CATEGORY_SLUGS`, pas dérivée de la DB →
  toujours complète, même au build stub), avec label + description éditoriale + **compte
  d'articles** (`getBlogCategoryCounts`, un seul `groupBy`, stub-safe, ISR 1 h).
- Breadcrumb (source unique `<Breadcrumbs>`) + `CollectionPage` JSON-LD (`hasPart` = 5 hubs).
- Route ajoutée à `routing.ts` (`/blog/categorie` → EN `/blog/category`) → **auto-incluse dans
  `pages.xml`** (via `buildPagesSitemap` qui itère `routing.pathnames`).
- **Redirect EN→FR** : ajout du mapping exact `/en/blog/category` → `/fr/blog/categorie` dans
  `en-to-fr-redirect.ts` (le préfixe `/category/` existant, avec slash, ne couvrait PAS le hub
  sans slash → il serait tombé en 404 `/fr/blog/category`). +2 tests.
- Liens ajoutés : **footer** (colonne Ressources) + bouton « Toutes les catégories » sur `/blog`.

**C — Maillage croisé sur chaque `/blog/categorie/[slug]`** :
- Section « Autres thématiques » en bas de page : les **4 autres catégories** en chips cliquables
  + bouton vers le hub. Statique, stub-safe, renforce le maillage interne entre hubs.

## 5. Audit E2E multi-agents (5 agents) + correctifs lot 2 — 2026-06-24

Vérification E2E (navigation, SEO/AEO/GEO, Speakable, métadonnées, rich results,
liens internes/externes, correction/régressions, runtime `:3001`). **Aucun bug
P0/P1 dans le diff initial.** Correctifs de perfectionnement appliqués :

- **Meta description catégorie** : remplacement de la meta thin/générique (« Articles
  Axion-IA dans la catégorie X », ~45 car., identique ×5) par les descriptions
  éditoriales riches (110-140 car.) — SSOT nouveau `lib/category-descriptions.ts`
  partagé entre le hub (cartes) et la meta des pages catégorie.
- **Speakable** : `speakable: true` sur les `CollectionPage` du hub, des catégories
  ET de l'index `/blog` (intro answer-ready citable voix / AI-Overview).
- **Hub anti-thin** : noindex/follow runtime si 0 article total (parité page catégorie ;
  jamais déclenché en prod).
- **`isPartOf`** : suppression du WebSite inline → référence le nœud canonique `#website`
  (hub + catégorie). `hasPart` du hub : `@id` ajouté sur chaque catégorie (consolidation).
- **Date** : `category-loader` tronque la date à `YYYY-MM-DD` (l'ISO brut
  « …T07:00:00.000Z » s'affichait dans `<time>`).
- **Doublon `BreadcrumbList` (bug pré-existant, même classe)** : supprimé sur **`/blog`**
  ET **`/blog/[slug]`** (deux `BreadcrumbList` au même `@id`, un malformé). `<Breadcrumbs>`
  reste la source unique partout.
- **`/blog` index** : ItemList aligné sur le contenu visible (20) au lieu de ~300
  (mismatch schéma/contenu) + `@id` page-aware ; ajout d'un nœud `CollectionPage`
  (parité avec les pages catégorie).
- **Breadcrumb article** : niveau catégorie inséré (`Accueil > Blog > {catégorie} >
  {titre}`) → maillage montant article → hub catégorie.

Vérifié au runtime (`:3001`) : 1 seul `BreadcrumbList` par page, Speakable présent,
`CollectionPage` hub = 1+5, meta descriptions riches uniques, noindex hub/catégorie
vides correct. typecheck + lint + 64 tests verts.

### Réponses navigation (questions Will)
- **News** : hub `/actualites` (48 max, RSS, sitemap-news) — **sans pagination, filtre
  ni recherche** ; isolé du blog.
- **Filtrer par type d'offre** (audit/formation/1-to-1/impl/sites web) : ✅ via les hubs
  catégorie (DB) + le nouveau hub.
- **Filtrer par secteur d'activité / taille / tag / auteur** : routes existantes
  (`/blog/secteur|taille|tag|auteur/[slug]`) mais **(a) non découvrables** (aucun lien
  depuis le blog/nav) et **(b) alimentées uniquement par les 3 articles FS legacy** — les
  articles DB de prod n'y apparaissent pas. → chantier séparé recommandé.
- **Filtrer par ville/département** : pas de route `/blog/ville/...` ; seulement
  l'inverse (page `/implantations/<region>/<ville>` liste 3 articles `mentionedCities`).

## Reste (hors périmètre, non bloquant)

- H1 « Catégorie » + eyebrow « Catégorie » légèrement redondants (nit design, non corrigé).
- Câblage des photos sur les autres hubs (secteur/tag/auteur) si souhaité plus tard — le composant
  est prêt (props optionnelles).
