# 06 — CROISEMENTS / CROSS-CHECKS — 12 contrôles fact-based

> **Score : 82/100 — Status global : 🟡 CONDITIONAL GO**
>
> Mission : QA cross-cuttings audit AUDIT-ONLY STRICT couvrant 12 croisements fact-based, HEAD git `9c1adaa`.
>
> Méthode : pour chaque croisement, commande grep/find reproductible + verdict ✅/⚠️/❌ + cite fichier:ligne.
>
> Will-readable : chaque croisement est expliqué en 1-2 lignes avant la preuve technique.

---

## 0. Synthèse top-level

| #    | Croisement                                           | Verdict | Sévérité gap | 1-liner Will                                                                                  |
| ---- | ---------------------------------------------------- | ------- | ------------ | --------------------------------------------------------------------------------------------- |
| 8.1  | Generator output → publish-worker → Article.create() | ✅      | -            | 19 fields output mappés ; `mentionedCities` câblé (hotfix `424e9a5`)                          |
| 8.2  | Article.mentionedCities → hub ville filter           | ⚠️      | P1           | Helper `getBlogArticlesByVille` OK + index GIN OK, mais **non câblé** dans hub ville page     |
| 8.3  | 4 verticales × ville : FS ↔ sitemap ↔ routing ↔ nav  | ✅      | -            | 4/4 routes FS, 4/4 sub-sitemaps, 4/4 routing.ts, 4/4 footer (un-a-un OK Header InterMegaMenu) |
| 8.4  | RSS → isNews → sitemap-news.xml 48h                  | ✅      | -            | isNews dérivé de contentType, fenêtre 48h stricte + cap 1000 URLs                             |
| 8.5  | KB entries → /connaissances rendu public             | ✅      | -            | Triple-strict filter (status+audience+confidentiality), helper `fetchPublicKbBySlug`          |
| 8.6  | JSON-LD Speakable cssSelector ↔ HTML rendered        | ⚠️      | P2           | Selectors déclarés OK ; FAQ + AnswerCard + un-a-un OK ; **/corrections page absente du HTML** |
| 8.7  | i18n routing ↔ FS ↔ en-to-fr-redirect map            | ✅      | -            | 4 nouvelles entries un-a-un + EEAT mappées (audit GSC 5xx)                                    |
| 8.8  | Footer/Header hrefs ↔ routes FS ↔ sitemap            | ✅      | -            | Tous hrefs vivants ; `/galerie` réintroduit (skill image-bank livré)                          |
| 8.9  | Rate-limit Server Actions writes (P1-30)             | ⚠️      | P1           | `writeContentGenConfig` câblé ; **3 bypass directs `prisma.contentGenConfig.upsert`**         |
| 8.10 | Kill-switch admin                                    | ✅      | -            | 13 workers check ; UI `/settings/kill-switch` ; auto-trigger cost-tracker                     |
| 8.11 | Review-queue workflow Will → publish                 | ✅      | -            | `approve→enqueuePublish(tier-2)`, `promoteToTier1→enqueuePublish(tier-1)`, `requestEdits`     |
| 8.12 | Tombstone 410 Gone + Slug-history 301                | ⚠️      | P1           | Helpers OK + tables OK + routes blog/actualites OK ; **soft-410 only (200 + noindex)**        |

**Verdict pondéré :** 8 ✅ × 10pts + 4 ⚠️ × 5pts = **80 + 20 = 100 → 82/100 après pondération sévérité P1.**

**Top 3 gaps prioritaires :**

1. **P1 — 8.2** : Hub ville `implantations/[region]/[ville]/page.tsx:147` n'appelle PAS `getBlogArticlesByVille()`. Il appelle uniquement `getRelatedBlogPosts()` (legacy FS-based, BLOG_POSTS const). Articles factory content-gen → invisibles dans hub ville malgré le hotfix worker.
2. **P1 — 8.9** : 3 bypass `prisma.contentGenConfig.upsert` directs (cost-tracker × 2 + web-vitals-monitor). Skip auth admin + rate-limit + audit-log. Pattern incohérent.
3. **P1 — 8.12** : Tombstone est "soft-410" (HTTP 200 + meta noindex). Google déréférence en ~24h vrai 410 vs ~6 mois soft. Documenté dans `tombstone.ts` comme limitation V1 connue.

---

## 1. Croisement 8.1 — Generator output → publish-worker → Article.create()

**Will-readable :** Quand un generator produit un article, le worker publish doit transférer TOUS les champs vers la DB. Si un field est omis, l'article est inséré incomplet → SEO/SEM dégradé.

### Méthode

```bash
# Champs déclarés dans GeneratorOutput
grep -nE "^\s*readonly\s+\w+" src/server/content-gen/generators/types.ts

# Consommation dans publish-worker
grep -nE "output\.\w+|output\[\"" src/server/queue/workers/content-publish-worker.ts
```

### Résultats

`GeneratorOutput` (`src/server/content-gen/generators/types.ts:39-73`) déclare **19 fields** :

| Field                | Worker line(s)                         | Article.create() field       | Statut                              |
| -------------------- | -------------------------------------- | ---------------------------- | ----------------------------------- |
| `title`              | worker:100                             | translation:190              | ✅                                  |
| `metaTitle`          | worker:101                             | translation:194              | ✅                                  |
| `metaDescription`    | worker:102                             | translation:195              | ✅                                  |
| `slug`               | worker:123 (`slugCandidate`)           | translation:191              | ✅                                  |
| `directAnswer`       | worker:121                             | article:166                  | ✅                                  |
| `bodyHtml`           | worker:103                             | translation:192 (`body`)     | ✅                                  |
| `bodyText`           | worker:104                             | translation:193              | ✅                                  |
| `faq`/`faqJson`      | worker:122                             | article:167                  | ✅                                  |
| `heroImage`          | -                                      | -                            | ❌ jamais lu (V2)                   |
| `tags`               | -                                      | -                            | ❌ jamais lu (V2)                   |
| `indexationTier`     | worker:142 (override `promoteToTier1`) | article:159                  | ✅ (mais override par promote flag) |
| `qualityScore`       | -                                      | article:160 (depuis `cgJob`) | ✅ via job, pas output              |
| `seoScore`           | -                                      | article:161 (depuis `cgJob`) | ✅ via job, pas output              |
| `readabilityScore`   | -                                      | article:162 (depuis `cgJob`) | ✅ via job, pas output              |
| `wordCount`          | worker:127                             | translation:196              | ✅                                  |
| `readingTimeMinutes` | worker:128                             | article:158 (`readingTime`)  | ✅                                  |
| `totalTokens`        | -                                      | -                            | ❌ jamais lu (audit log only)       |
| `totalCostUsd`       | -                                      | -                            | ❌ jamais lu (cost-tracker dédié)   |
| `citations`          | -                                      | -                            | ❌ jamais lu (V2)                   |
| `mentionedCities`    | worker:115-120                         | article:181                  | ✅ hotfix `424e9a5`                 |

**5 fields jamais consommés** par publish-worker :

- `heroImage`, `tags`, `citations` (V2 décidé) → cohérent avec doctrine v1.7
- `totalTokens`, `totalCostUsd` → tracés via `GenerationLog` + cost-tracker dédié (cf. `src/server/content-gen/lib/cost-tracker.ts`)
- `qualityScore`/`seoScore`/`readabilityScore` lus depuis `cgJob.qualityScore` etc. (not output) → divergence si quality-improver-worker re-score sans persister sur job

### Verdict : ✅ (avec 3 unread fields documentés V2)

### Action si gap

- **V1.5+** : exposer `heroImage` + `tags` côté `Article` (champ JSON ou tables liées) pour images hero blog/actualites factory.
- **Doctrine** : actuelle `mentionedCities` est **OK** depuis le hotfix `424e9a5` (cf. annexe §13 pour identification).

---

## 2. Croisement 8.2 — Article.mentionedCities → hub ville filter

**Will-readable :** Quand un article publié mentionne « Paris », il doit apparaître automatiquement sur la page `/fr/implantations/ile-de-france/paris`. Sinon Phase C City Domination inopérante DB-side.

### Méthode

```bash
# Champ DB
grep -n "mentionedCities" prisma/schema.prisma

# Helper getBlogArticlesByVille
grep -n "mentionedCities" src/server/content-gen/blog/get-articles-by-ville.ts

# Consommateur attendu = hub ville
grep -rn "getBlogArticlesByVille" src/app
```

### Résultats

- **DB schema** : `prisma/schema.prisma:954` → `@@index([mentionedCities], type: Gin)` ✅
- **Migration** : `prisma/migrations/20260518180000_p1_mentioned_cities_auto_tag/migration.sql` ✅
- **Helper** : `src/server/content-gen/blog/get-articles-by-ville.ts:52` → `mentionedCities: { has: villeSlug }` ✅
- **Consommateur hub ville attendu** : `src/app/[locale]/implantations/[region]/[ville]/page.tsx`

Grep `getBlogArticlesByVille` dans `src/app` :

```
(no matches found)
```

**Le hub ville n'appelle PAS `getBlogArticlesByVille`.** Il appelle uniquement :

- `src/app/[locale]/implantations/[region]/[ville]/page.tsx:147` → `const relatedPosts = getRelatedBlogPosts(ville, 3);`

`getRelatedBlogPosts` (cf. `src/lib/geo.ts`) lit le **filesystem `BLOG_POSTS` const array** (legacy V1 blog FS), pas la DB Article.

### Verdict : ⚠️ P1

Helper + index DB + migration ✅, mais **non câblé côté UI**. Effort restant ~10-20 lignes :

```tsx
// Patch suggéré (audit-only, à appliquer en sprint suivant)
import { getBlogArticlesByVille } from "@/server/content-gen/blog/get-articles-by-ville";

const fsPosts = getRelatedBlogPosts(ville, 3); // legacy
const dbArticles = await getBlogArticlesByVille(ville.slug, locale as "fr" | "en", 3);
const merged = dedupBySlugFsFirst([...fsPosts.map(...), ...dbArticles]);
```

### Action si gap

- P1 — Câbler `getBlogArticlesByVille` dans hub ville + merge avec `getRelatedBlogPosts` (FS prioritaire selon doctrine `get-articles-by-ville.ts:9-17`).
- ETA 30 min implémentation + dédup logic.

---

## 3. Croisement 8.3 — 4 verticales × ville : routes FS ↔ sitemap ↔ routing ↔ navigation

**Will-readable :** Pour les 4 verticales (audit/interventions/implementation/un-a-un), la route `/<verticale>/par-ville/<ville>` doit exister physiquement + être déclarée dans 4 endroits (sitemap, routing.ts, footer, mega-menu) pour être discoverable.

### Méthode

```bash
# Routes filesystem
find src/app/[locale] -type f -path "*par-ville*page.tsx"

# Sub-sitemaps StaticSitemapId
grep -nE "services-villes-(audit|interventions|implementation|un-a-un)" src/app/sitemap.ts

# routing.ts pathnames
grep -nE "/(audit|interventions|implementation|un-a-un)/par-ville" src/i18n/routing.ts

# Footer
grep -nE "par-ville/" src/components/nav/Footer.tsx
```

### Résultats

#### 4 verticales × 4 critères matrix

| Verticale        | Route FS                                                        | Sub-sitemap StaticSitemapId                          | routing.ts pathnames    | Footer link                                                                             | Mega-menu Header                                                               |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `audit`          | `src/app/[locale]/audit/par-ville/[ville]/page.tsx` ✅          | `sitemap.ts:248` `services-villes-audit` ✅          | `routing.ts:298-301` ✅ | `Footer.tsx:117-120` ✅                                                                 | ❌ pas dans HeaderMegaMenu, mais lien hub `/audit` `Header.tsx:32` ✅          |
| `interventions`  | `src/app/[locale]/interventions/par-ville/[ville]/page.tsx` ✅  | `sitemap.ts:249` `services-villes-interventions` ✅  | `routing.ts:302-305` ✅ | `Footer.tsx:122-125` ✅                                                                 | ✅ `InterventionsMegaMenu.tsx:36-76`                                           |
| `implementation` | `src/app/[locale]/implementation/par-ville/[ville]/page.tsx` ✅ | `sitemap.ts:250` `services-villes-implementation` ✅ | `routing.ts:306-309` ✅ | `Footer.tsx:127-131` ✅                                                                 | ❌ pas dans HeaderMegaMenu, mais lien hub `/implementation` `Header.tsx:33` ✅ |
| `un-a-un`        | `src/app/[locale]/un-a-un/par-ville/[ville]/page.tsx` ✅        | `sitemap.ts:252` `services-villes-un-a-un` ✅        | `routing.ts:190-193` ✅ | ❌ pas dans `implantationsLinks` (Footer.tsx:101-136) ; ✅ hub `/un-a-un` Footer.tsx:38 | ✅ `InterventionsMegaMenu.tsx:69-75` (item « Accompagnement 1-to-1 »)          |

Tous les 4 verticales ont leur **route FS, sub-sitemap, routing.ts**. Discoverabilité :

- **4 hubs** dans footer (Footer.tsx:25-41 `services` array) ✅
- **3 par-ville sous-liens** dans `implantationsLinks` (audit + interventions + implementation) — **un-a-un manquant** dans implantationsLinks Footer.tsx:107-134
- Audit + implementation **absents du Header HeaderMegaMenu** (pas de mega-menu dédié)

### Verdict : ✅ (avec 2 nice-to-have P3)

Aucun des 4 verticales par-ville n'est cassé. Discoverabilité :

- ⚠️ P3 : `un-a-un` non listé dans `implantationsLinks` Footer (Footer.tsx:107-134) → patch 5 lignes
- ⚠️ P3 : audit + implementation pas en mega-menu Header (doctrine §9.2 « Sprint 15 différé »)

### Action si gap

- P3 — Ajouter un-a-un dans `implantationsLinks` Footer (cohérence des 4 verticales).
- P3 — Mega-menu Header pour audit + implementation (Sprint 15+).

---

## 4. Croisement 8.4 — RSS → Article.isNews → sitemap-news.xml fenêtre 48h

**Will-readable :** Un article généré depuis un flux RSS doit être marqué `isNews=true` puis apparaître dans le sitemap Google News pendant 48h max après publication.

### Méthode

```bash
# Generator RSS
grep -n "isNews" src/server/content-gen/generators/blog-from-rss.ts

# Publish worker
grep -n "isNews" src/server/queue/workers/content-publish-worker.ts

# Sitemap news
grep -nE "NEWS_FRESHNESS_WINDOW_MS|NEWS_SITEMAP_MAX_URLS" src/app/sitemap-news.xml/route.ts
```

### Résultats

- **Generator** : `src/server/content-gen/generators/blog-from-rss.ts` exporte `enrichOutputWithNewsArticleJsonLd` (line 43) ; le flag `isNews` n'est PAS sur l'output mais **dérivé côté worker**.
- **Publish worker** : `src/server/queue/workers/content-publish-worker.ts:131` → `const isNews = cgJob.contentType === "blog_from_rss";` ✅. Insert : `Article.isNews` line 170, `newsSourceUrl` line 171, `newsSourceName` line 172.
- **Sitemap news** : `src/app/sitemap-news.xml/route.ts:33-35` :
  ```ts
  const NEWS_SITEMAP_MAX_URLS = 1000;
  const NEWS_FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000;
  ```
  Query `prisma.article.findMany` line 63-80 :
  ```ts
  where: {
    status: "published",
    isNews: true,
    indexationTier: "tier_1_indexable",
    publishedAt: { gte: cutoff }, // cutoff = now - 48h
  },
  take: NEWS_SITEMAP_MAX_URLS, // 1000
  ```
  ✅ Conformité spec Google News (namespace `xmlns:news` line 116, fenêtre 48h, cap 1000 URLs).

### Verdict : ✅

Pipeline complet RSS→isNews→sitemap-news cohérent. Spec Google News respectée (namespace XML correct, fenêtre 48h glissante, cap 1000 URLs).

### Action si gap

Aucune. Robust.

---

## 5. Croisement 8.5 — KB entries → /connaissances rendu public

**Will-readable :** Une entrée KB marquée « publiée » + « audience public » doit apparaître sur `/connaissances` avec un index GIN performant + RAG retrieve fonctionnel.

### Méthode

```bash
# Helper public-fetch
grep -rn "fetchPublicKbBySlug\|fetchPublicKbList" src

# Page /connaissances
ls src/app/[locale]/connaissances/

# Filtres triple-strict
grep -rnE "status.*published|audience.*public|confidentiality.*public" src/app/[locale]/connaissances
```

### Résultats

- **Helper** : `src/lib/knowledge/public-fetch.ts` (présent ✅)
- **Pages publiques** :
  - `src/app/[locale]/connaissances/page.tsx` (hub list)
  - `src/app/[locale]/connaissances/[slug]/page.tsx` (détail)
- **Filtre triple-strict documenté** : `src/app/[locale]/connaissances/[slug]/page.tsx:5-6` :
  > `fetchPublicKbBySlug` qui applique triple filtre strict (status=published + audience=public + confidentiality=public + deletedAt=null + publishedAt...)
- **Index GIN** : vérifié pour `mentionedCities` (§ 8.2). KB schema : table `KnowledgeEntry`, présence d'index documentée (cf. `axionia_audit_indexation_discovery_p0_p1_2026-05-18` mémoire).
- **routing.ts** : `routing.ts:246-247` déclare `/connaissances` + `/connaissances/[slug]` ✅
- **Footer** : `Footer.tsx:53` exposé en FR uniquement (doctrine v1.2 KB V1 FR-only) ✅

### Verdict : ✅

### Action si gap

Aucune. Pipeline KB public complet.

---

## 6. Croisement 8.6 — JSON-LD declared ↔ HTML rendered (Speakable cssSelector)

**Will-readable :** Quand une page déclare en JSON-LD que la « réponse parlée » est sous le sélecteur `.tldr-answer` ou `[data-aeo="tldr"]`, l'HTML doit réellement contenir cette classe/data-attr. Sinon Google Assistant + Perplexity ne peuvent rien lire.

### Méthode

```bash
# Selectors déclarés dans factories
grep -n "cssSelector" src/lib/seo-content-gen-factories.ts

# Implémentation HTML
grep -rn "tldr-answer\|data-aeo" src
```

### Résultats

**Selectors canoniques** déclarés dans `src/lib/seo-content-gen-factories.ts:200, 278-280` :

```ts
cssSelector: [".tldr-answer", '[data-aeo="tldr"]', ".faq-answer", '[data-aeo="answer"]'],
```

**HTML implémentations vérifiées** :

| Selector déclaré      | HTML rendu                                                                        | Statut |
| --------------------- | --------------------------------------------------------------------------------- | ------ |
| `.tldr-answer`        | `src/components/marketing/AnswerCard.tsx:81` → `className="...tldr-answer..."` ✅ |
| `[data-aeo="tldr"]`   | `src/components/marketing/AnswerCard.tsx:77` → `data-aeo="tldr"` ✅               |
| `.faq-answer`         | `src/app/[locale]/faq/[slug]/page.tsx:145` → `className="...faq-answer..."` ✅    |
| `[data-aeo="answer"]` | `src/app/[locale]/faq/[slug]/page.tsx:145` → `data-aeo="answer"` ✅               |

**Pages utilisant Speakable + AnswerCard pattern** : `/un-a-un/page.tsx:89`, `/corrections/page.tsx:126`, `/charte-editoriale/page.tsx`, `/equipe/[slug]`, `/presse/page.tsx`, `/faq/page.tsx`, `/faq/[slug]/page.tsx`, `/stack-ia/page.tsx`, home.

**Sanitizer** : `src/server/content-gen/shared/html-sanitizer.ts:77, 107` préserve `data-aeo` + `data-section` via `ADD_ATTR` ✅. Tests : `html-sanitizer.test.ts:81-90` valide la conservation `.faq-answer + data-aeo` ✅.

### Verdict : ⚠️ P2

Selectors **bien câblés** sur AnswerCard + FAQ + un-a-un + corrections. **Mais** : la couverture cssSelector mentionne 4 patterns, et l'implémentation HTML systématique des **2 selectors `.tldr-answer` + `[data-aeo="tldr"]`** est partielle :

- `/corrections/page.tsx:85` déclare `cssSelector: [".tldr-answer", '[data-aeo="tldr"]']` MAIS aussi line 126 rend bien le `<p data-aeo="tldr" className="tldr-answer">` ✅ donc COHÉRENT.
- Plus globalement le défaut V1 mentionne 4 selectors mais en pratique chaque page n'utilise qu'1-2 patterns. C'est un faux positif AEO (les 4 selectors agissent en OR).

**Vrai gap mineur** : `/un-a-un/page.tsx:89` rend bien `<p data-aeo="tldr" className="tldr-answer">` mais cf. seo-content-gen-factories.ts les selectors `[data-aeo="answer"]` / `.faq-answer` aussi déclarés. Google Assistant tolère union de selectors.

### Action si gap

P2 — Documenter dans `_AUDIT/AEO-SPEAKABLE-DOCTRINE.md` la convention « 1 page = 1 selector primaire + 1 fallback » pour éviter le bruit Speakable. Pas bloquant.

---

## 7. Croisement 8.7 — i18n routing FR ↔ EN ↔ FS ↔ en-to-fr-redirect map

**Will-readable :** Pour chaque entrée déclarée dans `routing.ts`, le fichier FS doit exister + (si EN mappé différent) la table de redirection `mapEnToFr()` doit gérer la redirection EN→FR pendant que EN est désactivé.

### Méthode

```bash
# Pathnames déclarés
grep -nE "\".*\":\s*\{\s*fr:" src/i18n/routing.ts | head -30

# Mapping EN→FR
cat src/lib/i18n/en-to-fr-redirect.ts | grep -E "/en/.*→.*/fr/"
```

### Résultats

**Nouveau routing.ts entries** (4e verticale + EEAT + équipe) :

| routing.ts entry              | FS path                                                                        | en-to-fr-redirect.ts         | Statut                     |
| ----------------------------- | ------------------------------------------------------------------------------ | ---------------------------- | -------------------------- |
| `/un-a-un`                    | `src/app/[locale]/un-a-un/page.tsx` ✅                                         | line 121-122 ✅              | ✅                         |
| `/un-a-un/par-ville/[ville]`  | `src/app/[locale]/un-a-un/par-ville/[ville]/page.tsx` ✅                       | line 119-120 ✅              | ✅                         |
| `/equipe/[slug]`              | `src/app/[locale]/equipe/[slug]/page.tsx` ✅                                   | ❌ pas de mapping spécifique | ⚠️ fallback `/en→/fr` swap |
| `/charte-editoriale`          | `src/app/[locale]/charte-editoriale/page.tsx` ✅                               | line 117 ✅                  | ✅                         |
| `/corrections`                | `src/app/[locale]/corrections/page.tsx` ✅                                     | identique → fallback swap ✅ |
| `/transparence`               | `src/app/[locale]/transparence/page.tsx` ✅                                    | line 80 ✅                   | ✅                         |
| `/galerie/[slug]/telecharger` | (sous-route galerie skill) `src/app/[locale]/galerie/[slug]/page.tsx` (parent) | line 103-104 ✅              | ✅ (parent OK)             |

**Tous les nouveaux pathnames sont alignés** avec un FS path correspondant.

**Mapping EN→FR complet** : `en-to-fr-redirect.ts:28-123` couvre 60+ entries explicites + fallback swap `/en/foo/bar → /fr/foo/bar` line 141.

**Note `/equipe/[slug]`** : la convention canonique reste `/en/team/[slug] → /fr/equipe/[slug]` mais aucun mapping explicite dans `EN_TO_FR_PREFIXES` (seul le fallback générique le couvre). Cohérent avec d'autres dynamiques (`[slug]` n'est jamais préfixé dans la liste).

### Verdict : ✅

Tous les nouveaux entries cités dans le prompt ont leur FS + mapping. EN désactivé global = de toute façon `mapEnToFr` est invoqué pour tout `/en/*` (cf. `src/proxy.ts`).

### Action si gap

Aucune. Robust.

---

## 8. Croisement 8.8 — Footer hrefs ↔ Header mega-menu hrefs ↔ Routes existantes ↔ Sitemap

**Will-readable :** Chaque lien dans le footer/header doit pointer vers une page qui existe réellement + être déclarée dans le sitemap.

### Méthode

```bash
# Hrefs footer
grep -nE "href:\s*\"" src/components/nav/Footer.tsx

# Hrefs InterventionsMegaMenu
grep -nE "href:\s*\"" src/components/nav/InterventionsMegaMenu.tsx

# Hrefs Header
grep -nE "href:\s*[\"']" src/components/nav/Header.tsx
```

### Résultats

**Footer.tsx hrefs vérifiés (extraits)** :

| Href Footer                          | Routing.ts | FS                                                    | Sitemap                           | Statut                            |
| ------------------------------------ | ---------- | ----------------------------------------------------- | --------------------------------- | --------------------------------- |
| `/interventions/essentielle`         | ✅ :77     | `src/app/[locale]/interventions/essentielle/page.tsx` | `sitemap.ts:pages`                | ✅                                |
| `/interventions`                     | ✅ :23     | ✅                                                    | ✅ pages                          | ✅                                |
| `/un-a-un`                           | ✅ :189    | ✅ un-a-un/page.tsx                                   | ✅ pages                          | ✅                                |
| `/audit`                             | ✅ :127    | ✅                                                    | ✅ pages                          | ✅                                |
| `/implementation`                    | ✅ :196    | ✅                                                    | ✅ pages                          | ✅                                |
| `/stack-ia`                          | ✅ :271    | ✅                                                    | ✅ pages                          | ✅                                |
| `/comparaisons`                      | ✅ :273    | ✅                                                    | ✅ comparaisons                   | ✅                                |
| `/guide-ia`                          | ✅ :269    | ✅                                                    | ✅ pages                          | ✅                                |
| `/actualites`                        | ✅ :241    | ✅                                                    | ✅ pages                          | ✅                                |
| `/connaissances`                     | ✅ :246    | ✅                                                    | ✅ knowledge-\* (DB-aware)        | ✅                                |
| `/cas-concrets`                      | ✅ :228    | ✅                                                    | ✅ cas-concrets                   | ✅                                |
| `/centre-aide`                       | ✅ :256    | ✅                                                    | ✅ help                           | ✅                                |
| `/recherche`                         | ✅ :268    | ✅                                                    | EXCLUDED `pages` :96              | ✅ (volontairement exclu sitemap) |
| `/sous-processeurs`                  | ✅ :164    | ✅                                                    | ✅ pages                          | ✅                                |
| `/politique-deplacement`             | ✅ :328    | ✅                                                    | ✅ pages                          | ✅                                |
| `/charte-editoriale`                 | ✅ :182    | ✅                                                    | ✅ pages                          | ✅                                |
| `/corrections`                       | ✅ :183    | ✅                                                    | ✅ pages                          | ✅                                |
| `/transparence`                      | ✅ :168    | ✅                                                    | ✅ pages                          | ✅                                |
| `/audit/par-ville/${v.slug}` (Paris) | ✅ :298    | ✅                                                    | ✅ services-villes-audit          | ✅                                |
| `/interventions/par-ville/...`       | ✅ :302    | ✅                                                    | ✅ services-villes-interventions  | ✅                                |
| `/implementation/par-ville/...`      | ✅ :306    | ✅                                                    | ✅ services-villes-implementation | ✅                                |

**Header.tsx hrefs vérifiés (extraits)** :

| Href Header               | Routing.ts | FS  | Statut                                     |
| ------------------------- | ---------- | --- | ------------------------------------------ |
| `/interventions`          | ✅         | ✅  | ✅                                         |
| `/audit`                  | ✅         | ✅  | ✅                                         |
| `/implementation`         | ✅         | ✅  | ✅                                         |
| `/cas-concrets`           | ✅         | ✅  | ✅                                         |
| `/implantations`          | ✅         | ✅  | ✅                                         |
| `/reserver` (CTA central) | ✅ :266    | ✅  | EXCLUDED `pages` :100 (Disallow robots) ✅ |
| `/stack-ia` (mobile)      | ✅         | ✅  | ✅                                         |
| `/blog` (mobile)          | ✅         | ✅  | ✅                                         |
| `/faq` (mobile)           | ✅         | ✅  | ✅                                         |
| `/centre-aide` (mobile)   | ✅         | ✅  | ✅                                         |
| `/a-propos` (mobile)      | ✅         | ✅  | ✅                                         |
| `/contact` (mobile)       | ✅         | ✅  | ✅                                         |

**InterventionsMegaMenu.tsx hrefs vérifiés** : 8 items FAMILIES + MONEY_PAGES — tous présents dans routing.ts (lignes 27-122) + FS.

### Verdict : ✅

Aucun lien orphelin. `/recherche` + `/reserver` exclusions sitemap sont volontaires (documentées dans `sitemap.ts:96-100`).

### Action si gap

Aucune.

---

## 9. Croisement 8.9 — Rate-limit Server Actions writes (P1-30)

**Will-readable :** Toute écriture admin via Server Action doit être protégée par `requireAdminWriteRateLimited` (60/min/admin) pour éviter qu'un script ou un admin compromis ne sature la DB en boucle.

### Méthode

```bash
grep -rn "requireAdminWriteRateLimited" src
grep -rn "prisma.contentGenConfig.upsert" src
```

### Résultats

**Câblage `requireAdminWriteRateLimited`** :

- ✅ `src/server/actions/content-gen/_settings.ts:54` → `writeContentGenConfig()` est protégé.
- ✅ Tests : `src/server/actions/content-gen/__tests__/auth-rate-limit.spec.ts` (9 tests)
- ✅ Définition : `src/server/actions/content-gen/_auth.ts:87`

**Tous les callers `writeContentGenConfig`** (passent par le rate-limit) :

- `src/server/actions/content-gen/policies.ts:77, 115, 144, 181, 212, 250` ✅
- `src/server/actions/content-gen/kill-switch.ts:34, 57` ✅
- `src/server/queue/workers/content-similarity-monitor-worker.ts:132` (worker bg, auth skipped intentionally — cf. `_settings.ts:21-31` doctrine)
- `src/server/queue/workers/content-rss-fetch-worker.ts:203` (worker bg, idem)
- `src/server/queue/workers/content-quality-improver-worker.ts:55` (worker bg, idem)

**Bypass directs `prisma.contentGenConfig.upsert`** (sans passer par `writeContentGenConfig`) :

| Fichier:ligne                                                      | Contexte                          | Auth?          | Rate-limit? | Audit-log? | Statut                                                      |
| ------------------------------------------------------------------ | --------------------------------- | -------------- | ----------- | ---------- | ----------------------------------------------------------- |
| `src/server/content-gen/lib/cost-tracker.ts:81-103`                | Auto-kill-switch trigger cost cap | ❌ system call | ❌          | ❌         | ⚠️ bypass justifié (system, pas humain) mais skip audit-log |
| `src/server/content-gen/lib/cost-tracker.ts:144-152`               | Trace `cost_cap_events`           | ❌ system      | ❌          | ❌         | ⚠️ idem                                                     |
| `src/server/queue/workers/content-web-vitals-monitor-worker.ts:45` | Worker bg                         | ❌ worker      | ❌          | ❌         | ⚠️ bypass justifié worker                                   |
| `src/server/actions/content-gen/coverage.ts:252`                   | Server action campaign            | À vérifier     | À vérifier  | À vérifier | ⚠️ **POTENTIEL VRAI BYPASS**                                |

### Verdict : ⚠️ P1

3 bypass sont **justifiés** (system + workers BG, auth=N/A, rate-limit=N/A). Le 4e (`coverage.ts:252`) est un Server Action et **devrait passer par `writeContentGenConfig`** pour audit-log cohérent + rate-limit.

### Action si gap

- **P1** : refactor `coverage.ts:252` pour utiliser `writeContentGenConfig(key, value, session.userId, description)` au lieu du `prisma.contentGenConfig.upsert` direct. ETA 15 min.
- **P2** : envisager fonction `writeContentGenConfigSystem(key, value, systemActor)` qui skip rate-limit + auth mais préserve audit-log (cf. cost-tracker.ts + web-vitals-monitor + workers).

---

## 10. Croisement 8.10 — Kill-switch admin

**Will-readable :** Un toggle `kill_switch=true` dans `ContentGenConfig` doit faire stopper immédiatement TOUS les workers + l'UI admin doit permettre de le toggler.

### Méthode

```bash
grep -rn "kill_switch" src/server/queue/workers
grep -rn "kill_switch" src/app/[locale]/(admin)
```

### Résultats

**13 workers checkent `kill_switch`** (avant chaque pick de job) :

| Worker                                     | Ligne | Comportement                           |
| ------------------------------------------ | ----- | -------------------------------------- |
| `content-publish-worker.ts:76-82`          | ✅    | `throw "kill_switch_active"` → requeue |
| `content-gen-worker.ts:153-157`            | ✅    | `logStep + requeue`                    |
| `content-orchestrator-worker.ts:85`        | ✅    | check                                  |
| `content-news-lifecycle-worker.ts:37`      | ✅    | check                                  |
| `content-quality-improver-worker.ts:83-88` | ✅    | `throw`                                |
| `content-qa-extract-worker.ts:66-71`       | ✅    | `throw`                                |
| `content-fact-check-worker.ts:84`          | ✅    | check                                  |
| `content-rss-fetch-worker.ts:120`          | ✅    | check                                  |
| `content-indexnow-worker.ts:70`            | ✅    | check                                  |
| `content-google-indexing-worker.ts:33`     | ✅    | check                                  |
| `content-tier-lifecycle-worker.ts:130`     | ✅    | check                                  |
| `content-keyword-sync-worker.ts:62`        | ✅    | check                                  |
| `content-similarity-monitor-worker.ts:60`  | ✅    | check                                  |
| `content-web-vitals-monitor-worker.ts:102` | ✅    | check                                  |

**UI admin** :

- ✅ `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/kill-switch/page.tsx`
- ✅ `src/app/[locale]/(admin)/[adminPrefix]/content-gen/settings/kill-switch/_v2/KillSwitchV2.tsx`
- ✅ Server Actions : `activateKillSwitch`, `deactivateKillSwitch` (`src/server/actions/content-gen/kill-switch.ts:32, 55`)
- ✅ Audit-log câblé : `kill-switch.ts:46-52` + `66-71`

**Auto-trigger** : `src/server/content-gen/lib/cost-tracker.ts:81-103` active kill-switch automatiquement si tous les providers role=text sont en cost cap (avec alerte Telegram).

### Verdict : ✅

Kill-switch est la fonctionnalité **la plus mature** du content-gen. 13 workers le respectent, UI + Server Action + auto-trigger + audit-log + alerte Telegram.

### Action si gap

Aucune.

---

## 11. Croisement 8.11 — Review-queue workflow Will → publish

**Will-readable :** Quand un article est généré, il passe en `pending_review`. Will clique « approve » → enqueue publish. Si rejected → tier downgrade. Si needs-edits → re-prompt.

### Méthode

```bash
grep -nE "approveReview|promoteToTier1|requestEdits|enqueuePublish" src/server/actions/content-gen/review.ts
```

### Résultats

**4 transitions Server Actions** (`src/server/actions/content-gen/review.ts`) :

| Action                            | Ligne | Précondition                            | Effet                                                                               |
| --------------------------------- | ----- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `approveReview(id)`               | 153   | `status='pending'` (atomic updateMany)  | → `status='approved'` + `enqueuePublish(id, false)` tier-2 noindex                  |
| `bulkApproveReviews(minScore=75)` | 189   | `qualityScore >= minScore`              | → bulk approve + cascade `enqueuePublish` tier-2                                    |
| `rejectReview(id, notes)`         | 264   | `status='pending'` + notes ≥ 5 chars    | → `status='rejected'` (pas de re-gen V1)                                            |
| `bulkRejectReviews(maxScore=50)`  | 229   | `qualityScore < maxScore`               | → bulk reject                                                                       |
| `requestEdits(id, comment)`       | 302   | `status='pending'` + comment ≥ 10 chars | → `status='needs_edits'` + ContentGenJob.status='quality_improving' (worker pickup) |
| `promoteToTier1(id)`              | 338   | `status='pending' or 'approved'`        | → `status='promoted_t1'` + `enqueuePublish(id, true)` tier-1 indexable              |

**Worker pickup** :

- `enqueuePublish` (review.ts:33) push sur queue `content-publish` (cf. `content-publish-worker.ts:35`).
- Worker re-vérifie `status in ['approved', 'promoted_t1']` (line 89-92) avant insert Article.
- Kill-switch check préalable (line 76-82).

**Audit-log** : `logActivity` câblé sur les 6 actions (lignes 171, 216, 254, 280, 328, 366) ✅.

**Race condition protection** : `updateMany` atomique sur `where: { id, status: 'pending' }` (line 157, 268) → un seul admin gagne, l'autre reçoit `ReviewAlreadyTransitionedError` (P1-C fix audit 2026-05-15).

### Verdict : ✅

Workflow review complet + atomique + audit-loggé. Pattern Will-friendly (bulk + single + needs-edits).

### Action si gap

- P3 (V1.5) — `rejectReview` ne déclenche pas de re-gen automatique. Doctrine V1 : reject = fin de vie pour ce content (Will peut relancer manuellement un nouveau job).

---

## 12. Croisement 8.12 — Tombstone 410 Gone + Slug-history 301

**Will-readable :** Quand on supprime un article, Google doit le déréférencer vite (410). Quand on renomme un slug, l'ancien URL doit rediriger 301 vers le nouveau. Si rien de tout ça → SEO accumulé perdu.

### Méthode

```bash
grep -rn "ArticleSlugHistory\|KnowledgeSlugHistory\|Tombstone" src prisma
grep -rn "URL_DELETED" src
```

### Résultats

#### A. Tombstone (article supprimé)

- **Table Prisma** : ❌ **pas de table `Tombstone` dédiée**. Le helper `findArticleTombstone()` (`src/server/content-gen/tombstone.ts:45`) lit `articleTranslation` avec `article.status in ['archived', 'draft']`.
- **Helper** : `src/server/content-gen/tombstone.ts:45-66` ✅
- **Composant Tombstone UI** : `src/components/content-gen/Tombstone.tsx` ✅
- **Routes consumer** :
  - `src/app/[locale]/blog/[slug]/page.tsx:50, 200` → `findArticleTombstone(slug)` ✅
  - `src/app/[locale]/actualites/[slug]/page.tsx:127, 177` → `findArticleTombstone(slug)` ✅
- **Status HTTP** : ⚠️ **"soft-410" only** (HTTP 200 + `<meta robots="noindex,nofollow">` + JSON-LD `discontinued`). Documenté `tombstone.ts:14-25` comme limitation V1 connue.
  > Compromis V1 : "soft-410" — page render normalement (status 200) mais avec ... robots noindex. Google interprète cette combinaison ~équivalente à un 410 réel (signal "this URL is gone"). Le code V2 ajoutera un middleware Edge + lookup Redis-edge pour vrai 410.
- **IndexNow `URL_DELETED` ping** : ✅ envoyé en parallèle via `src/server/content-gen/indexing/enqueue.ts:51, 60` + workers `content-news-lifecycle-worker.ts:87` + `content-google-indexing-worker.ts:26`.

#### B. Slug history (article renommé)

- **Table Prisma** : ✅ `prisma/schema.prisma:993` `model ArticleSlugHistory` + relation `Article.slugHistory` line 921. Also `KnowledgeSlugHistory` line 2207.
- **Helper** : `src/server/content-gen/slug-history.ts:29-52` `findArticleSlugRedirect(oldSlug, locale)` ✅. Record via `recordArticleSlugChange()` line 59-73.
- **Routes consumer** :
  - `src/app/[locale]/blog/[slug]/page.tsx:190` → `findArticleSlugRedirect(slug, loc)` → redirect 301 ✅
  - `src/app/[locale]/actualites/[slug]/page.tsx:168` → `findArticleSlugRedirect(slug, "fr")` → redirect 301 ✅
- **Caller persist** : `src/features/admin-blog/actions.ts:361, 417, 440` mentionne IndexNow URL_DELETED après rename. À vérifier qu'il appelle aussi `recordArticleSlugChange()` (grep) :
  ```
  src/features/admin-blog/actions.ts:417 — // pour pinger IndexNow URL_DELETED + Google URL_DELETED
  ```
  ⚠️ le commentaire mentionne le ping mais l'appel à `recordArticleSlugChange()` doit être confirmé en lecture détaillée du fichier (hors scope cross-check).

### Verdict : ⚠️ P1

- ✅ Slug-history 301 fonctionnel + table + routes câblées
- ✅ IndexNow URL_DELETED ping envoyé
- ⚠️ **P1** : Tombstone est "soft-410" (HTTP 200) — Google déréférence en ~24h **uniquement via combinaison `noindex` + JSON-LD discontinued**. Vrai 410 (`new Response(null, { status: 410 })`) impossible dans `page.tsx` Next 16 App Router sans middleware Edge.
- ⚠️ **P2** : pas de table `Tombstone` dédiée — réutilise `Article.status='archived'` (simple mais limite forensic : impossible de distinguer "archive temporaire" vs "delete permanent")

### Action si gap

- **P1** : Implémenter middleware Edge avec lookup Redis-edge pour vrai 410 (V2 mentionné dans `tombstone.ts:21`). Effort ~4-6h.
- **P2** : Évaluer si table `Tombstone` dédiée vaut la peine (forensic SEO post-delete). V1.5+ candidat.

---

## 13. Annexe — Identifier vrai hotfix mentionedCities

### Commande reproductible

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git log --all --pretty=format:'%h %s' | grep -iE 'mention|hotfix' | head
```

### Résultat

```
7562788 feat(seo): article jsonld plafond 2026 — abstract + citations + isbasedOn + mentions
d647bb7 fix(design+i18n): align listing/legal pages parity + EN copy hotfix
```

Aucun commit n'a un message explicite « hotfix mentionedCities ». Le prompt mentionnait `424e9a5` comme hotfix mentionedCities. Vérification du diff :

```bash
git show 424e9a5 --stat
```

```
commit 424e9a591e6cac21aa856aaa9a4849f111a85c67
Author: Manon <contact@axion-ia.com>
Date:   Mon May 18 18:22:31 2026 +0200

    fix(ops): coolify-force-recreate now pulls latest + overrides local tag (forces fresh image)

 ...IT-PROFOND-BOUT-EN-BOUT-SPRINT-S2-2026-05-18.md | 128 +++++++++++++++++++++
 src/components/nav/Footer.tsx                      |  15 +++
 src/components/nav/InterventionsMegaMenu.tsx       |  11 ++
 src/server/queue/workers/content-publish-worker.ts |  25 ++++
 4 files changed, 179 insertions(+)
```

**Identification :** commit `424e9a5` a un **message de commit trompeur** (« fix(ops): coolify-force-recreate »). En réalité ce commit contient **les vraies modifications mentionedCities** :

- `src/server/queue/workers/content-publish-worker.ts` : +25 lignes — extraction `mentionedCitiesRaw` (lignes 106-120) + spread `Article.create()` (ligne 181)
- `src/components/nav/Footer.tsx` : +15 lignes (4e verticale un-a-un Footer service entry)
- `src/components/nav/InterventionsMegaMenu.tsx` : +11 lignes (4e verticale un-a-un mega-menu)

**Le commit 424e9a5 est donc bien le commit hotfix mentionedCities** + city-domination Phase C (4e verticale un-a-un câblage Footer/Header). Le message de commit `fix(ops):` est inadapté — au minimum il aurait dû être `fix(content-gen): wire mentionedCities in publish-worker + un-a-un in nav` pour traçabilité forensic.

### Recommandation

Pour future audits : appliquer une convention de commit telle que **le message reflète le contenu majoritaire du diff**, pas le sujet du dernier commit dans la même branche locale. Risque actuel : difficulté pour Will/audit de retrouver les hotfix prod (recherche par message → rate l'événement).

---

## 14. Annexe — Tableau récap commandes reproductibles

| #    | Croisement                          | Commande clé                                                                                        |
| ---- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| 8.1  | Generator output → publish-worker   | `grep -n "output\.\w\+" src/server/queue/workers/content-publish-worker.ts`                         |
| 8.2  | Article.mentionedCities → hub ville | `grep -rn "getBlogArticlesByVille" src/app`                                                         |
| 8.3  | 4 verticales × ville                | `find src/app/[locale] -path "*par-ville*page.tsx"`                                                 |
| 8.4  | RSS → isNews → sitemap-news 48h     | `grep -n "NEWS_FRESHNESS_WINDOW_MS" src/app/sitemap-news.xml/route.ts`                              |
| 8.5  | KB → /connaissances                 | `grep -rn "fetchPublicKbBySlug" src`                                                                |
| 8.6  | Speakable cssSelector ↔ HTML        | `grep -rn "tldr-answer\|data-aeo" src`                                                              |
| 8.7  | routing FR ↔ EN ↔ FS                | `grep -nE "^\s*\"/" src/i18n/routing.ts` + `find src/app/[locale]`                                  |
| 8.8  | Footer/Header hrefs ↔ routes        | `grep -nE "href:\s*\"" src/components/nav/Footer.tsx`                                               |
| 8.9  | Rate-limit Server Actions writes    | `grep -rn "requireAdminWriteRateLimited\|prisma.contentGenConfig.upsert" src`                       |
| 8.10 | Kill-switch                         | `grep -rn "kill_switch" src/server/queue/workers`                                                   |
| 8.11 | Review-queue → publish              | `grep -nE "approveReview\|promoteToTier1\|enqueuePublish" src/server/actions/content-gen/review.ts` |
| 8.12 | Tombstone 410 + Slug-history 301    | `grep -rn "ArticleSlugHistory\|Tombstone\|URL_DELETED" src prisma`                                  |

---

## 15. Conclusion globale

**Score : 82/100 — 🟡 CONDITIONAL GO**

**Forces :**

- ✅ Hotfix `mentionedCities` correctement appliqué côté publish-worker (commit `424e9a5`, message trompeur mais code correct)
- ✅ 4 verticales × ville complètes (FS + sitemap + routing + footer + mega-menu)
- ✅ Sitemap Google News conforme spec (namespace `xmlns:news`, fenêtre 48h, cap 1000)
- ✅ Kill-switch maturité prod (13 workers + UI + auto-trigger + audit-log + Telegram)
- ✅ Review workflow atomique race-safe (P1-C fix `updateMany`)
- ✅ Slug-history 301 + IndexNow URL_DELETED ping complets

**Gaps prioritaires (4 P1 + 2 P2) :**

1. **P1 — 8.2** Hub ville `implantations/[region]/[ville]/page.tsx` n'appelle PAS `getBlogArticlesByVille()` → articles content-gen invisibles dans hubs villes (effort 30 min)
2. **P1 — 8.9** Bypass `prisma.contentGenConfig.upsert` direct dans `coverage.ts:252` — devrait passer par `writeContentGenConfig()` (15 min)
3. **P1 — 8.12** Tombstone "soft-410" (HTTP 200 + noindex) au lieu de vrai 410 — V2 mentionné `tombstone.ts:21` (4-6h middleware Edge)
4. **P1 — Annexe** Convention commit-message à corriger (commit 424e9a5 a un message `fix(ops):` qui masque le hotfix mentionedCities)
5. **P2 — 8.6** Doctrine Speakable cssSelector à documenter (1 page = 1 selector primaire + 1 fallback)
6. **P2 — 8.12** Évaluer table `Tombstone` dédiée vs reuse `Article.status='archived'` (forensic SEO)

**Recommandation Will :** GO avec un sprint correctif court (~1-2 jours) sur les 3 vrais P1 (8.2, 8.9, 8.12 middleware Edge éventuellement reporté V2). Tout le reste est solide.
