# Agent 10.2 — Content-Gen articles factory navigation/CTA

**Source** : `src/app/[locale]/actualites/[slug]/page.tsx` (route `NewsArticle`, DB Prisma `ArticleTranslation`).
**Méthode** : audit code (DB-driven, pas de fichier sample committé). Conclusions vraies pour 100 % des articles publiés.

## 🚨 P0 — Hub `/fr/actualites` MANQUANT

- `src/app/[locale]/actualites/` ne contient **QUE** `[slug]/page.tsx`. Pas de `page.tsx` racine.
- `grep -r "/actualites" src/components/nav` → **0 match**. Le Header ni le Footer n'expose `/actualites` !
- Seul `/blog` est référencé dans le footer (`Footer.tsx:39`). `/actualites` est un **silo orphelin SEO** : Google ne peut découvrir les articles que via sitemap-news.xml + IndexNow ping.
- **Impact** : la news factory pousse les articles vers `/actualites/<slug>` (worker `content-publish-worker.ts:184` `revalidatePath`), mais **aucun visiteur** ne peut atterrir dessus via navigation organique sur le site.
- **Verdict** : ROUGE — content-gen pipeline opérationnel côté backend mais **dead-end côté navigation publique**.

## Pattern par article — analyse code

`actualites/[slug]/page.tsx` rend :

1. ✅ **Breadcrumbs** : `Accueil › Actualités › <titre>` (mais `/actualites` hub = 404 → breadcrumb intermédiaire mort)
2. ✅ **AnswerCard TL;DR** AEO/GEO (source = excerpt ou 2 premières phrases)
3. ✅ **Author byline** : `<Link href="/equipe/<slug>">Par <author.name></Link>` — clickable, Manon disclosed conforme V1.0.3
4. ✅ **`<time dateTime>`** publishedAt (formaté `toLocaleDateString("fr-FR")`)
5. ⚠️ **dateModified PAS affiché en surface** (présent dans JSON-LD `buildNewsArticleJsonLd` only)
6. ✅ **Source RSS** : badge + `<a target="_blank" rel="noopener">` (compliance § 28.3)
7. ✅ **CTA bas article** : `CtaBlock tone="dark"` avec `<Cta href="/interventions/essentielle">` + prix dynamique
8. ✅ **JSON-LD NewsArticle** Schema.org complet (citations, isBasedOn, dateline)
9. ❌ **PAS de section "Articles similaires"** — pas de cross-links inter-articles factory
10. ❌ **PAS de tags/catégories clickables** sur la page article (`article.newsCategory` rendu en eyebrow string, pas en `<Link>`)
11. ❌ **Liens internes éditoriaux** : aucun comptage possible — dépend du contenu généré par le pipeline content-gen ; le template ne force pas de structure « 5-15 liens internes »

## Comptage CTAs

| CTA                          | Présent | Cible                                       |
| ---------------------------- | ------- | ------------------------------------------- |
| CTA bas article (conversion) | ✅      | `/interventions/essentielle`                |
| CTA latéral / sticky         | ❌      | —                                           |
| CTA hero ou sous-titre       | ❌      | —                                           |
| Lien `/reserver`             | ❌      | (uniquement via /interventions/essentielle) |
| Lien `/demande-devis`        | ❌      | —                                           |

**Verdict** : 1 CTA conversion en pied de page — **respecte la règle minimale ROUGE**.

## Tombstone + slug redirect (V1.0.3)

✅ Audit indexation 2026-05-15 P0-5+P0-7 wirés :

- `findArticleSlugRedirect` (slug-history) → 301 redirect vers nouveau slug si renommé
- `findArticleTombstone` → render `<Tombstone>` avec robots noindex,nofollow si archived/rolled-back
- Slug inventé qui n'est ni published, ni dans slugHistory, ni tombstone → `notFound()` = 404 propre

## P0 / P1 / P2

- **P0** : créer `src/app/[locale]/actualites/page.tsx` hub (liste 20 articles tier-1 + pagination + filter catégorie). Sans ça, la news factory tourne pour le sitemap mais l'expérience humaine est cassée.
- **P0** : ajouter lien `/actualites` dans Header (mega-menu ressources) ET Footer (column resources, à côté de `/blog`).
- **P1** : ajouter section « Articles similaires » en bas de chaque `<NewsArticlePage>` (basée sur `Article.category` + recency). Maillage interne dense indispensable pour Google.
- **P1** : ajouter `dateModified` visible sur l'article (badge "Mis à jour le …" si `updatedAt > publishedAt`).
- **P2** : catégorie clickable (`<Link href="/actualites?category=<id>">`). Suppose hub paginé.
