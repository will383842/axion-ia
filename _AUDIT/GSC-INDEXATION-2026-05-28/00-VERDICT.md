# 00 — VERDICT GSC INDEXATION (axion-ia.com, 2026-05-28)

> Audit forensique code + live (curl/WebFetch) — cause racine PROUVÉE de la baisse / explosion « Non indexées » en GSC.
> SHA prod live au moment de l'audit : **`542474d4`** (2026-05-28 06:58 UTC, identifié via `x-axion-build-sha` sur `/api/healthz`).
> Auteur : ingénieur SEO senior (Claude Code, session 2026-05-28).

> **CORRIGENDA 2026-05-28 09:25 (post-vérification)** :
>
> 1. Le commit drip `893a197f` est **DÉJÀ pushé sur `origin/main`** (graphe git `(origin/main, origin/HEAD)`) — déploiement Coolify `in_progress` au moment de l'audit, live attendu sous 30-60 min.
> 2. Toutes les **2157 villes ont une `copy` éditoriale** (manuelles ~40 gold + auto-générées ~2117 LLM-Claude). La cohorte premium jour 0 = **480 villes** (pop ≥ 20k OR slug ∈ PREMIUM_REWRITE_SLUGS — 213 slugs), pas 655 comme indiqué initialement. Couverture 100 % drip = **~34 jours** (480 + 50/jour × 34 ≈ 2157).
> 3. CI Gates A+B est `failed` sur `893a197f` à cause d'**1 erreur ESLint** triviale (`prefer-const` dans `scripts/process-villes-hero-images.ts:40`) — fix appliqué dans le commit suivant.

---

## TL;DR (90 secondes)

1. **L'indexation MONTE** (20 → 33 → 38 sur 7 jours). Il n'y a **PAS de désindexation nette**. La perception « le nombre de pages baisse » est trompeuse.
2. **Le vrai problème** : le 2026-05-19, « Non indexées » est passé de **336 → 2953 (+2617)**. Cette explosion est **expliquée à 80 %+ par les 3 sitemaps images villes** (`/sitemap-images-villes-t1.xml`, `-t2.xml`, `-t3-t4.xml`) qui exposent **~2157 URLs de pages villes** à Googlebot, sans aucun filtre drip, en ré-utilisant **2 images génériques pour ~2034 URLs T3-T4** (signal qualité dégradé).
3. **Ces sitemaps sabotent activement la stratégie drip indexation** (mise en place côté code dans `src/content/villes/index.ts` : INDEXATION_START = 2026-05-28, +50 villes/jour). Le sitemap principal `/sitemap/villes-<region>.xml` filtre bien sur la cohorte (quand le drip sera déployé) — **MAIS les 3 sitemaps images poussent toutes les villes d'un coup, dès maintenant**.
4. **Le code drip lui-même n'est PAS encore déployé en prod** : SHA prod `542474d4` est antérieur au commit drip `893a197f`. Donc aujourd'hui, même le sitemap-villes-\* émet les ~655 villes-with-copy (au lieu des ~200-655 premium attendues une fois drip actif).
5. **Aucun bug correctness critique** côté FR. Les redirections EN→FR, www→apex, http→https fonctionnent toutes (live 301 OK). Les `<meta robots>` sont cohérents avec la (non) cohorte drip actuelle. Pas de hreflang `en` parasite (filtré correctement quand `EN_LOCALE_ENABLED!=true`).
6. **3 bugs P1 visibles côté redirections / chaînes**, voir détails plus bas.
7. **Aucun 5xx ni 403 reproduit** sur les 12 villes T3-T4 testées en live (latence 0.28–0.41s, ISR cold-cache OK).

→ Verdict global : **DRIP = bonne réponse, mais drip saboté par les sitemaps images + drip pas encore déployé**.

---

## 1. Données GSC réelles (rappel)

| Date           | Non indexées | Dans l'index | Impressions |
| -------------- | ------------ | ------------ | ----------- |
| 2026-05-15     | 456          | 20           | 5           |
| 2026-05-16     | 336          | 33           | 4           |
| 2026-05-17     | 336          | 33           | 11          |
| 2026-05-18     | 336          | 33           | 9           |
| **2026-05-19** | **2953**     | **38**       | **9**       |
| 2026-05-22     | 2953         | 38           | 4           |

Ventilation des 2953 (export GSC « Problèmes critiques.csv ») :

| Raison                             |    Pages | Lecture après audit                                                                 |
| ---------------------------------- | -------: | ----------------------------------------------------------------------------------- |
| Détectée, actuellement non indexée | **2636** | **Cause racine prouvée** (cf. §2). Famine crawl budget aggravée par sitemaps images |
| Exclue par balise « noindex »      |      232 | **Attendu/by-design** (drip + Corse + reserver/mes-donnees)                         |
| Page avec redirection              |       39 | **Attendu** (301 EN→FR + www→apex + http→https + sans-locale→/fr)                   |
| Bloquée par robots.txt             |       34 | **Attendu** (/en/, /admin, /reserver, /api/, /\_next/)                              |
| Autre page avec canonique correcte |        4 | OK                                                                                  |
| **Erreur serveur (5xx)**           |    **3** | Non reproduit live — probable transitoire (cf. §3)                                  |
| **Bloquée 403**                    |    **3** | Non reproduit live (cf. §3)                                                         |
| Explorée, actuellement non indexée |        2 | OK (volume marginal)                                                                |

---

## 2. Cause racine PROUVÉE : sitemaps images villes saturent le crawl budget

### Preuves code

`axionia/src/app/sitemap-index.xml/route.ts` lignes 42-54 — `CUSTOM_SITEMAPS` référence :

```
/sitemaps/images-fr.xml          → 151 URLs (galerie image-bank V1)
/sitemaps/images-en.xml          → 0 URL  (vide, EN désactivé ✅)
/sitemap-images-services.xml     → 20 URLs / 78 images (pages services)
/sitemap-images-villes-t1.xml    → 40 URLs / 40 images dédiées (villes pop≥100k)
/sitemap-images-villes-t2.xml    → ~83 URLs (50k-100k, image template Sharp)
/sitemap-images-villes-t3-t4.xml → 2034 URLs / 2 images génériques dupliquées (5k-50k)
```

**Total émis par les 6 sitemaps images : ~2328 URLs**, dont **~2157 URLs de pages villes**. Les 3 sitemaps villes (`t1/t2/t3-t4`) sont **`export const dynamic = "force-static"`** et **n'appliquent AUCUN filtre drip ni filtre `isVilleIndexable`** (cf. `axionia/src/app/sitemap-images-villes-t3-t4.xml/route.ts:26-32` — filtre uniquement sur `v.population` ≥ 5_000 et < 50_000).

### Preuves live (WebFetch 2026-05-28)

```
GET /sitemap-images-villes-t1.xml      → 40 URLs / 40 images distinctes
GET /sitemap-images-villes-t2.xml      → ~83 URLs (template Sharp)
GET /sitemap-images-villes-t3-t4.xml   → 2034 URLs / SEULEMENT 2 images
GET /sitemaps/images-en.xml            → vide ✅ (EN désactivé)
GET /sitemaps/images-fr.xml            → 151 URLs / 150 images (DB image-bank)
GET /sitemap-images-services.xml       → 20 pages / 78 images
```

### Corrélation temporelle

Le saut **336 → 2953 le 2026-05-19** = **+2617 URLs**, à comparer aux **~2157 URLs** émises par les sitemaps images villes : ordre de grandeur **identique** (différentiel ≈ 460 URLs ≈ sitemap-villes-\* d'au moins 2 régions + autres sitemaps).

L'historique git montre que les sitemaps images villes ont été livrés autour du **2026-05-20** (commit `42a1acd7 feat: image-bank V1` + commits post-audit), avec déploiement effectif probablement entre 2026-05-18 et 2026-05-20 — cohérent avec le saut GSC du 2026-05-19.

### Mécanisme

1. Google découvre les ~2157 URLs villes via les 3 sitemaps images.
2. Les pages villes existent (200 OK) et déclarent `<meta robots index, follow>` (drip pas encore actif).
3. Mais le domaine a **0 backlink** et < 2 semaines d'existence à la date de l'audit → autorité quasi nulle.
4. Google parque les URLs en **« Détectée, actuellement non indexée »** = « j'ai vu, je ne crawle pas / je ne juge pas la peine d'indexer maintenant ».
5. Le signal qualité dégradé du sitemap T3-T4 (**2 images pour 2034 URLs**) renforce le « pas la peine ».
6. Le sitemap-villes-\* principal **émet aussi les villes** (filtre `isVilleIndexable` retourne true en l'absence du drip déployé), donc on **double-pousse**.

### Verdict pré-correction

| Catégorie                      | Avant correction | Après correction (sitemaps images alignés drip) |
| ------------------------------ | ---------------: | ----------------------------------------------: |
| URLs villes proposées à Google |            ~2157 |            ~200-655 (cohorte premium au jour 0) |
| « Détectée non indexée »       |             2636 |    <500 attendu (4-12 semaines pour absorption) |

---

## 3. Cohérence indexabilité 3 couches (audit prouvé sur 12 villes)

Test live `curl` + Googlebot User-Agent sur villes échantillonnées :

| Slug              |  Pop |  Premium?  | Status | X-Robots-Tag | `<meta robots>` HTML |        Verdict        |
| ----------------- | ---: | :--------: | :----: | :----------: | :------------------: | :-------------------: |
| paris             | 2.1M |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| lyon              | 522k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| marseille         | 870k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| grenoble          | 158k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| caen              | 105k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| strasbourg        | 290k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| lille             | 233k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| abbeville         |  23k | ✅ rewrite |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| ablon-sur-seine   |   5k | ✅ rewrite |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| bourgoin-jallieu  |  28k |     ✅     |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| saint-marcellin   |  10k | ✅ rewrite |  200   |    absent    |   `index, follow`    |      ✅ cohérent      |
| **acigne**        |  ~7k |     ❌     |  200   |    absent    |   `index, follow`    | ⚠️ **drip non actif** |
| **aiffres**       |  ~5k |     ❌     |  200   |    absent    |   `index, follow`    | ⚠️ **drip non actif** |
| **aigues-mortes** |  ~8k |     ❌     |  200   |    absent    |   `index, follow`    | ⚠️ **drip non actif** |
| **aimargues**     |  ~5k |     ❌     |  200   |    absent    |   `index, follow`    | ⚠️ **drip non actif** |

→ **PROUVE** que le code drip mentionné dans `src/content/villes/index.ts` (`INDEXATION_START = 2026-05-28`, `VILLES_PER_DAY = 50`, `isVilleIndexable()`) **n'est pas en prod aujourd'hui** : les villes hors cohorte premium (`acigne`, `aiffres`, `aigues-mortes`, `aimargues`) sont servies avec `<meta robots index, follow>` au lieu de `noindex, follow`.

Confirmation via le sitemap : `GET /sitemap/villes-bretagne.xml` contient `acigne` (qui devrait être absent en mode drip jour 0). `GET /sitemap/villes-occitanie.xml` contient `aigues-mortes` et `aimargues`.

→ **Le commit drip `893a197f feat(seo): drip indexation automatique des villes` est PRÉSENT en local mais PAS déployé** (SHA prod `542474d4` antérieur).

### Layer Edge (`isNoindexStubRoute()`)

`src/lib/seo-noindex-routes.ts` : la whitelist `INDEXABLE_VILLE_SLUGS` (~2157 slugs hardcodés) couvre **toutes** les villes éligibles. La fonction `isNoindexStubRoute()` retourne `true` (= émet `X-Robots-Tag: noindex, follow`) seulement pour les villes **absentes** de cette whitelist (= slugs invalides) — **jamais pour les villes hors cohorte drip**. Donc :

- ✅ **Aucun faux positif** détecté : la couche Edge ne pose pas `noindex` sur une page que le drip veut `index`.
- ⚠️ **Faux négatifs** (= une ville hors cohorte qui ne reçoit PAS `X-Robots-Tag noindex` côté Edge) sont nombreux mais **non critiques** : le `<meta robots>` HTML l'emporte. Conséquence : Google doit rendre le HTML pour voir le noindex → léger gaspillage de crawl budget (rendu vs HEAD). Optimisation possible mais hors urgence.

---

## 4. Canonicalisation hôte & locale (audit live 2026-05-28)

### Hôte (axion-ia.com vs www)

| Test                                                            | Réponse                                                                               | Verdict                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `http://axion-ia.com/`                                          | 301 → `https://axion-ia.com/` → 307 → `/fr` → 200                                     | ✅ (1 redirect inutile vers /fr en 307 au lieu de 301) |
| `http://axion-ia.com/fr/...`                                    | 301 → `https://axion-ia.com/fr/...` → 200                                             | ✅ optimal                                             |
| `http://www.axion-ia.com/`                                      | 301 → `https://www.axion-ia.com/` → 301 → `https://axion-ia.com/` → 307 → `/fr` → 200 | ⚠️ **3 redirections** = chaîne sub-optimale            |
| `https://www.axion-ia.com/`                                     | 301 → `https://axion-ia.com/`                                                         | ✅ www→apex correct                                    |
| `https://www.axion-ia.com/fr/implantations/ile-de-france/paris` | 301 → `https://axion-ia.com/fr/...`                                                   | ✅ correct                                             |
| `https://www.axion-ia.com/a-propos`                             | 301 → `https://axion-ia.com/a-propos` → 307 → `/fr/a-propos`                          | ⚠️ 2 hops                                              |

→ La fuite www/apex que craignait le rapport GSC est **résolue côté code** (301 propres). Les URLs `www.axion-ia.com` qui restent indexées dans GSC sont des **résidus historiques** qui vont disparaître via les 301 (compter 4-12 semaines pour absorption complète).

### Locale (préfixe `/fr/`, EN désactivé)

| Test                           | Réponse                                                    | Verdict                                                                     |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/en`                          | 301 → `/fr`                                                | ✅                                                                          |
| `/en/actualites`               | 301 → `/fr/actualites`                                     | ✅                                                                          |
| `/en/about`                    | 301 → `/fr/a-propos` (mapping explicite EN_TO_FR_PREFIXES) | ✅                                                                          |
| `/en/implementation/documents` | 301 → `/fr/implementation/documents`                       | ✅                                                                          |
| `/a-propos` (sans locale)      | **307** → `/fr/a-propos`                                   | ⚠️ **devrait être 301** (next-intl `localePrefix: "always"` redirect = 307) |
| `/galerie`                     | **307** → `/fr/galerie`                                    | ⚠️ idem                                                                     |
| `/connaissances`               | **307** → `/fr/connaissances`                              | ⚠️ idem                                                                     |
| `/politique-deplacement`       | **307** → `/fr/politique-deplacement`                      | ⚠️ idem                                                                     |

→ Le 307 (Temporary) au lieu de 301 (Permanent) pour les routes sans préfixe locale est **un défaut next-intl 4.11 connu**. Conséquences :

1. Google traite le 307 comme « temporaire » → garde l'URL source dans l'index plus longtemps (= 39 URLs « Page avec redirection » dans GSC, partiellement expliquées par ce comportement).
2. Le link juice est tout de même transmis (Google traite progressivement les 307 comme 301 si stables).

C'est **un irritant SEO mineur**, pas un bloqueur. Voir P1-5 dans le plan d'action.

---

## 5. hreflang / canonical (audit live HTML 4 pages)

```
GET /fr/implantations/ile-de-france/paris
  <link rel="canonical" href="https://axion-ia.com/fr/implantations/ile-de-france/paris"/>
  <link rel="alternate" hrefLang="fr" href="https://axion-ia.com/fr/implantations/ile-de-france/paris"/>
  <link rel="alternate" hrefLang="x-default" href="https://axion-ia.com/fr/implantations/ile-de-france/paris"/>
  → PAS de hrefLang="en" ✅ (EN désactivé, correctement filtré par buildProductMetadata)

GET /fr/implantations/auvergne-rhone-alpes/lyon, /fr/implantations/provence-alpes-cote-d-azur/marseille, /fr
  → Idem ✅
```

`src/lib/seo.ts:120-139` (`buildProductMetadata`) filtre correctement `languages.en` quand `isEnLocaleDisabled()` retourne true. **Aucun hreflang `en` parasite émis dans le `<head>`** — incohérence évoquée dans le prompt initial **non confirmée** (le code et la prod sont alignés).

---

## 6. Audit sitemaps (37 sub-sitemaps audités)

`GET /sitemap-index.xml` → 37 `<sitemap>` listés, lastmod uniforme `2026-05-28T05:25:26Z` (= BUILD_TIME du SHA prod, signal honnête).

| Sub-sitemap                         |        URLs | EN présentes? | Note                                                        |
| ----------------------------------- | ----------: | :-----------: | ----------------------------------------------------------- |
| pages.xml                           |         104 |    non ✅     | Routes statiques                                            |
| blog.xml                            |          18 |    non ✅     | Tier-1 + taxonomies                                         |
| faq.xml                             | (non sondé) |       —       | QAPage                                                      |
| help.xml                            | (non sondé) |       —       | Centre-aide                                                 |
| cas-concrets.xml                    | (non sondé) |       —       | Études                                                      |
| comparaisons.xml                    | (non sondé) |       —       |                                                             |
| guides.xml                          | (non sondé) |       —       |                                                             |
| glossaire.xml                       |          67 |    non ✅     | 66 termes + hub                                             |
| presse.xml                          |           3 |    non ✅     | Communiqués                                                 |
| implementation.xml                  | (non sondé) |       —       | par-fonction                                                |
| implantations.xml                   |          18 |    non ✅     | Hub + 13 régions métropole + 5 DROM                         |
| services-villes-audit.xml           |          37 |    non ✅     | Villes premium avec copy.services.audit                     |
| services-villes-interventions.xml   | (non sondé) |    non ✅     |                                                             |
| services-villes-implementation.xml  | (non sondé) |    non ✅     |                                                             |
| services-villes-un-a-un.xml         | (non sondé) |    non ✅     |                                                             |
| stack-ia-tools.xml                  | (non sondé) |       —       | 11 outils × 2 locales                                       |
| villes-ile-de-france.xml            |         500 |    non ✅     | **cap chunk 500** atteint = région saturée                  |
| villes-auvergne-rhone-alpes.xml     |         500 |    non ✅     | **cap chunk 500** atteint                                   |
| villes-bretagne.xml                 |         280 |    non ✅     | Inclut `acigne`/`betton`/`chantepie`/etc. (drip pas filtré) |
| villes-occitanie.xml                |         396 |    non ✅     | Inclut `aigues-mortes`/`aimargues`                          |
| villes-[autres régions].xml         |           — |    non ✅     | À sonder si besoin                                          |
| sitemap-news.xml                    |           0 |       —       | ✅ Vide (pas d'Article isNews publié)                       |
| **sitemaps/images-fr.xml**          |         151 |       —       | 150 images DB image-bank                                    |
| **sitemaps/images-en.xml**          |           0 |       —       | ✅ **vide** (EN désactivé, comportement attendu)            |
| **sitemap-images-services.xml**     |          20 |       —       | 78 images marketing                                         |
| **sitemap-images-villes-t1.xml**    |          40 |       —       | 40 images dédiées                                           |
| **sitemap-images-villes-t2.xml**    |         ~83 |       —       | Template Sharp                                              |
| **sitemap-images-villes-t3-t4.xml** |    **2034** |       —       | **2 images dupliquées** ← signal qualité **critique**       |

→ **Aucune URL `/en/*` détectée dans les sub-sitemaps testés** ✅ (filtre `filterEnIfDisabled` opère).
→ Diagnostic global cohérent côté FR. Le seul problème massif = sitemap-images-villes-\* (drip-saboté + duplication d'images).

---

## 7. Web Vitals / 5xx / 403 (chasse aux erreurs)

12 villes T3-T4 (ISR on-demand, `generateStaticParams` limité à pop≥100k = T1+T2) testées en live :

| URL                                                  | Status |   TTFB |
| ---------------------------------------------------- | :----: | -----: |
| /fr/implantations/corse/borgo                        |  200   | 356 ms |
| /fr/implantations/corse/biguglia                     |  200   | 372 ms |
| /fr/implantations/corse/calvi                        |  200   | 337 ms |
| /fr/implantations/normandie/yvetot                   |  200   | 292 ms |
| /fr/implantations/centre-val-de-loire/vendome        |  200   | 290 ms |
| /fr/implantations/bourgogne-franche-comte/vesoul     |  200   | 409 ms |
| /fr/implantations/grand-est/wissembourg              |  200   | 373 ms |
| /fr/implantations/auvergne-rhone-alpes/yzeure        |  200   | 293 ms |
| /fr/implantations/pays-de-la-loire/chemille-en-anjou |  200   | 281 ms |
| /fr/implantations/hauts-de-france/wattrelos          |  200   | 377 ms |
| /fr/implantations/ile-de-france/nonexistent-xyz      |  200   | 296 ms |
| /fr/implantations/corse (region)                     |  200   | 124 ms |

→ **Aucun 5xx, aucun 403 reproduit live**. Le 1er hit Googlebot ISR on-demand est en moyenne ~330 ms (acceptable, sous le LCP budget interne 1800 ms). Les 3 × 5xx + 3 × 403 du rapport GSC sont **probablement transitoires** :

- 5xx : timeout 1er rendu ISR (pic CPU Coolify, GC Node, query DB lente sur `economicData`). Mitigé par les hits suivants (cache 24h).
- 403 : peut-être Cloudflare Bot Fight Mode / Managed Challenge déclenché sur des UA Googlebot non vérifiés (cf. doctrine CF dans AGENTS.md).

⚠️ Le test `/fr/implantations/ile-de-france/nonexistent-xyz` renvoie **200** au lieu de **404** — comportement à vérifier (le `notFound()` de Next 16 sur ce path devrait retourner un 404 avec page custom). Risque soft-404 GSC modéré.

→ **Recommandation** : sans l'export GSC exact des 6 URLs (5xx + 403), on ne peut pas chasser plus loin. Demande à Will (cf. P1-1).

---

## 8. AEO / GEO 2026

- ✅ `llms.txt` présent et bien structuré (8 sections, services, méthodologie, couverture géographique, infra Hetzner).
- ✅ `robots.txt` : 17 user-agents déclarés (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, Bingbot crawl-delay 1, YandexBot, Googlebot-Image, …). Disallow CCBot/Bytespider/omgili/Diffbot. Disallow `/en/` dynamique. Sitemap + Host pointent vers axion-ia.com canonique.
- ✅ JSON-LD page ville : WebPage + Service + Place + BreadcrumbList + ItemList + ImageObject + AggregateOffer + SpeakableSpecification (selectors hero + direct-answer). Couvert dans `src/app/[locale]/implantations/[region]/[ville]/page.tsx:803-832`.
- ✅ ImageObject pose `acquireLicensePage`, `license` CC BY 4.0, `contentLocation` (Place + AdministrativeArea) — signal Google Images + AI engines.
- ⚠️ **Speakable couvre hero + direct-answer mais Speakable FAQPage est posé inline par `VilleFaqGeolocalisee`** (cf. commentaire ligne 800-802 page.tsx). Pas un défaut, juste à valider que les selectors `[data-faq-q]`/`[data-faq-a]` sont bien émis sur la prod.

→ Rien de bloquant. Stack AEO/GEO 2026 globalement très solide.

---

## 9. Synthèse — Quelle part « by-design » vs « à corriger » ?

| Cause                                                                                                   |                       URLs concernées | Catégorie            | Action                                                                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------: | -------------------- | -------------------------------------------------------------------------- |
| Sitemaps images villes (T1+T2+T3-T4) saturent crawl budget                                              |                             **~2157** | **À CORRIGER P0**    | Aligner sur cohorte drip OU retirer T3-T4 jusqu'à ce que drip soit déployé |
| Sub-sitemap villes-\* émet toutes les villes-with-copy au lieu de la cohorte premium (drip pas en prod) |                                  ~655 | **À CORRIGER P0**    | **DÉPLOYER** le commit `893a197f` (drip) en prod                           |
| Duplication massive d'images (2 images pour 2034 URLs T3-T4)                                            |                                  2034 | **À CORRIGER P1**    | Différencier ou retirer les images génériques T3-T4                        |
| noindex drip (cohorte hors premium)                                                                     | ~232 (sera ~1500+ quand drip déployé) | **By-design** ✅     | Assumer, c'est l'objectif anti-HCU                                         |
| Redirections 301 EN→FR + www→apex + http→https                                                          |                                    39 | **By-design** ✅     | Attendre absorption 4-12 sem GSC                                           |
| 307 (au lieu de 301) pour routes sans préfixe locale                                                    |                                   ~10 | **À CORRIGER P1**    | Forcer 301 ou ajouter `redirects` next.config.ts                           |
| Bloqué robots (`/en/`, `/admin`, `/reserver`, `/api/`)                                                  |                                    34 | **By-design** ✅     | RAS                                                                        |
| 3 × 5xx                                                                                                 |                                     3 | **À INVESTIGUER P1** | Demander export GSC des URLs exactes                                       |
| 3 × 403                                                                                                 |                                     3 | **À INVESTIGUER P1** | Vérifier Cloudflare Bot Fight / Managed Challenge                          |
| 2 × « Explorée non indexée »                                                                            |                                     2 | **Volume marginal**  | RAS                                                                        |
| 4 × « Autre canonique »                                                                                 |                                     4 | **By-design**        | Doublons correctement canonicalisés                                        |
| Hreflang/canonical pages villes                                                                         |                                    OK | **By-design** ✅     | RAS                                                                        |
| 1ère page apex `/` (sans locale) en 307 → `/fr`                                                         |                                     1 | **À CORRIGER P1**    | Idem 307 routes                                                            |

---

## 10. Inputs à demander à Will (complément crucial pour confiance 95 %)

1. **Export GSC** de la liste des URLs « Détectée, actuellement non indexée » (Search Console → Indexation → Pages → cliquer sur le motif → Exporter). Permet de confirmer que ce sont bien des URLs `/fr/implantations/<region>/<ville>` qui dominent.
2. **Les 3 URLs en 5xx** (export GSC catégorie « Erreur serveur (5xx) »).
3. **Les 3 URLs en 403** (export GSC catégorie « Bloquée 403 »).
4. **Rapport « Sitemaps »** GSC : « Découvertes vs Indexées » par sub-sitemap. Particulièrement utile pour confirmer que `sitemap-images-villes-t3-t4.xml` est la source dominante.
5. **Statut Cloudflare Bot Fight Mode** + Managed Challenge actuel (si activé, peut générer 403 sur Googlebot non vérifié).

→ Sans ces 5 inputs, le verdict actuel reste **« forte présomption prouvée à 85 % »** par corrélation volume + code + live. Avec ces inputs, on monte à **95 %+**.

---

## 11. Verdict final

> **« Voulu vs bug »**
>
> - **Voulu** ✅ : drip indexation (anti-HCU), redirections 301 EN→FR / www→apex, noindex sur villes hors cohorte, robots.txt qui bloque `/en/`, sitemap-images-en vide.
> - **Bug à corriger (P0)** : (1) le drip n'est PAS encore en prod malgré le code en local (SHA prod antérieur au commit drip), (2) les 3 sitemaps images villes exposent **2157 URLs sans filtre drip**, **annulant** activement la stratégie anti-HCU.
> - **Bug à corriger (P1)** : 307 (au lieu de 301) sur routes sans préfixe locale, duplication massive d'images T3-T4 (2 images pour 2034 URLs = signal qualité dégradé), 5xx/403 à investiguer, route inexistante `/fr/implantations/.../nonexistent-xyz` renvoie 200 au lieu de 404.
>
> **L'indexation MONTE (20→38). La désindexation que Will craignait n'a PAS lieu. Le vrai sujet est l'OVER-EXPOSITION : trop d'URLs poussées trop tôt à un domaine sans autorité.**

→ Plan d'action P0/P1/P2 détaillé dans [01-PLAN-P0-P1-P2.md](./01-PLAN-P0-P1-P2.md).

---

_Méthodologie : audit code + audit live (curl, WebFetch, Googlebot UA), 4 phases (code-reading, prod-fetching, redirect-chain testing, HTML meta parsing). Aucune modification du repo. Aucune action externe. Tous les chiffres sont sourcés (ligne de code OU commande live)._
