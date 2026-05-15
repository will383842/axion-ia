# FIX SITEMAP-NEWS — XML brut conforme Google News

**Date** : 2026-05-15
**Sprint** : Content-gen perf 2026-05-15
**Audit source** : Sitemap+IndexNow 2026-05-15 — AGENT 4 §4.1.3 P0-3
**Auteur** : Claude (autopilote content-gen)
**Statut** : LIVRÉ — typecheck OK, 843/843 tests passants

---

## Problème

Le sitemap-news actuel (avant ce patch) utilisait la convention Next 16
`MetadataRoute.Sitemap` via `app/sitemap.ts` (`generateSitemaps()` → id
`"news"`). Deux blocages :

1. **Namespace manquant**. `MetadataRoute.Sitemap` ne supporte PAS
   `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`. Sans
   ce namespace + les balises `<news:news><news:publication>...`, Google
   News refuse purement et simplement le sitemap (le sitemap reste valide
   pour Google Search mais News ne crawle pas).
2. **Fenêtre 90 jours**. La fenêtre était fixée à 90 jours, alors que
   Google News exige **48h stricte** (publications plus anciennes =
   retirer du sitemap, sinon Google News considère le sitemap stale et
   dégrade la confiance).

Conséquence : Google News inatteignable malgré le code en place et les
~10-15 actualités déjà publiées avec `Article.isNews=true` +
`indexationTier=tier_1_indexable`.

---

## Solution livrée

### 1. `src/app/sitemap-news.xml/route.ts` (NOUVEAU)

Route Handler GET XML brut conforme spec :

- Headers `Content-Type: application/xml; charset=utf-8` +
  `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- Namespace strict : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`
- Filtre Prisma : `status=published` + `isNews=true` +
  `indexationTier=tier_1_indexable` + `publishedAt >= NOW - 48h`
- Max **1000 URLs** (cap hard Google News, pas 50K)
- `escapeXml()` pour titres (anti injection / parsing error)
- `export const dynamic = "force-dynamic"` + `revalidate = 300` —
  fenêtre 48h glissante exige éval à chaque request, cache 5min CDN
- **Fail-soft** : try/catch sur le `findMany` → XML vide valide si
  `P2021` (table absente bootstrap pré-migration)

Structure XML générée :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>https://axion-ia.com/fr/actualites/{slug}</loc>
    <news:news>
      <news:publication>
        <news:name>Axion-IA</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>{ISO 8601}</news:publication_date>
      <news:title>{title escaped}</news:title>
    </news:news>
  </url>
</urlset>
```

### 2. `src/app/sitemap.ts` (MODIFIÉ)

- `"news"` retiré de `StaticSitemapId` union
- `"news"` retiré du tableau `staticIds` dans `generateSitemaps()`
- `case "news"` retiré du switch
- Fonction `buildNewsSitemap()` supprimée (~50 lignes)
- Import `prisma` retiré (plus utilisé dans ce fichier)
- Commentaires d'ADR ajoutés pour traçabilité

### 3. `src/app/sitemap-index.xml/route.ts` (MODIFIÉ)

Ajout d'un tableau `CUSTOM_SITEMAPS` qui liste les sub-sitemaps en dehors
de `generateSitemaps()` (= Route Handlers XML brut). Pour l'instant un
seul : `/sitemap-news.xml`. Le rendu XML concatène
`generatedBlocks + customBlocks`. Sans cette modification, Googlebot ne
découvre pas le sitemap-news en suivant `/sitemap-index.xml`.

### 4. `src/app/robots.ts` (PAS DE CHANGEMENT)

Déjà bon — pointe sur `Sitemap: ${SITE_URL}/sitemap-index.xml`. La
correction du sitemap-index suffit à propager la découverte.

---

## Choix d'architecture documenté

**Pourquoi ne pas tout faire en Route Handler ?**
On garde `app/sitemap.ts` (`MetadataRoute.Sitemap`) pour les sub-sitemaps
classiques (pages, blog, villes, KB, etc.) car la convention Next 16 gère
bien :

- `<lastmod>` ISO 8601 cohérent
- `alternates.languages` (hreflang) auto
- `changefreq`/`priority`
- Découpage `generateSitemaps()` par id

On bascule en Route Handler XML brut **uniquement** pour le sitemap-news
qui exige un namespace XML inaccessible via la convention metadata.

**Pourquoi `/sitemap-news.xml` et pas `/sitemap/news.xml` ?**
La convention Next 16 sert ses sub-sitemaps à `/sitemap/<id>.xml`. Un
Route Handler à `app/sitemap/news.xml/route.ts` entrerait en conflit
avec la convention metadata. Le path racine `/sitemap-news.xml` évite
ce conflit et reste référencé via `sitemap-index.xml`.

---

## Validation

- `pnpm typecheck` → **OK** (0 erreur)
- `pnpm test` → **843 passed / 845** (2 skipped pré-existants), 0
  régression
- E2E `tests/e2e/content-gen/news-rss.spec.ts` : compatible (hit le même
  path `/sitemap-news.xml`, vérifie 200 + slug présent)
- Workers existants (`content-publish-worker.ts`,
  `content-news-lifecycle-worker.ts`) appellent
  `revalidatePath("/sitemap-news.xml")` — contrat préservé

---

## Suivi

- Soumettre `/sitemap-news.xml` dans Google Search Console (section
  Sitemaps) une fois la prod déployée
- Vérifier `Sitemaps de news` dans GSC → état Reçu + 0 erreurs
- Monitorer apparition dans Google News Publisher Center sous 48h
