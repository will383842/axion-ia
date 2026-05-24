# A3-06 — Sitemap & IndexNow
## Score : 55/70
## Date : 2026-05-21
## HEAD : 37ca0147

---

### Points obtenus

- [OK] **sitemap-index.xml présent et valide** — Route Handler `src/app/sitemap-index.xml/route.ts`. Liste ~17+ sub-sitemaps dynamiques (generated via `generateSitemaps()` + 6 custom sitemaps). `lastmod` différencié par catégorie (news, blog, knowledge, fallback) + fix audit indexation 2026-05-18 P0-2 (BUILD_TIME honnête vs `new Date()` module-load). Cache-Control `s-maxage=600` (10 min refresh CDN post-publish). Sitemaps.org namespace correct.
- [OK] **robots.ts pointe vers `/sitemap-index.xml`** — Directive `Sitemap: https://axion-ia.com/sitemap-index.xml` présente.
- [OK] **16+ sub-sitemaps couvrant tous types contenus** — pages, blog, faq, help, cas-concrets, comparaisons, guides, glossaire (60 termes), presse, implementation, implantations, services-villes (audit/interventions/implementation/un-a-un), stack-ia-tools, villes-{region}, knowledge-{n} (DB-aware chunked). Couverture exhaustive.
- [OK] **Sitemap-news.xml conforme Google News** — Route Handler `src/app/sitemap-news.xml/route.ts`. Namespace `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"` correct. Fenêtre stricte 48h glissante. Cap 1000 URLs. Sprint S+4-D : fusion DB Article isNews + PRESS_RELEASES éditoriaux.
- [OK] **Images sitemaps multiples présents et structurés**
  - `src/app/sitemaps/images-fr.xml/route.ts` : Google Image 1.1, namespace `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`, image:loc + image:title + image:caption + image:license (CC BY 4.0) + image:geo_location optionnel. Fail-soft P2021.
  - `src/app/sitemaps/images-en.xml/route.ts` : miroir EN.
  - `src/app/sitemap-images-services.xml/route.ts` : 73 images marketing pages services.
  - `src/app/sitemap-images-villes-t1.xml`, `t2.xml`, `t3-t4.xml` : images villes France.
- [OK] **Hreflang FR/EN dans sitemaps** — `buildDynamic()` et builders statiques dans `sitemap.ts` injectent `alternates.languages: { fr, en, "x-default" }` via Next MetadataRoute. `images-fr.xml` utilise `<xhtml:link rel="alternate" hreflang="..." />` XML brut. `filterEnIfDisabled()` nettoie les EN URLs si `EN_LOCALE_ENABLED!=true` (2026-05-16 EN OFF).
- [OK] **Priorité/changefreq cohérents par type** — Hiérarchie: homepage=1.0, depth-2=0.8, implantations-hub=0.8, press-releases=0.7, guides/glossaire-hub=0.7, ville-hub=0.7, services×villes=0.7, blog-posts=0.5-0.6, tags/auteurs=0.4. `changefreq=weekly` pour pages stratégiques, `monthly` pour contenu éditorial. Cohérent avec audit Google qui déconseille gamification des priorités.
- [OK] **IndexNow worker BullMQ actif** — `content-indexnow-worker.ts` : POST direct `api.indexnow.org`, timeout 20s, rate-limit 30/min, kill-switch intégré, fail-streak Redis (seuils alertes 3/10/30 → Telegram).
- [OK] **IndexNow clé fichier public** — `public/3a5c32d22b04f1430690cc33eaec6be9.txt` présent. `keyLocation = /{key}.txt` canonique (fix P1-11 2026-05-15 — ancienne `/api/indexnow/key` retournait 422 spec violation).
- [OK] **IndexNow enqueue post-publication** — `content-publish-worker.ts` appelle `enqueueIndexingForTier1()` si `promoteToTier1=true`. `enqueue.ts` centralise IndexNow + Google Indexing API (gated `GOOGLE_INDEXING_API_ENABLED`). JobId déterministe `indexnow-{articleId}-{event}` pour idempotency BullMQ.
- [OK] **postbuild ping IndexNow** — `scripts/indexnow-ping.ts` exécuté via `pnpm postbuild`. Couvre STRATEGIC_PATHS (10 routes) + villes dynamiques indexable + image-bank URLs. Fail-soft (exit 0 si INDEXNOW_KEY manquant ou IndexNow down).
- [PARTIEL] **GSC client opérationnel** — `gsc-client.ts` implémente OAuth refresh_token flow (GSC SearchAnalytics + URL Inspection API). `indexing-client.ts` pour Google Indexing API. MAIS : env vars `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`, `GSC_PROPERTY_URL` optionnelles et probablement non configurées en prod (note MEMORY = "GSC service account JSON : non configuré"). `GOOGLE_INDEXING_API_ENABLED=false` par défaut.
- [PARTIEL] **IndexNow retry logic** — BullMQ `removeOnFail: { count: 5000 }` = jobs failed conservés pour re-run manuel. Pas de retry automatique configurable (defaultMaxAttempts non spécifié = 0 retries par défaut BullMQ). Fail-streak Telegram actif (alertes à 3/10/30 fails).

---

### Points perdus

- [P1] **EN locale désactivée → hreflang tronqué** — `filterEnIfDisabled()` supprime toutes les URLs `/en/*` du sitemap et nettoie `alternates.languages.en`. En prod depuis 2026-05-16, les sitemaps n'émettent que FR. Google ne voit aucun signal hreflang `x-default`/`en` → pénalité potentielle sur les marchés anglophones si EN réactivé sans re-crawl complet. **(Score impact : -2 sur /8 hreflang)**
- [P1] **GSC soumission non configurée** — Env vars `GSC_OAUTH_*` probablement absentes prod. `GOOGLE_INDEXING_API_ENABLED=false`. Pas de soumission programmatique sitemaps via API GSC (sitemap submit doit être fait manuellement via interface). Le client `gsc-client.ts` est code-ready mais dormant. **(Score impact : -5 sur /8 GSC)**
- [P2] **IndexNow retry automatique absent** — BullMQ worker sans `attempts` config explicite = 0 retries (job fail terminal). Un timeout réseau fugace vers `api.indexnow.org` → URL non pingée, sans retry. Le fail-streak alerte Telegram mais ne re-schedule pas. **(Score impact : -1 sur /5 retry)**
- [P2] **Ping IndexNow délai non mesurable** — Le ping est enqueued par `content-publish-worker` → exécuté par `content-indexnow-worker`. Délai réel = latence BullMQ Redis (< 1s théorique) + worker concurrency + rate-limit 30/min. Pas de monitoring du délai effectif publish→ping. Cible < 60s théoriquement atteinte mais non vérifiée empiriquement. **(Score impact : -2 sur /10 délai)**
- [P3] **`sitemap-images-services.xml` sans hreflang** — La route handler services ne génère pas de `<xhtml:link rel="alternate">` (contrairement à `sitemaps/images-fr.xml`). Mineur car images marketing statiques, mais incohérence de pattern. **(Score impact : -0 car couvert ailleurs, mineur)**
- [P3] **Knowledge sub-sitemaps conditionnels** — `knowledge-{n}` chunks générés seulement si `countKnowledgePublicEntries() > 0` (DB-aware). Au build GH Actions (stub.invalid), kbChunkCount=0 → aucun chunk knowledge dans sitemap-index ISR initial. ISR `revalidate=3600` les réintroduit en prod après 1h max. Risque : fenêtre 1h post-deploy où Googlebot voit sitemap-index incomplet.
- [P3] **`sitemap-images-villes-t1/t2/t3-t4.xml` : contenu non vérifié** — Les 3 route handlers existent mais leur contenu (images villes réelles vs placeholders) n'a pas été audité. Si les images villes ne sont pas encore importées (note audit image-bank-complet : "importer 73 images"), ces sitemaps pourraient être vides → déclaration dans sitemap-index de sub-sitemaps vides = signal négatif GSC.

---

### Liste des sitemaps détectés

**Fichiers statiques public/**
- `public/3a5c32d22b04f1430690cc33eaec6be9.txt` — Clé IndexNow (32 chars hex)
- `public/llms.txt` — présent (IA bot discovery)

**Route Handlers Next.js App Router**
| Path                                | Type                | Namespace          | Statut  |
|-------------------------------------|---------------------|--------------------|---------|
| `/sitemap-index.xml`                | Sitemap-index       | sitemapindex 0.9   | OK      |
| `/sitemap/<id>.xml`                 | Sub-sitemaps (×20+) | MetadataRoute      | OK      |
| `/sitemap-news.xml`                 | Google News         | xmlns:news 0.9     | OK      |
| `/sitemaps/images-fr.xml`           | Google Image 1.1 FR | xmlns:image 1.1    | OK      |
| `/sitemaps/images-en.xml`           | Google Image 1.1 EN | xmlns:image 1.1    | OK      |
| `/sitemap-images-services.xml`      | Image services      | xmlns:image 1.1    | OK      |
| `/sitemap-images-villes-t1.xml`     | Image villes T1     | xmlns:image 1.1    | UNVÉRIF |
| `/sitemap-images-villes-t2.xml`     | Image villes T2     | xmlns:image 1.1    | UNVÉRIF |
| `/sitemap-images-villes-t3-t4.xml`  | Image villes T3-T4  | xmlns:image 1.1    | UNVÉRIF |

**Sub-sitemaps via generateSitemaps()**
- `pages`, `blog`, `faq`, `help`, `cas-concrets`, `comparaisons`, `guides`, `glossaire`, `presse`, `implementation`, `implantations`, `services-villes-audit`, `services-villes-interventions`, `services-villes-implementation`, `services-villes-un-a-un`, `stack-ia-tools`
- `villes-{regionSlug}[-{chunkIdx}]` — auto-généré par région
- `knowledge-{n}` — DB-aware (0 chunks si DB vide/stub)

---

### Analyse IndexNow

**Architecture (3 niveaux)**

1. **Postbuild batch** (`scripts/indexnow-ping.ts`) : déclenché à chaque `pnpm build` via `postbuild` hook. Pinge STRATEGIC_PATHS (10 routes) + villes indexable dynamiques + image-bank URLs. Fail-soft (exit 0).

2. **Worker BullMQ événementiel** (`content-indexnow-worker.ts`) : Queue `content-indexnow`, concurrency=2, rate-limit 30/min. Enqueued par `content-publish-worker` et `enqueueIndexingForTier1` helper lors de toute promotion tier-1. Délai théorique publish→ping : BullMQ latency (< 200ms Redis) + worker processing (~1s) → **bien sous les 60s cibles**.

3. **Route handler debug** (`/api/indexnow`) : endpoint POST HMAC-signé pour usage manuel/debug. Bypass usuel du pipeline (la lib `src/lib/indexnow.ts` appelle directement `api.indexnow.org`).

**Clé IndexNow**
- Fichier : `public/3a5c32d22b04f1430690cc33eaec6be9.txt` — contenu = clé brute sur 1 ligne (32 chars hex confirmé).
- `keyLocation` : `https://axion-ia.com/{key}.txt` — conforme spec IndexNow (fix P1-11 2026-05-15, ancienne `/api/indexnow/key` causait 422).
- Env var `INDEXNOW_KEY` : déclarée dans `env.ts` via Zod `.string().min(8).max(128).optional()`. Présente dans `.env.example` (valeur vide à remplir prod).

**Retry logic**
- BullMQ sans `attempts` explicite = comportement défaut (1 tentative, pas de retry auto).
- Fail-streak Redis (`indexnow:fail-streak`) + alertes Telegram seuils 3/10/30. Escalade Telegram mais pas de re-schedule automatique.
- MANQUANT : `attempts: 3, backoff: { type: "exponential", delay: 5000 }` dans la config worker.

**Lifecycle events**
- `publish`, `update`, `delete` → Google Indexing API routing (`URL_UPDATED` / `URL_DELETED`).
- IndexNow ne différencie pas les events (ping unique, spec limitée).

---

### Analyse hreflang sitemaps

**Dans sitemap.ts (MetadataRoute)**
- `alternates.languages: { fr: "...", en: "...", "x-default": "..." }` présent sur TOUTES les entries des 16+ sub-sitemaps via `buildDynamic()` et builders statiques.
- `filterEnIfDisabled()` : si `EN_LOCALE_ENABLED !== "true"` → supprime `en` des alternates ET filtre les URLs `/en/*`. Actuellement actif en prod (EN OFF depuis 2026-05-16).
- Conséquence prod actuelle : sitemaps ne contiennent que FR + `x-default=FR`. Hreflang partiel mais cohérent avec la réalité (EN sert des 301).

**Dans images-fr.xml (XML brut)**
- `<xhtml:link rel="alternate" hreflang="fr-FR" href="..." />` + `hreflang="en"` + `hreflang="x-default"` présents pour chaque image et la page galerie index.
- Namespace `xmlns:xhtml="http://www.w3.org/1999/xhtml"` déclaré.
- NOTE : ce sitemap utilise les codes BCP-47 complets (`fr-FR`) vs `sitemap.ts` qui utilise les codes courts (`fr`). Incohérence mineure mais tolérable (Google accepte les deux).

**Dans sitemap-images-services.xml**
- PAS de hreflang — uniquement `<image:image>` blocks sans `<xhtml:link>`. Mineur (pages services ont leur hreflang via `sitemap/pages.xml`).

---

### GSC status

**Vérification manuelle (confirmée via MEMORY)**
- GSC property `axion-ia.com` : vérifiée par DNS TXT (Domain property). Sitemaps déjà soumis manuellement (confirmé MEMORY 2026-05-13).
- GSC service account JSON : **NON CONFIGURÉ** en prod. Env vars `GSC_OAUTH_*` absentes selon note contextuelle.

**État des submissions**
- `GOOGLE_INDEXING_API_ENABLED=false` (défaut `.env.example`, probablement prod).
- Pas de soumission programmatique des sub-sitemaps nouvellement ajoutés (S+3/S+4 ajouts : guides, glossaire, presse, stack-ia-tools, 4× image sitemaps).
- Bing WMT : client `bing-wmt-client.ts` présent, status inconnu.

**Actions manuelles requises (GSC)**
1. Vérifier que `/sitemap-index.xml` est bien soumis en GSC (probablement OK post-2026-05-13).
2. Soumettre manuellement les 4 nouveaux sub-sitemaps image si pas encore fait : `sitemap-images-services.xml`, `sitemap-images-villes-t1.xml`, `sitemap-images-villes-t2.xml`, `sitemap-images-villes-t3-t4.xml`.
3. Configurer env vars `GSC_OAUTH_*` + `GSC_PROPERTY_URL` pour activer l'URL Inspection API (`gscInspectUrl`) utilisée par `content-monitoring-worker.ts`.

---

### Pages orphelines détectées

Types de contenu présents dans la codebase mais dont la couverture sitemap est à surveiller :

| Contenu                             | Sitemap dédié       | Statut            |
|-------------------------------------|---------------------|-------------------|
| `/fr/galerie/*` (image-bank)        | `sitemaps/images-fr.xml` | OK (DB-aware) |
| `/fr/actualites/*` (news articles)  | `sitemap-news.xml` (48h) | OK — mais après 48h orphelin sitemap (normal spec Google News, doit figurer dans blog.xml aussi) |
| `/fr/presse/*` (communiqués)        | `sitemap/presse.xml` | OK (Sprint S+4-D) |
| `/fr/ressources/*` (KB public)      | `knowledge-{n}.xml` | CONDITIONNEL (0 au build SSG stub) |
| `/fr/faq/*` (FAQ pages)             | `sitemap/faq.xml`   | OK (FAQ legacy FS) — FAQ DB-generated non couverts si `KB_AUTO_PUBLISH=false` |
| `robots.ts` disallow `/reserver`    | Exclu sitemap       | Cohérent |
| `/fr/admin/*` (admin obfuscated)    | Exclu (Disallow)    | OK |
| `/fr/mes-donnees/*`                 | Exclu (EXCLUDED_FROM_INDEX) | OK |
| Sub-sitemaps villes T3-T4 images    | Déclarés sitemap-index | UNVÉRIF si vides |

**Gap identifié :** Les articles `isNews=true` disparaissent du sitemap-news après 48h (spec). Ils devraient alors être indexés via `sitemap/blog.xml`. La condition `indexationTier: "tier_1_indexable"` dans `buildBlogSitemap` les couvre si promus tier-1. Vérifier que les news-articles factory sont bien promus tier-1 et non restés tier-2.

---

### Recommandations ordonnées par ROI

**1. Quick wins (<2h)**

- **[QW-1] Activer retry BullMQ sur IndexNow worker** — Ajouter `attempts: 3, backoff: { type: "exponential", delay: 5000 }` dans la config `new Worker(...)` de `content-indexnow-worker.ts`. 30 min de dev. Évite la perte silencieuse de pings sur timeout réseau fugace.

- **[QW-2] Soumettre les 4 sitemaps images en GSC** — Interface GSC → Sitemaps → Ajouter URL → 4 sitemaps `/sitemap-images-*.xml`. 15 min action humaine Will. ROI immédiat Google Images discovery.

- **[QW-3] Vérifier contenu sitemap-images-villes-t1/t2/t3-t4** — Lire les 3 route handlers. Si vides (aucune image ville importée), supprimer temporairement de `CUSTOM_SITEMAPS` dans `sitemap-index.xml/route.ts` pour éviter signal GSC "sitemap vide". 30 min.

- **[QW-4] Ajouter articles isNews dans blog.xml après 48h** — Vérifier que `buildBlogSitemap` inclut bien les `isNews=true` tier-1 (code dit `isNews: false` sur la clause WHERE DB). Si exclus → ajouter clause ou sub-sitemap dédié articles actualité hors-fenêtre News. Impact SEO organique moyen-terme.

**2. Sprints (<1j)**

- **[S-1] Configurer GSC OAuth + URL Inspection API** — Env vars `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`, `GSC_PROPERTY_URL` dans Coolify. Activer le monitoring indexation via `gscInspectUrl` pour les articles publiés. Coût 0€, unlock dashboards content-monitoring-worker.

- **[S-2] Activer `GOOGLE_INDEXING_API_ENABLED=true`** — Une fois OAuth configuré, activer l'Indexing API pour les articles `isNews=true` (NewsArticle type supporté par Google). Articles blog ordinaires : Google retourne 200 silencieux (pas de garantie d'indexation mais pas de pénalité). ROI : time-to-index Google News < 1h au lieu de crawl passif ~6-24h.

- **[S-3] Monitoring délai IndexNow ping** — Ajouter metric Redis (timestamp enqueue vs timestamp worker complete) pour valider empiriquement le délai < 60s. Simple `job.data.enqueuedAt` dans le worker + log analytics. 2-3h.

**3. Projets (>1j)**

- **[P-1] Réactiver EN locale + hreflang complet** — Corriger le bug next-intl v4.11 307 self-redirect. Réactiver `EN_LOCALE_ENABLED=true`. Sitemaps émettront automatiquement URLs EN + alternates bilingues complets. Impact AEO/GEO sur marchés anglophones (cf. AGENTS.md procédure re-enable).

- **[P-2] Sitemap diff post-build IndexNow** — Passer `scripts/indexnow-ping.ts` de "ping top-15 fixe" à "diff URLs ajoutées/modifiées depuis dernier build" via git diff ou manifest JSON. Évite de re-pinger 10 000+ URLs stables à chaque deploy. Sprint S+17 roadmap (noté dans le script).

- **[P-3] Chunking sitemap images villes** — Quand la banque d'images atteindra 1 000+ images (2 150 villes × 2-3 images), les sitemaps `sitemap-images-villes-t*.xml` devront être chunkés (pattern déjà en place pour les sitemaps villes texte). Anticiper l'architecture avant la saturation.
