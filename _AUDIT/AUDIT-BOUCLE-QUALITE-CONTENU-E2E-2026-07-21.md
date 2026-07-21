# AUDIT E2E — Production, publication, mesure et qualité du contenu

**Date** : 2026-07-21 · **SHA prod** : `7fe76d5158a399c39b28255321e2dad6d64989df` (`origin/main`, image du 2026-07-21T05:24Z)
**Méthode** : lecture seule. Toute affirmation est adossée à une requête SQL prod, une commande live, ou `fichier:ligne` sur `origin/main`.

> ⚠️ **Piège méthodologique majeur** : le working tree local était sur `feat/services-villes-unify` (2026-07-08), soit une branche différente de la prod. Un audit mené sur le tree local produit des conclusions fausses. Toutes les citations ci-dessous sont vérifiées contre `origin/main`.

---

## 1. Synthèse exécutive

1. **La production de contenu est à l'arrêt.** Le compte OpenAI est en `insufficient_quota` (vérifié par appel API live depuis le conteneur worker). Dernière publication : 2026-07-20 15:01. Sur les 10 derniers jours, 5 jours à 100 % d'échec.
2. **Le taux de publication réel est de 8,9 %**, pas 30 % : 1 945 jobs lancés depuis le 2026-06-16 → **173 articles**.
3. **Le corpus produit 9 clics Google.** Sur 3 531 pages mesurées : 22 clics au total, dont 13 sur la page d'accueil (marque). 3 435 pages à zéro impression.
4. **49 % du corpus publié porte au moins un défaut dur** : 50 articles avec un token de prix non résolu, 35 avec une statistique attribuée à des institutions qui ne l'ont jamais publiée, 15 avec `alt="text"`, 10 avec des tokens `[lien]`, 3 avec du jargon de sprint interne.
5. **Le `qualityScore` est positivement corrélé aux défauts** (r ≈ +0,25). Il ne mesure pas la qualité mais la densité rédactionnelle, et sert de tampon d'auto-validation.
6. **L'analytics n'a jamais fonctionné.** L'instance Plausible contient 11 événements au total, tous du 2026-05-13. Deux bugs indépendants et cumulés.
7. **Les instruments de mesure sont en panne silencieuse** : 3 variables d'env posées sur le conteneur WEB et absentes du WORKER, Sentry cassé, aucune série temporelle SEO.
8. **L'architecture, elle, est saine** : indexation à 3 niveaux, fallback ville proche, doctrine bots training/citation, JSON-LD valide à 100 %, redirections EN→FR propres. Le problème n'est pas la conception, c'est le générateur et l'instrumentation.

**Coût de l'inaction** : chaque jour de production ajoute ~20 pages au passif factuel d'un organisme certifié Qualiopi, sans contrepartie de visibilité mesurable.

---

## 2. Hypothèses du pré-audit INFIRMÉES

Section obligatoire. Sept croyances contredites par les faits.

| # | Hypothèse | Verdict | Preuve |
|---|---|---|---|
| 1 | « Le juge LLM ne tourne que sur les articles sous le seuil » | **FAUX** | Second chemin : `v7-phase8-shared.ts:407` → `runMultiJudge()` → `reviewArticle()` (`multi-judge-ensemble.ts:152`), exécuté à la génération sur tous les articles. Juge sur `gpt-4o` depuis 2026-07-09, pas Claude. |
| 2 | « `Article.editorialScore` n'est jamais écrit » | **FAUX** | `content-publish-worker.ts:680` et `:723`. *Nuance* : couverture réelle 1/173 articles, 22/1945 jobs. |
| 3 | « Dérive de schéma prod (antécédent content-engine-v2) » | **FAUX aujourd'hui** | 209 modèles ↔ 210 tables (extra = `_prisma_migrations`), 204 enums ↔ 204. `articles.featured_image_alt_fr` existe désormais. Dérive résolue. |
| 4 | « `prisma migrate deploy` échoue silencieusement » | **NON CONFIRMÉ** | `pending = 0`, dernière migration appliquée 2026-07-20 21:25. Les 6 `rolled_back` datent de mai et sont résolus. *Réserve : un échec avant insertion de ligne serait invisible par construction.* |
| 5 | « Bloquer `Google-Extended` exclut des AI Overviews et de Gemini » | **FAUX** | Doc Google vérifiée en live : « *does not impact a site's inclusion in Google Search nor is it used as a ranking signal* ». Ce n'est pas un crawler (product token, zéro requête HTTP). Les AI Overviews sont servies depuis l'index **Googlebot**. Coût réel du blocage ≈ **zéro**. |
| 6 | « `glossaire.xml` quasi vide = bug `stub.invalid` » | **FAUX** | Les 60 termes sont sous le seuil de 80 mots (`glossary-extension.ts:829,841-845`) → `noindex, follow` **et** exclusion du sitemap. Cohérence page↔sitemap exemplaire. Décision anti-thin-content assumée. |
| 7 | « L'ISR repeuple les sitemaps sous 1 h » | **FAUX** | `src/app/sitemap.ts:108` → `revalidate = 86400` (**24 h**). Le `s-maxage=600` observé est le TTL CDN, pas l'ISR. |
| 8 | « Le consentement fait perdre du trafic mesuré » | **FAUX** | `Plausible` et `RefererTracker` sont montés inconditionnellement (`layout.tsx:312,316`) ; seul Clarity est derrière la CMP. Perte due au consentement : 0 %. |

---

## 3. Tableau de statut [CODÉ] → [ALIMENTÉ]

Un item n'est « fait » que s'il est **[ALIMENTÉ]** (la donnée existe et grossit en base).

| Item | CODÉ | BRANCHÉ | PLANIFIÉ | ACTIF PROD | ALIMENTÉ | Preuve |
|---|:--:|:--:|:--:|:--:|:--:|---|
| `site-route-gsc` | ✅ | ✅ | ✅ | ✅ | ✅ | 3 531 routes, run 2026-07-21T04:00Z |
| `site-route-discovery` / `-inspector` / `-anomaly-detector` | ✅ | ✅ | ✅ | ✅ | ✅ | 3 932 routes, 383 anomalies |
| `content-web-vitals-monitor` (RUM) | ✅ | ✅ | ✅ | ✅ | ✅ | 65 853 échantillons |
| `content-tier-lifecycle` (perf → tier) | ✅ | ✅ | ✅ | ✅ | ✅ | 7 promotions |
| `content-keyword-sync` | ✅ | ✅ | ✅ | ✅ | ⚠️ | 64 lignes, **sans historique** |
| `content-monitoring` | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | branche indexation `return` immédiat (flag absent) |
| `content-similarity-monitor` | ✅ | ✅ | ✅ | ✅ | ⚠️ | **30 échecs** (`headers` hors scope) ; compare les **titres** seulement |
| `content-weekly-report` | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | 2 succès / **5 échecs** SMTP |
| **`embeddings-backfill`** | ✅ | ✅ | ✅ | ❌ | **❌** | **0 embedding / 173 articles.** Flag absent du WORKER |
| **`content-psi-monitor`** | ✅ | ✅ | ✅ | ❌ | **❌** | 0 échantillon `psi-lab`. `GOOGLE_PSI_API_KEY` absente |
| **`external-links-monitor`** | ✅ | ✅ | ✅ | ❌ | **❌** | Cron en Redis, worker non démarré |
| **`content-refresh`** | ✅ | ⚠️ | **❌** | ❌ | **❌** | Aucun cron, aucune clé Redis. Jamais exécuté |
| **`gsc-hcu-monitor`** | ⚠️ stub | ⚠️ | **❌** | ❌ | **❌** | `gsc-hcu-monitor-worker.ts:54` « V1 stub » |
| **`gscInspectUrl()`** | ✅ | **❌** | ❌ | ❌ | **❌** | 0 call site sur `origin/main` |
| Historisation SEO (`content_metrics`) | ✅ | **❌** | ❌ | ❌ | **❌** | Table **vide** |
| Attribution `Submission` → page | **❌** | ❌ | ❌ | ❌ | **❌** | Pas de `articleId`/`landingUrl` ; `count(referer)=0` sur 8 lignes |
| **Plausible** | ✅ | **❌** | — | **❌** | **❌** | 11 événements depuis toujours, 0 sur 30 j |
| Index HNSW `articles.embedding` | ✅ | ✅ | — | ✅ | **❌** | Index créé, **0 vecteur** |

**Score : 7 items sur 24 atteignent [ALIMENTÉ] sans réserve.**

---

## 4. La panne de production

### 4.1 Cause racine — vérifiée par appel API live

```
HTTP 429
"message": "You exceeded your current quota, please check your plan and billing details."
"type": "insufficient_quota"
```

### 4.2 Trois défauts qui l'ont rendue invisible

1. **`providers/openai.ts:63-64`** mappe *tout* 429 vers `ProviderError("OpenAI rate limited", "rate_limited", "openai", true)` — et **jette `err.message`**. OpenAI renvoie 429 pour un rate limit transitoire **et** pour un quota épuisé. La branche générique voisine (`:74`) conserve pourtant le message. Conséquence : en base et en console admin, la cause réelle est indiscernable.
2. `retryable: true` → le système réessaie une opération structurellement impossible et **brûle un slot** à chaque fois. Slots monotones ⇒ **1 167 créneaux de couverture perdus définitivement**.
3. **`captureWorkerError` est cassé** : `[sentry-worker] capture failed: Sentry.captureException is not a function`. **Aucune erreur worker ne remonte à Sentry.**

### 4.3 Décomposition du coût (2026-06-16 → 2026-07-21, ~60 $ au total)

| Destination | Jobs | Coût | Part du budget |
|---|---:|---:|---:|
| **Publiés** | 173 | 15,25 $ | 25 % |
| **`needs_review`** (rédigés en entier puis jetés) | 377 | **35,47 $** | **59 %** |
| Annulés / quarantaine | 171 | 3,31 $ | 6 % |
| **Échecs** (dont 919 « rate limited », 55 circuit breaker) | 1 167 | 0,49 $ | ~1 % |

**Lecture** : ~65 % de la dépense ne produit rien, mais l'enjeu annuel est de l'ordre de **400 $** — faible. Le vrai coût des échecs n'est pas monétaire, ce sont les **slots**.

---

## 5. Le passif éditorial

### 5.1 Défauts durs, comptés en base (n = 163 articles publiés)

| Défaut | Articles |
|---|---:|
| Token `{{price:...}}` non résolu (dont fuites dans le JSON-LD `FAQPage`) | **50** |
| Statistique « 31 % » | **35** — dont 28 citent France Compétences, 22 la DARES, 11 l'INSEE, 8 BPI France |
| `alt="text"` publié | 15 |
| Tokens `[lien]` / `[AFNOR]` / `[UNESCO]` visibles | 10 |
| Jargon de sprint « Session 12+ » | 3 |

Extraits bruts de la base de production :

> « Selon une étude de **France Compétences**, seulement **31 %** des PME en France ont intégré l'IA dans leurs opérations »
> « Selon la **DARES**, **31 %** des PME françaises ont déjà intégré l'IA dans leurs processus en 2024 »
> « Selon une étude de **BPI France**, **31 %** des PME considèrent l'IA comme un levier de croissance (BPI France, 2024) **[lien]** »

*Nuance honnête* : certains usages du « 31 % » sont cohérents (progression 8 % → 31 % attribuée à Syntec Numérique). Le défaut n'est pas le nombre, c'est son **attribution à des sources qui ne l'ont jamais publié**.

S'ajoutent : au moins 4 études de cas clients fabriquées (dont une localisée nominativement à Mantes-la-Ville avec des pourcentages), une statistique ICF « 5,7× » détournée du coaching exécutif vers le « coaching IA », et l'affirmation « le règlement DORA, prévu pour 2025 » (applicable depuis le 17/01/2025).

### 5.2 Le score ne prédit pas la qualité

Corrélation `qualityScore` ↔ nombre de défauts durs : **r = +0,252**. Articles notés ≥ 80 : 0,86 défaut en moyenne. Articles notés < 70 : 0,23.

L'article le mieux noté du site (90/93) contient 3 tokens de prix non résolus et une statistique nationale auto-sourcée « données Axion-IA, 2025 ». L'article le moins bien noté de l'échantillon (66/54) ne contient **aucun** défaut dur.

Aucune des six dimensions stockées n'a détecté des défauts **triviaux par regex**.

### 5.3 Verdict éditorial humain (14 contenus lus intégralement)

**4 BON / 2 MOYEN / 3 FAIBLE / 5 À SUPPRIMER.** Sur les 10 contenus issus du pipeline IA : **0 BON**.

Les 4 bons — page séminaire 1 jour, page secteur juridique, `/formations/par-ville/lyon`, pattern de repli Taverny — **ne sortent pas du générateur**. Ils sont humains, ou produits par une architecture conçue par un humain.

### 5.4 Risque doorway — le bon diagnostic

La duplication **littérale** est quasi nulle (Jaccard 8-grammes médian 1,2 % entre articles ville). Le générateur paraphrase intégralement. **Un détecteur de contenu dupliqué ne verra rien.**

Le risque réel relève de la politique **« scaled content abuse »** (Google, mars 2024), qui vise la valeur ajoutée et non la similarité lexicale :

- 97 articles de blog géociblés, **tous en `index, follow`** ;
- **53 sur 97 (55 %)** ne contiennent aucune information spécifique à leur ville au-delà de son nom ;
- convergence vers un CTA unique ;
- contradictions entre pages sur la prestation vendue (5 étapes / framework NIST / grille de 24 critères pour le même service) ;
- rythme automatisé.

**L'ironie** : le garde-fou existe et fonctionne (`indexationTier`, appliqué correctement aux pages programmatiques — `/formations/par-ville/taverny` est en `noindex, follow` avec renvoi explicite vers Argenteuil). **Le blog le contourne intégralement.**

---

## 6. Les instruments

### 6.1 Dérive d'environnement WEB ↔ WORKER

Trois variables posées sur le conteneur **WEB** et **absentes du WORKER** — celui qui exécute les jobs :

| Variable | Effet |
|---|---|
| `OPENAI_EMBEDDINGS_ENABLED` | Backfill no-op chaque nuit, rapportant `totalArticlesWithoutEmbedding: 0` alors qu'il y en a 173. **Valeur mensongère** : le worker sort avant de compter. |
| `EXTERNAL_LINKS_MONITOR_ENABLED` | Worker jamais démarré ; le cron mensuel tourne dans le vide. |
| `PERPLEXITY_API_KEY` | Fact-check post-publication dégradé (15/173 articles scorés). |

**Cas d'école du faux [ACTIF PROD]** : la variable est visible dans Coolify, le process qui en a besoin ne la voit pas.

### 6.2 Plausible n'a jamais fonctionné — deux bugs cumulés

```sql
SELECT count() FROM events_v2;                              -- 11
SELECT countIf(timestamp > now()-INTERVAL 30 DAY) FROM events_v2;  -- 0
SELECT min(timestamp), max(timestamp) FROM events_v2;
-- 2026-05-13 13:10:25 | 2026-05-13 15:00:34
```

**Bug 1 — le script n'est pas dans le HTML.** `curl -s https://axion-ia.com/fr | grep -c plausible` → **0**.
`Plausible.tsx:17-20` fait `if (!domain) return null` où `domain = env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Or `NEXT_PUBLIC_*` est **inliné au build**, et le `Dockerfile` ne déclare que 4 `ARG NEXT_PUBLIC_*` (`:57-65`) — `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` et `_API_URL` **n'y sont pas**. Elles sont bien présentes au *runtime* : 100 % trop tard.

**Bug 2 — l'URL du script est un 404.** `Plausible.tsx:37` construit `/js/script.404.file-downloads.outbound-links.tagged-events.web-vitals.js`. Les extensions `404` et `web-vitals` **n'existent pas** dans `plausible/community-edition:v3.0.1` (vérifié : 404 ; `script.js` et les 4 autres variantes répondent 200).

Conséquence : **aucune conversion, aucune source d'acquisition, aucun signal AEO/GEO n'a jamais été enregistré.** Le runbook `docs/runbooks/R18-plausible-events-missing.md` décrit le symptôme mais aucune des trois causes qu'il liste n'est la bonne.

### 6.3 Aucune série temporelle SEO

- `SiteRoute.gsc*` : `UPDATE` en place, 7 colonnes scalaires écrasées à chaque run.
- `KeywordTracking` : `upsert` sur `(keyword, targetUrl)`. **64 lignes, toutes syncées dans la même fenêtre de 13 secondes.**
- `content_metrics` (la table conçue pour ça) : **vide**, et ne porte de toute façon aucune colonne clics/impressions/position.

**Toute question du type « cette page progresse-t-elle ? » est structurellement sans réponse.**

⚠️ Trois limites à connaître avant d'utiliser les chiffres GSC en base : troncature aux **25 premières requêtes** par URL (`site-route-gsc-worker.ts:76`), fenêtre 28 j **non synchronisée** entre URLs (400/jour — c'est une mosaïque, pas un instantané), et portée limitée aux routes `isIndexable = true`.

### 6.4 Attribution business : zéro par construction

`Submission` possède `referer` (`schema.prisma:705`) mais **le champ n'est jamais renseigné à l'écriture** : `features/unified-contact/actions.ts` ne liste pas la clé dans son `create`. Vérifié : `count(referer) = 0` sur 8 lignes. Aucun `articleId`, aucun `landingUrl`, aucune relation vers `Article`. `Booking` : 0 ligne.

Le cookie `axion_ref_city` **est** lu (`actions.ts:202`) et persisté dans `details.funnel` ; `_region` et `_phase` ne sont **jamais lus**. Et **0 submission sur 8** ne contient de `funnel`.

---

## 7. Surfaces d'indexation

| Constat | Détail |
|---|---|
| **`sitemap/presse.xml` vide** | 1 communiqué publié depuis 7 jours, `index, follow`, canonical propre, **absent de tout sitemap**. Chaîne : build sur `stub.invalid` → `catch` → `rows = []` → baké vide → `revalidate = 86400` ⇒ **vide jusqu'à 24 h après chaque déploiement**. Le pattern correct existe déjà : `sitemap-blog.xml/route.ts:38-39` (`force-dynamic` + `revalidate = 600`) → 134 URLs, il fonctionne. |
| **`sitemap-knowledge.xml` orphelin** | Route existe, répond 200, **0 URL**, non référencée dans `sitemap-index.xml`. |
| **`sitemap-images-villes-t3-t4.xml`** | Soumet **357 pages villes en `noindex`** à Google Images — signal contradictoire. |
| **674 pages `<service>/par-ville/<ville>`** | Live en `index, follow`, **hors sitemap et hors cap d'indexation**. Motif service × ville réintroduit sur 5 familles après la suppression des 10 750 pages de mai. |
| **38 routes 404 marquées indexables** | `site_routes` : `http_status = 404 AND is_indexable = true`. |
| **`Disallow: /_next/`** dans robots.txt | Bloque `/_next/static/**`, donc **CSS et JS**. Google déconseille explicitement — risque de rendu **bien mieux documenté** que la question `Google-Extended`. |
| Anomalies non résorbées | 134 `thin_content`, 106 `orphan_page`, 94 duplications meta, détectées au 2026-07-21T03:00Z. ⚠️ `orphan_page` est **inopérant par construction** : `internalLinkCount` compte les liens **sortants** (header inclus). |
| ✅ Redirections EN→FR | 301, un seul saut, aucune chaîne. `mapEnToFr()` traduit sémantiquement les slugs. 0 URL `/en/*` en sitemap, 0 `hreflang` résiduel. |
| ✅ JSON-LD | 8 pages échantillonnées, **100 % valides** au parsing. |

### 7.1 Entité `Organization` fragmentée — meilleur levier AEO du site

Sur la seule page d'accueil, **deux entités distinctes** coexistent :

- `ProfessionalService` — « Axion-IA — Cabinet IA opérationnel », **sans `@id`**, sans adresse, sans `sameAs` ;
- `Organization` — `@id: https://axion-ia.com/#organization`, complète (NAP cohérente : 11 Avenue Paul Verlaine, 38100 Grenoble).

Le nœud le plus visible est le plus pauvre, et **rien ne les réconcilie**. Correctif : ajouter `"@id": "https://axion-ia.com/#organization"` au nœud `ProfessionalService`.

`sameAs` compte **3 profils**, dont deux à très faible autorité (`about.me`, `indiehackers.com`). **Absents et critiques pour un organisme de formation** : Google Business Profile, Wikidata, registre public des OF / NDA DREETS, EDOF, SIREN (societe.com / Pappers).

Autre point : **2 157 nœuds `City`** dans le JSON-LD de `/fr/formations/entreprise` — risque de troncature silencieuse par Google, qui ferait perdre les `Course`/`Offer`.

### 7.2 Politique bots — bien conçue, mais mesurée par rien

La doctrine training/citation est **correcte** : bots d'entraînement bloqués (`GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `CCBot`), bots de citation autorisés (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Bingbot`, `ChatGPT-User`, `Perplexity-User`).

Divergences mineures : `ai.txt` est le moins à jour des trois fichiers (manque `anthropic-ai`, `ChatGPT-User`, `Perplexity-User`, `Mistral-User`). `Applebot` (search) n'est nulle part — autorisé par héritage, non documenté.

**Contradiction de fond à arbitrer** : `ai-policy.json` déclare `"license": "CC-BY-4.0"` et `"rag": { "allowed": true }`. Or **CC BY 4.0 autorise explicitement l'entraînement** (réutilisation commerciale sous seule condition d'attribution) — ce qui contredit frontalement `"training": { "allowed": false }` et tout le dispositif robots.txt. Un opérateur de bonne foi peut invoquer la licence.

⚠️ `Crawl-delay: 1` sur `Bingbot` : honoré par Bing (ignoré par Google). À 1 req/s sur ~2 000 URLs, frein réel à la fraîcheur de l'index Bing — donc à Copilot.

---

## 8. Anomalie à instruire

`/fr/blog/coach-ia-grenoble-guide-pratique` — **position 2,0, 52 impressions, 0 clic**. Un CTR nul en position 2 est quasi impossible sur une requête à intention réelle. Signature d'une réponse absorbée par une AI Overview, ou d'un titre/meta inadapté. Cible de diagnostic prioritaire.

---

## 9. BASELINE 2026-07-21

```
SHA DÉPLOYÉ                       7fe76d5158a399c39b28255321e2dad6d64989df

── SURFACE ──────────────────────────────────────────────────
Routes publiques inventoriées                3 932   (live 3 848 · 404 38 · unknown 46)
  indexables                                 2 236
  noindex délibéré (drip villes)             1 682
URLs en sitemap (pages)                      1 142   (1 128 uniques)
URLs en sitemap (images)                       947
Sous-sitemaps vides                              1   (presse.xml)
Sitemap orphelin                                 1   (sitemap-knowledge.xml)

── CORPUS ───────────────────────────────────────────────────
Articles                                       173   (163 publiés · 10 archivés)
  publiés en juillet 2026                      152   (88 % du corpus)
  jamais modifiés après publication            154   (89 %)
  locale                                    100 % fr · 0 en
qualityScore médiane                            77
seoScore médiane                                78
readabilityScore médiane                        40
embedding non nul                            0/173   ⛔
factCheckScore renseigné                    15/173
editorialScore renseigné                     1/173
viewsCount > 0                               0/173   ⛔ compteur mort

── GOOGLE (28 j glissants, top-25 req/URL) ──────────────────
Clics                                           22   (dont 13 sur /fr)
Impressions                                  1 206
Position moyenne pondérée                    19,37
CTR                                          1,82 %
URLs avec ≥1 impression                         96   (4,4 % des indexables)
URLs avec ≥1 clic                               10
URLs à 0 impression                        ~2 102   (95,6 %)

── PLAUSIBLE ────────────────────────────────────────────────
Événements depuis toujours                      11   🔴 (tous du 2026-05-13)
Événements 30 j                                  0   🔴
Conversions 90 j                                 0   🔴
Trafic LLM 90 j                    NON MESURABLE   🔴

── PIPELINE (2026-06-16 → 2026-07-21) ───────────────────────
Jobs lancés                                  1 945
Publiés                                        173   (8,9 %)
needs_review (payés puis jetés)                377
failed                                       1 167   (919 = quota OpenAI)
Dépense totale                              ~60 $   (25 % vers du publié)

── PASSIF ÉDITORIAL (n = 163 publiés) ───────────────────────
Token {{price:}} non résolu                     50
Statistique « 31 % » mal attribuée              35
alt="text"                                      15
Tokens [lien]/[AFNOR]/[UNESCO]                  10
Jargon « Session 12+ »                           3
Articles géociblés index,follow                 97   (dont 53 sans ancrage local)
```

**Commandes de re-mesure à l'identique** : voir `_AUDIT/PLAN-BOUCLE-QUALITE-CONTENU-2026-07-21.md` §Vérification.

---

## 10. Non vérifié

- Nombre exact de routes du dernier build SSG (pas d'accès au log GitHub Actions).
- Total propriété GSC (clics/impressions au niveau `sc-domain:`) — obtenable, credentials en place, non appelé en lecture seule stricte.
- Diff de schéma au niveau des **types SQL, contraintes et cardinalités** (seuls les noms ont été comparés).
- Effet du blocage `Google-Extended` sur le *grounding* Gemini Apps — Google ne le documente pas explicitement ; indécidable en l'état.
- État en base du flag gouvernant `runMultiJudge` (`ContentGenConfig`).
- Perte due aux adblockers sur Plausible (non mesurable sans données).
