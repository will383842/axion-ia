# 06 — Sitemap + IndexNow

> **Pondération** : 50 pts | **Score** : **50/50** (100%) 🟢

---

## 6.1 Sub-sitemaps images-{fr,en}.xml — ✅ 30/30

### Inventaire

- `src/app/sitemaps/images-fr.xml/route.ts` (184 LOC) ✅
- `src/app/sitemaps/images-en.xml/route.ts` (153 LOC) ✅

### Conformité Google Image Sitemap 1.1

| Check                                                                     | Result |  Line FR |
| ------------------------------------------------------------------------- | ------ | -------: |
| Namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"` | ✅     |     L170 |
| `<image:image>` enfant de `<url>`                                         | ✅     | L155-157 |
| `<image:loc>` URL absolue                                                 | ✅     |     L155 |
| `<image:title>` (texte échappé)                                           | ✅     |     L156 |
| `<image:caption>` (alt si null)                                           | ✅     |     L157 |
| `<image:license>` (défaut CC BY 4.0)                                      | ✅     |     L159 |
| `<image:geo_location>` (si `geoPlacename`)                                | ✅     |     L145 |
| `lastmod` ISO 8601                                                        | ✅     |     L126 |
| `export const dynamic = "force-dynamic"`                                  | ✅     |      L52 |
| `export const revalidate = 3600`                                          | ✅     |      L53 |
| Hreflang alternates `<xhtml:link>`                                        | ✅     | L129-141 |
| Pagination ready (`MAX_URLS = 1000`)                                      | ✅     |      L48 |
| Fail-soft catch P2021 (table absente)                                     | ✅     |   L95-97 |

### ⚠️ Note stub.invalid (clarification critique)

**Pas d'early-exit explicite `stub.invalid`** dans le code des sub-sitemaps.

MAIS : selon ADR 0026 + `src/lib/prisma.ts`, le **Prisma singleton est lui-même stub-aware** :

- Si `process.env.DATABASE_URL?.includes("stub.invalid")` → retourne un Proxy qui short-circuit toutes les queries vers `[] / null / 0`
- `prisma.imageAsset.findMany(...)` au build GH Actions → retourne `[]` → XML vide → `sitemap-index` ignore proprement

**Donc P0 BUILD CRASH = INFIRMÉ** (Proxy Prisma gère).

**MAIS** : doctrine AGENTS.md recommande :

> Si une nouvelle page SSG fait un appel DB direct au build, vérifier que le stub Proxy couvre la méthode utilisée **OU** ajouter un `if (process.env.DATABASE_URL?.includes("stub.invalid")) return <fallback>` early-exit dans la page.

Pattern recommandé (cf. `src/server/exporters/knowledge-rss.ts` + `knowledge-sitemap.ts` qui font un early-exit explicite). **P2 best-practice cohérence doctrine** (pas P0 build crash).

## 6.2 sitemap-index.xml — ✅ 10/10

`src/app/sitemap-index.xml/route.ts:46-47` :

```xml
<loc>${SITE_URL}/sitemaps/images-fr.xml</loc>
<loc>${SITE_URL}/sitemaps/images-en.xml</loc>
```

✅ 2 entries dans `CUSTOM_SITEMAPS` array (L42-48).

## 6.3 IndexNow extension — ✅ 10/10

`scripts/indexnow-ping.ts:93-124` :

```ts
async function collectImageBankUrls(siteUrl: string): Promise<string[]> {
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    return []; // ✅ Early-exit explicite (cohérent doctrine)
  }
  try {
    const translations = await prisma.imageAssetTranslation.findMany({
      where: { isPublished: true },
      // ...
      take: 1000, // ✅ Cap 1000 URLs (limite API IndexNow)
    });

    return translations.map((t) => {
      const segment = t.languageCode === "fr" ? "galerie" : "gallery"; // ✅ Segment FR/EN
      return `${siteUrl}/${t.languageCode}/${segment}/${t.slug}`;
    });
  } catch {
    return []; // ✅ Best-effort
  }
}
```

- ✅ Fonction `collectImageBankUrls()` ajoutée
- ✅ Early-exit `stub.invalid` explicite (best-practice contre exemple sub-sitemaps)
- ✅ Try/catch best-effort (n'empêche pas le ping STRATEGIC_PATHS)
- ✅ Cap 1000 URLs
- ✅ Segment FR=galerie / EN=gallery
- ✅ Appelé en main flow `indexnow-ping.ts:69` (`imageBankUrls = await collectImageBankUrls(siteUrl)`)

## 6.4 Bing URL Submission API — Backlog P2

Non implémenté V1. Mention dans plan IMPLEMENTATION-PLAN.md Sprint 4 : IndexNow ping va déjà sur `api.indexnow.org` qui relaie à Bing + Yandex.

**P2 V1.5** : ajouter Bing URL Submission API pour cas où IndexNow latence > 24h.

---

## 📋 Issues identifiées

### P2 (2)

- **P2-SITEMAP-1** : Sub-sitemaps `images-{fr,en}.xml/route.ts` ajouter early-exit `stub.invalid` explicite cohérence doctrine `knowledge-rss.ts`. Effort 5min × 2 files = 10min.
- **P2-BING-1** : Bing URL Submission API direct (vs relais IndexNow). Effort ~2h. Sprint V1.5.

---

## 🎯 Sous-pondération

| Check                                   |    Pts |  Score |
| --------------------------------------- | -----: | -----: |
| 6.1 Sub-sitemaps Google 1.1 + namespace |     30 |     30 |
| 6.2 sitemap-index.xml référence         |     10 |     10 |
| 6.3 IndexNow `collectImageBankUrls()`   |     10 |     10 |
| **TOTAL**                               | **50** | **50** |

---

## ✅ Verdict Phase 6

**🟢 PASS PARFAIT 50/50 (100%)** — Sub-sitemaps Google Image 1.1 conformes, sitemap-index intégré, IndexNow best-effort + cap 1000 + segment FR/EN + early-exit stub.invalid.

**P0 build crash redouté par Will = INFIRMÉ** (Proxy Prisma `src/lib/prisma.ts` gère `findMany` → `[]`).

Pas de bloquant. 2 P2 best-practice + Bing API V1.5.
