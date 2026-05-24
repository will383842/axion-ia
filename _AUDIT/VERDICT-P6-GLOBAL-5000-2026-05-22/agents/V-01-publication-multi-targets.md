# V-01 — Publication multi-targets (re-évaluation P6, HEAD 8031a00)

**Branche** : `audit/p6-verdict-global-5000-2026-05-22`
**Baseline audit 2026-05-22** : 42/100 (P0 🔴) — helper DB dead code + 4 hubs services villes vides.
**Score actuel** : **150 / 200** (équivalent 75/100) — **🟡 GO conditionnel**

Δ baseline → P6 = **+33 pts /100** (helper câblé sur 2 surfaces, restent : index blog FS + guides/glossaire/cas-concrets DB-blind).

---

## 1. Forces (corrections livrées depuis baseline)

1. **`getBlogArticlesByVille()` câblé hub ville** — `axionia/src/app/[locale]/implantations/[region]/[ville]/page.tsx:35,150-203` (Sprint Correctif 2026-05-22 “P0c”) : merge dedup DB-first (Article DB via `mentionedCities`) + fallback FS legacy `getRelatedBlogPosts()`. Articles factory désormais visibles dans hub ville pilote.
2. **`getBlogArticlesByVille()` câblé sur les 4 hubs services villes** — `axionia/src/components/sections/VilleServicePageTemplate.tsx:31,302,459-506` (P0d). Couvre les 4 verticales `audit`, `interventions`, `implementation`, `un-a-un` (`axionia/src/app/[locale]/{audit,interventions,implementation,un-a-un}/par-ville/[ville]/page.tsx`). Section dédiée “Articles mentionnant {ville}” + tracking `ville_service_${service}_article` + cap 3 (fail-soft `try/catch` Prisma).
3. **Worker persiste `mentionedCities[]`** — `axionia/src/server/queue/workers/content-publish-worker.ts:268-282,355-363` : extraction typée tolérante (string-only, cap 20), spread conditionnel dans `tx.article.create()`. Hotfix audit 2026-05-18 confirmé en place sur HEAD 8031a00 → index GIN `articles_mentioned_cities_idx` exploitable côté hub ville (`get-articles-by-ville.ts:46-66`, `mentionedCities: { has: villeSlug }`).

Bonus : helper `BlogArticleByVilleResult` typé readonly, query `take=3` + `where indexationTier='tier_1_indexable'` (anti-doorway respecté), fallback `[]` sur table absente bootstrap.

---

## 2. Gaps P0/P1 résiduels

1. **🔴 P0 — Index blog `/blog` FS-only** (`axionia/src/app/[locale]/blog/page.tsx:15,72-87,251-275`) : la liste blog itère `BLOG_POSTS` (const FS `@/content/transversal`) et **n'interroge jamais `prisma.article.findMany()`**. Les articles factory tier-1 publiés en DB ne sont surfacés qu'en URL directe `/blog/[slug]` (via `loadBlogArticleForView`) et dans `/actualites` (qui lit `prisma.article` mais filtre `isNews=true`, donc seuls `blog_from_rss` y arrivent — cf. `actualites/page.tsx:64`, `content-publish-worker.ts:306`). **Conséquence** : les `blog_article`, `blog_from_keywords`, `blog_from_title`, `comparison`, `qa_derived`, `faq_standalone`, `guide_pilier` (7 des 9 `ContentType` enum, `schema.prisma:2517-2527`) n'apparaissent dans **aucune** liste hub agrégée — Google crawl uniquement via sitemap + maillage ville. Effort : **3-4 h** (ajout merge DB+FS dans `BlogListing`, dédup slug, tri unifié par `publishedAt`, ItemList JSON-LD à étendre).

2. **🔴 P0 — Hubs `/guides`, `/glossaire`, `/cas-concrets` DB-blind** : aucun match `prisma.article` ni `getBlogArticlesByVille` (Grep dans `src/app/[locale]/{guides,glossaire,cas-concrets,ressources}`). Les `ContentType` enum `guide_pilier`, `qa_derived`, `faq_standalone` publient en `Article` mais aucun de ces 3 hubs ne lit la DB → contenus factory invisibles malgré pipeline opérationnel. Pas de helper équivalent `getGuidesByVille`/`getCaseStudiesByVille` côté `src/server/content-gen/`. Effort : **6-8 h** (3 helpers DB + câblage + filtre par `contentType` au lieu de tier seulement).

3. **🟡 P1 — Article DB-only pas de filtre `contentType` côté hub ville** : `get-articles-by-ville.ts:46-66` query tous les `Article` sans distinguer `contentType` (champ Prisma `ContentGenJob.contentType` non répercuté sur `Article`). Hub ville mélange blog_article + comparison + landing_ville etc. dans la même section “Articles & ressources”. Effort : **1-2 h** (ajouter `contentType` sur `Article` via migration ou join `ContentGenJob` + segmenter UI 3 sections). Schema gap : `Article` n'a pas de champ `contentType` aujourd'hui (vérification rapide `schema.prisma:2778` montre `contentType` seulement sur `ContentGenJob`/`ReviewQueue`/`CampaignContentTypeProfile`).

---

## 3. Décisions Will figées appliquées

- **D-W1-5 / D-P5-1-6** : 4 verticales (audit/interventions/implementation/un-a-un) toutes câblées dans `VilleServicePageTemplate` — conforme.
- **D1-D5 / D7** : société FR pure, EN miroir désactivé runtime (`proxy.ts` 301), pas d'impact V-01 (DB query `locale:"fr"`).
- Exclusions Wikidata/DPA/CF WAF : non pertinentes pour cet axe.

---

## 4. Verdict

**🟡 GO conditionnel — 150/200**. Helper DB désormais consommé sur 5 surfaces (hub ville + 4 hubs services). Worker persiste `mentionedCities` (anti-régression HEAD). **Gap restant majeur** : visibilité cross-target dans les hubs racines `/blog` (FS-only), `/guides`, `/glossaire`, `/cas-concrets` — 6 `ContentType` sur 9 invisibles hors maillage ville/sitemap. Effort consolidé restant ≈ **10-14 h** (vs baseline 13 h) — équivalent désormais à un sprint correctif scoped, non plus à un P0 bloquant.

**Recommandation Sprint C** : prioriser P0-1 `/blog` DB-merge (3-4 h, gain estimé +20 pts /100) avant P0-2 (6-8 h, gain +15 pts). Une fois ces deux livrés, V-01 vise 180-185/200 = 🟢.
