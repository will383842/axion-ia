# 09 — VÉRIFICATION DATA-LAYER + ANGLAIS NON-INDEXÉ + PLAN « PERFECTION »

> Vérification complémentaire (2026-06-25) des **données et paramètres** qui pilotent la génération : knowledge base, RAG/embeddings, mots-clés, intent, pain-points/secteurs, audience, villes — **plus** une vérification ADVERSARIALE de l'exigence : _« l'anglais on s'en fout MAIS surtout pas indexé »_.
> Méthode : 6 agents d'exploration + **requêtes sur la vraie base locale** + relecture directe du code pour trancher les contradictions inter-agents. Tout est READ-ONLY.

---

## A. DONNÉES RÉELLES (mesurées sur la base locale, 2026-06-25)

| Donnée                                  | Valeur réelle                                                                                                                                                                                                      | Lecture                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `knowledge_entries`                     | **520** (toutes `published`, toutes FR)                                                                                                                                                                            | KB peuplée localement                  |
| `knowledge_embeddings`                  | **507** (~97 % des entrées)                                                                                                                                                                                        | RAG vectoriel alimenté localement      |
| `keywords`                              | **1835**, **26 clusters**, **1 seul `last_used_at`** (1834 jamais utilisés)                                                                                                                                        | Pool quasi vierge                      |
| `keywords.search_intent` (distribution) | transactionnel 770 · sectoriel 216 · aeo 181 · informationnel 157 · benefice 143 · voice_search 97 · local 94 · ai_overview 48 · commercial_investigation 39 · featured_snippet 36 · comparatif 34 · partenaire 20 | **3 vocabulaires** mélangés (voir C.3) |
| `cities`                                | **0**                                                                                                                                                                                                              | ⚠️ couche ville VIDE en local          |
| `city_generation_order`                 | **0**                                                                                                                                                                                                              | idem                                   |
| `generated_ville_secteurs`              | **0**                                                                                                                                                                                                              | aucun contenu ville généré localement  |
| `articles`                              | 33 (tous `tier_1_indexable`, `published`)                                                                                                                                                                          | —                                      |
| `article_translations` par locale       | **fr 33 · `en 5`**                                                                                                                                                                                                 | ⚠️ 5 traductions EN publiées (voir B)  |
| `content_gen_jobs` par statut           | needs_review **19** · published **16** · failed **7** · quality_improving 6 · cancelled 1                                                                                                                          | Backlog de revue élevé + 7 échecs      |
| `coverage_campaigns`                    | 4, **toutes `draft`**                                                                                                                                                                                              | Orchestrateur au repos                 |
| `content_gen_config.quality_loop`       | enabled, targetScore 85, **minScoreThreshold 70**, maxAttemptsAuto 2                                                                                                                                               | —                                      |
| `policies`                              | skipVilleIfCopyExists, plagiarismJaccardInternal 0.30, rssAutoPublishMinScore 75, tier3RetentionDays 90                                                                                                            | —                                      |

> ⚠️ **Local ≠ prod.** La base locale a 0 ville mais 520 entrées KB ; la mémoire projet indique l'inverse en prod (« 0 ressource KB publique », ~2157 villes seedées). **Chaque action ci-dessous marquée 🔍 exige une confirmation sur la base PROD.**

---

## B. ANGLAIS — « SURTOUT PAS INDEXÉ » : VERDICT

### B.1 — Verdict : **POSTURE SAINE**, mais reposant sur UN SEUL flag runtime

Tous les vecteurs d'indexation `/en/*` ont été vérifiés dans le code. **Aucune fuite active.** Deux « fuites critiques » signalées par un agent ont été **RÉFUTÉES** par lecture directe.

| Vecteur                      | Verdict             | Preuve (file:line)                                                                                                                                                                                                  |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy 301 `/en/*`→FR         | ✅ SÛR              | `src/proxy.ts:40-46` (301 permanent, AVANT next-intl et AVANT le service du fichier statique)                                                                                                                       |
| Sitemaps (blog/faq/villes/…) | ✅ SÛR              | `src/app/sitemap.ts:443-456` `filterEnIfDisabled()` retire toute URL `/en/` + tout alternate `en`, appliqué à TOUS les builders (469-535)                                                                           |
| Sitemap KB                   | ✅ SÛR              | `src/app/sitemap-knowledge.xml/route.ts:33,81` n'émet l'URL EN que si `EN_LOCALE_ENABLED==="true"`                                                                                                                  |
| hreflang page metadata       | ✅ SÛR              | `src/lib/seo.ts:160,185` omet `hreflang=en` quand désactivé                                                                                                                                                         |
| Sitemaps images              | ✅ SÛR              | `images-en.xml` → vide ; `images-fr.xml:49,127,154-155` n'émet l'alternate EN que si `EN_ENABLED`                                                                                                                   |
| robots.txt                   | ✅ SÛR (volontaire) | `src/app/robots.ts:121-129` **ne bloque PLUS `/en/*`** — choix SEO correct : laisser Googlebot crawler le 301 pour consolider vers FR. Seules les surfaces privées (`/en/my-data`, `/en/admin`…) restent disallowed |
| IndexNow / Google Indexing   | ✅ SÛR              | pings dérivés du sitemap (déjà filtré EN)                                                                                                                                                                           |

### B.2 — Faux positifs RÉFUTÉS (vérifiés)

```
[RÉFUTÉ] « KB sitemap émet /en/* » — l'agent citait knowledge-sitemap.ts:208
(buildKnowledgeSitemapChunk, push urlEn inconditionnel). Or cette fonction N'EST PLUS
câblée dans le sitemap public : sitemap.ts ne déclare plus de chunks knowledge-N
(ADR 0026). L'émetteur réel = sitemap-knowledge.xml/route.ts, qui gate EN correctement.
→ Code mort, pas une fuite. (Reco hygiène : supprimer la branche urlEn morte.)

[RÉFUTÉ] « les pages /en/* pré-rendues sont servies malgré le 301 » — le proxy.ts
intercepte CHAQUE requête /en/* (le matcher n'exclut que api/assets/sitemap) et émet
le 301 AVANT que Next serve le HTML statique. Le prerender ne crée donc pas de fuite
d'indexation par lui-même.

[RÉFUTÉ] « robots.txt émet Disallow: /en/ » + « images-fr fuit hreflang en » + « opengraph 502 »
+ « 47 villes indexées » — proviennent d'un audit GSC du 2026-06-05 (3 semaines, périmé) ;
le code ACTUEL implémente déjà les correctifs. Discardés.
```

### B.3 — RISQUE RÉSIDUEL RÉEL (defense-in-depth manquante)

La suppression EN est **entièrement portée par le flag runtime `EN_LOCALE_ENABLED`** (+ le proxy). La couche **données** reste, elle, « pro-EN » :

```
[MAJEUR] base de données | 5 article_translations locale=en sont status=published ET
l'article porte indexation_tier=tier_1_indexable (slugs EN : 3-quick-wins-2026,
accounting-automation-roi, custom-ai-when-really, essentielle-typical-day,
why-audit-before-implementing). indexation_tier vit sur `articles` (PARTAGÉ FR+EN) →
on NE PEUT PAS noindexer le seul EN via le tier. Si EN_LOCALE_ENABLED bascule à true OU
si le proxy tombe, ces 5 pages + tous les prerenders /en/* deviennent indexables
INSTANTANÉMENT. | La protection anti-index EN n'a AUCUN filet au niveau données.

[MAJEUR] generateStaticParams (toutes routes [locale]) | `routing.locales` inclut "en" →
le build pré-rend /en/* pour ~17 000 routes (double le SSG) même EN désactivé. Coût build
+ fichiers latents. | Gâchis + surface latente : si une régression d'émission d'URL oublie
filterEnIfDisabled, le HTML EN existe déjà.

[MINEUR] routing.ts / messages/en.json | locales=["fr","en"] + tous les pathnames EN +
messages EN restent en place. | Dette ; tant que présents, l'EN reste « un flag away ».
```

### B.4 — POUR LA PERFECTION « ZÉRO ANGLAIS INDEXÉ » (par ordre)

1. **[P0] Dé-publier / supprimer les 5 `article_translations` EN** (puisque « l'anglais on s'en fout »). Soit `DELETE` des 5 lignes EN, soit passer l'`article` correspondant en `tier_2_noindex` si la version FR n'existe pas. → supprime le seul contenu EN réellement « publié + indexable » en base.
2. **[P0] Ajouter un helper `getEffectiveLocales()`** (= `EN_LOCALE_DISABLED ? ["fr"] : routing.locales`) et l'utiliser dans **tous** les `generateStaticParams()` + le `[locale]/layout.tsx`. → arrête de pré-rendre `/en/*`, coupe ~50 % du SSG, supprime les fichiers latents. (Le helper existe déjà côté sitemap : `effectiveLocales` dans `sitemap.ts:217` — le généraliser.)
3. **[P1] NE PAS ajouter `Disallow: /en/` dans robots.txt.** Contre-intuitif mais correct : un `Disallow` empêcherait Googlebot de voir le 301 → les URLs EN resteraient « indexées, bloquées par robots » au lieu d'être consolidées. Le 301 actuel est la bonne méthode de dé-indexation.
4. **[P1] (optionnel, décision définitive)** retrait complet EN du code (`routing.locales=["fr"]`, purge `messages/en.json`, pathnames EN, hreflang) — procédure documentée dans `AGENTS.md` (~4-6 h). À ne faire que si EN ne sera jamais réactivé.
5. **[P2] GSC** : après ≥4 semaines de 301, marquer les `/en/*` « resolved » dans Search Console.

> **En l'état, rien d'anglais ne s'indexe** (le 301 + les filtres sitemap/hreflang tiennent). Les actions 1-2 transforment une protection « flag-dépendante » en protection **structurelle** (le contenu EN n'existe plus, donc rien à indexer même si le flag bascule).

---

## C. DONNÉES & PARAMÈTRES DE GÉNÉRATION — CE QUI CLOCHE

### C.1 — Pain-points / secteurs / bénéfice métier : **TOUT EST DORMANT** (le plus structurant)

La `sector-pain-matrix.ts` (50 combos 10 secteurs × 5 verticales, rédigés à la main, riches : douleur, bénéfice mesuré, avant/après, lexique métier, objection) est **excellente** — mais **inerte en production** :

```
[CRITIQUE] prompt-augmentation.ts:42 + benefit-gate.ts:31 + sector-campaigns.ts:93 |
Triple verrou fail-closed sur la valeur métier : (1) QUALITY_PROFILES_ENABLED=false (env),
(2) benefit_gate.enabled=false (config), (3) AUCUNE campagne ne renseigne targetSecteur/vertical.
Résultat : buildPh3PromptAugmentation() retourne "" → 0 article n'injecte la pain-matrix,
0 article n'est scoré sur la concrétude du bénéfice. | La plus grosse valeur du moteur
(ciblage douleur métier + gate bénéfice) ne tourne pas. Articles = génériques.

[MAJEUR] sector-pain-matrix.ts (TS pur) | La matrice n'est PAS seedée en DB (pas de table
SectorPainEntry). Non queryable, non versionnable, édition = redeploy. | Aucune visibilité
admin, aucun audit-trail des douleurs métier.

[MAJEUR] prompt-augmentation.ts:48-67 | pain-matrix géo-AGNOSTIQUE : même douleur pour
Lyon/Marseille/Paris ; seul villeEconomicToAnchorFacts() (bloc anchor) diffère, et les deux
blocs sont concaténés sans dialoguer. | Risque HCU : ~98 % de corps identique entre 2 villes
d'un même secteur ; l'outline SimHash ne classe ça que « SIMILAR » (Hamming 5-8), PAS « BLOCK ».

[MAJEUR] prompt-augmentation.ts (audience) | targetAudienceSize (TPE/PME/ETI/GE) +
targetAudienceOrganisation sont portés par le job mais JAMAIS injectés dans le prompt.
Une PME de 3 personnes et une ETI de 50 reçoivent la même douleur. | Contenu commoditisé,
similarité inter-articles accrue.

[MAJEUR] (test) | Aucun test ne vérifie que l'OUTPUT respecte le « avant/après » /
le bénéfice quand le profil=commercial. | On impose au prompt sans garantir le rendu.
```

### C.2 — Knowledge base & RAG

```
[CRITIQUE] kb-health.ts:100-118 | Mode dégradé DB-down SILENCIEUX : si la table KB est
absente/injoignable, getKbHealth() renvoie healthy:true (bypass) → content-gen continue
SANS KB → RAG vide → hallucinations non détectées. | Aucune alerte. 🔍 vérifier l'état prod.

[CRITIQUE] embeddings.ts:76-109 | Dégradation RAG silencieuse si Voyage 401/402 : alerte
Telegram async throttlée 30 min (perdue si Telegram down). Pas de health-check exposé. |
La prod peut tourner en FTS-only (sans sémantique) pendant des heures sans le savoir.

[MAJEUR] blog-article.ts:145-159 (et tous générateurs) | kbRetrieve() peut renvoyer []
(KB vide / stub.invalid / Voyage down) → kbContext="" → LLM génère « groundé » sans sources.
La gate kbChunks.length>0 existe pour le tier mais l'auto-publish peut quand même approuver. |
Articles sans grounding réel. Reco : hard-gate AVANT l'appel LLM si chunks=0.

[MAJEUR] assertKbReady (kb-health.ts:125) | Hard-gate : ≥50 published + ≥60 % canonical +
<90 j depuis dernier ingest. 🔍 Si la prod a réellement 0 KB public → TOUS les jobs sont
bloqués sauf KB_BYPASS=true. | À trancher : seeder ≥50 facts en prod, ou assumer le bypass.

[MAJEUR] 3 espaces vectoriels | KB=Voyage-3 (1024) · chatbot=OpenAI-small (1024) ·
dedup=OpenAI-large (1536). « 1024 » Voyage ≠ « 1024 » OpenAI (espaces différents). |
Incohérence si on veut un jour croiser les corpus. Documenter / unifier.

[MAJEUR] (tests) | 0 test direct sur kb-feeder, kb-health, kb-client, route /api/internal/kb/ingest,
public-fetch (triple filtre anti-leak public/confidential). | Régression anti-fuite KB non couverte.
```

### C.3 — Mots-clés & intent

```
[MAJEUR] 3 vocabulaires d'intent NON alignés | (a) colonne keywords.search_intent = FR/custom
(transactionnel, sectoriel, aeo…), (b) config search_intent_distribution = ANGLAIS
(informational/commercial_investigation/transactional/local/navigational), (c) enum Prisma
SearchIntent = anglais. normalizeKeywordIntent() mappe 7 valeurs FR→enum mais laisse
sectoriel/benefice/partenaire → null (≈ 379 mots-clés, ~21 %, traités comme « angle » pas
« intent » — par design, mais à documenter). | Mapping fragile ; un nouveau libellé seed
non mappé = intent silencieusement ignoré.

[MAJEUR] schema keywords.search_intent = VARCHAR(40), pas d'enum DB, pas de CHECK |
Typo seed (« comercial ») → null → fallback jobIntent, indétectable en base. |
Reco : contrainte CHECK ou enum DB + validation Zod stricte de la config distribution.

[MAJEUR] keyword-selector (campaign_id absent, TODO P1-8) | Pool de mots-clés PARTAGÉ entre
campagnes (pas d'isolation par campaign_id). Deux campagnes même vertical → épuisement conjoint. |
Reco : colonne keywords.campaign_id + filtre dans le SELECT FOR UPDATE SKIP LOCKED.

[MINEUR] search_volume / difficulty | Colonnes seedées mais IGNORÉES dans la sélection
(ORDER BY ne les utilise pas). | ROI sous-optimal : on ne priorise pas volume↑/difficulté↓.

[MINEUR] pas d'index sur cluster_id + pas d'alerte sur keyword_select_exhausted |
Scan agrégat à chaque sélection ; épuisement d'une vertical = silencieux.
```

### C.4 — Villes & indexabilité (couche locale VIDE — 🔍 prod à confirmer)

```
[INFO/RÉSOLU] drip villes | isVilleIndexable() = INDEXABLE_RANK.has(slug) (immédiat) depuis
le retrait du drip 2026-06-14. La « contradiction » signalée par un agent = le code fait foi :
le drip EST retiré. ~1811/2157 villes uniques indexables ; ~346 quasi-doublons restent noindex
(anti-doorway, intentionnel).

[MAJEUR] orphelins services×villes | Pas de FK ContentGenJob.anchorVilleSlug → City ni
GeneratedVilleCopy.villeSlug → City. Articles ciblant une ville mais non remontés par le hub
(getRelatedBlogPosts ne remonte que ~3) = orphelins de maillage. | (Volume « ~5000 » de la
mémoire NON prouvé en SQL — à quantifier.) 🔍

[MAJEUR] maillage asymétrique | hub→verticales OK, mais verticales/articles NE re-lient PAS
le hub. | Googlebot ne remonte pas au contexte géo ; jus interne dilué.

[MINEUR] double taxonomie tier | City.populationTier (1-4 INSEE) vs CityGenerationOrder.tier
(T1-T4 pédago) — 2 sens coexistent. | Confusion de maintenance.

[À CONFIRMER 🔍] volume sitemap vs budget de crawl | Préoccupation d'architecture réelle
(beaucoup d'URLs villes vs domaine jeune). Les chiffres « 47 indexées / 6-8k URLs » viennent
d'un audit périmé (2026-06-05) — re-mesurer en GSC avant d'agir.
```

### C.5 — Auto-publish & qualité (rappel, recoupe 06/08)

```
[MAJEUR] chaîne fail-open | auto-publish ON par défaut × minScoreThreshold=70 ×
data-quality gate OFF × benefit-gate OFF → un contenu thin/générique s'auto-publie. Confirmé
par les 19 needs_review vs 16 published + le backlog. | Aligner les filets (cf. 08, action #1).
```

---

## D. PLAN « PERFECTION » — LISTE PRIORISÉE

> Légende : 🔍 = confirmer sur la base PROD d'abord. Chaque item est une OBSERVATION/RECO (rien n'a été modifié).

### P0 — Bloquant / valeur immédiate

1. **EN structurel** : supprimer/dépublier les 5 `article_translations` EN ; ajouter `getEffectiveLocales()` dans tous les `generateStaticParams()` + layout → plus aucun `/en/*` pré-rendu. (B.4 #1-2)
2. **Activer la valeur métier** : `QUALITY_PROFILES_ENABLED=true` + `benefit_gate.enabled=true` + **renseigner `targetSecteur`/`vertical` dans les campagnes** (sinon la pain-matrix reste morte). (C.1)
3. **Fermer la chaîne qualité fail-open** : gate data-quality ON pour les types courts OU plancher auto-publish relevé ; vérifier que le worker applique réellement le benefit-gate (blocage/retry). (C.5)
4. **KB prod** 🔍 : confirmer ≥50 entrées `public/published` (sinon assertKbReady bloque tout) OU assumer `KB_BYPASS` explicitement ; rendre le mode dégradé DB-down **bruyant** (log/alerte). (C.2)

### P1 — Robustesse & cohérence

5. **Hard-gate grounding** : si `kbRetrieve()` renvoie 0 chunk → bloquer/needs_review AVANT l'appel LLM (pas seulement le tier). (C.2)
6. **Observabilité RAG** : endpoint `GET /api/admin/embeddings-health` (teste la clé Voyage en réel) + alerte bloquante (pas Telegram throttlé). (C.2)
7. **Intent SSOT** : unifier les 3 vocabulaires — enum/CHECK DB sur `search_intent`, validation Zod stricte de `search_intent_distribution`, compléter/valider `normalizeKeywordIntent`. (C.3)
8. **Isolation mots-clés par campagne** (`keywords.campaign_id`) + alerte `keyword_select_exhausted`. (C.3)
9. **Pain-matrix audience-aware + géo-aware** : injecter `targetAudienceSize/Organisation` ; croiser pain × données ville ; re-prompt si outline SimHash = SIMILAR (anti-HCU). (C.1)
10. **Garanties meta** (recoupe 02/08) : clamp/fallback metaTitle 50-60 + metaDescription 140-160 + directAnswer 40-80 entre génération et rendu.

### P2 — Industrialisation & dette

11. **Pain-matrix en DB** (`SectorPainEntry` seedé) → queryable/versionnable/visible admin. (C.1)
12. **Maillage villes** : FK `anchorVilleSlug`/`villeSlug` → City + backlink verticale→hub + quantifier les orphelins. 🔍 (C.4)
13. **Tests anti-régression** : kb-feeder / kb-health / kb-client / route ingest / public-fetch (triple filtre) ; test « output commercial inclut avant/après ». (C.2/C.1)
14. **Hygiène** : supprimer la branche `urlEn` morte de `knowledge-sitemap.ts` ; index `cluster_id` ; doc des 3 espaces vectoriels ; unifier la taxonomie tier villes. (B.2/C.3/C.4)
15. **Volume sitemap vs crawl** 🔍 : re-mesurer en GSC (chiffres 06-05 périmés) avant tout tier-0-only.

---

### Bilan

- **Anglais** : aucune fuite d'indexation active ; 2 « critiques » d'agent réfutés. Mais la protection est **flag-dépendante** → 2 actions P0 (supprimer les 5 trad. EN + ne plus pré-rendre `/en/*`) la rendent **structurelle**. _« surtout pas indexé »_ = atteignable proprement.
- **Données de génération** : l'infrastructure est mature, mais la **valeur métier est débranchée** (pain-matrix/benefit-gate/secteurs dormants) et les **filets qualité sont fail-open**. La « perfection » = rebrancher le ciblage métier + fermer la chaîne fail-open + rendre KB/RAG observables — **avant** de monter en volume.
- ⚠️ Plusieurs constats sont **local-only** (villes vides, KB pleine) — confirmer sur PROD les items marqués 🔍.
