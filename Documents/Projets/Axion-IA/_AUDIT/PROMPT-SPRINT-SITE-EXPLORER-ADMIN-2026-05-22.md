# SPRINT SITE EXPLORER ADMIN
## AxionIA — Catalogue exhaustif URLs + Tree view visuel + Preview + Édition inline

**Date création** : 2026-05-22
**Type** : Sprint feature admin (IMPLÉMENTATION)
**Mode** : IMPLEMENTATION (commits incrémentaux + push autorisés)
**Effort estimé** : 25-35h autopilot
**Modèle recommandé** : Sonnet 4.6 (suffisant pour cette feature)
**Demandé par Will explicitement le 2026-05-22** : "voir toutes les url, pages, templates etc depuis la console d'administration ainsi que la structure globale visuel du site. Le but est de pouvoir aller directement vers un url pour voir si elle est parfaite et éventuellement la modifier"

---

## 0. MISSION

Créer un **Site Explorer Admin** complet qui permet à Will de :

1. **Lister UNIQUEMENT les URLs publiques visibles par les users** du site (statiques + dynamiques DB + paramétrées) dans la console admin
2. **Visualiser l'architecture** en tree view collapsible (et optionnellement graph SVG)
3. **Filtrer + chercher** par type / section / status / verticale / ville / mot-clé
4. **Inspecter** chaque URL : status HTTP, metaTitle, metaDescription, H1, word count, JSON-LD count, liens internes/externes count, Lighthouse score
5. **Preview** : click URL → ouvre nouvel onglet sur la page live
6. **Éditer** : pages DB (articles, glossaire, cas-concrets) → édition inline avec validation. Pages statiques `.tsx` → marquées non-éditables avec lien vers code source GitHub
7. **Détecter problèmes** : 404, metaTitle dupliqués, pages orphelines (sans liens internes)

### ⚠️ EXCLUSIONS STRICTES (NE PAS scanner / cataloguer / afficher)

Le Site Explorer ne doit contenir **QUE les URLs publiques visibles par les visiteurs réels du site**. Sont **EXCLUS** :

- ❌ **Routes admin** : tout chemin contenant `(admin)` ou `[adminPrefix]` (toutes les pages `/[locale]/(admin)/[adminPrefix]/**`)
- ❌ **Routes API** : tout `src/app/**/route.ts` (handlers REST)
- ❌ **Server Actions** : tout fichier `actions.ts` ou Server Action référencé
- ❌ **Routes auth** : `/login`, `/logout`, `/api/auth/**`, `/[locale]/(auth)/**`
- ❌ **Routes internes/utilitaires** : `/_next/**`, `/sitemap.xml`, `/robots.txt`, `/favicon.ico` (ce sont des assets, pas des pages users)
- ❌ **Routes draft/preview** : pages en mode draft non visibles publiquement
- ❌ **Routes admin spécifiques** : `/[adminPrefix]/site-explorer/**` (le Site Explorer lui-même !)

### ✅ INCLUS (vues users uniquement)

- ✅ **Pages statiques publiques** : `/`, `/contact`, `/booking`, `/mentions-legales`, `/cgv`, `/rgpd`, `/transparence`, `/corrections`, `/ai-policy`, `/faq`, `/qui-sommes-nous`, etc.
- ✅ **Hubs verticales** : `/audits`, `/interventions-formations`, `/un-a-un`, `/implementations`, `/sites-web-augmentes`
- ✅ **Hubs blog/contenu** : `/blog`, `/guides`, `/cas-concrets`, `/glossaire`, `/presse`, `/galerie`, `/stack-ia`, `/codage-developpement`
- ✅ **Pages dynamiques articles** : `/blog/[slug]`, `/cas-concrets/[slug]`, `/guides/[slug]`, `/presse/[slug]`, `/stack-ia/[tool]`, `/galerie/[slug]`, `/equipe/[slug]`
- ✅ **Pages dynamiques villes** : `/audits/[ville]`, `/interventions/[ville]`, `/un-a-un/[ville]`, `/implementations/[ville]`, `/sites-web-augmentes/[ville]`, `/implantations/[ville]`
- ✅ **Pages glossaire** : `/glossaire/[term]`

---

## 1. CONTEXTE PROJET AXION-IA

### Société française AxionIA — 5 verticales
- `interventions_formations`, `audits`, `un_a_un`, `implementations`, `sites_web_augmentes`

### Stack
- Next.js 16 App Router + Prisma 5.22 + Postgres + BullMQ Redis
- Auth NextAuth.js admin

### Décisions Will canoniques FIGÉES (ne pas re-demander)
- D-W1-5, D-P5-1-6, D1-D5, D7 société française pure
- Exclusions Will : Wikidata, DPA, CF WAF, toggle auto/manuel publication

### Structure routes existante (à inventorier)

#### Routes statiques publiques (~50)
- `/`, `/fr`, `/contact`, `/booking`, `/qui-sommes-nous`
- `/audits`, `/interventions-formations`, `/un-a-un`, `/implementations`, `/sites-web-augmentes` (hubs verticales)
- `/blog`, `/guides`, `/cas-concrets`, `/glossaire`, `/presse`, `/galerie`, `/stack-ia`, `/codage-developpement`, `/faq`
- `/mentions-legales`, `/cgv`, `/rgpd`, `/transparence`, `/corrections`, `/ai-policy`

#### Routes dynamiques (~5000+ après scale)
- `/blog/[slug]` → DB `articles` (1000-10000 attendus)
- `/cas-concrets/[slug]` → DB
- `/guides/[slug]` → DB ou filesystem
- `/glossaire/[term]` → DB `defined_terms` (60+ termes)
- `/presse/[slug]` → DB
- `/stack-ia/[tool]` → DB (11 outils acquis S+4)
- `/audits/[ville]`, `/interventions/[ville]`, `/un-a-un/[ville]`, `/implementations/[ville]`, `/sites-web-augmentes/[ville]` (5 × 2100 villes potentielles)
- `/implantations/[ville]` (39 villes pilote)
- `/galerie/[slug]` → DB image-bank
- `/equipe/[slug]`

#### Routes admin (~30)
- `/[adminPrefix]/content-gen/**`
- `/[adminPrefix]/image-bank/**`
- `/[adminPrefix]/users/**`
- `/[adminPrefix]/settings/**`

#### Routes API + Server Actions
- À cataloguer également pour debug

---

## 2. PHASE A — MODÈLE PRISMA `SiteRoute` (~3h)

### Schema

```prisma
enum SiteRouteType {
  static              // page.tsx statique sans paramètre
  dynamic_template    // page.tsx avec [param] non résolu
  dynamic_db          // page.tsx avec [param] résolu depuis DB
  dynamic_filesystem  // page.tsx avec [param] résolu depuis filesystem
  api                 // route handler /api/**
  server_action       // Server Action (référence)
}

enum SiteRouteStatus {
  live               // accessible, 200 OK
  draft              // existe en DB mais pas publié
  preview            // accessible avec auth uniquement
  not_found          // 404
  redirect           // 301/302
  error              // 500
  unknown            // pas encore checké
}

enum SiteRouteVisibility {
  public             // accessible visiteurs (SEULE valeur scannée et cataloguée)
  // ⚠️ Les valeurs 'admin' et 'api_only' sont volontairement OMISES :
  // le Site Explorer NE catalogue PAS les pages admin ni API.
  // Si un dev tente de scanner une route admin, le scanner DOIT la SKIP.
}

model SiteRoute {
  id              String              @id @default(cuid())
  pathPattern     String              // "/fr/blog/[slug]" (template)
  pathRendered    String?             // "/fr/blog/audit-ia-paris-2026" (résolu)
  pathSlug        String?             // "audit-ia-paris-2026" (slug seul si dynamique)

  type            SiteRouteType
  status          SiteRouteStatus     @default(unknown)
  visibility      SiteRouteVisibility

  source          String              // 'filesystem' | 'prisma:articles' | 'prisma:case_studies' | 'prisma:defined_terms' | ...
  filePath        String?             // "src/app/[locale]/blog/[slug]/page.tsx"

  // Hiérarchie
  parentRouteId   String?
  parentRoute     SiteRoute?          @relation("RouteHierarchy", fields: [parentRouteId], references: [id])
  childRoutes     SiteRoute[]         @relation("RouteHierarchy")
  depth           Int                 @default(0) // profondeur dans l'arborescence

  // Contexte business
  section         String?             // "blog" | "audits" | "glossaire" | "admin" | etc.
  verticales      String[]            @default([])
  cityIds         String[]            @default([])

  // Metadata inspection (rafraîchi par worker)
  httpStatus      Int?                // 200 / 404 / etc.
  metaTitle       String?             @db.VarChar(500)
  metaDescription String?             @db.Text
  h1              String?             @db.VarChar(500)
  wordCount       Int?
  jsonLdCount     Int?
  internalLinkCount Int?
  externalLinkCount Int?
  hasAiDisclaimer Boolean?
  lastModifiedAt  DateTime?
  lastInspectedAt DateTime?

  // Lighthouse (optionnel, cron weekly)
  lighthousePerf  Int?                // 0-100
  lighthouseSeo   Int?
  lighthouseA11y  Int?
  lighthouseBP    Int?
  lighthouseRunAt DateTime?

  // Édition
  editable        Boolean             @default(false) // true si page DB-driven
  editorRoute     String?             // path admin pour éditer (ex: /[adminPrefix]/content-gen/articles/[id])
  sourceDbTable   String?             // "articles" si page DB
  sourceDbId      String?             // id row DB si page DB

  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@unique([pathPattern, pathSlug])
  @@index([type])
  @@index([status])
  @@index([section])
  @@index([visibility])
  @@index([depth])
  @@map("site_routes")
}
```

### Migration

`prisma/migrations/20260522170000_add_site_routes_explorer/migration.sql`

### Tests Vitest
- `site-route-model.test.ts` : 6 tests

### Commit
```
feat(admin): site explorer — Phase A — modèle Prisma SiteRoute

- Model avec hiérarchie parent/childs
- Type (static/dynamic_template/dynamic_db/dynamic_filesystem/api/server_action)
- Status (live/draft/preview/not_found/redirect/error/unknown)
- Visibility (public/admin/api_only)
- Metadata inspection (status, meta, h1, word count, JSON-LD, liens, Lighthouse)
- Édition (editable + editorRoute pour pages DB)
- Migration additive
- 6 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 3. PHASE B — SCANNER ROUTES SCRIPT (~5h)

### Script `src/scripts/scan-site-routes.ts`

Algorithme avec **EXCLUSIONS STRICTES** (uniquement URLs publiques visiteurs) :

```
1. SCAN FILESYSTEM (UNIQUEMENT ROUTES PUBLIQUES)
   - Glob `src/app/**/page.tsx`
   - Pour chaque path filesystem :
     - 🚫 SKIP si chemin contient `(admin)` (groupe Next.js admin)
     - 🚫 SKIP si chemin contient `[adminPrefix]` (groupe avec prefix admin)
     - 🚫 SKIP si chemin contient `(auth)` (groupe auth NextAuth)
     - 🚫 SKIP si chemin contient `_next` ou commence par `_`
     - 🚫 SKIP les routes utilitaires : `/sitemap.xml`, `/robots.txt`, `/favicon.ico`, `/manifest.json`, `/.well-known/**`
     - ✅ TOUS LES AUTRES → analyser
     - Construire `pathPattern` depuis le chemin (ex: src/app/[locale]/blog/[slug]/page.tsx → /[locale]/blog/[slug])
     - Détecter si paramétré (présence de [param])
     - Si statique (aucun [param]) → type='static', visibility='public'
     - Si paramétré → type='dynamic_template' (résolu en étape 2), visibility='public'
   - Construire hiérarchie : parent = path moins 1 segment
   - Upsert dans `SiteRoute` table

2. RÉSOLUTION DYNAMIQUE DB (UNIQUEMENT CONTENUS PUBLIÉS)
   - Pour chaque `dynamic_template` :
     - Identifier la source DB associée selon le path :
       - /blog/[slug] → table `articles` WHERE publish_status IN ('published', 'tier_1', 'tier_2') AND deleted_at IS NULL
       - /cas-concrets/[slug] → table `case_studies` WHERE published=true
       - /guides/[slug] → table `guides` WHERE published=true
       - /glossaire/[term] → table `defined_terms` WHERE published=true
       - /presse/[slug] → table `press_articles` WHERE published=true
       - /stack-ia/[tool] → table `stack_ia_tools` WHERE active=true
       - /audits/[ville] etc → liste villes pilote (39) ou top 200 si Sprint Perfection 2026 livré
       - /implantations/[ville] → liste villes
       - /galerie/[slug] → table `image_assets` WHERE is_public=true AND deleted_at IS NULL
       - /equipe/[slug] → table `team_members` WHERE active=true
     - 🚫 EXCLURE les rows : draft, archivé, deleted, quarantained, awaiting_review (sauf 'tier_2' qui est visible noindex)
     - Pour chaque row publique : créer SiteRoute avec type='dynamic_db', pathRendered + pathSlug + sourceDbTable + sourceDbId + editable=true, visibility='public'

3. RÉSOLUTION FILESYSTEM
   - Si pages utilisent helpers TS (ex: economic-data/<slug>.ts) :
     - Glob `src/data/villes/economic-data/*.ts` → liste slugs villes
     - Créer SiteRoute dynamic_filesystem, visibility='public'

4. 🚫 NE PAS SCANNER LES API ROUTES
   - Le scan saute volontairement `src/app/**/route.ts`
   - Le scan saute volontairement `src/app/**/actions.ts`
   - Raison : exclusions §0 Mission — uniquement URLs publiques visiteurs

5. VÉRIFICATION FINALE (safety net)
   - AVANT upsert : si pathPattern contient `/admin`, `/api`, `_next` ou `(admin)` → ❌ REJECT + log warning
   - 0 row admin/api ne doit apparaître dans `SiteRoute` table

6. STATS FINALES
   - Count total : X routes publiques uniquement
   - Par type : static / dynamic_db / dynamic_template / dynamic_filesystem
   - Par status : live / draft / not_found / unknown
   - ⚠️ visibility est TOUJOURS 'public' (l'enum n'a que cette valeur)
```

### Test de non-régression critique
```typescript
// Le scan ne doit JAMAIS créer de SiteRoute avec un path admin/api
test('scanner ne catalogue pas les routes admin', async () => {
  await runScanner();
  const adminRoutes = await prisma.siteRoute.findMany({
    where: {
      OR: [
        { pathPattern: { contains: '(admin)' } },
        { pathPattern: { contains: '[adminPrefix]' } },
        { pathPattern: { contains: '/api/' } },
        { pathPattern: { contains: '_next' } },
      ]
    }
  });
  expect(adminRoutes.length).toBe(0);
});
```

### Commande

```powershell
pnpm tsx src/scripts/scan-site-routes.ts
```

Idempotent : upsert by `(pathPattern, pathSlug)`.

### Durée d'exécution attendue
- ~50 routes statiques
- ~5000-10000 routes dynamiques DB (selon volume articles)
- Total : 1-3 minutes

### Tests
- `scan-site-routes.test.ts` : 8 tests (filesystem scan, DB resolution, hierarchy construction)

### Commit
```
feat(admin): site explorer — Phase B — scanner routes filesystem + DB

- Script src/scripts/scan-site-routes.ts
- Scan filesystem src/app/**/page.tsx
- Résolution dynamic_db pour /blog/[slug], /cas-concrets/[slug], etc.
- Résolution dynamic_filesystem pour /economic-data/[slug]
- Scan API routes
- Construction hiérarchie parent/childs
- Upsert idempotent
- 8 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 4. PHASE C — WORKER INSPECTION (~5h)

### Worker `site-route-inspector-worker.ts`

Cron daily 02:00 UTC OU déclenchement manuel admin.

```typescript
// Pour chaque SiteRoute avec status NOT in ('draft') :
//   - HEAD request → update httpStatus
//   - Si 200 : GET request, parse HTML
//   - Extract :
//     - <title> → metaTitle
//     - <meta name="description"> → metaDescription
//     - <h1>première occurrence → h1
//     - Count mots dans <article> ou <main> → wordCount
//     - Count <script type="application/ld+json"> → jsonLdCount
//     - Count <a href="/..."> (internal links)
//     - Count <a href="https://"> (external links non axion-ia.com)
//     - Présence <AiContentDisclaimer> ou wording "Cet article a été rédigé avec l'assistance de l'IA"
//   - Update SiteRoute row
//
// Rate limit : 30 inspections/min
// Log progression
```

### Cron config
- `0 2 * * *` (daily 2h UTC)
- BullMQ Repeatable Job

### Tests
- `site-route-inspector.test.ts` : 8 tests

### Commit
```
feat(admin): site explorer — Phase C — worker inspection daily

- src/server/queue/workers/site-route-inspector-worker.ts
- Cron daily 2h UTC
- HEAD + GET parsing extraction (title, description, H1, word count, JSON-LD, liens, AiDisclaimer)
- Rate limit 30/min
- 8 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 5. PHASE D — CONSOLE ADMIN SITE EXPLORER (~10h)

### Nouvelle page `/[adminPrefix]/site-explorer/`

Server Component principal.

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ SITE EXPLORER — XXXX URLs publiques (admin & API exclus)    │
│                                                             │
│ Stats : XX statiques | XX dynamiques DB | XX 404            │
│                                                             │
│ ┌─ Filtres ──────────────────────────────────────────────┐│
│ │ Type [tous ▾]  Section [tous ▾]  Status [tous ▾]      ││
│ │ Verticale [tous ▾]  Ville [tous ▾]                     ││
│ │ [🔍 Recherche path ou title...]                        ││
│ │ [☐ Afficher uniquement les anomalies]                  ││
│ └────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─ Vue [Liste] [Tree] [Graph] ──────────────────────────┐│
│ │                                                        ││
│ │ TREE VIEW (par défaut) — UNIQUEMENT pages publiques : ││
│ │                                                        ││
│ │ ▼ /fr                                        [Live]   ││
│ │   ├─ / (home)                                [Live] 🔍││
│ │   ├─ /audits (hub vertical)                  [Live] 🔍││
│ │   │  ├─ /audits/paris                  ✏️ [Live] 🔍   ││
│ │   │  ├─ /audits/lyon                   ✏️ [Live] 🔍   ││
│ │   │  └─ ... (39 villes pilote)                       ││
│ │   ├─ /blog (hub blog)                        [Live] 🔍││
│ │   │  ├─ /blog/audit-ia-paris-2026   ✏️ [Live] 🔍      ││
│ │   │  ├─ /blog/formation-ia-pme      ✏️ [Live] 🔍      ││
│ │   │  └─ ... (3 412 articles publiés)                  ││
│ │   ├─ /interventions-formations               [Live] 🔍││
│ │   ├─ /un-a-un                                [Live] 🔍││
│ │   ├─ /implementations                        [Live] 🔍││
│ │   ├─ /sites-web-augmentes                    [Live] 🔍││
│ │   ├─ /glossaire (60 termes)                  [Live]   ││
│ │   │  └─ /glossaire/[term] × 60         ✏️ [Live]      ││
│ │   ├─ /cas-concrets                           [Live]   ││
│ │   ├─ /guides                                 [Live]   ││
│ │   ├─ /presse                                 [Live]   ││
│ │   ├─ /galerie (image-bank)                   [Live]   ││
│ │   ├─ /stack-ia                               [Live]   ││
│ │   ├─ /codage-developpement                   [Live]   ││
│ │   ├─ /contact                                [Live] 🔍││
│ │   ├─ /booking                                [Live] 🔍││
│ │   ├─ /faq                                    [Live] 🔍││
│ │   ├─ /mentions-legales                       [Live]   ││
│ │   ├─ /cgv, /rgpd, /transparence              [Live]   ││
│ │   └─ ... 50 pages statiques publiques                ││
│ │                                                        ││
│ │ ❌ Pages admin /[adminPrefix]/* : NON listées         ││
│ │ ❌ Routes API /api/* : NON listées                    ││
│ │ ❌ Routes auth NextAuth : NON listées                  ││
│ │                                                        ││
│ └────────────────────────────────────────────────────────┘│
│                                                             │
│ Pagination : 1 2 3 ... 50 →                                │
└─────────────────────────────────────────────────────────────┘
```

⚠️ **Pas de filtre "visibility"** dans l'UI puisque tout est public par construction. Si visibility autre que 'public' apparaît dans la DB (bug), c'est une anomalie à fixer.

#### Composants à créer

- `src/components/admin/site-explorer/SiteExplorerLayout.tsx`
- `src/components/admin/site-explorer/SiteExplorerFilters.tsx` (client, URL params)
- `src/components/admin/site-explorer/SiteExplorerStats.tsx` (compteurs globaux)
- `src/components/admin/site-explorer/SiteExplorerTree.tsx` (tree view collapsible)
- `src/components/admin/site-explorer/SiteExplorerList.tsx` (vue liste paginée)
- `src/components/admin/site-explorer/SiteRouteRow.tsx` (row réutilisable)
- `src/components/admin/site-explorer/SiteRouteInspector.tsx` (overlay détails)

#### Actions par ligne URL
- 🔍 **Inspecter** : ouvre overlay avec métadonnées (HTTP status, meta, H1, word count, JSON-LD, liens, Lighthouse)
- 🌐 **Preview** : ouvre URL dans nouvel onglet (`target="_blank"`)
- ✏️ **Éditer** : SI page DB (`editable=true`) → redirige vers `editorRoute`. SI statique → désactivé + tooltip "Page statique, éditer le code source"
- 🔄 **Re-inspecter** : trigger manual inspection de cette URL
- 📋 **Copier URL** : clipboard

### Server Actions

- `src/server/site-explorer/admin/site-routes.ts`
  - `listSiteRoutes(filters)`
  - `getSiteRouteDetail(id)`
  - `triggerInspection(id)` : enqueue job worker pour 1 URL
  - `triggerScanAll()` : lance scan-site-routes.ts (admin uniquement)

### Vue Graph SVG (optionnel)

Composant `SiteExplorerGraph.tsx` qui utilise `react-flow` ou `vis-network` pour afficher graphe networking entre pages :
- Noeuds = URLs
- Arêtes = liens internes
- Densité couleur = trafic ou wordCount
- Click noeud = ouvre détail

**Skip si effort > 5h supplémentaire** — fallback Tree view seul.

### Sidebar admin entry

Ajouter "Site Explorer" dans section 📊 Suivi (cohérent D-P5-6) :
```
📊 Suivi
  ├─ Jobs
  ├─ Articles
  ├─ Cities
  ├─ Provenance
  └─ 🆕 Site Explorer  [XXXX]
```

### Tests
- `site-explorer-pages.test.tsx` : 10 tests RTL
- `site-explorer-actions.test.ts` : 8 tests server actions

### Commit
```
feat(admin): site explorer — Phase D — console admin tree + filtres + inspection

- Page /[adminPrefix]/site-explorer/
- 7 composants admin (layout, filters, stats, tree, list, row, inspector)
- 4 server actions (list, detail, triggerInspection, triggerScanAll)
- Sidebar entry "Site Explorer"
- 18 vitest tests (10 RTL + 8 server)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. PHASE E — ÉDITION INLINE PAGES DB (~6h)

### Pages éditables

Pour les SiteRoute avec `editable=true` (pages DB-driven) :

| Type page | Table source | Editor route admin |
|---|---|---|
| `/blog/[slug]` | `articles` | `/[adminPrefix]/content-gen/articles/[id]/edit` |
| `/cas-concrets/[slug]` | `case_studies` | `/[adminPrefix]/case-studies/[id]/edit` |
| `/glossaire/[term]` | `defined_terms` | `/[adminPrefix]/glossary/[id]/edit` |
| `/presse/[slug]` | `press_articles` | `/[adminPrefix]/press/[id]/edit` |
| `/stack-ia/[tool]` | `stack_ia_tools` | `/[adminPrefix]/stack-ia/[id]/edit` |
| `/equipe/[slug]` | `team_members` | `/[adminPrefix]/team/[id]/edit` |

### Editor inline (pour articles uniquement, déjà partiellement existant via P5 review)

Étendre `/[adminPrefix]/content-gen/articles/[id]/edit/page.tsx` :
- Formulaire édition champs principaux : title, metaTitle, metaDescription, bodyHtml (markdown editor TipTap ou similaire), heroImageId, status, tags
- Validation Zod côté serveur
- Server Action `updateArticle(id, input)` avec audit trail SOC2
- Re-publication auto post-edit (regen JSON-LD, IndexNow ping)
- Preview avant submit ("Voir comme visiteur")

### Pages statiques (non-éditables)

Pour SiteRoute avec `type='static'` :
- Bouton "✏️ Éditer" désactivé
- Tooltip : "Page statique, modifier le code source : src/app/.../page.tsx"
- Lien GitHub : `https://github.com/will383842/axion-ia/blob/main/<filePath>`

### Tests
- `article-inline-edit.test.tsx` : 8 tests

### Commit
```
feat(admin): site explorer — Phase E — édition inline pages DB

- Editor inline articles (extension existant content-gen/articles/[id]/edit)
- Server action updateArticle avec audit SOC2 + regen JSON-LD + IndexNow ping
- Pages statiques : bouton désactivé + lien GitHub source
- 8 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. PHASE F — DÉTECTION ANOMALIES (~3h)

### Worker `site-route-anomaly-detector.ts`

Cron daily 03:00 UTC, après l'inspection worker.

Détecter :
- 🔴 **404** : pages avec `httpStatus=404`
- 🟠 **metaTitle dupliqués** : 2+ pages avec même metaTitle
- 🟠 **metaDescription dupliquées** : 2+ pages avec même description
- 🟠 **H1 dupliqués** : 2+ pages avec même H1
- 🟠 **Pages orphelines** : pages sans liens internes entrants (`internalLinkCount=0` pondéré inverse)
- 🟠 **Pages thin content** : `wordCount < 300` sur pages publiques
- 🟠 **Pages sans JSON-LD** : `jsonLdCount=0` sur pages article
- 🟠 **AiDisclaimer absent** : `hasAiDisclaimer=false` sur pages AI-générées
- 🟡 **Pages sans liens externes** : `externalLinkCount<2` sur articles publiés

Insérer dans table `SiteRouteAnomaly` (à créer aussi).

### Modèle

```prisma
model SiteRouteAnomaly {
  id              String   @id @default(cuid())
  siteRouteId     String
  siteRoute       SiteRoute @relation(fields: [siteRouteId], references: [id], onDelete: Cascade)
  type            String   // '404' | 'duplicate_meta_title' | 'orphan_page' | 'thin_content' | 'no_jsonld' | 'no_ai_disclaimer' | 'no_external_links'
  severity        String   // 'high' | 'medium' | 'low'
  description     String   @db.Text
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?

  @@index([siteRouteId])
  @@index([type])
  @@index([severity])
  @@map("site_route_anomalies")
}
```

### Page admin `/[adminPrefix]/site-explorer/anomalies`
- Liste anomalies par sévérité
- Filtre par type
- Action "Résoudre" (marque resolvedAt)
- Compteur badge sidebar si > 0 anomalies high severity

### Tests
- `anomaly-detector.test.ts` : 10 tests

### Commit
```
feat(admin): site explorer — Phase F — détection anomalies daily

- Worker site-route-anomaly-detector (cron daily 3h UTC)
- 9 types anomalies (404, metaTitle dup, orphan, thin content, no JSON-LD, etc.)
- Model SiteRouteAnomaly Prisma
- Page admin /site-explorer/anomalies
- 10 vitest tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. PHASE G — LIGHTHOUSE INTÉGRATION (~3h, OPTIONNEL)

Si effort > 30h cumulés, skipper et reporter Sprint S+8.

### Worker `site-route-lighthouse-worker.ts`

Cron weekly Sunday 04:00 UTC.

- Top 20 URLs prioritaires (par trafic GSC ou wordCount élevé)
- Pour chaque : `npx lighthouse` headless
- Stocker scores dans `SiteRoute.lighthousePerf/Seo/A11y/BP`
- Alerte Telegram si chute > 10 pts sur 1 URL

### Badge UI

Dans SiteExplorerRow : afficher badge Lighthouse score (vert ≥ 90, orange 70-89, rouge < 70).

### Tests
- `site-lighthouse.test.ts` : 5 tests

### Commit (si livré)
```
feat(admin): site explorer — Phase G — Lighthouse integration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 9. ZONES INTERDITES

- ❌ `prisma/seeds/villes/copy/*.ts` (Manon)
- ❌ `prisma/seeds/image-bank/seed-images.ts` (Manon)
- ❌ Décisions Will Wikidata, DPA, CF WAF, toggle auto/manuel publication
- ❌ Modifier les autres modèles Prisma sans nécessité (juste ajouter SiteRoute + SiteRouteAnomaly)

---

## 10. LIVRABLES OBLIGATOIRES

### Verdict sprint
`_AUDIT/SITE-EXPLORER-2026-05-22/VERDICT-SPRINT-SITE-EXPLORER.md`

```markdown
# VERDICT SPRINT SITE EXPLORER ADMIN
## Date livraison : YYYY-MM-DD
## HEAD post-sprint : <SHA>
## Effort réel : XXh

## 7 phases livrées
| Phase | Description | Statut |

## Métriques d'impact
- Total SiteRoute en base : XXXX
- Par type : ...
- Par status : ...
- Anomalies détectées : XX (XX high / XX medium / XX low)
- Pages éditables inline : XXXX

## Migrations Prisma
- 20260522170000_add_site_routes_explorer
- 20260522170500_add_site_route_anomalies

## Workers créés
- site-route-inspector-worker (daily 2h UTC)
- site-route-anomaly-detector (daily 3h UTC)
- (optionnel) site-route-lighthouse-worker (weekly Sunday 4h UTC)

## Pages admin créées
- /[adminPrefix]/site-explorer/ (tree + filtres + inspection)
- /[adminPrefix]/site-explorer/anomalies (liste anomalies)
- /[adminPrefix]/site-explorer/[id] (détail route)

## Tests Vitest
- Phase A : 6 tests
- Phase B : 8 tests
- Phase C : 8 tests
- Phase D : 18 tests
- Phase E : 8 tests
- Phase F : 10 tests
- (Phase G : 5 tests)
- TOTAL : ~58 nouveaux tests

## Gates anti-régression
- typecheck ✅
- lint ✅
- vitest XXXX/XXXX
- isolation-check ✅
- prisma migrate status ✅

## Actions Will post-sprint
1. Lancer scan initial : `pnpm tsx src/scripts/scan-site-routes.ts` (~3 min)
2. Trigger première inspection complète : 30 min (rate-limited 30/min)
3. Review anomalies détectées : 1h
4. Tester édition inline sur 1 article
5. (optionnel) Activer worker Lighthouse Phase G

## UNKNOWNs résiduels
- ...
```

### Mémoire
Slug : `axionia_sprint_site_explorer_admin_livre_2026-05-22`

### MEMORY.md
```
- [🟢 AxionIA Sprint Site Explorer Admin LIVRÉ 2026-05-22 — XXXX URLs cataloguées](axionia_sprint_site_explorer_admin_livre_2026-05-22.md) — Console admin /site-explorer avec tree view + filtres + inspection daily + détection anomalies (404/duplicates/orphans/thin/no JSON-LD/no AiDisclaimer) + édition inline pages DB + Lighthouse scores hebdo. 58 tests, 2 migrations.
```

---

## 11. STOP & ASK FINAL

```
✅ Sprint Site Explorer Admin livré.

📊 Métriques :
- XXXX URLs cataloguées
- XX statiques + XX dynamiques DB + XX templates
- XX anomalies détectées (XX high)
- XXXX pages éditables inline
- Worker inspection daily actif
- Console admin /site-explorer opérationnelle

🚨 Actions Will post-sprint :
1. pnpm tsx src/scripts/scan-site-routes.ts (initial scan)
2. Review anomalies détectées admin
3. Tester édition 1 article inline

🚀 Suite :
[A] Activation immédiate workers daily
[B] Activation Phase G Lighthouse hebdo
[C] Continuer pipeline audits finaux
```

---

## 12. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance le sprint Site Explorer Admin décrit dans `_AUDIT/PROMPT-SPRINT-SITE-EXPLORER-ADMIN-2026-05-22.md`. Mode IMPLEMENTATION (commits incrémentaux + push autorisés). Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7 société française pure) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. **RÈGLE STRICTE OBJECTIVE : le Site Explorer catalogue UNIQUEMENT les URLs publiques visibles par les visiteurs réels du site. EXCLUSIONS ABSOLUES du scan/catalogue/UI : routes admin (`(admin)`, `[adminPrefix]`), routes API (`src/app/**/route.ts`), Server Actions, routes auth NextAuth, routes utilitaires (`_next`, `sitemap.xml`, `robots.txt`, `.well-known`). Le scanner DOIT skip ces routes dès le filesystem scan, et un test de non-régression vérifie que 0 row admin/api n'apparaît dans SiteRoute table.** Lire EN PREMIER axionia_decisions_will_final_2026-05-21 + axionia_p5_decisions_canoniques_2026-05-21. Exécuter 7 phases séquentielles : Phase A modèle Prisma SiteRoute (enum SiteRouteVisibility avec UNIQUEMENT 'public' valeur — admin/api_only omis volontairement) + SiteRouteAnomaly + migration → Phase B script scan-site-routes filesystem AVEC EXCLUSIONS STRICTES (skip `(admin)`/`[adminPrefix]`/`(auth)`/`_next`/`sitemap.xml`/`robots.txt`/`.well-known`) + résolution DB UNIQUEMENT contenus PUBLIÉS (articles WHERE publish_status IN published/tier_1/tier_2 AND deleted_at IS NULL, case-studies/guides/glossaire/press WHERE published=true, image-bank WHERE is_public=true) + 🚫 PAS de scan API routes ni Server Actions + safety net AVANT upsert rejette tout pathPattern contenant `/admin`/`/api`/`_next`/`(admin)` → Phase C worker site-route-inspector-worker daily 2h UTC (HEAD+GET parse meta+H1+wordCount+JSON-LD+liens+AiDisclaimer rate-limited 30/min, UNIQUEMENT routes publiques) → Phase D console admin /[adminPrefix]/site-explorer avec tree view collapsible montrant UNIQUEMENT routes publiques (pas de filtre visibility puisque tout est public par construction) + filtres URL params + 4 server actions (list/detail/triggerInspection/triggerScanAll) + 7 composants admin → Phase E édition inline pages DB (articles/case-studies/glossaire/presse/stack-ia/equipe) avec audit SOC2 + regen JSON-LD + IndexNow ping post-edit + pages statiques bouton désactivé + lien GitHub → Phase F worker site-route-anomaly-detector daily 3h UTC (9 types anomalies sur routes publiques uniquement) + page admin /site-explorer/anomalies → Phase G (optionnel si effort < 30h cumulés) worker Lighthouse weekly Sunday 4h UTC top 20 URLs publiques + badges UI. Convergence Manon (git pull --rebase avant push). Gates verts obligatoires (typecheck/lint/vitest/isolation-check/prisma validate). Test critique de non-régression : `expect(adminRoutes.length).toBe(0)` après scan. Self-troubleshoot toutes erreurs. Termine par VERDICT-SPRINT-SITE-EXPLORER.md + mémoire axionia_sprint_site_explorer_admin_livre_2026-05-22 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec métriques + 3 options [A/B/C]. Go.
```

---

## 13. QUAND LANCER

⏳ **À lancer APRÈS** :
- Sprint P5 console admin livré (acquis 2026-05-21, sprint 593/1000)
- Sprint Perfection 2026 Finalisation livré (Cities DB 2100 + KB 4 verticales) — utile pour avoir les vraies villes en DB

⏳ **À lancer AVANT** :
- Audits finaux (mega-audit final pré-prod + admin raccordement + E2E flows) — pour qu'ils auditent un site avec Site Explorer présent

OU peut être lancé indépendamment en parallèle des autres sprints (zones distinctes).

---

*Sprint Site Explorer Admin — 25-35h Sonnet 4.6 autopilot — IMPLEMENTATION — Catalogue exhaustif URLs + tree view + inspection + édition inline pages DB*
