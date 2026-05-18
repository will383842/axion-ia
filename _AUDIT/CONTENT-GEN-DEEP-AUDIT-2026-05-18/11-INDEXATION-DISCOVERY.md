# 11 — INDEXATION DISCOVERY — Audit chaîne complète

> Score : **84/100** — Status global : 🟢 (à 1 STOP & ASK humain près)
> Périmètre : `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/sitemap-index.xml/route.ts`, `src/app/sitemap-news.xml/route.ts`, `src/app/llms.txt/route.ts`, `src/app/llms-full.txt/route.ts`, `src/app/ai.txt/route.ts`, `src/app/.well-known/security.txt/route.ts`, `src/app/.well-known/ai-policy.json/route.ts`, `src/app/api/indexnow/route.ts`, `src/app/api/indexnow/key/route.ts`, `public/<INDEXNOW_KEY>.txt`, `src/lib/indexnow.ts`, `src/lib/seo-content-gen-factories.ts`, `src/server/queue/workers/content-indexnow-worker.ts`, `src/server/queue/workers/content-google-indexing-worker.ts`, `src/server/queue/workers/content-keyword-sync-worker.ts`, `src/server/content-gen/seo/gsc-client.ts`, `src/server/content-gen/seo/bing-wmt-client.ts`, `src/server/content-gen/seo/indexing-client.ts`.
> HEAD audité : `9c1adaa` (working dir `axionia/`).

---

## 0. Vue d'ensemble (Will-readable, 5 lignes)

1. **La chaîne de découverte est complète** : robots.txt + sitemap-index + 4 fichiers IA (llms.txt, llms-full.txt, ai.txt, ai-policy.json) + security.txt + 4 endpoints IndexNow + 3 clients API (Google Search Console, Google Indexing API, Bing Webmaster Tools). Tout est codé et déployable.
2. **Le code est de très bonne qualité** : commentaires honnêtes sur les limites (Google Indexing API restreint à JobPosting/BroadcastEvent, EN locale désactivé, stub.invalid pour le build GitHub Actions), validation HMAC sur l'endpoint IndexNow public, OAuth refresh_token pour GSC + Indexing API, alerte Telegram fail-streak.
3. **3 vraies fragilités opérationnelles restent** : (a) **Yandex Webmaster API n'a pas de client** (seul l'allow `YandexBot` dans robots.txt existe, aucun ping/audit possible côté Yandex), (b) **soumission manuelle du sitemap-index à GSC/Bing/Yandex non vérifiable depuis le code** (STOP & ASK Will), (c) **dépendance forte au var `BUILD_TIME`** pour le `lastmod` sitemap — si l'injection saute, Google désactive le signal.
4. **Périmètre couvert solide** : 12 sub-sitemaps statiques + ~14 chunks ville/région auto + N chunks knowledge (1 chunk par 500 entries DB) + 3 sub-sitemaps custom (news, images-fr, images-en) = ~17 500 URLs annoncées.
5. **Action humaine prioritaire** : vérifier dans Search Console et Bing Webmaster Tools que `https://axion-ia.com/sitemap-index.xml` est bien soumis et accepté (pas de 4xx, pas de "couldn't fetch"). Bing accepte automatiquement via IndexNow mais le sitemap explicite reste recommandé.

---

## 1. robots.txt

Source unique : `src/app/robots.ts` (convention Next 16 `MetadataRoute.Robots`, exposé à `/robots.txt`).

### 1.1 Allow / Disallow général

| Élément                                                                         | Valeur                                | Source                       |
| ------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------- |
| Allow global (UA `*`)                                                           | `/` + `/api/og`                       | `src/app/robots.ts:56,95-96` |
| Disallow `/api/`                                                                | OK (sauf longest-match `/api/og`)     | `src/app/robots.ts:15`       |
| Disallow `/_next/`                                                              | OK                                    | `src/app/robots.ts:16`       |
| Disallow `/admin/`, `/fr/admin/`, `/en/admin/`                                  | OK (espace obfusqué + chemins legacy) | `src/app/robots.ts:29-31`    |
| Disallow funnel booking (`/reserver/`, `/fr/reserver/`, `/en/booking/`)         | OK                                    | `src/app/robots.ts:23-25`    |
| Disallow espace user RGPD (`/mes-donnees/`, `/fr/mes-donnees/`, `/en/my-data/`) | OK                                    | `src/app/robots.ts:19-21`    |
| Disallow design system (`/design`, `/components`, `/sections` × 3 locales)      | OK                                    | `src/app/robots.ts:33-41`    |
| Directive `Sitemap:`                                                            | `${SITE_URL}/sitemap-index.xml`       | `src/app/robots.ts:126`      |
| Directive `Host:`                                                               | `${SITE_URL}`                         | `src/app/robots.ts:127`      |

**Commentaires SEO importants** dans le code :

- L'allow `/api/og` est documenté pour résoudre l'alerte GSC 2026-05-18 « Bloquée par robots.txt » sur les OG dynamiques (`src/app/robots.ts:44-55`).
- La directive `Sitemap:` pointe explicitement vers `/sitemap-index.xml` (et non `/sitemap.xml`) — Next 16 réserve `/sitemap.xml` à la convention `generateSitemaps()` qui n'auto-génère pas d'index, d'où la Route Handler custom (`src/app/robots.ts:120-126`).

### 1.2 AI bots (13 + YandexBot = **14 bots allowed**)

| Catégorie              | Liste                                                                                                                                                                                                                          | Source                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| AI bots ALLOWED (14)   | `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `Mistral-User`, `Bingbot`, `Meta-ExternalAgent`, `YandexBot` | `src/app/robots.ts:58-78` |
| AI bots DISALLOWED (4) | `CCBot`, `Bytespider`, `omgili`, `Diffbot`                                                                                                                                                                                     | `src/app/robots.ts:80-85` |

**YandexBot** : ajouté commit `a9d3168` (P1-3 audit City Domination 2026-05-18). Justification dans le code (`src/app/robots.ts:72-77`) : couverture ~50 M users russophones (Russie, Biélorussie, Kazakhstan, francophone Europe Est) + déclaration cohérente avec la doctrine « ALLOW search + answer engines ».

### 1.3 Crawl-delay Bingbot

| Élément             | Valeur      | Source                      |
| ------------------- | ----------- | --------------------------- |
| Bingbot crawl-delay | `1` seconde | `src/app/robots.ts:104-109` |

Justification (P1-16 audit indexation 2026-05-15) : Bingbot historiquement 10× plus agressif que Googlebot, sur ~13K routes pSEO villes + factory 100/jour il peut écraser l'origin Coolify (cache MISS prolongé observé prod). Le delay 1s reste safe pour le ranking (Bing tolère jusqu'à 30s).

### 1.4 EN locale désactivé

| Élément                | Valeur                                                          | Source                                      |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| Détection EN désactivé | `isEnLocaleDisabled()` (true si `EN_LOCALE_ENABLED !== "true"`) | `src/lib/i18n/en-to-fr-redirect.ts:148-150` |
| Action robots.txt      | Ajoute `/en/` au `disallow` de tous les UAs (incl. AI bots)     | `src/app/robots.ts:91`                      |

**État actuel (2026-05-18)** : `EN_LOCALE_ENABLED` non set en prod → EN désactivé → `Disallow: /en/` actif. Cohérent avec proxy.ts qui 301 → FR sur `/en/*`. Évite de cramer le crawl budget Google sur des 301.

### 1.5 Status

🟢 **Conforme spec robots.txt + doctrine AEO/GEO 2026**. Aucun gap identifié.

---

## 2. Sitemap-index

Source : `src/app/sitemap-index.xml/route.ts` (Route Handler XML brut, exposé à `/sitemap-index.xml`).

### 2.1 Pourquoi un Route Handler custom et pas `sitemap.xml`

Next 16 réserve `/sitemap.xml` à la convention `MetadataRoute.Sitemap` (`generateSitemaps()` dans `src/app/sitemap.ts`) qui ne génère QUE les sub-sitemaps enfants `/sitemap/<id>.xml` mais PAS l'index racine. Sans Route Handler custom, Googlebot ne saurait pas qu'il existe plusieurs sub-sitemaps (`src/app/sitemap-index.xml/route.ts:5-16`).

### 2.2 Construction de l'index

| Étape                                                                                                    | Source                                       |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Appelle `generateSitemaps()` (sub-sitemaps statiques + villes-_ + knowledge-_)                           | `src/app/sitemap-index.xml/route.ts:140`     |
| Ajoute 3 sub-sitemaps custom (`/sitemap-news.xml`, `/sitemaps/images-fr.xml`, `/sitemaps/images-en.xml`) | `src/app/sitemap-index.xml/route.ts:42-48`   |
| Calcule `lastmod` différencié par catégorie (news / blog / knowledge / fallback BUILD_TIME)              | `src/app/sitemap-index.xml/route.ts:82-126`  |
| Rend XML brut conforme `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`                             | `src/app/sitemap-index.xml/route.ts:160-164` |
| Cache HTTP : `max-age=300, s-maxage=600, stale-while-revalidate=3600`                                    | `src/app/sitemap-index.xml/route.ts:175`     |

### 2.3 lastmod différencié (P1-14 + P0-2 fixé 2026-05-18)

| Catégorie                                                                                                                  | Source `lastmod`                                                      | Source code                                     |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| `blog`                                                                                                                     | `MAX(updatedAt)` Article `isNews=false, status=published`             | `src/app/sitemap-index.xml/route.ts:106-114`    |
| `news` (sub-sitemap custom)                                                                                                | `MAX(updatedAt)` Article `isNews=true, status=published`              | `src/app/sitemap-index.xml/route.ts:96-104`     |
| `knowledge-*`                                                                                                              | `MAX(updatedAt)` KnowledgeEntry `status in [published, deprecated]`   | `src/app/sitemap-index.xml/route.ts:116-124`    |
| `pages`, `faq`, `help`, `cas-concrets`, `comparaisons`, `implementation`, `implantations`, `villes-*`, `services-villes-*` | `BUILD_TIME` env (fallback `new Date()` recalculé à chaque ISR cycle) | `src/app/sitemap-index.xml/route.ts:73-80, 137` |

**Fix P0-2 du 2026-05-18** : avant, `FALLBACK_LASTMOD` était figé au module-load → tous les sub-sitemaps non-DB partageaient le boot time du worker → Google détectait le pattern uniforme et désactivait le signal `lastmod`. Désormais recalculé à chaque ISR cycle (revalidate=3600) si `BUILD_TIME` absent (`src/app/sitemap-index.xml/route.ts:62-72`).

**🟡 DÉPENDANCE OPS** : `BUILD_TIME` doit être injecté dans le `Dockerfile` GH Actions au moment du build. Si quelqu'un retire l'injection, fallback OK mais `lastmod` cesse de refléter la date de build réelle. À documenter dans ADR 0026.

### 2.4 Status

🟢 **Conforme spec sitemaps.org 0.9 + best practice Google `lastmod` honnête**. Cache CDN court (10 min) pour propagation rapide post-publish.

---

## 3. Sub-sitemaps (15+)

Source : `src/app/sitemap.ts` (convention Next 16 `MetadataRoute.Sitemap`), exposés à `/sitemap/<id>.xml`.

### 3.1 Tableau exhaustif des sub-sitemaps déclarés

| #            | ID sub-sitemap                                 | URL exposée                                   | Type                                             | Source builder                                                                                   | Volume estimé                              |
| ------------ | ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1            | `pages`                                        | `/sitemap/pages.xml`                          | Static (FR+EN si EN actif)                       | `buildPagesSitemap()` `src/app/sitemap.ts:418-435`                                               | ~60-80 URLs                                |
| 2            | `blog`                                         | `/sitemap/blog.xml`                           | DB-aware tier-1 + FS fallback                    | `buildBlogSitemap()` `src/app/sitemap.ts:441-545`                                                | ~30 + N posts                              |
| 3            | `faq`                                          | `/sitemap/faq.xml`                            | FS only V1 (DB tier-1 V1.5+)                     | `buildFaqSitemap()` `src/app/sitemap.ts:582-594`                                                 | Variable                                   |
| 4            | `help`                                         | `/sitemap/help.xml`                           | FS centre-aide + categories                      | `buildHelpSitemap()` `src/app/sitemap.ts:547-569`                                                | Variable                                   |
| 5            | `cas-concrets`                                 | `/sitemap/cas-concrets.xml`                   | FS case-studies + industry filters               | `buildCasConcretsSitemap()` `src/app/sitemap.ts:602-621`                                         | Variable                                   |
| 6            | `comparaisons`                                 | `/sitemap/comparaisons.xml`                   | FS comparaisons                                  | `buildComparaisonsSitemap()` `src/app/sitemap.ts:623-635`                                        | Variable                                   |
| 7            | `implementation`                               | `/sitemap/implementation.xml`                 | FS `/par-fonction/[slug]` × 2 locales            | `buildImplementationSitemap()` `src/app/sitemap.ts:637-651`                                      | Variable                                   |
| 8            | `implantations`                                | `/sitemap/implantations.xml`                  | Hub + 12 régions indexable (Corse noindex)       | `buildImplantationsHubSitemap()` `src/app/sitemap.ts:657-695`                                    | ~26 URLs                                   |
| 9            | `services-villes-audit`                        | `/sitemap/services-villes-audit.xml`          | Villes avec `copy.services.audit`                | `buildServicesVillesSitemap('audit')` `src/app/sitemap.ts:765-794`                               | V1=2, cible ~4 300                         |
| 10           | `services-villes-interventions`                | `/sitemap/services-villes-interventions.xml`  | Villes avec `copy.services.interventions`        | idem `('interventions')`                                                                         | V1=2, cible ~4 300                         |
| 11           | `services-villes-implementation`               | `/sitemap/services-villes-implementation.xml` | Villes avec `copy.services.implementation`       | idem `('implementation')`                                                                        | V1=2, cible ~4 300                         |
| 12           | `services-villes-un-a-un`                      | `/sitemap/services-villes-un-a-un.xml`        | 4e verticale S+2 City Domination                 | idem `('un-a-un')` `src/app/sitemap.ts:341-342, 762`                                             | V1=0, cible ~4 300                         |
| 13..N        | `villes-<region>` ou `villes-<region>-<chunk>` | `/sitemap/villes-<region>(-<n>).xml`          | Chunké à 1000 URLs/sitemap                       | `buildVillesByRegionSitemap()` `src/app/sitemap.ts:705-740` + `getVillesSitemapIds()` `:197-219` | ~14 IDs (12 régions ind. + chunks IDF/Sud) |
| N+1..M       | `knowledge-<n>`                                | `/sitemap/knowledge-<n>.xml`                  | DB KnowledgeEntry chunké 500 entries × 2 locales | `buildKnowledgeSitemapChunk()` `src/app/sitemap.ts:257-260, 363-373`                             | DB-aware, 0 si bootstrap                   |
| **CUSTOM 1** | `sitemap-news.xml`                             | `/sitemap-news.xml`                           | Google News namespace `xmlns:news`               | Route Handler `src/app/sitemap-news.xml/route.ts`                                                | 0-1000 (fenêtre 48h glissante)             |
| **CUSTOM 2** | `sitemaps/images-fr.xml`                       | `/sitemaps/images-fr.xml`                     | Image Sitemap 1.1 image-bank V1 FR               | `src/app/sitemaps/images-fr.xml/route.ts`                                                        | Variable                                   |
| **CUSTOM 3** | `sitemaps/images-en.xml`                       | `/sitemaps/images-en.xml`                     | Image Sitemap 1.1 image-bank V1 EN               | `src/app/sitemaps/images-en.xml/route.ts`                                                        | Variable                                   |

**Total comptabilisé** : **12 sub-sitemaps statiques + N chunks villes-_ dynamiques + M chunks knowledge-_ DB-aware + 3 sub-sitemaps custom** = entre **15 et 17 fichiers exposés** suivant la phase (V1 vs V2/V3 city domination).

### 3.2 Pattern de chunking (anti-50K URLs Google)

`SITEMAP_CHUNK_SIZE = 1000` (`src/app/sitemap.ts:62`). Best practice 2026 = 2 % du plafond Google 50K pour garder Search Console lisible et le crawl budget bien alloué. Le chunking villes est déterministe (tri par `region.slug`, puis tri `villes.slug`) pour qu'un nouveau ville n'invalide qu'1 chunk au lieu de tous.

### 3.3 Anti-doorway HCU 2024 — tier-1 only dans sitemap

- Blog : `getIndexableBlogPosts()` filtre tier-1 (`src/app/sitemap.ts:444-456`).
- Villes : `getIndexableVilles()` filtre sur `copy` présent (V1 ~Paris).
- Régions : `getIndexableRegions()` exclut Corse `noindex:true`.
- Services × villes : exige `copy.services.<service>` présent (auto-promotion tier-1 dès qu'un copy substantiel existe).
- News : `indexationTier='tier_1_indexable'` + fenêtre 48h (`src/app/sitemap-news.xml/route.ts:62-71`).
- KB : `audience='public'` + `status in [published, deprecated]` + `deletedAt IS NULL`.

🟢 **Aucune doorway page indexée**. Conforme HCU.

### 3.4 EN locale filtering

`filterEnIfDisabled()` (`src/app/sitemap.ts:295-308`) retire toutes les entries `/en/*` + nettoie `alternates.languages.en` quand EN désactivé. Évite que Googlebot crawle des 301s (waste crawl budget).

### 3.5 Status

🟢 **Architecture solide, scale-ready jusqu'à 12 900 URLs services×villes V3 sans toucher au code**. 1 dépendance critique : la table `Article` + `KnowledgeEntry` doivent être migrées en prod (fail-soft `try/catch` couvre le bootstrap).

---

## 4. llms.txt v0.2

Source : `src/app/llms.txt/route.ts` (edge runtime, exposé à `/llms.txt`).

### 4.1 Structure conforme spec llmstxt.org

| Section                                           | Présente                                                                                | Source                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| `# Site`                                          | ✅ titre + description + URL + langues + hébergement + lien vers `llms-full.txt`        | `src/app/llms.txt/route.ts:32-38`  |
| `## Important pages` (Modules + Preuve & méthode) | ✅ 7 entrées                                                                            | `src/app/llms.txt/route.ts:40-51`  |
| `## Connaissances & contenu`                      | ✅ 4 entrées (Blog, FAQ, Glossaire, Guide IA)                                           | `src/app/llms.txt/route.ts:53-58`  |
| `## Implantations géographiques`                  | ✅ 3 entrées (Hub, IDF, audit par ville)                                                | `src/app/llms.txt/route.ts:60-64`  |
| `## Galerie & ressources`                         | ✅ 3 entrées (image-bank, centre-aide, plan-du-site)                                    | `src/app/llms.txt/route.ts:66-70`  |
| `## Contact & presse`                             | ✅ 2 entrées                                                                            | `src/app/llms.txt/route.ts:72-75`  |
| `## Stratégie & positionnement`                   | ✅ 5 bullets doctrine                                                                   | `src/app/llms.txt/route.ts:77-83`  |
| `## Optional`                                     | ✅ 6 liens (llms-full, sitemap-index, images-fr, images-en, news, plan humain)          | `src/app/llms.txt/route.ts:85-92`  |
| `## Excluded`                                     | ✅ 6 patterns (admin, mes-donnees, reserver, design/components/sections, /api/_, /en/_) | `src/app/llms.txt/route.ts:94-101` |

**Évolution P1-9 (2026-05-18)** : enrichissement de 4 à 14 entrées couvrant tous les modules sitemap. Cible AEO : Claude.ai / ChatGPT Search / Perplexity / Bing Copilot indexent en priorité les URLs listées — manquer une section = perdre la visibilité de cette catégorie.

### 4.2 Cache HTTP

`Cache-Control: public, max-age=3600, stale-while-revalidate=86400, stale-if-error=604800` (`src/app/llms.txt/route.ts:108`). Conforme spec (1h fresh + 24h SWR + 7j fallback erreur).

### 4.3 Companion `llms-full.txt`

Présent : `src/app/llms-full.txt/route.ts` (edge runtime). Émet en plus :

- Pricing dérivé du SSOT `pricing.ts` (zéro hardcode).
- Block FAQ inline (FR+EN).
- Block cas concrets inline.
- Block méthodologie 4 étapes.
- Block engagement (mobile-first, RGPD, OÜ, pas de Stripe/Resend).

🟢 **Excellent, contenu inline copy-pastable par les LLMs**. Audit indexation P1-9 livré.

### 4.4 Status

🟢 **Conforme spec llmstxt.org + companion `llms-full.txt` complet**.

---

## 5. ai.txt

Source : `src/app/ai.txt/route.ts` (edge runtime, exposé à `/ai.txt`). Standard Spawning.ai / IAB AI Preferences draft 2025.

### 5.1 Structure

| Élément                                           | Valeur                                                                              | Source                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------- |
| Préférence globale `ai-training: allow` (UA `*`)  | ✅                                                                                  | `src/app/ai.txt/route.ts:32-38` |
| Allowlist `ai-citation: allow` (6 bots)           | ClaudeBot, OAI-SearchBot, PerplexityBot, GPTBot, Google-Extended, Applebot-Extended | `src/app/ai.txt/route.ts:43-65` |
| Disallowlist `ai-training: disallow` (4 scrapers) | Bytespider, CCBot, Diffbot, omgili                                                  | `src/app/ai.txt/route.ts:69-79` |
| Conditions commerciales                           | `commercial-reuse-license: contact@axion-ia.com`                                    | `src/app/ai.txt/route.ts:84-85` |
| Cache HTTP                                        | `max-age=86400, stale-while-revalidate=604800, stale-if-error=604800`               | `src/app/ai.txt/route.ts:93`    |

**Cohérence avec robots.txt** : les 4 disallowés correspondent exactement à `AI_BOTS_DISALLOWED` de `robots.ts:80-85`. Les 6 alloués `ai-citation:` sont un sous-ensemble des 14 alloués `robots.txt`.

### 5.2 Bonus : `/.well-known/ai-policy.json`

Route Handler additionnel `src/app/.well-known/ai-policy.json/route.ts`. Standard émergent utilisé par Perplexity, Claude, ChatGPT, Gemini, Copilot. Émet un JSON structuré incluant :

- `publisher` : Axion-IA OÜ
- `license` : CC-BY-4.0
- `attribution.required: true`
- `training.allowed: true` + attribution required
- `search_indexing.bots_explicitly_allowed` : 13 bots (cohérent robots.txt)
- `rag.allowed: true` + citation_format
- `expires: 2027-05-16`

🟢 **Triple ceinture AI discovery (robots.txt + ai.txt + ai-policy.json)**. Couverture maximale.

### 5.3 Status

🟢 **Conforme spec Spawning.ai draft + bonus JSON policy structurée**.

---

## 6. security.txt

Source : `src/app/.well-known/security.txt/route.ts` (force-static, exposé à `/.well-known/security.txt`).

### 6.1 Contenu RFC 9116

| Champ                  | Valeur                                              | Source                                        |
| ---------------------- | --------------------------------------------------- | --------------------------------------------- |
| `Contact:`             | `mailto:contact@axion-ia.com`                       | `src/app/.well-known/security.txt/route.ts:8` |
| `Expires:`             | `2027-05-16T23:59:59.000Z`                          | `:9`                                          |
| `Preferred-Languages:` | `fr, en`                                            | `:10`                                         |
| `Canonical:`           | `https://axion-ia.com/.well-known/security.txt`     | `:11`                                         |
| `Policy:`              | `https://axion-ia.com/fr/politique-confidentialite` | `:12`                                         |
| Cache HTTP             | `max-age=86400, immutable`                          | `:22`                                         |

### 6.2 Conformité RFC 9116

- ✅ `Contact` obligatoire
- ✅ `Expires` obligatoire (< 1 an dans le futur, ici ~12 mois — conforme)
- ✅ `Canonical` recommandé
- ✅ `Policy` recommandé
- ✅ `Preferred-Languages` recommandé
- ❌ `Encryption` (PGP key URL) absent — optionnel, non bloquant
- ❌ `Acknowledgments` (hall of fame chercheurs) absent — optionnel, futur

### 6.3 Status

🟢 **Conforme RFC 9116 minimal viable**. **🟡 RAPPEL** : `Expires: 2027-05-16` — programmer un renouvellement avant cette date (cron annuel ou ticket calendrier).

---

## 7. IndexNow flow

### 7.1 Inventaire fichiers

| Élément                   | Path                                                                              | Rôle                                                                   |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Key file public           | `public/3a5c32d22b04f1430690cc33eaec6be9.txt` (contenu = la clé)                  | Sert `INDEXNOW_KEY` sur `https://axion-ia.com/${INDEXNOW_KEY}.txt`     |
| Matcher proxy             | `src/proxy.ts:116, 125` exclut `.*\\.txt$` du i18n redirect                       | Garantit que `/<key>.txt` n'est pas redirigé `/fr/<key>.txt`           |
| Endpoint backup dynamique | `src/app/api/indexnow/key/route.ts` (edge runtime)                                | Backup debug, n'est plus le `keyLocation` officiel                     |
| Helper centralisé         | `src/lib/indexnow.ts` (`pingIndexNow()`)                                          | Fire-and-forget, validation host, log Sentry                           |
| Factory payload           | `src/lib/seo-content-gen-factories.ts:420-439` (`buildIndexNowPayload()`)         | Construction `{host, key, keyLocation, urlList}` cap 10 000 URLs/batch |
| Endpoint REST exposé      | `src/app/api/indexnow/route.ts` (edge runtime)                                    | POST + HMAC SHA-256 `X-Axion-Indexnow-Signature` requis                |
| Worker BullMQ             | `src/server/queue/workers/content-indexnow-worker.ts`                             | Queue `content-indexnow`, ping upstream `api.indexnow.org`             |
| Alertes Telegram          | `src/server/content-gen/shared/content-gen-alerts.ts` (`alertIndexNowFailStreak`) | Escalade fail streak 3/10/30 (Redis key `indexnow:fail-streak` TTL 1h) |
| Enqueue depuis publish    | `src/server/content-gen/indexing/enqueue.ts`                                      | Appelé par `article.ts` action server post-publish                     |

### 7.2 HMAC secret

`INDEXNOW_INTERNAL_HMAC_SECRET` (≥ 32 chars). Vérifié sur l'endpoint POST `/api/indexnow` (`src/app/api/indexnow/route.ts:33-58`). Constant-time comparison. Refuse 401 si signature absente, longueur ≠ 64 hex, ou secret manquant/court. Empêche un tiers d'abuser de la clé pour spammer Bing avec des URLs malveillantes.

**Doctrine** : la majorité du pipeline appelle directement `api.indexnow.org` via `pingIndexNow()` ou le worker (bypass de cette route), donc l'HMAC ne protège que l'usage manuel/debug curl. Sain.

### 7.3 Rate-limit

| Élément                | Valeur                       | Source                                                    |
| ---------------------- | ---------------------------- | --------------------------------------------------------- |
| BullMQ limiter         | `30 req/min`                 | `src/server/queue/workers/content-indexnow-worker.ts:147` |
| Concurrency worker     | `2`                          | `:146`                                                    |
| Job retention          | 1000 completed / 5000 failed | `:151-152`                                                |
| Timeout fetch upstream | `20 s` (AbortController)     | `:107-108`                                                |

### 7.4 Fail-streak monitoring (P0-10 audit 2026-05-15)

- INCR Redis `indexnow:fail-streak` (TTL 1h auto-refresh) à chaque échec upstream.
- DEL au succès suivant.
- Alerte Telegram à 3, 10, 30 fails consécutifs (escalade).
- Source : `src/server/queue/workers/content-indexnow-worker.ts:28-58`.

### 7.5 Kill-switch global

Vérifie `content_gen.kill_switch.active` avant chaque ping (`src/server/queue/workers/content-indexnow-worker.ts:70-78`). Si Will met le kill-switch, on n'envoie plus de signal IndexNow aux moteurs, cohérent avec une pause éditoriale.

### 7.6 Coverage IndexNow

Protocole partagé : **Bing + Yandex + Seznam + Naver** → 1 seul ping `api.indexnow.org` les notifie tous. Donc l'allow `YandexBot` dans robots.txt + IndexNow ping = Yandex est notifié des nouvelles URLs **mais le crawl effectif Yandex n'a pas de monitoring API côté nous**.

### 7.7 Status

🟢 **IndexNow flow complet, sécurisé HMAC + fail-streak Telegram + rate-limit + kill-switch**. Architecture exemplaire.

---

## 8. GSC + Bing + Yandex API

### 8.1 Google Search Console (read-only)

| Élément                                                 | Fichier                                                                                         | Status                         |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| Client OAuth refresh_token flow                         | `src/server/content-gen/seo/gsc-client.ts:37-79`                                                | ✅ Codé                        |
| Cache access_token 55 min                               | `:22-27, 75-77`                                                                                 | ✅                             |
| `gscTopKeywordsForUrl()` (searchAnalytics.query)        | `:101-183`                                                                                      | ✅                             |
| `gscInspectUrl()` (URL Inspection API, quota 2000/jour) | `:235-280`                                                                                      | ✅ Codé P1-10 audit 2026-05-18 |
| Env vars requises                                       | `GSC_OAUTH_CLIENT_ID`, `GSC_OAUTH_CLIENT_SECRET`, `GSC_OAUTH_REFRESH_TOKEN`, `GSC_PROPERTY_URL` | À vérifier Coolify             |
| Skip silencieux si creds absents                        | ✅ (graceful degrade dev/preview)                                                               | `:113, 122, 240-247`           |
| Worker consommateur                                     | `content-keyword-sync-worker.ts` (cron hebdo lundi 04:00 UTC)                                   | ✅ Codé `:59-100`              |

### 8.2 Google Indexing API (write, JobPosting + BroadcastEvent uniquement)

| Élément                                                      | Fichier                                                | Status                    |
| ------------------------------------------------------------ | ------------------------------------------------------ | ------------------------- |
| Client OAuth refresh_token                                   | `src/server/content-gen/seo/indexing-client.ts:36-77`  | ✅ Codé                   |
| `indexingPublishUrl(url, type)` (URL_UPDATED / URL_DELETED)  | `:86-135`                                              | ✅                        |
| Sentry capture sur 400/403/410 (changement politique Google) | `:120-130`                                             | ✅ P1-20 audit 2026-05-18 |
| Env var dédiée                                               | `INDEXING_OAUTH_REFRESH_TOKEN` (scope `auth/indexing`) | À vérifier Coolify        |
| Worker BullMQ                                                | `content-google-indexing-worker.ts`                    | ✅ Codé                   |
| Quota limiter                                                | 200/jour (gratuit Google)                              | `:70`                     |
| Job retention                                                | 1000 completed / 5000 failed                           | `:74-75`                  |
| Kill-switch                                                  | ✅ check `content_gen.kill_switch.active`              | `:33-39`                  |

**⚠️ Limite officielle assumée dans le code** (`indexing-client.ts:18-21, 9-12`) : Google n'accepte que `JobPosting` et `BroadcastEvent`. Pour Articles/FAQ, retour 200 sans effet. IndexNow couvre Bing/Yandex en parallèle.

### 8.3 Bing Webmaster Tools (read-only V1)

| Élément                                              | Fichier                                                         | Status                         |
| ---------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `bingWmtGetCrawlStats(daysWindow)` (`GetCrawlStats`) | `src/server/content-gen/seo/bing-wmt-client.ts:58-92`           | ✅ Codé P2-30 audit 2026-05-18 |
| `bingWmtGetUrlInfo(url)` (`GetUrlInfo`)              | `:100-127`                                                      | ✅                             |
| `bingWmtGetQuota()` (`GetUrlSubmissionQuota`)        | `:136-156`                                                      | ✅                             |
| `isBingWmtReady()` helper                            | `:159-161`                                                      | ✅                             |
| Env var requise                                      | `BING_WMT_API_KEY` (créer via bing.com/webmasters → API access) | À vérifier Coolify             |
| Sentry capture sur erreur                            | ✅                                                              | `:71-75`                       |
| Doctrine                                             | Read-only V1 (IndexNow universal couvre déjà la soumission)     | `:14-18`                       |

### 8.4 Yandex Webmaster API

**🔴 ABSENT** : aucun client Yandex Webmaster Tools dans le repo.

Seule présence Yandex = l'allow `YandexBot` dans `robots.ts:77` + le ping universel via IndexNow (qui notifie Yandex automatiquement). Mais **aucun monitoring côté nous** :

- Pas de `yandex-wmt-client.ts`.
- Pas de worker keyword-sync Yandex.
- Pas de stats crawl Yandex en dashboard admin.

**Impact** : visibilité ciblée Europe Est annoncée par P1-3 (~50 M users russophones) ne sera pas mesurable. Ajouter `src/server/content-gen/seo/yandex-wmt-client.ts` similaire au Bing client, voir https://yandex.com/dev/webmaster/.

### 8.5 Soumission sitemap manuelle (UNKNOWN)

| Console               | Sitemap soumis ?                                                                                   | Source              |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------- |
| Google Search Console | **UNKNOWN** — depuis le code, impossible à vérifier (action manuelle dans la console Google)       | STOP & ASK Will §10 |
| Bing Webmaster Tools  | **UNKNOWN** — Bing accepte automatiquement via IndexNow mais le sitemap explicite reste recommandé | STOP & ASK Will §10 |
| Yandex Webmaster      | **UNKNOWN** — aucun client API, soumission manuelle requise                                        | STOP & ASK Will §10 |

### 8.6 Status

🟡 **GSC + Indexing API + Bing WMT clients codés et production-ready**, mais **Yandex Webmaster API absent** (gap réel) et **vérification soumission sitemap manuelle ouverte** (STOP & ASK Will).

---

## 9. Gaps consolidés

| #   | Domaine                                      | Gap                                                                                                                                                                                                                            | Priorité | Effort                                                         | Source                            |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------- | --------------------------------- |
| G1  | Yandex Webmaster API                         | Aucun client `yandex-wmt-client.ts`, aucun monitoring crawl Yandex                                                                                                                                                             | **P1**   | 4-6h (modèle = `bing-wmt-client.ts`)                           | §8.4                              |
| G2  | Soumission sitemap GSC/Bing/Yandex           | Action manuelle dans les 3 consoles, non automatisable, non vérifiable depuis le code                                                                                                                                          | **P1**   | 30 min (action humaine)                                        | §8.5                              |
| G3  | `BUILD_TIME` injection                       | Dépendance forte au Dockerfile GH Actions ; si retiré, lastmod cesse de refléter la date réelle                                                                                                                                | **P2**   | Documenter dans ADR 0026                                       | §2.3                              |
| G4  | `security.txt` Expires 2027-05-16            | Programmer renouvellement annuel                                                                                                                                                                                               | **P3**   | 5 min (ticket calendrier)                                      | §6.3                              |
| G5  | `Encryption` (PGP) absent dans security.txt  | Optionnel RFC 9116, signal de maturité sécu                                                                                                                                                                                    | **P3**   | 1h (générer key + ajouter URL)                                 | §6.2                              |
| G6  | KeyLocation IndexNow magic file              | `public/3a5c32d22b04f1430690cc33eaec6be9.txt` doit rester sync avec `INDEXNOW_KEY` env var. Si rotation de clé, oubli possible                                                                                                 | **P2**   | Documenter procédure rotation                                  | §7.1                              |
| G7  | `INDEXING_OAUTH_REFRESH_TOKEN` vérification  | Env vars OAuth pas vérifiables depuis le code (vérifier Coolify)                                                                                                                                                               | **P2**   | 5 min (check Coolify env panel)                                | §8.2                              |
| G8  | `BING_WMT_API_KEY` vérification              | Idem (créer la clé via bing.com/webmasters si pas déjà fait)                                                                                                                                                                   | **P2**   | 15 min                                                         | §8.3                              |
| G9  | Sub-sitemaps `images-fr.xml`/`images-en.xml` | Référencés dans `CUSTOM_SITEMAPS` mais leur builder dépend de l'image-bank V1 — si la table image-bank n'est pas migrée en prod, ces sitemaps risquent d'être vides ou 500                                                     | **P2**   | Vérifier que `pnpm prisma migrate deploy` couvre image-bank V1 | §3.1                              |
| G10 | Pas de cron sitemap-diff postbuild auto      | Le worker `content-indexnow-worker.ts` est événementiel temps réel ; pas de batch quotidien 02:00 mentionné. Commentaire `:9-11` mentionne `scripts/indexnow-ping.ts` postbuild — à vérifier qu'il est wired dans le CI deploy | **P2**   | 1-2h vérif + éventuel cron                                     | `content-indexnow-worker.ts:8-11` |

**Aucun P0** : la chaîne discovery est opérationnelle. Les gaps P1 sont des extensions de couverture (Yandex) ou des actions humaines non-bloquantes (soumission console manuelle).

---

## 10. STOP & ASK Will

Le code ne peut pas répondre à ces questions — Will doit vérifier dans les 3 consoles externes :

### 10.1 Google Search Console

- **Q1** : Es-tu connecté à `https://search.google.com/search-console` avec la propriété `sc-domain:axion-ia.com` (Domain property, pas URL-prefix) ?
- **Q2** : Dans **Sitemaps**, le fichier `https://axion-ia.com/sitemap-index.xml` est-il listé en statut **Success** (lu dans les 7 derniers jours, 0 erreur) ?
- **Q3** : Si oui, combien d'**URLs Discovered** vs **URLs Submitted** ? (cible > 80 % discovered).

### 10.2 Bing Webmaster Tools

- **Q4** : Es-tu connecté à `https://www.bing.com/webmasters` avec la propriété `axion-ia.com` (vérification DNS ou meta) ?
- **Q5** : Dans **Sitemaps**, `https://axion-ia.com/sitemap-index.xml` est-il listé ? (Bing l'accepte automatiquement via IndexNow mais la soumission explicite accélère).
- **Q6** : Dans **IndexNow** (menu dédié), historique 7j : combien de pings reçus de notre côté ? 0 = problème réseau ou kill-switch actif.
- **Q7** : Une `BING_WMT_API_KEY` a-t-elle été générée (menu **API access**) et injectée dans Coolify ? Sans elle, `bing-wmt-client.ts` retourne null (P2-30 codé mais inactif).

### 10.3 Yandex Webmaster

- **Q8** : As-tu créé un compte sur `https://webmaster.yandex.com` et ajouté/vérifié la propriété `axion-ia.com` ?
- **Q9** : Si oui, le sitemap-index est-il soumis manuellement (menu **Sitemap files**) ?
- **Q10** : Souhaites-tu qu'on ouvre un ticket pour coder un `yandex-wmt-client.ts` (4-6h dev, similaire au Bing client) ?

### 10.4 OAuth Google credentials

- **Q11** : Les 4 env vars Coolify sont-elles set en prod ?
  - `GSC_OAUTH_CLIENT_ID`
  - `GSC_OAUTH_CLIENT_SECRET`
  - `GSC_OAUTH_REFRESH_TOKEN` (scope GSC search analytics)
  - `INDEXING_OAUTH_REFRESH_TOKEN` (scope Indexing API)
  - `GSC_PROPERTY_URL` (ex: `sc-domain:axion-ia.com`)

Sans ces vars, `gsc-client.ts`, `indexing-client.ts` et le worker `content-keyword-sync-worker.ts` skip silencieusement (graceful degrade documenté).

### 10.5 Rotation INDEXNOW_KEY

- **Q12** : La clé actuelle est `3a5c32d22b04f1430690cc33eaec6be9` (fichier public + supposée dans `INDEXNOW_KEY` env Coolify). En cas de rotation future, qui propage le changement dans (a) `public/<new-key>.txt`, (b) env var Coolify, (c) suppression de l'ancien fichier ? Documenter une mini-procédure dans ADR 0026 ou nouveau ADR.

---

**Fin du fichier 11-INDEXATION-DISCOVERY.md** — auditeur senior SEO/Indexation, 2026-05-18.
