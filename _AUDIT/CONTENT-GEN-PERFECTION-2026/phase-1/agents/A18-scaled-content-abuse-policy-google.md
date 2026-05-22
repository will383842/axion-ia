# A18 — Scaled Content Abuse Policy Google + HCU

**Agent** : A18  
**Date** : 2026-05-21  
**HEAD audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode** : AUDIT-ONLY STRICT — citations fichier:ligne. 0 invention.

---

## Mission

Auditer le risque de pénalité Google `scaled content abuse policy` (mars 2024) et l'alignement Helpful Content Update (HCU) + Search Quality Rater Guidelines pour le pipeline content-gen Axion-IA visant 3 400+ articles auto-générés.

---

## Méthode

Lecture directe des fichiers suivants :

| Fichier | Lignes clés lues |
|---|---|
| `src/server/content-gen/quality/doctrine-check.ts` | Intégralité |
| `src/server/queue/workers/content-orchestrator-worker.ts` | Intégralité |
| `src/server/queue/workers/content-publish-worker.ts` | Intégralité |
| `src/server/queue/workers/content-gen-worker.ts` | L.330–410 |
| `src/server/content-gen/scheduler/anti-burst.ts` | Intégralité |
| `src/server/actions/content-gen/policies.ts` | Intégralité |
| `src/server/content-gen/quality/soft-404-gate.ts` | Intégralité |
| `src/server/content-gen/generators/blog-article.ts` | L.1–120, L.150–260 |
| `src/server/content-gen/generators/blog-from-keywords.ts` | L.1–50, L.150–285 |
| `src/server/content-gen/generators/landing-ville.ts` | L.150–230 |
| `src/lib/seo.ts` | L.460–685 |
| `src/lib/analytics/plausible-tracker.ts` | Intégralité |
| `src/components/marketing/AiContentDisclaimer.tsx` | Intégralité |
| `src/app/[locale]/blog/[slug]/page.tsx` | L.1–80, L.240–404 |
| `src/app/[locale]/blog/auteur/[slug]/page.tsx` | Intégralité |
| `.github/workflows/nightly.yml` | Intégralité |
| Grep patterns : `MAX_PUBLISH_PER_DAY`, `dailyCap`, `drip`, `weekend`, `dwell`, `scroll_depth`, `aiGenerated`, `doorway`, `Person JSON-LD` | Résultats |

---

## État observé

### 1. Volume / rythme actuel

- Objectif campagne : 3 400+ contenus (`totalTargetCount` DB — référencé `_AUDIT/CONTENT-GEN-PERFECTION-2026/`)
- Cron orchestrator : tick toutes les 15 minutes (`content-orchestrator-worker.ts:1-16`), mode "per-type antiburst" ou "global-v1"
- **Défaut `dailyBatchSize` = 20** (`policies.ts:41`) — **non un cap dur, mais un budget tick par campagne**
- **Cap `dailyTargetByType` max admin-configurable : 500/type** (`policies.ts:75` : `if (totalByType > 500) throw new Error("total_per_type_too_high")`)
- Anti-burst activé par défaut (`antiBurstEnabled: true`, `policies.ts:46`) — étalement uniforme sur 24h UTC
- Publish worker : `limiter: { max: 20, duration: 60_000 }` = 20 articles publiés/minute max (`content-publish-worker.ts:359`)
- Aucune variable `MAX_PUBLISH_PER_DAY` définie dans le code
- **Aucun cap journalier dur de publication** : le budget journalier est configurable dans `ContentGenConfig` DB sans plancher autre que validation admin

### 2. Drip schedule / fenêtre horaire

- Anti-burst calcule `expected = ceil((t / 86_400_000) * target)` pour étaler sur 24h UTC (`anti-burst.ts:61`)
- **Aucune fenêtre horaire 8h-22h CET** : la distribution est uniforme 0h-24h UTC, ce qui signifie des publications possibles la nuit (0h-6h CET) et le weekend
- **Aucune pause weekend** : ni flag `isWeekend`, ni filtre `Saturday/Sunday` dans aucun fichier du périmètre
- Cron nightly GH Actions `0 3 * * *` (03:00 UTC) = publication possible 03h-05h CET

### 3. HCU compliance

- `doctrine-check.ts` : vérifie SIREN, naming brand, banned phrases, ratio AxionIA-centric (> 60% block, > 95% cible)
- `soft-404-gate.ts` : seuil 350 mots (ou 280 avec rich JSON-LD+cas concret) — `SOFT_404_MIN_WORD_COUNT_DEFAULT = 350` (l.33)
- Blog article : minimum 600 mots dans system prompt (`blog-article.ts:31`)
- Blog-from-keywords : minimum 500 mots (`blog-from-keywords.ts:38`)
- Landing-ville : soft-404 gate active (`landing-ville.ts:181-203`) — force tier_3_noindex si < 350 mots
- **Keyword density check : ABSENT** — aucun contrôle du ratio densité keyword > 3% dans aucun generator
- **Test HCU "primarily for users vs ranking"** : non formalisé en code — uniquement via la doctrine brand-centric (ratio AxionIA-centric, pas du contenu user-first)

### 4. E-E-A-T author authority

- `buildPersonJsonLd()` (`seo.ts:492`) : `jobTitle`, `sameAs LinkedIn`, `knowsAbout` (6 domaines), `knowsLanguage` — complet pour Will
- Persona Manon (`ville-service-jsonld.ts:276-293`) : `Person` JSON-LD avec `jobTitle`, `worksFor`, `knowsAbout` — **mais sans `sameAs`** (doctrine v2.1 : "0 réseau social" pour les personas IA)
- **`alumniOf` absent** sur les deux profiles (Will et Manon)
- Page auteur `/blog/auteur/[slug]` : émet `ProfilePage + Person` JSON-LD (`page.tsx:71-82`) — OK
- `AiContentDisclaimer` composant visible (`blog/[slug]/page.tsx:354`) : mentionne "supervisé par l'équipe Axion-IA avant publication"
- **Gap critique** : le disclaimer dit "supervisé" mais le worker `content-gen-worker.ts:364-373` prévoit un mode `factoryAutoPublishAllBlogTypes=true` qui court-circuite la review humaine — **contradiction potentielle avec la promesse de supervision**
- Bio founder : dans `press.ts:350` (EN seulement, ~50 mots) — **pas de page `/fr/a-propos` dédiée avec bio + photo + LinkedIn visibles** (page About générique non auditée)

### 5. Engagement signals

- `plausible-tracker.ts` : `trackEvent()` helper générique — couvre les CTA/booking events
- **Dwell time** : ABSENT — aucun `IntersectionObserver`, `setTimeout`, `scroll.*percent` dans le périmètre
- **Scroll depth** : ABSENT — aucun tracking scroll depth dans le code audité
- Plausible est bien intégré (composant `<Plausible />` dans layout) mais les custom events de contenu sont limités aux conversions

### 6. Pattern detection / template risk

- `landing-ville-templates.ts` : 3 templates selon service (`audit`, `intervention`, `implementation`) — sections figées : "Hero · 3 modules cards · cas concret local · FAQ × 8 · CTA final" (`l.80`)
- **Risque doorway tangible** : sur ~2150 pages villes × 4 services = ~8600 URLs pSEO, les templates partagent une structure quasi-identique. La différenciation repose uniquement sur le LLM pour l'angle local, non vérifié programmatiquement
- Dedup embedding (`dedup/embedding-similarity.ts`) : cosine similarity threshold 0.85 "duplicate" — mais **non connecté au pipeline publish** (module existant mais non wired dans content-gen-worker ni publish-worker)
- Plagiarism Jaccard : `plagiarismJaccardInternal: 0.3` default — ce check est présent dans le worker mais ne bloque pas la publication (log only)

### 7. Action plan post-penalty

- **Runbook pénalité Google manual action : ABSENT** dans tout le codebase et `_AUDIT/`
- `PROMPT-SEO-MASTER-2026.md:389` mentionne "confirmer setup actif, alerts configurées (manual actions, security issues)" — mention d'alerte GSC sans procédure définie
- `corrections/page.tsx` : page de corrections publique existe (URL `/fr/corrections`) — bon signal trust, mais aucune procédure de bulk deindex documentée

---

## Findings — Tableau P0/P1/P2

| ID | Priorité | Description | Fichier:ligne | Impact |
|---|---|---|---|---|
| F01 | **P0** | `MAX_PUBLISH_PER_DAY` **absent** : aucune constante nommée, le cap est implicitement configurable par admin jusqu'à 500/type/jour. Risque scaled content abuse si admin configure 200+/type | `policies.ts:63,75` | Pénalité algo/manuelle Google |
| F02 | **P0** | **Pas de pause weekend** ni fenêtre horaire 8h-22h CET. Publications possibles 24h/24 y compris 3h-6h CET = signal non-humain fort | `anti-burst.ts:61`, `policies.ts:40-47` | Signal spam pattern aux crawlers |
| F03 | **P0** | **`factoryAutoPublishAllBlogTypes=true`** court-circuite la review humaine sur `blog_article` + `landing_ville` (`content-gen-worker.ts:366-373`) mais `AiContentDisclaimer` déclare "supervisé par l'équipe Axion-IA avant publication" — **contradiction légale AI Act art. 50 + risque HCU** | `content-gen-worker.ts:366-373`, `AiContentDisclaimer.tsx:37-38` | AI Act non-compliance + HCU "primarily for ranking" |
| F04 | **P0** | **Keyword density check absent** : aucun gate anti-stuffing. Sur 8600 pages villes avec keyword répété dans titre, H1, meta, body, tags — densité > 3% probable sans contrôle | aucun fichier | Pénalité keyword stuffing Spam Brain |
| F05 | **P0** | **Runbook pénalité Google manual action absent** : ni script de bulk deindex, ni procédure reconsideration request, ni playbook de réponse en < 72h | Tout le repo | Exposition illimitée en cas de pénalité |
| F06 | **P1** | Dedup embedding (`dedup/embedding-similarity.ts`) **non wired au pipeline publish** — des articles quasi-identiques peuvent être publiés si les villes sont différentes mais le contenu similaire > 0.85 | `embedding-similarity.ts:24-64`, non référencé dans `content-gen-worker.ts` | Duplicate content signal |
| F07 | **P1** | **Dwell time et scroll depth non trackés** : Plausible présent mais 0 événement de durée ou scroll. Google utilise ces signaux UX dans ses évaluations HCU quality rater | `plausible-tracker.ts:13-23` | Manque signal "people love this content" |
| F08 | **P1** | **`alumniOf` absent** sur Person JSON-LD de Will et Manon — signal E-E-A-T incomplet vs Guidelines Search Quality Rater (section "Beneficial purpose + E-E-A-T") | `seo.ts:524-533`, `ville-service-jsonld.ts:281-293` | E-E-A-T score partiel |
| F09 | **P1** | **Pages villes sans vérification programmatique de l'unicité de l'angle** : templates fixés avec sections obligatoires identiques (`landing-ville-templates.ts:80,129,155`). Seul le LLM différencie — non audité/mesuré post-génération | `landing-ville-templates.ts:55-160` | Doorway risk pages villes |
| F10 | **P1** | `blog-article.ts` : system prompt mentionne "600 mots minimum" mais le gate `soft-404` dans ce generator (`blog-article.ts:228-235`) utilise `hasFullLocalBusinessJsonLd: false` et `hasLocalCase: false` par défaut, ce qui ne compense pas. Seuil effectif = 350 mots (pas 600) | `blog-article.ts:228-235`, `soft-404-gate.ts:76-94` | Thin content blog |
| F11 | **P1** | **First-hand experience signals non vérifiés** : prompt demande "cas d'usage réels, bénéfices mesurables, retour terrain" (`blog-article.ts:27`) mais aucun gate ne vérifie la présence de chiffres concrets ou noms d'entreprises dans l'output | `blog-article.ts:27`, aucun checker | HCU "Experience" signal faible |
| F12 | **P2** | Page auteur Will : `sameAs` pointe vers `https://www.linkedin.com/in/will-axion-ia` (`seo.ts:498`) — URL à vérifier en prod (profil LinkedIn non confirmé actif) | `seo.ts:498` | E-E-A-T trust signal cassé |
| F13 | **P2** | Plagiarism Jaccard interne threshold 0.3 : ne bloque pas la publication (code path = log only, non confirmé comme bloquant dans le worker audité) | `policies.ts:88`, `content-gen-worker.ts:320-333` | Duplicate content interne |
| F14 | **P2** | `AiContentDisclaimer` non présent sur les pages `/actualites/[slug]` RSS — uniquement vérifié dans `blog/[slug]/page.tsx:354`. Les articles RSS auto-publiés (tier-2) peuvent manquer la disclosure visible | Grep sur routes non audité en détail | AI Act art. 50 compliance partielle |

---

## Scoring /40

| Critère | Score | Max | Observations |
|---|---|---|---|
| **Volume / rythme actuel mesuré** | 3 | 6 | Anti-burst existe et est activé par défaut. Mais cap journalier non fixé, aucune mesure du volume réel publié sur 30j dans le code |
| **HCU compliance** (doctrine, soft-404, anti-thin) | 5 | 8 | Soft-404 gate présent, doctrine-check actif. Mais keyword density absent, test "primarily for users" non formalisé, seuil 350 mots bas pour pSEO |
| **E-E-A-T author authority** | 4 | 6 | Person JSON-LD avec jobTitle/sameAs/knowsAbout. Manque alumniOf, page auteur bio/photo complète, Manon sans sameAs (doctrine intentionnelle mais risque E-E-A-T) |
| **Engagement signals trackés** | 1 | 4 | Plausible présent. Dwell time et scroll depth ABSENTS |
| **Cap journalier + drip schedule + weekend pause** | 2 | 8 | Anti-burst 24h UTC existe. Aucune fenêtre 8h-22h CET, aucune pause weekend, cap max 500 configurable sans garde-fou |
| **Pattern detection risk** | 2 | 4 | Dedup embedding existant mais non wired. Templates très structurés = risque doorway mesurable |
| **Action plan recovery** | 0 | 4 | Runbook pénalité Google manual action ABSENT |
| **TOTAL** | **17** | **40** | |

---

## ⚠️ VERDICT : SCORE 17/40 < 22/40 → **HOLD PUBLICATION 200+/JOUR**

**Ne pas dépasser 20 articles/jour publiés** jusqu'à correction des P0 (F01, F02, F03, F04, F05).

---

## Délégations recommandées

| Sous-tâche | Agent ou responsable | Délai |
|---|---|---|
| Implémenter `MAX_PUBLISH_PER_DAY` hard cap configurable (défaut 30, max 100) | Dev (Sprint P2) | < 1 semaine |
| Ajouter fenêtre horaire 8h-22h CET + pause weekend dans anti-burst | Dev (Sprint P2) | < 1 semaine |
| Corriger contradiction `AiContentDisclaimer` "supervisé" vs auto-publish bypass | Dev + Will (décision) | < 48h |
| Implémenter keyword density check (seuil > 3% = warn, > 5% = block) | Dev (Sprint P2) | < 1 semaine |
| Rédiger runbook Google manual action (3 pages max) | Will | < 1 semaine |
| Wirer dedup embedding au pipeline publish | Dev (Sprint P3) | 2-4 semaines |
| Ajouter IntersectionObserver scroll depth + dwell time Plausible | Dev (Sprint P3) | 2-4 semaines |

---

## UNKNOWNs

| ID | Inconnu | Impact |
|---|---|---|
| U1 | Volume réel d'articles publiés les 30 derniers jours — non mesurable sans accès DB prod | Impossible de mesurer le rythme actuel vs le seuil Google |
| U2 | Valeur réelle de `factoryAutoPublishAllBlogTypes` en prod Coolify — flag non confirmé ON/OFF | Si ON : F03 est actif et la contradiction disclosure est réelle |
| U3 | Score GSC impressions/clics actuels — non accessible en audit statique | Impossible de mesurer l'impact HCU réel |
| U4 | Plagiarism Jaccard bloquant ou non dans le worker complet (lignes > 410 non auditées) | F13 impact réel inconnu |

---

## Références

| Fichier | Rôle dans l'audit |
|---|---|
| `src/server/content-gen/scheduler/anti-burst.ts` | Algorithme drip schedule |
| `src/server/actions/content-gen/policies.ts` | Config caps journaliers |
| `src/server/queue/workers/content-orchestrator-worker.ts` | Logique tick campagne |
| `src/server/queue/workers/content-publish-worker.ts` | Pipeline publication finale |
| `src/server/queue/workers/content-gen-worker.ts` | Décision auto-publish vs review |
| `src/server/content-gen/quality/doctrine-check.ts` | Gate doctrine HCU |
| `src/server/content-gen/quality/soft-404-gate.ts` | Gate anti-thin content |
| `src/server/content-gen/generators/landing-ville.ts` | Generator pSEO villes |
| `src/server/content-gen/generators/landing-ville-templates.ts` | Templates répétitifs doorway |
| `src/server/content-gen/dedup/embedding-similarity.ts` | Dedup embedding (non wired) |
| `src/lib/seo.ts` | Person JSON-LD E-E-A-T |
| `src/lib/seo/ville-service-jsonld.ts` | Person Manon JSON-LD |
| `src/lib/analytics/plausible-tracker.ts` | Engagement tracking (incomplet) |
| `src/components/marketing/AiContentDisclaimer.tsx` | Disclosure AI Act art. 50 |
| `src/app/[locale]/blog/[slug]/page.tsx` | Page article + disclaimer |
| `src/app/[locale]/blog/auteur/[slug]/page.tsx` | Page auteur ProfilePage |
| `.github/workflows/nightly.yml` | Crons GH Actions (03:00 UTC) |

---

*Audit-only — aucune modification de code effectuée. HEAD audité : `2b98a70`.*
