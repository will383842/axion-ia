# A1 — Audit Sitemap & Inventaire URLs
**Agent A-1 — Sprint A Ville DRY 2026-05-25**
**Codebase analysée** : `src/app/sitemap.ts` + sous-sitemaps Route Handlers + content files

---

## 1. Architecture Sitemap

### Sitemap-index racine
- **URL** : `/sitemap-index.xml` (Route Handler custom — Next 16 réserve `/sitemap.xml` à la convention metadata)
- **Référencé dans** : `robots.ts` via directive `Sitemap:`
- **Sub-sitemaps générés** : `generateSitemaps()` dans `app/sitemap.ts`
- **Sub-sitemaps custom** : listés manuellement dans `CUSTOM_SITEMAPS` de `sitemap-index.xml/route.ts`

### Sub-sitemaps statiques (17 identifiants)
| ID | Route | Type |
|----|-------|------|
| `pages` | `/sitemap/pages.xml` | Routes statiques (routing.pathnames) |
| `blog` | `/sitemap/blog.xml` | Posts + taxonomies |
| `faq` | `/sitemap/faq.xml` | 40 FAQ items |
| `help` | `/sitemap/help.xml` | 6 articles + 6 catégories |
| `cas-concrets` | `/sitemap/cas-concrets.xml` | 6 études + 5 industries |
| `comparaisons` | `/sitemap/comparaisons.xml` | 3 pages |
| `guides` | `/sitemap/guides.xml` | 1 hub uniquement |
| `glossaire` | `/sitemap/glossaire.xml` | 1 hub + 60 termes |
| `presse` | `/sitemap/presse.xml` | 5 communiqués |
| `implementation` | `/sitemap/implementation.xml` | 8 par-fonction slugs |
| `implantations` | `/sitemap/implantations.xml` | 1 hub + 12 régions |
| `services-villes-audit` | `/sitemap/services-villes-audit.xml` | 39 villes |
| `services-villes-interventions` | `/sitemap/services-villes-interventions.xml` | 39 villes |
| `services-villes-implementation` | `/sitemap/services-villes-implementation.xml` | 39 villes |
| `services-villes-un-a-un` | `/sitemap/services-villes-un-a-un.xml` | 39 villes |
| `stack-ia-tools` | `/sitemap/stack-ia-tools.xml` | 12 outils |

### Sub-sitemaps dynamiques (villes par région)
| Pattern | Logique | Count actuel |
|---------|---------|-------------|
| `villes-<region>` | 1 chunk si villes×2 < 1000 | 12 sub-sitemaps |
| `villes-<region>-<n>` | Chunking auto si > 500 villes indexables/région | 0 chunks supplémentaires |

**Répartition des 39 villes indexables par région :**
- Auvergne-Rhône-Alpes : 6 (grenoble, lyon, saint-etienne, clermont-ferrand, annecy, villeurbanne)
- Île-de-France : 4 (paris, argenteuil, boulogne-billancourt, montreuil)
- Occitanie : 4 (montpellier, toulouse, perpignan, nimes)
- Provence-Alpes-Côte-d'Azur : 4 (marseille, nice, aix-en-provence, toulon)
- Grand-Est : 5 (strasbourg, metz, reims, nancy, mulhouse)
- Hauts-de-France : 2 (lille, amiens)
- Normandie : 3 (rouen, le-havre, caen)
- Nouvelle-Aquitaine : 2 (bordeaux, limoges)
- Pays-de-la-Loire : 3 (nantes, angers, le-mans)
- Bretagne : 2 (rennes, brest)
- Bourgogne-Franche-Comté : 2 (dijon, besancon)
- Centre-Val-de-Loire : 2 (tours, orleans)

### Sub-sitemaps DB-dynamiques (knowledge-N)
- **Logique** : `countKnowledgePublicEntries()` → chunks de 1000 URLs
- **Au build SSG** : 0 chunks (DATABASE_URL=stub.invalid → Proxy retourne 0)
- **En prod runtime** : N chunks selon articles KB `audience=public` + `status=published`

### Sub-sitemaps custom (Route Handlers XML brut)
| URL | Contenu |
|-----|---------|
| `/sitemap-news.xml` | Google News (namespace xmlns:news, fenêtre 48h, max 1000) |
| `/sitemaps/images-fr.xml` | Image Sitemap 1.1 FR (image-bank V1) |
| `/sitemaps/images-en.xml` | Image Sitemap 1.1 EN (image-bank V1) |
| `/sitemap-images-services.xml` | Images marketing services (73 images) |
| `/sitemap-images-villes-t1.xml` | Villes T1 pop ≥ 100K (images) |
| `/sitemap-images-villes-t2.xml` | Villes T2 (images) |
| `/sitemap-images-villes-t3-t4.xml` | Villes T3-T4 (images) |

---

## 2. Comptage URLs

### Totaux statiques (EN désactivé — production actuelle)

| Sub-sitemap | URLs FR | Commentaire |
|-------------|---------|-------------|
| pages | ~77 | 88 pathnames - 11 exclusions |
| blog (FS) | 0 | 3 posts tier-2 uniquement (scores 58/60/62 < 70) |
| blog (taxonomies) | 19 | 3 cats + 9 tags + 1 author + 0 sectors + 4 sizes + 2 services |
| faq | 40 | getAllFaqIds() |
| help | 12 | 6 articles + 6 catégories |
| cas-concrets | 11 | 6 + 5 industries |
| comparaisons | 3 | |
| guides | 1 | hub seul |
| glossaire | 61 | 1 hub + 60 termes |
| presse | 5 | |
| implementation | 8 | 8 par-fonction |
| implantations | 13 | 1 hub + 12 régions |
| villes-* | 39 | 12 sub-sitemaps (39 indexables) |
| services-villes-audit | 39 | |
| services-villes-interventions | 39 | |
| services-villes-implementation | 39 | |
| services-villes-un-a-un | 39 | |
| stack-ia-tools | 12 | |
| knowledge-* | 0 | DB runtime — 0 au build SSG |
| **TOTAL STATIQUE** | **~447** | Hors DB runtime |

### Volume si EN réactivé (future)
Quasi-double pour la plupart des sub-sitemaps : ~800-900 URLs statiques (filterEnIfDisabled supprimé).

### Volume prod runtime estimé
447 statiques + N articles tier-1 DB + N knowledge entries publiés.
Cible campagnes content-gen actives : 500–1000 URLs/mois supplémentaires.

---

## 3. Qualité Sitemap

### 3.1 `lastmod` différencié
- **Mécanisme** : `BUILD_TIME` env var injectée par `next.config.ts` au build
- **Blog** : `publishedAt` réel par post (signal honnête pour Googlebot)
- **sitemap-index.xml** : `getDifferentiatedLastmod()` lit MAX(updatedAt) par source DB
- **Statiques** : `BUILD_TIME` (honnête = « reconstruit le X »)
- **Résultat** : lastmod différencié = crawl prioritization Google activé

### 3.2 Doublons d'URLs
- **Glossaire hub** : excluded de `pages.xml` via `EXCLUDED_FROM_INDEX` + inclus dans `glossaire.xml`. **OK — pas de doublon.**
- **Blog posts FS vs DB** : dédup via `buildExcludeSlugsByType()` — FS prioritaire sur DB. **OK.**
- **Cas concrets industries** : unique par `Set()` dans `getAllIndustrySlugs()`. **OK.**

### 3.3 Chunking Google
- **SITEMAP_CHUNK_SIZE** = 1000 (bien sous la limite Google de 50 000)
- **Villes** : max 6 villes × 2 locales = 12 URLs par région → aucun chunk nécessaire aujourd'hui
- **Scalabilité** : chunking auto prévu pour 2157 villes si `copy` étendu (Phase 2/3 city domination)
- **Knowledge** : chunked à 1000 — safe

### 3.4 Format XML
- **sitemap.ts** : convention `MetadataRoute.Sitemap` Next 16 → XML valide auto
- **sitemap-news.xml** : Route Handler XML brut avec `xmlns:news` conforme Google News
- **sitemap-index.xml** : Route Handler XML brut conforme `sitemapindex` schema

### 3.5 hreflang / alternates
- **EN désactivé** : `filterEnIfDisabled()` retire les entrées `/en/*` et clean `alternates.languages.en`
- **x-default** : systématiquement = FR canonique

---

## 4. Issues Identifiées

### P0 — CRITIQUE

**P0-1 : Sitemap vide au build SSG pour knowledge-* et blog DB**
- **Impact** : Articles content-gen tier-1 invisibles dans sitemap au build SSG (DATABASE_URL=stub.invalid)
- **Comportement attendu** : ISR `revalidate=3600` repopule sous 1h en prod avec DATABASE_URL réel
- **Risque** : Si ISR ne se déclenche pas (cold start post-deploy), Googlebot crawle sans découvrir les articles 1h
- **Statut** : Connu + documenté (ADR 0026 stub.invalid contract) — ACCEPTABLE si ISR fonctionne en prod

**P0-2 : 0 blog posts tier-1 en FS**
- **Impact** : `sitemap/blog.xml` contient 0 post (seulement 19 URLs taxonomies) tant que DB est vide
- **Cause** : 3 posts FS ont `indexationTier: "tier-2-noindex-follow"` explicite (qualityScore 58/60/62 < 70)
- **Risque** : Google ne découvre aucun article via sitemap au build initial
- **Fix recommandé** : Passer au moins 1 post à `indexationTier: "tier-1-indexable"` + vérifier qualityScore ≥ 70

### P1 — IMPORTANT

**P1-1 : Route /implantations/[region]/[ville]/[verticale] absente du sitemap**
- **Impact** : 500 routes SSG (top 100 villes × 5 verticales Sprint A Phase 5) non déclarées dans sitemap
- **Condition** : Ces pages sont `noindex` si pas d'article LLM — mais pour les villes avec articles, elles devraient être dans le sitemap
- **Estimation** : ~100 routes pourraient être indexables (villes avec articles LLM tier-1)
- **Pattern concerné** : `/fr/implantations/{region}/{ville}/{verticale}` (audits/implementations/interventions/un-a-un/sites-web-ia)
- **Fix recommandé** : Ajouter `services-villes-landing` sub-sitemap dans `generateSitemaps()` filtrant sur les villes avec articles tier-1 par verticale

**P1-2 : 5e verticale sites-web-ia absente des services-villes sitemaps**
- **Impact** : `/fr/sites-web-augmentes/par-ville/:slug` n'existe pas en routing — mais la verticale existe dans VERTICALE_META et dans les routes `/implantations/[region]/[ville]/[verticale]`
- **Dualité URL** : Pattern 1 `/[service]/par-ville/:slug` (4 verticales dans sitemap) vs Pattern 2 `/implantations/[region]/[ville]/[verticale]` (5 verticales, absent sitemap)
- **Risque** : `sites-web-ia` n'a aucune présence sitemap

**P1-3 : Image sitemaps non auditables sans DB runtime**
- **Impact** : 4 image sitemaps déclarés dans sitemap-index.xml mais leur contenu dépend de image-bank DB
- **Vérification** : Impossible code-only — nécessite DB runtime pour valider les URLs images
- **Risque** : Si image-bank DB vide, sitemaps images = vides → Googlebot abandonne le crawl images

### P2 — MINEUR

**P2-1 : Commentaire code dit 60 termes glossaire**
- Le commentaire dans `sitemap.ts` dit « ~60 URLs mode FR-only » pour glossaire
- L'implémentation émet 1 hub + 60 termes = 61 URLs FR
- **Cohérent** — le commentaire approxime, pas d'issue réelle

**P2-2 : Services-villes limité à 4 verticales vs 5 dans le modèle ville**
- `VilleServicesLong` couvre audit/interventions/implementation/unAUn (4)
- `VERTICALE_META` et la route Phase 5 couvrent 5 verticales (+ sites-web-ia)
- La 5e verticale n'a pas de `copy.services.sitesWebIa` dans le type `VilleCopy`
- **Impact SEO** : pages `/fr/implantations/{region}/{ville}/sites-web-ia` ont contenu stub → noindex → OK pour l'instant

---

## 5. Données brutes

### Villes
| Type | Count |
|------|-------|
| Villes structurelles total | 2 157 |
| Villes indexables (avec copy) | 39 |
| Villes sans copy (noindex SSG stubs) | 2 118 |
| Régions indexables | 12 |
| Région noindex (Corse) | 1 |

### Content files
| Source | Count |
|--------|-------|
| Blog posts FS | 3 (tous tier-2) |
| FAQ items | 40 |
| Help articles | 6 |
| Help categories | 6 |
| Case studies | 6 |
| Industries | 5 |
| Comparaisons | 3 |
| Automatisations par-fonction | 8 |
| Glossaire termes | 60 (12 legacy + 48 nouveaux) |
| Presse communiqués | 5 |
| Stack IA tools | 12 |
| Press releases | 5 |

---

## 6. Verdict

| Dimension | Score | Statut |
|-----------|-------|--------|
| Structure sitemap-index | Excellente (différenciation lastmod, chunking, Custom+Generated) | OK |
| Déduplication URLs | Correcte (glossaire exclusion pages.xml, blog FS>DB) | OK |
| Chunking Google limits | Sous 1000/sub-sitemap (bien < 50k limit) | OK |
| Format XML | Valide (MetadataRoute.Sitemap + Route Handlers conformes) | OK |
| Coverage routes Sprint A | Incomplète (Phase 5 /implantations/region/ville/verticale absent) | WARNING |
| Coverage blog FS | Critique (0 posts tier-1 — articles LLM DB seuls) | WARNING |
| DB-runtime at build | Stub contract respecté (ISR < 1h en prod) | OK (ADR 0026) |

### Verdict global : **WARNING**

Le sitemap est structurellement sain avec une bonne architecture. Deux points attention :
1. La route Sprint A Phase 5 (`/implantations/[region]/[ville]/[verticale]`) n'est pas couverte par le sitemap — à corriger pour les pages avec article LLM tier-1
2. Les 3 posts FS sont tier-2 : le sitemap blog est vide au build SSG (OK si DB runtime active)

---

*Rapport généré par Agent A-1 — 2026-05-25*
*Fichiers analysés : `src/app/sitemap.ts` (1014 lignes) + `src/content/villes/index.ts` + 39 copy files + 13 data files + transversal.ts + blog/index.ts + routing.ts*
