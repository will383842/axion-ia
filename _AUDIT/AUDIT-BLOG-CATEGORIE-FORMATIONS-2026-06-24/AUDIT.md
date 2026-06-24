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

## Reste (hors périmètre, non bloquant)

- H1 « Catégorie » + eyebrow « Catégorie » légèrement redondants (nit design, non corrigé).
- Câblage des photos sur les autres hubs (secteur/tag/auteur) si souhaité plus tard — le composant
  est prêt (props optionnelles).
