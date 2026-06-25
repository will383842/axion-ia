This is an audit synthesis task. The cartography and analyses are already provided in full detail. My job is to produce prioritized recommendations in Markdown — no file modifications, no further code reading required since the audit evidence is comprehensive and consistent across all agents. Let me synthesize directly.

# Recommandations priorisées — Atteindre "articles 1500-2500 mots, best-of-2026, auto-publiables"

## Synthèse du diagnostic (3 causes racines confirmées par le code)

1. **Architecture mono-appel JSON** (P0 structurel) — les 5 générateurs blog (`blog-article`, `blog-from-keywords`, `blog-from-title`, `comparison`, `barometer-insight`) + les 12 Phase-8 produisent `title+meta+bodyHtml+8 FAQ` dans **un seul** `routerGenerate()`. Le modèle compresse `bodyHtml` à ~400-600 mots pour fermer un JSON valide. `guide-pilier` atteint 2000+ mots parce qu'il décompose (outline `maxTokens=2048` puis N sections `maxTokens=900` chacune). Preuves : `blog-from-keywords.ts:174-182`, `guide-pilier.ts:245-253`/`276-314`.
2. **Conflit de seuils auto-pub** (P0 config) — boucle interne sort à `qualityScore>=60` (`blog-*.ts`) mais l'orchestrateur exige `minScoreThreshold=75` seedé en DB (`content-gen-config.ts:56` vs `content-gen-worker.ts:860`). Les articles 60-74 partent en `quality_improving` puis `needs_review`.
3. **Bug `citationCount` intent informational** — `appendSourcesSection()` injecte les liens après génération mais `citationCount` n'est pas recalculé pour ce gate dans tous les chemins → `informational` hard-fail `citationCount<3` → `blockingFail` → `needs_review`. Le correctif `max(citations, liens externes)` existe au worker (`content-gen-worker.ts:614-625`) mais pas dans la boucle générateur.

Les modifs non-committées de la session (MIN_WORD_COUNT plancher, maxTokens 8000, budget 0.30, keyword-match) **traitent les symptômes mais pas la cause #1** : elles forcent la boucle à tourner 3 fois et à épuiser le budget sans jamais dépasser ~600 mots, garantissant `needs_review`. **À elles seules, elles aggravent le problème** (plus de coût, même longueur).

---

## TRANCHE 1 — Architecture long-form (LA décision structurante)

**Verdict : réécrire en multi-sections via un module partagé, en commençant par `blog-from-keywords`. NE PAS router vers `guide_pilier`. NE PAS accepter le court.**

| | |
|---|---|
| **Problème** | Mono-appel JSON plafonne à ~600 mots quoi qu'on demande dans le prompt. |
| **Action** | Extraire le pipeline 2-step de `guide-pilier` en module partagé `runOutlineThenSections(input, config)` (outline → boucle per-section `maxTokens=900` → assemblage → quality checks). Le câbler d'abord sur `blog-from-keywords` (type pilier SEO, le plus haut ROI), derrière feature-flag `LONGFORM_BLOG_V2`. |
| **Effort** | **M** (~3-4 j) : le pattern existe déjà et est prouvé en prod, on factorise au lieu d'inventer. |
| **Impact** | **Très élevé** : 1500-2500 mots garantis par construction (8 sections × 250-350 mots), `qualityScore` monte (volume + grounding par section), tier_1 accessible (`>=70 && kbChunks>0`). |
| **Coût** | +$0.01-0.04/article (9-13 appels vs 1-3). À 50 articles/semaine ≈ +$8-10/mois. Négligeable vs valeur SEO. |
| **Risque** | **Moyen** : outline STEP-1 parfois structurellement faible. Mitigations : flag de rollback instantané, gate keyword sur l'outline (absent de `guide-pilier` actuellement → à ajouter), A/B 50/50 control vs v2. |

**Pourquoi pas router vers `guide_pilier` ?** Confusion de rôles (tous les blogs deviendraient des guides HowTo), `guide_pilier` est `tier_2` par design (`guide-pilier.ts:391-394`, jamais tier_1) → perte de valeur SEO, et il manque les gates keyword H1/metaTitle. Le module partagé garde l'identité de chaque type tout en empruntant l'architecture.

**Pourquoi pas accepter le court ?** Contredit explicitement l'objectif Will "1500-2500 best-of-2026" ; les articles courts chutent automatiquement tier_2 (`qualityScore>=70 && kbChunks>0` requis pour tier_1) → invisibles. Web Vitals ne sont PAS un frein (article 2500 mots ≈ 8-12 KB gz, très loin du budget 75 KB).

---

## TRANCHE 2 — 2 vs 3 passes

**Verdict : passer à 2 passes UNE FOIS le multi-sections en place. Garder 3 tant que le mono-appel subsiste.**

| | |
|---|---|
| **Problème** | Avec mono-appel, la passe 3 n'améliore que ~2-5 pts (rendements décroissants) et coûte ~$48-145/mois inutilement ; mais la réduire AVANT de fixer l'architecture pousserait plus d'articles 58-62 en `needs_review`. |
| **Action** | (a) Tant que mono-appel : **MAX=3 inchangé**. (b) Après bascule multi-sections : la longueur n'est plus le facteur limitant → passer `MAX_QUALITY_ITERATIONS=2`. Le multi-sections atteint la cible dès la passe 1, la passe 2 sert au polish SEO/doctrine. |
| **Effort** | **S** (1 ligne, mais conditionnée à la Tranche 1). |
| **Impact** | Moyen : -33% coût boucle, -50% latence, sans perte qualité une fois la longueur garantie. |
| **Coût** | Économie ~$0.02/article. |
| **Risque** | Faible si fait après Tranche 1 ; **moyen** si fait avant (rejette les borderline). |

Ne **jamais** descendre à 1 passe (~30% de rejets observés).

---

## TRANCHE 3 — Longueur cible par type de contenu

**Verdict : différencier explicitement long-form vs court-form, centraliser dans un `quality-config.ts`.**

| Type | MIN_WORD_COUNT cible | Architecture |
|---|---|---|
| `blog_from_keywords`, `guide_pilier` | **1800-2500** (pilier SEO) | Multi-sections |
| `blog_article`, `blog_from_title`, `comparison` | **1500-2000** | Multi-sections (Phase 2) |
| `barometer_insight` | **1200-1800** (borné par données vérifiées) | Multi-sections léger |
| `blog_from_rss` | **600-900** (comparable source, anti-régurgitation) | Mono-appel OK |
| `qa_derived` | **300-500** (Featured Snippet) | Mono-appel OK |
| `faq_standalone`, `faq_geo` | pas de plancher mots, gate `faqCount>=10` | Mono-appel OK |
| `landing-ville-*` | 100-250 (flexible) | Inchangé |

| | |
|---|---|
| **Problème** | MIN_WORD_COUNT dupliqué dans 10 fichiers (4 configs divergentes), `blog-from-rss` sans const, `blog-from-title` avec gate keyword bugué (`includes(slice(0,30))` vs `keywordPresentInText()`). Dette : 1 changement conceptuel = 7 fichiers édités cette session. |
| **Action** | Créer `src/server/content-gen/quality/quality-config.ts` exportant `QUALITY_CONFIGS` par type ; migrer les 10 générateurs vers l'import. Corriger au passage le gate keyword de `blog-from-title` (adopter `keywordPresentInText()`) et ajouter le const à `blog-from-rss`. |
| **Effort** | **S** (4-6 h). |
| **Impact** | Élevé en maintenabilité (SSOT, tuning futur = 1 fichier, vers DB-driven ensuite), corrige 2 bugs de dérive. |
| **Coût** | 0. |
| **Risque** | Négligeable. |

---

## TRANCHE 4 — Auto-publish vs needs_review

**Verdict : aligner le seuil orchestrateur sur 60 + fixer `citationCount`. C'est le quick-win le plus rentable, indépendant de l'architecture.**

| Reco | Problème | Action | Effort | Impact |
|---|---|---|---|---|
| **4a — Aligner seuils** | Boucle sort à 60, orchestrateur exige 75 → 40-50% des articles bloqués en `quality_improving`→`needs_review`. | `ContentGenConfig.quality_loop.minScoreThreshold = 75 → 60` (`content-gen-config.ts:56`). 1 ligne de seed + ré-seed prod. | **S** | **Très élevé** : auto-pub 10%→40-50%. |
| **4b — Fixer citationCount dans la boucle** | `informational` hard-fail `citationCount<3` systématique car `appendSourcesSection` post-gen. | Recalculer `citationCount = max(output.citations, liens externes <a https>)` AUSSI dans le gate intent du générateur (réutiliser la logique `content-gen-worker.ts:614-625`). | **S** | **Élevé** : ~30% d'articles débloqués. |
| **4c — Soft-404 → signal needs_review** | Un article court (~580 mots) `blockingFail=false` peut s'auto-publier en `tier_2` (invisible mais occupe capacité). | Faire de `soft404.isSoft404=true` un contributeur à `needs_review` (pas seulement à tier_3) tant que la Tranche 1 n'est pas déployée partout. | **S** | Moyen (filet de sécurité transitoire). |

**Garde-fou** : 4a+4b ensemble portent l'auto-pub à ~60-70%. Monitorer la distribution `qualityScore` post-déploiement ; si trop permissif (auto-pub de contenu faible), remonter 60→65. **Ne pas** appliquer 4a sans 4b (le citationCount bug masquerait le gain).

---

## Roadmap ordonnée

### Sprint 0 — Quick wins config (1-2 jours, ZÉRO refonte, déployable immédiatement)
1. **4a** Aligner `minScoreThreshold` 75→60 (1 ligne).
2. **4b** Recalculer `citationCount` dans les gates intent des générateurs.
3. **Tranche 3** Centraliser `quality-config.ts` + corriger gate keyword `blog-from-title` + const `blog-from-rss`.
4. **Décision** : ne PAS committer les modifs MIN_WORD_COUNT/budget en l'état seules — elles n'ont d'effet qu'avec l'architecture multi-sections (Sprint 1). Les garder en place mais sous le flag.
- *Résultat attendu* : auto-pub 10%→55-70% sur le corpus existant, sans toucher la longueur.

### Sprint 1 — Architecture long-form (1 semaine)
5. **Tranche 1** Extraire `runOutlineThenSections()` partagé (fork factorisé de `guide-pilier`), ajouter gate keyword sur l'outline.
6. Câbler `blog-from-keywords` derrière flag `LONGFORM_BLOG_V2`.
7. A/B test 50/50 sur 50-100 articles : mesurer `wordCount`, `qualityScore`, `tier_1 rate`, `coût`, `auto-pub rate`.
- *Critères de succès* : P(wordCount>1500)>80%, P(score>70)>60%, coût delta <$0.05, auto-pub >75%.

### Sprint 2 — Généralisation (1-2 semaines, conditionnel au succès A/B)
8. Étendre le module à `blog-article`, `blog-from-title`, `comparison`, `barometer-insight`.
9. **Tranche 2** Passer `MAX_QUALITY_ITERATIONS=3→2` sur les types multi-sections.
10. Déprécier les chemins mono-appel de ces types (garder en legacy 3-6 mois via flag).

### Sprint 3 — Dette & robustesse (différé, non bloquant)
11. Circuit-breaker provider Redis-shared (fixe la race multi-worker, `provider-router.ts:32`).
12. A/B provider Claude vs OpenAI sur long-form (`preferredProvider` absent des blogs) — uniquement si Sprint 1-2 ne suffisent pas.
13. Grounding : `k=8→12` + excerpts KB plus longs + 2 exemples Axion-IA concrets dans le system prompt.
14. Décision factorisation complète (`GeneratorBase`) — seulement si roadmap 2027 confirme 5+ nouveaux types.

---

## Tableau de bord des arbitrages (réponses directes à Will)

| Question | Tranchée |
|---|---|
| **Architecture long-form ?** | **Réécrire en multi-sections** via module partagé (fork de `guide_pilier`), pas router vers `guide_pilier`, pas accepter le court. |
| **2 vs 3 passes ?** | **3 maintenant**, **2 après** bascule multi-sections (la longueur cesse d'être le facteur limitant). |
| **Longueur par type ?** | Long-form **1500-2500** (keywords/article/title/comparison/guide) ; court-form assumé pour rss/qa/faq/landing. Centralisé en `quality-config.ts`. |
| **Auto-pub vs needs_review ?** | **Aligner seuil 60** + **fixer citationCount** = auto-pub 10%→60-70% dès Sprint 0, indépendamment de l'architecture. |

**Le levier le plus rapide** (Sprint 0, ~2 j) débloque déjà la majorité du corpus en auto-pub. **Le levier le plus structurant** (Sprint 1, ~1 semaine) résout définitivement la longueur. Les deux sont indépendants et peuvent être menés en parallèle.

Fichiers clés concernés (chemins absolus) :
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-blog-cat\src\server\content-gen\generators\guide-pilier.ts` (modèle à factoriser)
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-blog-cat\src\server\content-gen\generators\blog-from-keywords.ts` (1er cible)
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-blog-cat\prisma\seeds\content-gen\content-gen-config.ts:56` (seuil 75→60)
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-blog-cat\src\server\queue\workers\content-gen-worker.ts:614-625,860` (citationCount + seuil)
- `C:\Users\willi\Documents\Projets\Axion-IA\axionia-wt-blog-cat\src\server\content-gen\generators\blog-from-title.ts:200` (gate keyword bugué à corriger)