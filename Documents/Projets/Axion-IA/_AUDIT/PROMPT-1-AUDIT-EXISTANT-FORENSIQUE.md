# 🔍 PROMPT 1 — AUDIT FORENSIQUE EXISTANT (Content-Gen AxionIA)

> **Fichier** : `_AUDIT/PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md`
> **Phase** : P1 sur 6 (pipeline content-gen perfection 2026, cf. `PROMPT-MASTER-CONTENT-GEN-PERFECTION-2026.md`)
> **Date création** : 2026-05-21
> **Durée estimée** : 10-14h autopilot (22 sous-agents en parallèle)
> **Sortie** : score `D-Etat /1000` + 22 fichiers analyse + synthèse cross-cutting + STOP & ASK Will (12 axes prioritaires)
> **Mode** : `AUDIT-ONLY STRICT` — 0 code modifié, 0 commit, lecture seule sur le code prod
> **Self-contained** : ce fichier suffit pour démarrer (mais lecture du master P0 recommandée pour vision globale)

---

## 0. RÔLE & MISSION

<role>
Tu es **architecte d'audit forensique senior**, spécialiste content-gen / SEO 2026 / pipelines BullMQ / Prisma / Next.js 16. Ta posture : **détective implacable mais juste**. Tu cherches la vérité brute sur l'état actuel du système, sans complaisance ni catastrophisme. Tu mesures, tu prouves, tu cites.

Tu agis comme un **technical due-diligence partner** que Will louerait $1500/jour pour produire un rapport investisseur. Chaque finding cite : fichier, lignes, commit hash si pertinent, version Prisma, version Next.js, comportement observé vs attendu.
</role>

<mission>
Auditer chirurgicalement le système content-gen AxionIA tel qu'il existe **au commit `HEAD` du `2026-05-21`**, en orchestrant **22 sous-agents en parallèle** sur 22 angles distincts. Produire :

1. **22 rapports d'agents** (`agents/A01-*.md` à `A22-*.md`) — score pondéré par criticité business, somme = `/1000`.
2. **1 synthèse cross-cutting** (`CROSS-CUTTING.md`) — patterns transverses, contradictions, risques cumulés.
3. **1 verdict Phase 1** (`PHASE-1-VERDICT.md`) — score global D-Etat /1000 + top 10 P0 + top 20 P1 + recommandations input pour P2-P6.
4. **1 STOP & ASK Will** — 12 axes d'amélioration prioritaires à valider avant lancement P2/P3/P4.

Tu **ne proposes pas d'architecture cible** (c'est le job de P2). Tu **ne dessines pas le SEO 2026** (c'est P3). Tu **constates et chiffres** l'existant.
</mission>

---

## 1. OPERATING MODE

<operating-mode>

| Règle | Valeur |
|-------|--------|
| Mode | **AUDIT-ONLY STRICT**. 0 modification fichier prod (sauf création dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/`). |
| Outils autorisés | `Read`, `Grep`, `Glob`, `git log`, `git show`, `git blame`, `Bash` (lecture seule : `prisma format --check`, `wc -l`, etc.), `Agent` pour spawn sous-agents. |
| Outils interdits | `Edit`, `Write` (sauf dans `_AUDIT/...`), `git commit`, `git push`, `pnpm install`, modifications schema. |
| Spawn | **22 sous-agents en parallèle** via `Agent` tool, `subagent_type=Explore` pour lectures pures, `general-purpose` pour synthèses complexes. |
| Format findings | `[P0/P1/P2] [titre court] — fichier:lignes — observation factuelle + impact mesurable + recommandation (1 phrase) → délégué P2 ou P3 ou P4 ou P5`. |
| Invention | **0 invention**. Si fait incertain → `[UNKNOWN — confirm Will ou git history]`. |
| Convergence Manon | Avant spawn agents : `git log --all --oneline -30` + `git branch --all` → vérifier qu'aucune branche `feat/content-gen-*` ou `feat/villes-*` ou `feat/keywords-*` ouverte par Manon n'est en cours. Si oui → flag dans CROSS-CUTTING.md + audit en mode « lecture du commit HEAD origin/main uniquement ». |
| Score | **Pondéré par criticité business** (somme `/1000` sur 22 agents). Poids variables : A06 SEO/AEO/GEO=75 (max), A03 Quality=65, A11 KB=60, A10 Géo=55, A04 Keywords=50, A09 Dedup=50, A16 Auto-review=50, A02/A05/A12/A13/A14/A15/A17=45, A01/A07/A08/A18=40, A20=35, A19/A22=30, A21=25. Cf. §8 Verdict pour table complète. |
| Format markdown | Sections fixes : `Mission` / `Périmètre audité` / `Méthode` / `Findings (P0/P1/P2 numérotés)` / `Score /<poids>` / `Recommandations délégation P2-P6` / `Références`. |

### Anti-patterns interdits

- ❌ **Conclusions sans preuves** : « ce système est mauvais » → INTERDIT. Préfère « fichier `X.ts:42-50` allocateur de jobs n'a pas de backpressure → si queue >1000 jobs → OOM observé runner 16GB ».
- ❌ **Refactor suggestions** : tu listes les problèmes, P2 propose les solutions.
- ❌ **Best practices génériques** : tout conseil cite la spec / doc / RFC officielle.
- ❌ **Inventer des chiffres** : si tu ne peux pas mesurer, écris `[NON MESURÉ — instrumentation requise]`.
- ❌ **Sub-agent overlap** : chaque agent a son périmètre clair. Si chevauchement → la première découverte tranche (timestamp).

</operating-mode>

---

## 2. CONTEXTE CONDENSÉ (référence Master §3)

Voir `PROMPT-MASTER-CONTENT-GEN-PERFECTION-2026.md` §3 pour le détail.

**TL;DR** :
- AxionIA = cabinet IA B2B premium FR, Next.js 16 + Postgres + Prisma 5.22 + BullMQ + Anthropic SDK.
- **5 verticales** : `interventions_formations` / `un_a_un` / `audits` / `implementations` / `sites_web_augmentes` (nouvelle 2026-05-21).
- **3 cibles** : `tpe` / `pme` / `eti`.
- **7 types contenus** : `article_titre_manuel` / `article_keywords` / `longue_traine_intention` / `comparatif` / `pilier` / `qr_auto_genere` / `article_rss`.
- **Scope géo** : Global France + 39 villes pilote (cible 120 villes 12 mois).
- **Shift critique 2026** : Google AI Overviews FR imminent — AEO/GEO priorité absolue.
- **Compliance** : AI Act art. 50 deadline août 2026, scaled content abuse policy Google mars 2024.

---

## 3. PRÉ-REQUIS LECTURE (avant spawn)

L'agent maître P1 doit lire ces fichiers/dossiers AVANT de spawner les 16 sous-agents (pour calibrer leur briefing) :

### 3.1 — Code source

```
src/server/content-gen/**          # Service couche
src/app/[locale]/(admin)/[adminPrefix]/content-gen/**   # Pages admin
src/app/[locale]/(public)/**/{ville,article,guide,glossaire}/**   # Rendering public
src/server/queue/**                # Workers BullMQ
prisma/schema.prisma               # Tous modèles
prisma/migrations/**               # Historique migrations
axionia/kb/villes/**               # KB villes existante
axionia/kb/**                      # KB autres (si existe)
src/lib/seo/**                     # Helpers SEO
src/components/**                  # Composants (Article, FAQ, JSON-LD, Speakable)
sitemap*.ts ou sitemap-*.xml route handlers
```

### 3.2 — Audits précédents (CRITIQUES — input historique)

```
_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/**        # Score précédent 746/1200 + 513/700
_AUDIT/CONTENT-GEN-CITY-DOMINATION-2026-05-18/**   # Score précédent 2185.6/3200
_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/**              # 26 livrables, 16 agents //
_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/**    # 909/1000
_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md             # Historique sessions content-gen
```

### 3.3 — Mémoires Claude pertinentes

À lire via `Read` sur `C:\Users\willi\.claude\projects\C--Users-willi\memory\` :

- `axionia_content_gen_deep_audit_2026-05-18.md`
- `axionia_content_gen_city_domination_2026-05-18.md`
- `axionia_keywords_747seeds_2026-05-20.md`
- `axionia_keyword_strategy_audit_2026-05-19.md`
- `axionia_image_bank_complet_2026-05-20.md`
- `axionia_city_coverage_dashboard_2026-05-18.md`
- `axionia_sprint_s5_p2_pending_push_2026-05-20.md`
- `axionia_v2_shell_wired_pages_backlog_2026-05-19.md`
- `axionia_positionnement_4_verticales.md` (note : 5e verticale ajoutée 2026-05-21)
- `axionia_couleurs.md`
- `feedback_no_dalle_images.md`

### 3.4 — Git intel

```bash
git log --all --oneline -50
git branch --all
git log --since="2026-05-01" --pretty=format:"%h %ad %s" --date=short -50
git diff --stat HEAD~10 HEAD -- src/server/content-gen/
git diff --stat HEAD~10 HEAD -- prisma/
```

### 3.5 — DB schema introspect

```bash
pnpm prisma format --check     # vérification syntaxe schema
pnpm prisma migrate status     # état migrations vs DB
```

(N'exécute pas `migrate deploy` ou `migrate dev` — lecture seule.)

---

## 4. CONVERGENCE MANON — CHECK PRÉALABLE OBLIGATOIRE

Avant tout spawn :

```bash
git log --all --oneline -30 | grep -iE "(content-gen|content gen|villes|copy|image-bank|seed-images|keywords)" | head -20
git branch -r | grep -iE "feat/(content-gen|villes|image-bank|keywords)"
```

Si :
- Une branche `feat/<scope>` est ouverte et active (commit récent <24h) → **flag dans CROSS-CUTTING.md** comme "session parallèle Manon en cours, audit en mode shadow read".
- HEAD origin/main commit `6aaa57f` ou plus récent → vérifier que les fichiers livrés Sprint S+5 P2 sont bien sur main (logStep, Speakable drift, RssSource Prisma, villes helpers, CaseStudy, FAQ DOMPurify, 8 tests workers).
- WIP local non poussé → audit le code de l'index `git diff --staged` + `git diff` séparément.

**Règle absolue** : audit lit sur HEAD `origin/main` actuel. Tout WIP local est annoté `[WIP NON-PUSHÉ]` mais inclus dans l'audit (Will doit savoir).

---

## 5. ORCHESTRATION 16 SOUS-AGENTS

### Méthode

Spawn les 16 agents **en 1 seul message** avec 16 tool calls `Agent` parallèles. Chaque agent reçoit :
- **Mission précise** (1 paragraphe)
- **Périmètre exact** (chemins + globs)
- **Questions à investiguer** (10-20 questions précises)
- **Format output obligatoire** (template markdown standardisé)
- **Rubrique scoring** (/62.5 décomposé)
- **Délégations downstream** (quoi flagger pour P2, P3, P4, P5)

Chaque agent produit **1 seul fichier** dans `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents/A<NN>-<slug>.md`.

### Template output standardisé (chaque agent)

```markdown
# A<NN> — <Titre agent>

> **Mission** : <1 phrase>
> **Périmètre audité** : <chemins>
> **Durée audit** : <h>
> **Score** : <X>/62.5

## 1. Méthode

<Comment l'agent a procédé. Commandes exécutées. Fichiers lus. Mesures prises.>

## 2. État observé

<Description factuelle de ce qui existe AUJOURD'HUI. Pas d'opinion.>

## 3. Findings

### P0 — Bloquants

| # | Titre | Fichier:lignes | Observation | Impact | Délégué |
|---|---|---|---|---|---|
| P0-1 | ... | ... | ... | ... | P2 / P3 / P4 / P5 |

### P1 — Optimisations critiques

| # | Titre | Fichier:lignes | Observation | Impact | Délégué |
|---|---|---|---|---|---|

### P2 — Améliorations marginales

| # | Titre | Fichier:lignes | Observation | Impact | Délégué |
|---|---|---|---|---|---|

## 4. Scoring détaillé /62.5

| Sub-critère | /Y | Score | Justification |
|---|---|---|---|

**Total : <X>/62.5**

## 5. Quotes & extraits clés

<Extraits code 5-10 lignes max, ciblés. Ne pas copier 200 lignes.>

## 6. Délégations downstream

- **Pour P2 (Architecture)** : <liste sujets à traiter>
- **Pour P3 (SEO/AEO/GEO)** : <liste>
- **Pour P4 (Editorial)** : <liste>
- **Pour P5 (Console/Ops)** : <liste>

## 7. UNKNOWNs (à confirmer Will)

<Liste des choses incertaines.>

## 8. Références

<Liste exhaustive fichiers/commits/docs consultés.>
```

---

## 6. ROSTER DES 16 SOUS-AGENTS

### A01 — Inventory & cartographie système

**Mission** : Dresser l'inventaire exhaustif factuel du système content-gen existant.

**Périmètre** :
- `prisma/schema.prisma` (tous models `Content*`, `Article*`, `Campaign*`, `Keyword*`, `Vertical*`, `Generation*`, `Coverage*`)
- `src/server/content-gen/**/*.ts` (services, helpers, utils)
- `src/server/queue/workers/*content-gen*` ou équivalent (workers BullMQ)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` (pages admin)
- `src/app/[locale]/(public)/{ville,article,guide,glossaire,**}/**/page.tsx` (pages publiques générées)
- `prisma/migrations/**` (historique)

**Questions à investiguer (≥15)** :
1. Combien de models Prisma liés à content-gen ? Lister chacun avec nb champs.
2. Combien de migrations dans `prisma/migrations/` ? Quelle est la première migration content-gen et quand ?
3. Combien de workers BullMQ existent ? Quelle file (`queueName`) chacun écoute ?
4. Combien de pages admin `/content-gen/**` existent ? V1 vs V2 ?
5. Combien de routes publiques rendent du contenu généré ? `/articles/[slug]`, `/villes/[slug]/[type]`, etc.
6. Combien de fichiers TS dans `src/server/content-gen/` ? Total LOC ?
7. Quels enums TS définissent `Vertical`, `ContentType`, `Audience`, `ContentStatus` ?
8. La verticale `sites_web_augmentes` existe-t-elle dans l'enum Prisma ? Si NON → P0 critique.
9. Quels services helpers existent (`generateTitle`, `generateBody`, `generateFAQ`, `assignImage`, etc.) ?
10. Existe-t-il un modèle `Campaign` ? Avec quels champs ?
11. Existe-t-il un modèle `Keyword` ? Combien de seeds en DB (`SELECT count(*)`) ?
12. Existe-t-il une table `Article` ou équivalent (« contenu généré ») ?
13. Existe-t-il un modèle `GenerationProvenance` pour AI Act ? Si NON → P0.
14. Existe-t-il un modèle `ExternalLinkSource` (linkbase) ? Si NON → P1.
15. Quelle est la dernière migration appliquée ? `pnpm prisma migrate status`.
16. Combien de tests Vitest existent dans `src/server/content-gen/**/__tests__/` ?
17. Combien de tests E2E Playwright (si existe) ?
18. Combien de fichiers KB villes ? `axionia/kb/villes/copy/*.ts` count.
19. Y a-t-il une KB sectorielle ? `axionia/kb/verticals/*.ts` ?
20. Quel est le commit le plus récent qui touche `src/server/content-gen/` ? Auteur, date, sujet ?

**Scoring /62.5** :
- Exhaustivité inventaire `/20`
- Précision quantitative (chiffres, pas estimations) `/20`
- Identification gaps majeurs (models manquants) `/15`
- Cartographie relations entre modules `/7.5`

**Délégations** :
- → P2 : tous models à créer/étendre
- → P5 : pages admin manquantes

---

### A02 — Pipeline End-to-End (génération → publication → sitemap)

**Mission** : Tracer 1 article depuis le clic admin « générer » jusqu'à apparition dans `sitemap.xml`. Mesurer chaque étape.

**Périmètre** :
- Orchestrator service (probablement `src/server/content-gen/orchestrator.ts` ou équivalent)
- Workers BullMQ avec leurs handlers
- Route publication / cron sitemap-regen
- Lifecycle status (draft → review → improved → published → indexed)

**Questions à investiguer (≥15)** :
1. Trace complète : quel endpoint admin déclenche la génération ? (HTTP path)
2. Quel job BullMQ est enfilé ? Avec quel payload ?
3. Quel worker le consomme ? Combien de concurrence (`{ concurrency: N }`) ?
4. Quels sub-jobs sont enfilés ensuite (generate-outline → generate-body → generate-faq → ... ) ?
5. Idempotence : si worker crash mi-article, peut-on reprendre ? Comment ?
6. Quelle est la persistence des résultats intermédiaires (drafts) ? Si crash, perdu ou sauvegardé ?
7. Combien d'étapes total dans le pipeline (mesurer la chaîne) ?
8. Quelle latence p50 / p95 / p99 par étape ? **Si pas instrumenté → flag P0**.
9. Comment passe-t-on de `draft` à `published` ? Action manuelle admin ou auto ?
10. Sitemap : régénéré à chaque publish OU cron ? Si cron, quelle cadence ?
11. IndexNow ping : automatique sur publish ? Quel endpoint ?
12. GSC submit : automatique ou manuel ? Via API ou Search Console UI ?
13. Bing WMT submit : configuré ? Si non → P1.
14. ISR Next.js revalidate : déclenché après publish ? Via webhook ?
15. Si l'article est marqué `published` mais sitemap pas régénéré, c'est invisible Google. Combien de temps entre publish et apparition sitemap ?
16. Failure modes : Claude API down → que se passe-t-il ? Retry ? DLQ ?
17. Backpressure : si 1000 jobs en queue, comportement worker ?
18. Observabilité : logs structurés (`pino`/`winston`) ? Sentry intégration ?
19. Métriques Prometheus / Plausible événements custom ?
20. Tests E2E couvrent-ils le pipeline complet ?

#### Approfondissement « 7 flows distincts par type contenu » (sous-section critique)

Auditer **explicitement** chaque flow type contenu et identifier les variations vs flow générique. Tracer + mesurer chaque variante.

21. **Flow `article_titre_manuel`** :
    - Étapes obligatoires : Will saisit titre → skip sélection keyword (déjà fourni implicitement par titre) → outline → body → faq → review → publish
    - Étape additionnelle : extraction keyword principal depuis titre (regex + NER) pour mapping verticale
    - Cost estimé /article : ~$0.20 (économie 1 étape vs standard)
    - Question audit : ce flow est-il implémenté distinct ? Si NON → P1 (UX Will saisit titre + perdrait temps re-sélection keyword)

22. **Flow `article_keywords`** :
    - Étapes : sélection keyword DB (lock SELECT FOR UPDATE) → génération titre (validation keyword-in-title) → outline → body → faq → review → publish
    - Question : le flow standard est-il celui audité par A02 ? Confirmer.

23. **Flow `longue_traine_intention`** :
    - Étapes : sélection keyword filtré `isLongTail=true` + `intent ∈ informational/transactional` → génération titre orienté question (« Comment / Pourquoi / Combien ») → outline orienté réponse directe → body → FAQ enrichie (≥10 Q/A car longue traîne = AEO-friendly) → review
    - Question : ce flow privilégie-t-il les patterns AEO (h2 question + abstract <300 chars + speakable) ? Si même flow que standard → gap.

24. **Flow `comparatif`** :
    - Étapes : input « X vs Y vs Z » OU « top 10 alternatives à X » → recherche infos chaque option (KB ou external) → outline tableau comparatif → body avec ClaimReview JSON-LD → conclusions/recommandations → review
    - Étapes spécifiques : **fact-check renforcé sur chaque option** (vérifier pricing, features, dates). **Image par option comparée**.
    - Cost estimé /article : ~$0.80 (×4 vs standard car research multi-objets)
    - Question : ce flow existe-t-il ? Implémenté distinct ?

25. **Flow `pilier` (skyscraper)** :
    - Étapes : input topic cluster → outline étendu (10-15 h2) → **outline review humain obligatoire** (Will valide structure avant body) → body 3000-6000 mots → ≥10 FAQ → table of contents auto → tableau synthèse → review multi-iterations → publish
    - Étape humain in-the-loop : ralentit mais qualité critique pour piliers
    - Cost estimé /article : ~$2-4 (×10 vs standard, justifié par valeur long-term asset)
    - Question : workflow `pending_human_outline_review` existe-t-il ? Si NON → P1.

26. **Flow `qr_auto_genere`** :
    - Étapes : crawl interne corpus AxionIA existant (articles publiés) → extraction questions implicites des h2/intro/FAQ → matching keyword associé → génération réponse approfondie 600-800 mots → cross-link vers article source (`isBasedOn`) → review → publish
    - Étape spécifique : **anti-cannibalisation** (la nouvelle Q/R ne doit pas remplacer l'article parent qui rank déjà)
    - Cost estimé /article : ~$0.15 (économie car recyclage)
    - Question : ce flow existe-t-il ? Implémenté distinct ?

27. **Flow `article_rss`** :
    - Étapes : RSS feed parser → curation top N items dernières 48h → vérification originalité (anti-plagiat external) → angle éditorial original (« notre prise sur X ») → body avec citation source (`isBasedOn`) → review → publish
    - Étape spécifique : **délai 48h après publication source** (anti-scrape signal Google) + **valeur ajoutée éditoriale obligatoire** (pas summary mais analyse)
    - Cost estimé /article : ~$0.35
    - Question : `RssSource` Prisma existe (cf. Sprint S+5 P2 commit `6aaa57f`) ? Le worker `rss-parser-worker` traite quels feeds actuellement ?

#### Pour chaque flow, mesurer :

28. **Latence p50 / p95 / p99 par flow** : trace observable per flow ?
29. **Cost moyen Claude par flow** : observable Anthropic Console + tagging job metadata ?
30. **Success rate par flow** : nb publish / nb attempted ?
31. **Refusal reasons distribution par flow** : pilier rejet 30% car too thin ? Comparatif rejet 15% car fact-check fail ?
32. **Différences observables prompts** : combien de prompts distincts par flow ? Partagent-ils 80%+ de partials communs ?
33. **Réutilisabilité workers** : 1 worker par flow OU 1 worker générique configurable ?
34. **Tests Vitest par flow** : snapshot test 1 article par flow ? Coverage différentielle ?

**Scoring /45** (révisé depuis /45 initial vers /45 — pondération inchangée mais répartition étendue) :
- Trace complète pipeline générique `/12`
- **7 flows distincts par type contenu (existence + variations spécifiques)** `/15`
- Mesures latence + cost + success rate par flow `/8`
- Failure modes audités `/6`
- Observability state `/4`

**Délégations** :
- → P2 : architecture 7 flows distincts + workers réutilisables + métriques per-flow
- → P5 : runbook ops + dashboards monitoring per-flow

---

### A03 — Critères de qualité contenu (anti-thin, lisibilité, valeur lecteur)

**Mission** : Évaluer les critères de qualité actuellement appliqués aux contenus générés. Comparer aux standards édition pro.

**Périmètre** :
- Helper validation `validateContent`, `qualityCheck`, `antiThin` ou équivalents
- Schemas Zod sur `Article`
- Critères dans prompts (regarder ce qu'on demande au LLM)
- Output existant : sample 10 articles publiés récents (`Article.status='published'` ORDER BY `publishedAt` DESC LIMIT 10)

**Questions à investiguer (≥15)** :
1. Quelle est la longueur minimale exigée pour un article publié (mots) ?
2. Si non documenté → mesurer 10 articles : `min/avg/max` mots.
3. Y a-t-il un check Flesch (lisibilité FR) ? Si non → P1.
4. Y a-t-il un check sur nb h2/h3 minimum ?
5. Y a-t-il un check sur présence FAQ (≥6 Q/A) ?
6. Y a-t-il un check sur présence image hero ?
7. Y a-t-il un check sur internal links ≥5 ?
8. Y a-t-il un check sur external links ≥2 ?
9. Y a-t-il un check sur abstract / TL;DR / résumé ?
10. Y a-t-il un quality_score LLM-as-judge actuellement ?
11. Si oui, quelle est la distribution sur les 100 derniers articles ? `SELECT avg, stddev, min, max FROM ...`
12. Quels articles sont publiés malgré un quality_score faible ? Combien ?
13. Y a-t-il une notion d'« E-E-A-T » dans les schemas ou prompts ? Author Person + knowsAbout + sameAs ?
14. Valeur lecteur démontrable : présence d'exemples concrets, chiffres, cas clients ?
15. Anti-thin : nb mots par section h2 (cible >150) ? Sections vides ?
16. Détection « contenu primarily for ranking » (mots-clés stuffés) ? Density check ?
17. Validation FR : pas d'anglicismes inappropriés, ponctuation FR (espaces insécables), guillemets français ?
18. Cohérence ton de marque AxionIA (terracotta brand voice — assertif, expert, B2B premium) ?
19. Sample 3 articles publiés : qualité subjective de lecture (extraire 3 paragraphes, juger) ?
20. Comparaison vs concurrent référence : 1 article similaire sur axionai.fr ou un blog top-rank → qualité comparée ?

#### Approfondissement « valeur lecteur » (sous-section critique)

21. **Hook ouverture** : les 3 premières phrases captent-elles l'attention (problème + promesse + bénéfice) ? Mesurer sur 10 articles.
22. **Mental models / frameworks** : l'article propose-t-il un modèle mental nouveau (framework, matrice, taxonomie, schéma) ou recycle-t-il ?
23. **Storytelling B2B** : présence de mini-narrations (cas client, transformation, before/after) ? Au moins 1 anecdote concrète par article ?
24. **Specificité métier** : terminologie B2B FR maîtrisée (DAF, COMEX, CODIR, OPEX, EBITDA, scale-up, time-to-market, etc.) ou jargon générique IA ?
25. **Actionable takeaways** : chaque article contient-il un encart « 3-5 actions concrètes à mettre en place cette semaine » ? Si non → faible valeur lecteur.
26. **Données chiffrées** : nb stats / chiffres / metrics cités par article ? Sources tracées ?
27. **Dwell time signals** : structure de lecture (sub-headings, bullets, tableaux, encadrés, exemples encadrés) favorise-t-elle un dwell time >2 min ?
28. **Anti-bullshit** : présence de phrases creuses (« l'IA va révolutionner votre business »), généralisations, buzzwords non substantiés ? Score subjectif.
29. **Engagement final** : la conclusion ouvre-t-elle sur une action concrète (CTA service AxionIA contextuel) ? Pas juste « pour conclure ».
30. **Échantillonnage qualitatif** : lecture intégrale de 3 articles sample (1 standard, 1 pilier, 1 ville) — verdict subjectif `/10` valeur lecteur par article + extraits illustratifs des 3 meilleurs/pires paragraphes.

#### Approfondissement « qualité textuelle mesurable » (5 angles avancés)

31. **Originality score** : embeddings cosine de chaque article vs corpus AxionIA existant + corpus web (extrait Common Crawl secteur IA B2B FR). Score = `1 - max_cosine`. Cible ≥ 0.30 (article distinct). Méthode : indexer corpus 5K articles secteur, projeter chaque AxionIA, mesurer min distance. Articles <0.20 = trop dérivatifs.
32. **Lexical diversity (type-token ratio)** : `unique_tokens / total_tokens` après stopwords FR removal + lemmatisation. Cible ≥ 0.45 sur articles 1200+ mots. Sous 0.35 = vocabulaire monotone, signal IA détectable.
33. **Sentence variation** : standard deviation des longueurs de phrase. Cible σ ≥ 8 mots (alternance phrases courtes percutantes + phrases développées). Texte avec σ <5 = rythme plat, ennui lecteur.
34. **Coherence inter-section** : LLM-judge dédié sur transitions h2→h2. Score `/10` : « la section suivante découle-t-elle logiquement de la précédente, ou rupture brutale ? ». Outil : Claude Sonnet avec prompt « évalue cohérence narrative ».
35. **Brand voice consistency cross-articles** : embeddings de chaque article sur dimension « ton » (vs corpus golden samples Will-approved). Variance cross-corpus mesurée. Si écart-type voice >0.15 → drift identité de marque.

#### Approfondissement « valeur extra-rédactionnelle »

36. **Citation density** : ratio `nb claims chiffrés/dates/noms propres ÷ nb sources citées`. Cible ≤ 2 claims par citation (chaque 2 affirmations factuelles doivent être étayées). Articles avec ratio >5 = risque invention.
37. **Counterfactual ratio** : article présente-t-il un contre-argument / limite / nuance ? Détection LLM « identifie les sections qui exposent les limites de la thèse ». Cible ≥1 par article (anti-cherry-picking).
38. **Reading age (Flesch-Kincaid FR adapté)** : cible 12-15 ans (lecteur B2B éduqué). >18 = trop académique. <10 = trop simpliste.

**Scoring /65** :
- Inventaire critères existants `/8`
- Mesures quantitatives 10 articles sample `/10`
- Gaps vs standards édition pro `/8`
- Risque scaled content abuse policy `/7`
- **Valeur lecteur profonde (hooks + mental models + storytelling + actionable + dwell + anti-bullshit)** `/17`
- **Qualité textuelle mesurable (originality + lexical diversity + sentence variation + coherence + brand voice)** `/10`
- **Valeur extra-rédactionnelle (citation density + counterfactual + reading age)** `/5`

**Délégations** :
- → P4 : design quality gate + criteria E-E-A-T + valeur lecteur framework + storytelling B2B doctrine
- → P3 : intégration AEO/GEO dans qualité

---

### A04 — Mots-clés & intention de recherche

**Mission** : Auditer la table `Keyword` (747 seeds), le mapping verticale × cible × type contenu, la couverture longue traîne, et la sélection keyword par le pipeline.

**Périmètre** :
- Model `Keyword` Prisma
- Seeds keywords (`prisma/seeds/keywords/*.ts` ou équivalent — cf. commit `7289de1` 2026-05-20)
- Service `keyword-selector.ts` ou équivalent (comment le worker pick un keyword)
- Validation « keyword in title »

**Questions à investiguer (≥15)** :
1. Combien de champs sur `Keyword` ? Lister.
2. Y a-t-il un champ `searchIntent` ? Si non → P0 (Will l'a explicité).
3. Y a-t-il un champ `vertical` (qui mappe à quelle verticale ce keyword) ?
4. Y a-t-il un champ `audienceFit` (tpe/pme/eti) ?
5. Y a-t-il un champ `contentTypeFit` (à quel type de contenu ce keyword convient) ?
6. Y a-t-il un champ `clusterId` (topic cluster) ?
7. Y a-t-il un champ `isLongTail`, `isLocal`, `cityIds` ?
8. Y a-t-il un champ `searchVolume` (Semrush/Ahrefs) ?
9. Y a-t-il un champ `difficulty` (KD) ?
10. Distribution 747 seeds par verticale : `SELECT vertical, count(*) FROM Keyword GROUP BY vertical` (ou équivalent fichier seed).
11. Distribution par intent (si présent) : informational vs commercial vs transactional vs local.
12. Couverture longue traîne : combien de keywords ≥4 mots ? % du total ?
13. Comment le worker sélectionne le keyword ? Lock SELECT FOR UPDATE pour éviter doublon ? Random ? Priorité par score ?
14. Validation « keyword dans le titre » : code source ? Test ? Lemmatisation FR utilisée (`wink-lemmatizer` ou équivalent) ?
15. Re-use : un keyword peut-il servir plusieurs articles ? Compteur `usageCount` ?
16. Si keyword épuisé, comportement worker ?
17. Source d'enrichissement keywords : manuel ? Import Semrush CSV ? Scraping Google Suggest ?
18. Existe-t-il une UI admin pour gérer keywords (CRUD, import CSV, filtres) ?
19. Audit `_AUDIT/KEYWORD-STRATEGY-AUDIT-2026/` : quelles recos du précédent audit ont été implémentées ?
20. Couverture par verticale : la nouvelle verticale `sites_web_augmentes` a-t-elle des keywords seedés ?

**Scoring /62.5** :
- Inventaire schema Keyword `/15`
- Distribution + couverture mesurée `/15`
- Validation keyword-in-title auditée `/15`
- Couverture longue traîne `/10`
- UI admin `/7.5`

**Délégations** :
- → P2 : extension schema Keyword (D6 master)
- → P3 : stratégie longue traîne + intent fit AI Overviews

---

### A05 — Templates par type de contenu (7 types)

**Mission** : Auditer l'existence et la qualité de templates pour chacun des 7 types contenus.

**Périmètre** :
- Composants React/MDX pour rendering (`src/components/articles/*`, `src/app/[locale]/(public)/articles/[slug]/page.tsx`)
- Helpers de génération (`generate{ContentType}.ts`)
- Schemas Zod de validation
- Snapshot tests Vitest

**Questions à investiguer (≥15)** :
1. Existe-t-il un composant React dédié par type ? `<ArticleStandard/>`, `<ArticlePilier/>`, `<ArticleComparatif/>`, `<ArticleQR/>` ?
2. Ou bien 1 composant générique `<Article/>` polymorphe ?
3. Le rendering diffère-t-il selon le type (h2 vs h3 hierarchy, FAQ count, TOC) ?
4. Pour chaque type, lister la structure attendue (h1, h2 count, sections obligatoires).
5. Schema Zod par type ? Validation runtime sur output LLM ?
6. Snapshot test Vitest par type ? `__snapshots__/` count.
7. Type `pilier` : implémentation skyscraper (3000+ mots) ? Sample existant ?
8. Type `comparatif` : structure table comparison ? ClaimReview JSON-LD ?
9. Type `qr_auto_genere` : recyclage contenu existant — comment est-ce implémenté ?
10. Type `article_rss` : citation source originale (isBasedOn JSON-LD) ? Anti-plagiat curation ?
11. Type `longue_traine_intention` : différencé de `article_keywords` ?
12. Variants par audience (tpe vs pme vs eti) : ton, exemples, jargon, longueur ?
13. Variants par verticale : sections obligatoires diffèrent (e.g. `audits` doit avoir un encart pricing 490€) ?
14. Variants ville vs global : sections « Pourquoi à Paris », « Cas locaux » ?
15. Suggested content (`<SuggestedContent/>`) : composant existe ? Logique de sélection ?
16. CTA différencié par type ?
17. Table des matières (TOC) pour piliers ?
18. Tableau de synthèse (Google AI-friendly) sur quels types ?
19. Bullet lists (3-7 items) imposés ?
20. Mention humaine bas d'article (AI Act) déjà présente ?

**Scoring /62.5** :
- Existence templates par type `/20` (~3pts/type ×7)
- Qualité différenciation `/15`
- Schemas Zod + tests `/15`
- Variants audience/verticale/ville `/12.5`

**Délégations** :
- → P4 : design 7 templates production-grade complets

---

### A06 — SEO / AEO / GEO / Speakable / JSON-LD (état actuel)

**Mission** : Auditer toutes les balises SEO/meta/JSON-LD générées par les pages content-gen. Comparer aux standards 2026 (AI Overviews readiness).

**Périmètre** :
- `src/app/[locale]/(public)/articles/[slug]/page.tsx` (metadata function + page rendering)
- `src/lib/seo/**` (helpers seo, json-ld builders)
- Composants `<JsonLd/>`, `<Breadcrumbs/>`, `<FAQ/>`, `<Speakable/>`
- Sample 5 articles HTML rendu (curl https://axion-ia.com/fr/... ou snapshot Playwright)

**Questions à investiguer (≥20)** :
1. Balise `<title>` : longueur ? keyword early ? Vérifier 5 articles.
2. `<meta name="description">` : 140-160 chars ? CTA présent ? Mesurer.
3. `<link rel="canonical">` : absolue, sans param ? Mesurer.
4. Hreflang FR + EN + x-default : présents ? Cohérents ?
5. Open Graph complet (title/description/image/type/url/locale/site_name) ?
6. Twitter Cards ?
7. `<h1>` unique (pas zéro, pas 2) ?
8. Hiérarchie h2 > h3 > h4 sans skip ?
9. JSON-LD `Article` : présent ? Champs (headline, image, datePublished, dateModified, author, publisher, abstract, mainEntityOfPage, isPartOf, isBasedOn si RSS) ?
10. JSON-LD `FAQPage` : présent si FAQ section ?
11. JSON-LD `BreadcrumbList` : présent ? Position correcte ?
12. JSON-LD `Speakable` : présent ? cssSelector vs xpath ? Quels paragraphes ciblés ?
13. JSON-LD `Service` (sur pages service) ?
14. JSON-LD `LocalBusiness` (sur pages ville) ?
15. JSON-LD `Organization` (root layout) avec sameAs (LinkedIn, Wikidata, X) ?
16. JSON-LD `Person` (auteur) : knowsAbout, sameAs, jobTitle ?
17. JSON-LD `aiGenerated: true` (AI Act art. 50) : présent ? Si NON → **P0 critique** deadline août 2026.
18. Mention humaine bas d'article : présente ? Wording exact ?
19. Schema.org markup validator (Google Rich Results Test) : passe sur 3 articles sample ?
20. Abstract `<aside class="article-summary">` : <300 chars dans body ET dans JSON-LD `abstract` ?
21. Featured snippets readiness : tableau synthèse, bullet list 3-7, h2 question directe ? Audit 5 articles.
22. People Also Ask : FAQ ≥6Q avec h2 ouvrant interrogatif (Comment / Pourquoi / Quel / Combien) ?

#### Approfondissement « Featured Snippets + AI Overviews + KG entity » (sous-section critique)

23. **Position 0 readiness** : pour chaque article, identifier la question Google que cible le contenu et vérifier sa réponse-définition <60 mots juste après h2 ouvrant.
24. **People Also Ask harvest** : Will a-t-il configuré un outil pour récolter les PAA Google sur ses keywords cibles ? Si NON → P1 (`peopleAlsoAsk` enrichissement DB).
25. **Tableau structured data** : article cible-t-il featured snippet « table » via balisage `<table>` propre + caption + thead/tbody + JSON-LD `Dataset` si données quantifiables ?
26. **Liste structured data** : article cible-t-il featured snippet « list » (ordered ou unordered) via balisage `<ol>`/`<ul>` propre + JSON-LD `ItemList` ?
27. **HowTo featured snippet** : pour les articles à étapes, JSON-LD `HowTo` avec `HowToStep` + image par step ?
28. **Knowledge Graph entity AxionIA** : Wikidata Q-ID créé ? Si oui, lequel ? `Organization` JSON-LD pointe vers `sameAs: ["https://www.wikidata.org/wiki/Q..."]` ?
29. **Wikipedia FR/EN** : article Wikipedia AxionIA existe ? Si NON → enjeu GEO majeur, ajouter au backlog Will.
30. **Google Knowledge Panel** : recherche `AxionIA` sur Google → panneau de connaissance affiché ? Si NON → confirmer création KG via Wikidata + sameAs cohérents.
31. **Bing Entity** : Bing Webmaster Tools `Entity Explorer` vérifie l'entité AxionIA ?
32. **Schema.org sameAs exhaustif** : sur Organization root layout, sameAs liste LinkedIn + X/Twitter + Wikidata + Wikipedia FR + Wikipedia EN + Crunchbase + GitHub (si appli) + YouTube + Mastodon ?
33. **Person author sameAs** : auteur (Will ou persona) lié à LinkedIn + X + GitHub + ORCID (si pertinent) + Mastodon ?
34. **knowsAbout granular** : `Person.knowsAbout: ["Artificial Intelligence", "B2B Consulting", "Formation IA", ...]` ou juste générique ?
35. **isBasedOn** : pour articles RSS-derived, JSON-LD `isBasedOn` cite la source originale ?
36. **mentions** : JSON-LD `mentions` cite les entités (entreprises, personnes, technologies) référencées dans l'article ?
37. **about** : JSON-LD `about` rattache l'article à un topic Wikidata Q-ID (e.g. Q11660 = AI) ?
38. **AI Overviews compatibility check** : Will a-t-il accès à un environnement de test AI Overviews (compte US ou Brave Search Leo) pour tester ses articles ? Si NON → flag décision Will.
39. **Speakable cssSelector vs xpath** : sélecteur ciblé (`.article-summary`, `.tldr`) ou xpath ? Test Google Speakable Test Tool valide ?
40. **Indexation tier strategy** : sitemap priority + lastmod cohérents ? Sub-sitemaps prioritaires (services > villes > articles fraicheur) ?

**Scoring /75** :
- SEO classique `/10` (title, desc, canonical, hreflang, OG, Twitter, h1)
- AEO `/12` (FAQPage, abstract, h2 question, bullets, table)
- **Featured Snippets / Position 0 / People Also Ask** `/13`
- **Knowledge Graph entity AxionIA + Wikidata + Wikipedia + sameAs exhaustif** `/15`
- GEO complet `/10` (Organization sameAs, Person knowsAbout, mentions, about, isBasedOn)
- Speakable `/7`
- JSON-LD exhaustivité (Article, FAQPage, Service, LocalBusiness, BreadcrumbList, HowTo, Dataset, ItemList, Person, Organization) `/5`
- AI Act `aiGenerated:true` `/3`

**Délégations** :
- → P3 : tout le bloc SEO/AEO/GEO 2026 + KG entity strategy + Wikidata Q-ID claim + featured snippets framework

---

### A07 — Images : assignation, alt, variants, fallback

**Mission** : Auditer comment les images sont assignées aux articles depuis l'image-bank, la qualité des alt, les variants servis, et la doctrine « jamais d'IA générative ».

**Périmètre** :
- Service `assignImage`, `image-selector.ts` ou équivalent
- Schema `Image` / `ArticleImage` Prisma
- Composant `<ArticleImage/>` / `<Image/>` (next/image)
- Image-bank : `_AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/` + commits récents image-bank

**Questions à investiguer (≥15)** :
1. Comment un article reçoit une image ? Mapping topic → image-bank queries ?
2. Algorithme : exact match ? Cosine match sur embeddings tags ? Manuel admin ?
3. Si image-bank vide pour un topic → fallback ? Image générique ? Status `pending_image` ?
4. Vérification doctrine « jamais IA générative » : grep `dall-e`, `midjourney`, `stable-diffusion`, `imagen`, `openai.*image` dans code → 0 result attendu.
5. Alt rédactionnel : généré comment ? LLM ? Manuel ? Auto depuis EXIF/IPTC ?
6. Longueur alt : <125 chars (recommandation WCAG + SEO) ?
7. Variants AVIF + WebP + LQIP + thumbnail : générés ?
8. `<Image/>` next/image utilisé (pas `<img/>` raw) ?
9. Loading lazy sauf hero ?
10. `srcset` + `sizes` cohérents ?
11. EXIF / IPTC / XMP embed (copyright, license CC BY 4.0, author) ?
12. Watermark : sur download seulement ou inline ?
13. License par défaut : CC BY 4.0 ? Copyright `Axion-IA OÜ` ?
14. Pour piliers : ≥3 images (cf. Will brief) ? Vérifier sample.
15. Pour comparatif : 1 image par option ? Vérifier sample.
16. Captions (`<figcaption/>`) : utilisés ? Source citée ?
17. Sitemap images : généré ? Google Image Sitemap spec 1.1 ?
18. JSON-LD `ImageObject` sur images ?
19. Pour pages ville : image typique de la ville ? D'où vient-elle (image-bank tagged city) ?
20. Si Will n'a pas encore importé les 73 images cf. [[axionia_image_bank_complet_2026-05-20]] → couverture actuelle ?

**Scoring /62.5** :
- Assignation algorithme `/15`
- Doctrine « 0 IA générative » respectée `/10`
- Alt qualité (rédactionnel, <125, sample) `/12.5`
- Variants + LQIP + EXIF `/10`
- Sitemap images + JSON-LD ImageObject `/7.5`
- Fallback strategy `/7.5`

**Délégations** :
- → P4 : intégration images dans 7 templates
- → P3 : sitemap-images + ImageObject

---

### A08 — Maillage interne, externes, suggested content

**Mission** : Auditer la stratégie de liens (internes, externes) et le composant suggested content.

**Périmètre** :
- Service `internal-linker.ts`, `external-link-injector.ts` ou équivalents
- Composant `<SuggestedContent/>`, `<RelatedArticles/>`, footer cross-links
- Schema `Link` / `ExternalLinkSource` (linkbase)

**Questions à investiguer (≥15)** :
1. Nb internes moyens par article publié ? Mesurer sample 20.
2. Anchor text diversity : majorité « cliquez ici » / « en savoir plus » ou variété keyword-rich ?
3. Topology : article ville lie article verticale ? Cluster topology pillar→cluster ?
4. Internes générés automatiquement OU manuels OU les deux ?
5. Algorithme topic match : embeddings ? tags ? regex sur titres ?
6. Externes : table `ExternalLinkSource` existe ? Si non → P1.
7. Nb externes moyens par article ?
8. Externes : rel="noopener noreferrer" toujours ?
9. Externes : nofollow par défaut, dofollow si validated ?
10. DA / DR / Trust score utilisé pour sélectionner ?
11. Topic tags sur externes ?
12. `<SuggestedContent/>` : composant existe ? Rendu SSR ou client ?
13. Algorithme suggested : 2 same city + 2 same vertical + 2 cluster ?
14. Position dans page : bas d'article ? Sticky sidebar ?
15. Tracking analytics sur clics suggested ?
16. Si page ville : suggested affiche autres villes ? Articles même région (ex. Île-de-France) ?
17. Politique anti-link-stuffing : max externes par article ?
18. Sponsored / affiliate links déclarés (`rel="sponsored"`) ?
19. Broken link check : cron qui vérifie status externes ?
20. Internal link orphan detection : pages sans lien entrant ?

**Scoring /62.5** :
- Internes count + diversity `/15`
- Topology cluster `/10`
- Externes table existe + politique `/15`
- SuggestedContent existe + algo `/12.5`
- Maintenance (broken check, orphans) `/10`

**Délégations** :
- → P2 : schema `ExternalLinkSource`
- → P3 : stratégie maillage SEO 2026

---

### A09 — Anti-doublons / anti-thin / duplicate-content

**Mission** : Auditer les mécanismes en place pour détecter et empêcher les contenus dupliqués / near-duplicates / thin.

**Périmètre** :
- Helper `dedup`, `simhash`, `embedding-check`, `similarity` ou équivalents
- Champs `Article.simhash`, `Article.embedding` (pgvector)
- Workflow pre-publish check

**Questions à investiguer (≥15)** :
1. Existe-t-il un champ `simhash` sur `Article` ? Si NON → P0.
2. Existe-t-il pgvector extension Postgres installée ? `SELECT * FROM pg_extension WHERE extname='vector'`.
3. Si pgvector OK : index HNSW ou IVFFlat sur embedding column ? Si NON → P1.
4. Quel provider embeddings (si utilisé) ? OpenAI text-embedding-3-large ? Voyage AI ? Local ?
5. Threshold cosine pour flag near-duplicate ? Si NON défini → P0.
6. Pipeline pre-publish : check simhash distance Hamming ≤8 ?
7. Pipeline pre-publish : check cosine top-5 closest > 0.85 ?
8. Action si flag : reject auto / human review / auto-rewrite ?
9. Anti-thin : check nb mots minimum ? Quel seuil ?
10. Check h2/h3 count minimum ?
11. Check ratio mots/h2 (anti-section vide) ?
12. Templatique anti-redundancy : SimHash sur outline (h2 sequence) ?
13. Cross-language dedup : article FR généré, vérifier EN miroir cohérent ?
14. Internal duplicate (ce même site) : check `Article.simhash` vs existing.
15. External duplicate (autre site web) : Copyscape ou équivalent ? Si NON → P1.
16. Plagiarism check sur sources externes (RSS, citations) → fair use ?
17. Articles publiés actuellement : audit batch des 100 derniers — combien de near-duplicates détectables a posteriori ?
18. Faux positifs : ton de marque AxionIA récurrent ne doit pas trigger flag.
19. Performance scaling : SimHash O(N) sur 10K articles = OK, sur 100K → LSH index ?
20. Embeddings cost : ~$0.13/M tokens, calcul cost estimate pour 3400 articles = ?

**Scoring /62.5** :
- SimHash implémenté `/15`
- Embeddings + pgvector + cosine threshold `/20`
- Pipeline pre-publish check `/15`
- External duplicate check (Copyscape) `/7.5`
- Performance scaling readiness `/5`

**Délégations** :
- → P2 : architecture dedup 3 niveaux complète

---

### A10 — Couverture géographique (villes × verticales × types)

**Mission** : Mesurer la couverture actuelle de la matrice ville × verticale × type, identifier gaps, détecter cannibalisation.

**Périmètre** :
- Pages villes : `src/app/[locale]/(public)/villes/[slug]/**`
- KB villes : `axionia/kb/villes/copy/*.ts`
- Données économiques : `axionia/kb/villes/economic-data/*.ts`
- DB : articles per `cityId` × `vertical` × `contentType`

**Questions à investiguer (≥15)** :
1. Combien de villes couvertes ? `ls axionia/kb/villes/copy/` count + DB count distinct.
2. Liste des 39 villes pilote : Paris, Lyon, Marseille, ..., Nancy.
3. Statut V3 score moyen 83% — quelles villes <70 ?
4. Articles publiés par ville : `SELECT cityId, count(*) FROM Article WHERE published=true GROUP BY cityId`.
5. Cohérence : si ville a fichier `economic-data` mais 0 article → gap.
6. Matrice complète ville × verticale × type : exporter en CSV pour analyse.
7. Cannibalisation : 2 articles ciblent-ils le même keyword sur la même ville ? Risque hub vs cluster.
8. Stratégie KB villes : doctrine « zéro invention » respectée ? Sources INSEE/UNESCO citées ?
9. Articles ville incluent : démographie, secteur économique, écosystème IA local ?
10. Local SEO : NAP (Name, Address, Phone) cohérent par ville ? **AxionIA OÜ n'a pas d'adresse FR** — audit city domination flagué WeWork Paris ~300€/mo.
11. Alentours ville (rayon 30-50 km) : couverts en GEO mention ?
12. JSON-LD `LocalBusiness` par page ville ?
13. Google Business Profile par ville : Will gère ? Si NON → décision business.
14. Sitemap par ville (sub-sitemap) ?
15. Hreflang FR/EN par ville si applicable ?
16. Pagination : si 50 articles sur Paris, comment listé sur `/villes/paris/` ?
17. Cluster topology : article hub Paris → cluster ferrer articles sub-topics ?
18. Conflit avec sessions Manon (Rouen actuelle) : fichiers en WIP non poussé ?
19. Cible 12 mois 120 villes : trajectoire actuelle 39 → quels rythmes ?
20. Audit city domination 2026-05-18 score 2185.6/3200 (68.3%) : quelles recos implémentées depuis ?

**Scoring /62.5** :
- Inventaire villes + matrice `/20`
- Cannibalisation detection `/12.5`
- Local SEO (NAP, LocalBusiness, GBP) `/15`
- Stratégie KB villes + sources cités `/10`
- Sub-sitemaps + hreflang ville `/5`

**Délégations** :
- → P3 : stratégie Local SEO 2026
- → P2 : architecture data cities

---

### A11 — Knowledge Base : zéro invention enforcement

**Mission** : Auditer KB existante (villes V3 + sectorielle si existe + méta), comment injectée dans prompts, et hallucination control.

**Périmètre** :
- `axionia/kb/villes/**` (V3)
- `axionia/kb/verticals/**` (si existe)
- `axionia/kb/global/**` (méta entity AxionIA)
- Service `kb-loader.ts`, `prompt-builder.ts`
- Anthropic SDK `cache_control: ephemeral` usage

**Questions à investiguer (≥15)** :
1. Combien de fichiers KB total ? Volume tokens estimé ?
2. KB villes V3 : 39 fichiers, type étendu 16 dimensions. Bien sourcé INSEE/INAO/UNESCO ?
3. KB sectorielle (`kb/verticals/*.ts`) : existe ? Couvre les 5 verticales ?
4. KB méta `kb/global/axionia-entity.ts` : existe ? Wikidata Q-ID claim ?
5. Comment KB injectée dans prompt : RAG (search before) ? Full context ? Prompt cached partials ?
6. Prompt caching Anthropic activé ? `cache_control: {type: "ephemeral"}` présent ?
7. Cache hit rate observable ? Logs ?
8. Hallucination control : prompt instruit le LLM à ne pas inventer ? Marker `[NÉCESSITE VÉRIFICATION]` ?
9. Post-gen check : pattern `[NÉCESSITE VÉRIFICATION]` triggert review humain ?
10. Citations sources : chaque chiffre/date/nom propre lié à une source dans la KB ?
11. Sources structurées : `kb/villes/{slug}.ts` exporte `sources: [{ name, url, accessedAt }]` ?
12. Test invention : sur 10 articles publiés, sample 10 affirmations chiffrées → vérifiables vs KB ?
13. Drift KB : KB villes V3 a 16 dimensions, articles utilisent combien ?
14. KB versioning : si KB ville Paris modifiée, articles existants régénérés ?
15. KB tools pour Will : UI admin pour éditer KB ? Ou seulement fichiers TS manuels ?
16. KB validation : Zod schema sur KB pour empêcher fautes typos ?
17. Sample 3 articles ville récents : vérifier citation explicite KB.
18. AxionIA entity sameAs : LinkedIn, X, Wikidata, Wikipedia (FR + EN) ?
19. Wikidata claim : Q-ID AxionIA créé ? Si NON → P1 critique GEO.
20. Author entity : Will (William Jullin) Person schema sameAs LinkedIn ?

#### Approfondissement « Fact-checking automatique zéro invention » (sous-section critique)

21. **Claim extraction post-gen** : helper qui parse l'article et extrait tous les `factual_claims` (chiffres, dates, noms propres, citations). Existe ? Si NON → P0.
22. **Citation density per claim** : pour chaque claim extrait, est-il rattaché à une source via `<cite>`, `[ref:X]`, ou JSON-LD `citation` ? Ratio claims/citations mesuré.
23. **Source verification trigger** : si un claim n'a aucune source rattachée ET ne correspond à aucun fait KB sourcé → flag `unverified_claim` + status `pending_review`.
24. **KB fact lookup** : table `KbFact` (statement, source_url, source_date, confidence) ? Le pipeline check chaque claim vs `KbFact` ?
25. **Hallucination probabilistic detection** : si LLM cite un chiffre précis (e.g. « 73,2% des PME ») sans source — pattern detection (regex `\d+(?:[,.]\d+)?\s?%` + nearby citation check).
26. **Date freshness check** : dates citées sont-elles à jour (e.g. « rapport INSEE 2022 » alors qu'on est en 2026) ? Flag `stale_source` si source >36 mois.
27. **Named entity verification** : NER FR (spaCy `fr_core_news_lg` ou Claude) extrait entités nommées (orgs, persons, lieux) → vérifier existence Wikidata / SIRENE / Google KG.
28. **Anti-fabrication watchwords** : liste regex de patterns suspects (« selon une étude récente… », « il est prouvé que… », « les experts s'accordent… ») → flag manual review si non sourcé immédiatement après.
29. **Cross-KB consistency** : si KB ville Paris dit `population: 2,1M` et un article cite `2,5M` → flag drift KB vs content.
30. **Sample audit invention** : sur 10 articles publiés, extraire 5 claims chiffrés chacun (50 claims total) → vérification manuelle externe (INSEE, Wikipedia) → calcul ratio `claims_inventés / claims_total` = **score d'hallucination réel système**.

**Scoring /60** :
- KB exhaustivité 3 couches `/15`
- Injection prompt + caching `/10`
- Hallucination control mécanisme existant `/10`
- **Fact-checking automatique (claim extraction + source verification + KbFact lookup)** `/12`
- **Score d'hallucination réel mesuré sur 50 claims sample** `/8`
- Wikidata + KG entity AxionIA `/3`
- Tooling admin éditer KB `/2`

**Délégations** :
- → P2 : architecture fact-checking layer + KbFact table + claim extraction service
- → P3 : KG entity Wikidata strategy
- → P4 : doctrine zéro invention + prompts anti-hallucination renforcés

---

### A12 — Console admin : suivi & UX

**Mission** : Auditer pages admin content-gen existantes, dashboards, funnels, UX score.

**Périmètre** :
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen/**` (V2)
- `src/app/[locale]/(admin)/[adminPrefix]/content-gen-v1/**` (V1 si existe)
- Composants admin dashboard
- État `ADMIN_V2_ENABLED` flag

**Questions à investiguer (≥15)** :
1. Combien de pages admin content-gen existent ? Lister chemins.
2. V2 vs V1 : quelles pages migrées V2 ? Toutes ? Fall-through ?
3. Page `/content-gen` (dashboard root) : quels KPIs affichés ?
4. Page `/content-gen/articles` (list) : filtres ? Tri ? Pagination ?
5. Colonnes liste articles : titre, statut, ville, type, verticale, quality_score, date ?
6. Page `/content-gen/articles/[id]` (detail) : édit possible ? Re-generate ? Re-review ?
7. Page `/content-gen/campaigns` : existe ? CRUD campaigns ? Si NON → P0.
8. Page `/content-gen/keywords` : existe ? CRUD keywords ?
9. Page `/content-gen/city-coverage` : dashboard matrice ville × verticale × type ? (cf. memory check)
10. Funnel visuel draft → review → improved → published → indexed : existe ?
11. Heatmap calendar publications/jour : existe ?
12. Cost tracker Claude API : existe ?
13. GSC ingestion (CTR, impressions par article) : existe ?
14. Bing WMT ingestion : existe ?
15. Alertes UI : article refusé, cost cap reached, queue stuck ? Notifications inbox ?
16. Sentry capture errors workers : afficher dans admin ?
17. Multi-user : RBAC ? Si Will solo, simple. Si équipe → permissions ?
18. Sandbox preview mode : preview before publish ? URL `/_preview/article/[id]` ?
19. Bulk actions : sélectionner N articles + re-review / re-generate / discard ?
20. Mobile UX admin : responsive ?
21. A11y WCAG AA ?

#### Approfondissement « GSC / Bing WMT / refresh / drip » (sous-section critique)

22. **GSC API ingestion** : service account `service-account.json` configuré ? Domain property `axion-ia.com` verified ? Cron quotidien tire CTR + impressions + position par URL ?
23. **GSC table DB** : modèle `GscMetric` (urlId, date, ctr, impressions, position, clicks) ? Si NON → P1.
24. **Bing WMT API** : `BING_WEBMASTER_API_KEY` env var ? Cron tire stats Bing similaires ?
25. **GSC coverage view** : page admin liste toutes URLs avec colonnes `(indexed | submitted-not-indexed | excluded | error)` ? Drill-down par URL ?
26. **Crawl error alerts** : si GSC reporte une URL en `crawled-but-not-indexed`, alerte admin dans 24h ?
27. **Search analytics segments** : queries par URL (top 10) affichées en admin ? Permet de découvrir gap keywords couverts/non couverts.
28. **Refresh strategy auto** : articles >6 mois auto-flagués pour refresh ? Signal `dateModified` mis à jour à chaque refresh significatif ?
29. **Refresh trigger conditions** : ratio CTR <2%, position dégradée >5 places, dateModified vieux >180j → flag refresh ?
30. **Refresh workflow** : refresh = regen partiel (intro + conclusion + FAQ) ou full rewrite ? Anti-cannibalization (pas écraser URL existante) ?
31. **Drip publishing scheduler** : si campagne génère 200/jour mais 50/jour publishables d'un coup, queue de publication étale dans le temps ? Algorithme : random window 8h-22h CET, pause samedi/dimanche, max 30/jour par sub-sitemap ?
32. **Anti-burst Google detection** : publier 500 URLs same-day = signal artificial. Cap journalier `MAX_PUBLISH_PER_DAY=N` dur ? Si campagne pousse au-delà → queued for next day ?
33. **Editorial calendar UI** : vue calendrier des publications planifiées (drag-drop reschedule) ?
34. **Indexation tracking** : pour chaque URL publiée, status indexation suivi automatiquement (GSC URL Inspection API) ?
35. **Re-submission auto** : si URL `crawled-not-indexed` >7j, re-submit IndexNow + GSC submit ?
36. **Sandbox preview environment** : preview avant publish accessible via `/_preview/article/[id]?token=<JWT>` ? Bypass robots.txt protection ?
37. **Approval workflow** : workflow `draft → review_pending → human_approved → published` ? Notification email Will quand quality_score 8-8.5 pour validation manuelle ?
38. **Sentry errors workers ingestion admin** : page admin `/errors` qui pull Sentry API et affiche dans contexte content-gen ?
39. **Cost burn-rate visualization** : graph live cost Claude API last 24h / 7d / 30d / projection mois ?
40. **Multi-language switch admin** : si Will switches admin en EN, tout traduit correctement (i18next ou équivalent) ?

#### Approfondissement « Suivi pointu efficace » (7 angles)

41. **Anomaly detection metrics** : alerts si quality_score moyen drops >0.5pt en 7j ou si refusal_rate spike >+50% en 24h. Threshold configurables. Notif Slack/email Will.
42. **Cohort analysis** : tracker performance articles par cohorte semaine de publication. Indexation à 7j / 30j / 90j. Drop-off curves. Permet d'identifier que les articles publiés mardi 14h performent mieux que ceux du dimanche 2h, par exemple.
43. **Topic gap discovery** : ingestion GSC `Search queries` weekly → identifier queries `discovered-not-indexed` ou `crawled-not-clicked` sur lesquelles AxionIA n'a aucun article → liste « Sujets manquants prioritaires » dans admin.
44. **Heatmap géographique France interactive** : carte France SVG (départements ou régions) coloriée par densité couverture content-gen + drill-down clic région → liste villes couvertes + missing.
45. **Predictive forecasting** : modèle simple (moving avg 14j × tendance) qui projette : « au rythme actuel +X articles/jour, atteint cible 3400 articles le YYYY-MM-DD ». Mis à jour daily.
46. **Performance leaderboard hebdomadaire** : top 20 articles best CTR + top 20 worst CTR sur 30j glissants. Actions sur worst : `refresh` (auto-trigger improve), `kill` (noindex + sitemap remove), `manual edit`, `keep` (long-tail intentional).
47. **Reporting hebdo automatique email Will** : cron `lundi 8h CET` → email Will avec : KPIs semaine (gen/publish/refuse/cost), top 5 performers, top 5 worst, anomalies détectées, recommandations actions (3 max), prévisions cibles.

#### Approfondissement « Suivi indexation & search intelligence »

48. **Indexation timeline tracking** : pour chaque URL publiée, suivi auto status `submitted` → `crawled` → `indexed` → `ranked` avec timestamps. Graph latence indexation moyenne.
49. **Position tracking weekly** : rank tracker simple (10 keywords × 5 verticales = 50 keywords) avec position GSC weekly. Graph évolution sur 90j.
50. **Click-through rate (CTR) anomaly per query** : si CTR query <2% à position 1-3 → article à retravailler (title/meta peut-être faibles).
51. **Discover eligibility audit** : Google Discover (mobile push) priorise contenu fresh, visual, evergreen. Check articles éligibles (image >1200px, dateModified <30j, topic interest) → table `DiscoverEligibility`.
52. **AI Overviews citation tracking** : (quand outils dispo 2026) tracker si AxionIA cité par Google AI Overviews pour les top 50 queries. Action manuelle ou outil émergent (Surfer AI / Otterly).
53. **Voice search ranking** : Google Search Console n'expose pas voice queries directement. Approche : tracker queries longue traîne conversationnelles (« comment former mon équipe à l'IA », « combien coûte un audit IA ») → proxy voice intent.
54. **Mobile vs desktop ranking divergence** : GSC sépare par device. Identifier articles avec gap >5 positions mobile vs desktop → optimisation mobile-first.
55. **Backlinks alerts** : Ahrefs webhook (si souscription Ahrefs $99/mo) ou Google Alerts surveille « axion-ia.com » mentions → notification nouveau backlink.

#### Approfondissement « UX simplicité console admin » (sous-section critique — Will exigence explicite « simple et pas complexe »)

Audit user journey + simplicité utilisation. Mesurer chaque action clé en nombre de clicks + temps + cognitive load.

56. **User journey « Créer une campagne » — mesure** :
    - Combien de clicks depuis dashboard root pour créer + lancer une campagne complète ? Cible : ≤8 clicks (wizard 4 étapes).
    - Wizard step-by-step (recommandé) OU formulaire monolithique 30 champs (cognitive overload) ?
    - Étapes recommandées wizard :
      - **Étape 1** : verticale + nom campagne (2 champs)
      - **Étape 2** : volume + durée (slider visuel)
      - **Étape 3** : mix audience tpe/pme/eti + mix contenus 7 types (sliders avec preview impact)
      - **Étape 4** : scope géo (toggle global / cities multi-select) + cost cap + planning (start now / cron) + review final
    - Si actuel = formulaire monolithique → P0 redesign UX.

57. **User journey « Lancer campagne » — mesure** :
    - Une fois campagne créée, combien de clicks pour LANCER ? Cible : 1 click (bouton primaire vert « Lancer »).
    - Confirmation modale OUI/NON sur premier lancement (anti-erreur), pas sur suivants.

58. **User journey « Monitor campagne en cours » — mesure** :
    - Depuis dashboard, combien de clicks pour voir progression campagne X ? Cible : ≤2 clicks.
    - Visualisation : burn-down chart + funnel + cost burn rate visible same screen.

59. **User journey « Pauser campagne » — mesure** :
    - Combien de clicks ? Cible : 1 click sur card campagne + confirmation modale.

60. **User journey « Modifier campagne en cours »** :
    - Champs modifiables : mix, volume, cost cap. NON modifiables : verticale (sinon incohérence keywords).
    - Validation côté serveur : si modification rétroactive impacterait articles déjà generés, warning explicite.

61. **User journey « Archiver/cloner campagne »** :
    - 1 click archive + 1 click clone (créer nouvelle campagne avec mêmes settings, ouvrir wizard pré-rempli).

62. **Hick's Law compliance** : nb d'actions disponibles per écran ≤ 7 ? Si écran admin avec 15 boutons d'action → cognitive overload, P1 cleanup.

63. **Fitts's Law compliance** : boutons primaires (« Lancer », « Pauser ») suffisamment grands (≥44×44 px) et placés en zones accessibles (bas droite mobile, top right desktop) ?

64. **Heuristiques Nielsen 10** (audit subjectif scoring `/10` chaque) :
    1. Visibilité statut système (loading states, progress bars)
    2. Correspondance monde réel (vocabulaire FR métier, pas jargon dev)
    3. Contrôle utilisateur (undo, cancel partout)
    4. Cohérence + standards (couleurs terracotta partout, pas surprises)
    5. Prévention erreurs (warnings avant actions destructrices)
    6. Reconnaissance > rappel (presets visibles, pas memoriser)
    7. Flexibilité + efficacité (shortcuts experts + simple débutants)
    8. Esthétique minimaliste (whitespace, pas surcharge)
    9. Récupération erreurs (messages clairs + suggestion correction)
    10. Aide + documentation (tooltips contextuels, lien doc)

65. **Don Norman patterns** :
    - **Visibilité** : feedback immédiat sur toute action (toast notification).
    - **Affordances** : boutons ressemblent à des boutons, liens à des liens.
    - **Signifiers** : icônes claires (pas cryptiques).
    - **Mappings naturels** : sliders gauche-droite, toggles évidents.
    - **Constraints** : impossible de créer campagne incohérente (validation Zod runtime).
    - **Feedback** : succès / erreur évident, latence acceptable (<200ms perçu instant).

66. **One-click actions / presets** :
    - Existe-t-il des **campaign templates presets** réutilisables (e.g. « Campagne PME audits standard 100/jour ») ? Si oui, 1 click crée campagne pré-remplie.
    - Existe-t-il des **bulk operations** (lancer 5 campagnes similaires variantes verticales en 1 batch) ?
    - Existe-t-il un **mode « expert » keyboard shortcuts** ?

67. **Empty states & onboarding** :
    - Premier login admin → vide-vide ou tour guidé (Will skip si Will, important si futur user) ?
    - Liste vide (« aucune campagne ») → CTA clair « Créer ma première campagne ».

68. **Erreur states & resilience UX** :
    - Si Claude API down → l'admin reste utilisable (campagnes en lecture seule + warning bannière jaune) ?
    - Si campagne stuck → action « Force unstuck » accessible 1 click avec confirmation ?

69. **Mobile UX** : si Will doit checker prod en déplacement, mobile dashboard fonctionne ?

70. **Time to first value (TTFV)** : un nouvel admin user combien de temps avant qu'il publie son premier article via campagne ? Cible <15 min onboarding complet.

#### Pour mesure objective UX

71. **Test Will réel** : Will lance lui-même 1 campagne fictive depuis admin sandbox, chronométré, count clicks → métrique baseline UX.
72. **5-second test** : screenshot dashboard root → Will couvre 5 sec, debrief « qu'as-tu compris ? ». Si confusion → simplification P0.
73. **System Usability Scale (SUS)** : questionnaire 10 questions Will → score /100 → cible ≥80 (excellent).

**Scoring /45** (révisé répartition pour intégrer UX) :
- Pages existantes (inventaire) `/4`
- KPIs dashboards core + funnels + heatmaps `/6`
- **GSC API + Bing WMT ingestion + crawl errors** `/5`
- **Refresh strategy + drip publishing + anti-burst** `/5`
- **Anomaly detection + cohort + topic gap + heatmap géo + forecasting** `/6`
- **Performance leaderboard + Reporting hebdo email** `/3`
- **Indexation timeline + position tracking + CTR anomaly** `/3`
- **UX simplicité (user journeys ≤N clicks + Hick + Fitts + Nielsen + Don Norman)** `/8`
- **One-click actions / presets / bulk ops** `/3`
- Empty states + erreur states + mobile UX + TTFV `/1`
- Test Will réel SUS `/1`

**Délégations** :
- → P5 : wireframes 8 pages admin perfection + GSC ingestion + drip scheduler + approval workflow + anomaly engine + heatmap géo + reporting hebdo cron + performance leaderboard

---

### A13 — Campagnes multi-parallèles

**Mission** : Auditer si le système supporte plusieurs campagnes en parallèle (vision Will critique).

**Périmètre** :
- Model `Campaign` Prisma (si existe)
- Service `campaign-orchestrator.ts`
- Workers BullMQ namespacing
- Quotas global Claude API

**Questions à investiguer (≥15)** :
1. Model `Campaign` existe ? Si NON → P0 critique (Will l'a explicité).
2. Si existe : champs (id, name, vertical, status, dailyTarget, totalTarget, dates, mix, audience, costCap, ...) ?
3. Workers : 1 worker partagé OU 1 par campagne (namespace `gen:<campaignId>`) ?
4. Si partagé : comment 2 campagnes coexistent sans race ?
5. Quotas Claude API : cost cap global ? Per-campaign ?
6. RPM throttling Claude : géré comment ? Lib `bottleneck` ?
7. Locks keywords : si campagne A pick keyword X, campagne B le voit pas ?
8. Priorité campagnes : round-robin ? Weighted ?
9. Pause / resume campagne : action UI ? Effet sur jobs en queue ?
10. Clone campagne : possible ?
11. Status : draft / running / paused / completed / archived ?
12. Tracking par campagne : nb generated / published / refused / cost ?
13. Estimation time-to-complete : si dailyTarget=100 et totalTarget=3000 → 30 jours, calcul affiché ?
14. Si 3 campagnes parallèles, throughput total = somme ou throttled ?
15. Workers concurrency tuning : configurable par campagne ?
16. Failure isolation : si campagne A crash, B continue ?
17. Tests Vitest sur multi-campagne ?
18. Sample : créer 2 campagnes test, vérifier coexistence.
19. Backpressure global : si queue >1000 → comportement ?
20. Cron auto-launch campagnes selon scheduler ?

**Scoring /62.5** :
- Model Campaign existe `/15`
- Workers namespacing `/15`
- Quotas + locks `/15`
- Pause/resume/clone UX `/10`
- Failure isolation `/7.5`

**Délégations** :
- → P2 : architecture multi-campagnes complète

---

### A14 — Prompts : architecture, count, caching, output parsing

**Mission** : Auditer le système de prompts LLM utilisés pour génération.

**Périmètre** :
- `src/server/content-gen/prompts/**`
- Service `prompt-builder.ts`
- Anthropic SDK invocations (`client.messages.create({ ... })`)

**Questions à investiguer (≥20)** :
1. Combien de prompts distincts utilisés actuellement ? Lister.
2. Stockage prompts : fichiers TS ? DB ? Env ? Si DB → admin UI pour éditer ?
3. Versioning prompts : git tracked ?
4. Format prompts : raw string concaténation ? XML tags ? Template engine ?
5. Si XML tags : `<role>`, `<context>`, `<task>`, `<output_format>`, `<examples>` ?
6. Chain-of-thought : `<thinking>` activé sur Claude 4.7 extended thinking ?
7. Output JSON strict : `response_format: {type: "json_schema"}` ? Zod validation runtime ?
8. Prompt caching : `cache_control: {type: "ephemeral"}` sur system + KB + partials ?
9. Cache hit rate logs ?
10. Cost / article observé : input tokens + output tokens + cached × prix Claude ?
11. Modèle utilisé : Opus 4.7 / Sonnet 4.6 / Haiku 4.5 par étape ?
12. Few-shot examples : présents dans prompts ?
13. Negative examples : présents ?
14. Partials modulaires : `_vertical-{vertical}`, `_audience-{aud}`, `_content-type-{type}`, `_city-{slug}` ?
15. Streaming activé sur génération corps (UX admin live preview) ?
16. Batch API Anthropic utilisé pour bulk gen (50% prix réduit) ?
17. Files API : KB volumineuse uploadée comme files ?
18. Citations Anthropic feature : utilisée pour traçabilité sources ?
19. Tool use / function calling : utilisé (e.g. pour validation JSON output) ?
20. Failure handling : si Claude returns invalid JSON, retry ? Comment ?
21. Rate limit handling : si 429 → exponential backoff ?
22. Prompt injection protection : sanitize keywords from DB avant insert dans prompt ?

**Scoring /62.5** :
- Architecture modulaire `/15`
- XML tags + best practices 2026 `/12.5`
- Prompt caching activé `/15`
- Output JSON Zod validated `/10`
- Cost tracking par article `/10`

**Délégations** :
- → P2 : refactor prompt architecture 6 noyau + partials

---

### A15 — Publish, sitemap, IndexNow, GSC submit

**Mission** : Auditer le workflow publication → sitemap regen → IndexNow ping → GSC submit.

**Périmètre** :
- Service `publish.ts`, `sitemap-generator.ts`
- Route handlers sitemap (`/sitemap.xml`, `/sitemap-*.xml`)
- IndexNow integration
- GSC API client (si existe)

**Questions à investiguer (≥15)** :
1. Action `publish` : déclenchée comment (admin click ? cron auto ?) ?
2. Sitemap regen : à chaque publish ? Cron daily ? Cron hourly ?
3. Sub-sitemaps : combien et lesquels ? Articles, guides, glossaire, presse, villes, services, T1/T2/T3/T4 ?
4. Sitemap-index.xml : présent ? Lien vers tous sub-sitemaps ?
5. Sitemap-images.xml : généré conforme Google spec 1.1 ?
6. Sitemap-news.xml : pour articles presse ?
7. IndexNow : configuré ? Key file `/<KEY>.txt` présent racine ?
8. IndexNow endpoint : api.indexnow.org ? Bing direct ? Yandex direct ? Multi-ping ?
9. IndexNow rotation key : INDEXNOW_KEY rotation strategy ?
10. GSC submit : API utilisée ? Service account JSON ? Domain property verified ?
11. Bing WMT submit : API utilisée ? Webmaster Tools verified ?
12. Yandex WMT : configuré ? Skippable si FR-only mais nice-to-have.
13. ISR Next.js revalidate : déclenché after publish ? Via `revalidatePath()` ?
14. CDN cache purge (Cloudflare) : déclenché ?
15. Latence publish → indexation Google : mesurée ?
16. Crawl errors GSC : ingérés en admin ?
17. Sitemap priority + changefreq : utilisés ? (Note : Google n'utilise plus priority depuis 2017 mais lastmod oui).
18. Robots.txt : autorise Googlebot, Bingbot, ClaudeBot, GPTBot, PerplexityBot, OAI-SearchBot, CCBot ?
19. CF Managed Content : selon mémoire `axionia_content_gen_city_domination_2026-05-18`, ClaudeBot/GPTBot étaient bloqués CF Managed Content → fixé ?
20. llms.txt / ai.txt : présents racine ?

**Scoring /62.5** :
- Sitemap multi-tier complet `/15`
- IndexNow multi-ping `/12.5`
- GSC + Bing WMT submit auto `/12.5`
- ISR + CF purge `/10`
- Robots.txt + llms.txt + ai.txt `/12.5`

**Délégations** :
- → P3 : stratégie sitemap + crawl budget
- → P5 : monitoring indexation

---

### A16 — Auto-review LLM-as-judge + boucle improve

**Mission** : Auditer s'il existe un reviewer LLM avec scoring multi-dim + boucle improve avant publish.

**Périmètre** :
- Service `reviewer.ts`, `quality-check.ts`, `auto-improve.ts`
- Workflow `generated → reviewed → (improved | published | rejected)`

**Questions à investiguer (≥15)** :
1. Existe-t-il un reviewer LLM actif ? Si NON → P0 (Will l'a explicité).
2. Si oui : quel modèle (Sonnet 4.6 recommandé) ?
3. Output reviewer : JSON multi-dim ou note unique ?
4. Dimensions scorées : factual_accuracy / depth / originality / readability / seo_completeness / value_to_reader / tone_axionia_alignment ?
5. Seuils : publish ≥8.5 ? improve 7-8.5 ? reject <7 ?
6. Boucle improve : max iterations ? Si 2 itérations max et toujours <8.5 → reject ?
7. Cost cap improve : per article ? Per campaign ?
8. Quelle proportion des articles passent direct (sans improve) ?
9. Quelle proportion sont reject + manuel review ?
10. Reviewer prompt : XML tagged + chain-of-thought + JSON output ?
11. Bias reviewer : si reviewer modèle est même que generator, risque de validation trop laxiste ? Recommander reviewer ≠ generator model.
12. Heuristiques mesurables en complément : Flesch FR, mots min, internal link count, JSON-LD valid ? Si NON → P1.
13. Quotes 3 reviews récentes : qualité subjective des feedbacks reviewer.
14. Re-review : si admin force re-review après edit manuel → flow OK ?
15. Reviewer learning : feedback Will (« cet article aurait dû être rejected ») améliore les prompts ?
16. A/B test reviewer prompts : multi-variants ?
17. Cost reviewer : per article observé ?
18. Latence p50 reviewer ?
19. Failure handling reviewer down → publish quand même ou hold ?
20. Reviewer comments visibles admin pour debug ?

#### Approfondissement « Multi-LLM consensus + A/B testing + Active learning » (sous-section critique)

21. **Multi-LLM consensus reviewer** : reviewer = consensus 2-3 modèles (Sonnet + Opus + GPT-4o si dispo) ? Vote majoritaire ou score moyenné ? Si NON → P1 (boost qualité ~30%).
22. **Reviewer ≠ Generator obligatoire** : si générateur = Sonnet, reviewer = Opus (modèle plus puissant pour catch erreurs) ? Coût ~+50% mais qualité ↑↑.
23. **A/B testing 2 versions générées** : pour articles haut enjeu (piliers + verticales prioritaires), générer 2 variantes (température 0.7 + 1.0), faire reviewer choisir la meilleure ? Cost ×2 mais Best-of-N statistically supérieur.
24. **Best-of-N strategy** : variante avancée — générer N=3-5 versions, scoring chaque, garder top-1. Activable per-type contenu.
25. **Active learning Will feedback** : table `WillReview` (articleId, willScore, willComments, timestamp). Quand Will note un article publié <8/10 → feedback injecté dans prompts futurs (« évite ce pattern »). Si NON → P1.
26. **Reviewer prompts versioning** : table `ReviewerPromptVersion` avec champ `appliedFrom: DateTime`. Permet A/B test prompts reviewer entre versions.
27. **Adversarial review** : reviewer dédié « avocat du diable » qui cherche **uniquement** les faiblesses (anti-bullshit, claims faibles, transitions abruptes). Score `weakness_count`.
28. **Sanity-check rule-based** : avant LLM-review, helpers déterministes (mots min, h2 count, FAQ count, images, internal links, JSON-LD valid) → si fail ≥2 → rejet auto sans appeler LLM (économie cost).
29. **Improve iteration intelligence** : si itération 1 améliore mais reste <8.5, et itération 2 ne progresse pas → halt prématuré + escalate humain (anti-stagnation).
30. **Multi-axis improvement targeting** : si reviewer flag « depth insuffisant », l'improve prompt cible spécifiquement la section faible (pas full rewrite).
31. **Improve cost cap par article** : `max_improve_cost = $0.10/article` ? Au-delà → escalate humain.
32. **Calibration reviewer** : périodiquement, Will note manuellement 10 articles publiés → mesurer drift reviewer LLM vs ground truth Will. Si drift >0.5pt → re-tune prompt reviewer.
33. **Review explainability** : reviewer fournit `reasons[]` pour son score (pas juste 8.2) → admin peut comprendre + apprendre.
34. **Failure mode** : si reviewer LLM down (Anthropic 429 ou error) → fallback rule-based + hold publication + alerte ?
35. **Cost reviewer per 100 articles** : observed + projection scénarios A/B/C.

**Scoring /50** :
- Reviewer existe + multi-dim scoring `/10`
- **Multi-LLM consensus (Reviewer ≠ Generator)** `/8`
- **A/B testing / Best-of-N** `/6`
- **Active learning Will feedback loop** `/6`
- Boucle improve max iter + multi-axis targeting `/6`
- Heuristiques rule-based pré-LLM (économie cost) `/4`
- Calibration reviewer + explainability `/5`
- Failure mode + cost cap par article `/3`
- Admin UX reviews visibles `/2`

**Délégations** :
- → P4 : design auto-review framework complet + Multi-LLM consensus + A/B testing + active learning

---

### A17 — Conformité AI Act art. 50 + RGPD + DPA providers (FORENSIQUE)

**Mission** : Auditer la conformité du système content-gen aux obligations légales **deadline août 2026** AI Act art. 50, RGPD art. 17 droit à l'oubli, DPA signés avec providers IA, audit logs immuables.

**Périmètre** :
- JSON-LD émis (search `aiGenerated`, `additionalType`)
- Mention humaine bas d'article (search dans templates)
- Table `GenerationProvenance` (si existe)
- Endpoints `/api/admin/forget/*` ou équivalent
- Documents `_AUDIT/DPA-*` ou contrats Anthropic / OpenAI / Voyage AI
- Cookie banner + politique vie privée page `/mentions-legales` ou `/politique-confidentialite`
- Logs Pino/Winston avec PII risk

**Questions à investiguer (≥18)** :
1. **JSON-LD `aiGenerated: true`** : présent sur articles générés ? Si NON → **P0 critique**, deadline 2026-08-02 (AI Act art. 50).
2. **Format AI Act** : utilisation `additionalType: "https://schema.org/AIGeneratedContent"` ou champ Schema.org étendu ? Vérifier conformité texte officiel (Regulation EU 2024/1689 art. 50.2).
3. **Mention humaine** : phrase obligatoire bas d'article (« Contenu rédigé avec l'assistance de Claude (Anthropic). Édité et validé par l'équipe AxionIA. ») présente ?
4. **Wording exact** : recommandé par l'AI Act = mention claire et lisible. Audit wording actuel.
5. **Visibilité** : la mention humaine est-elle visible sans scroll (above the fold) ou seulement footer caché ?
6. **Watermarking** : Anthropic Claude n'expose pas encore d'API watermark, mais Will doit s'engager à le faire dès que disponible. Documenter ?
7. **GenerationProvenance table** : existe ? Champs (articleId, provider, model, modelVersion, promptHash, inputTokens, outputTokens, cost, timestamp, regulationVersion) ?
8. **Retention** : Provenance gardé combien de temps ? AI Act recommande 6 ans minimum.
9. **Immutabilité audit logs** : table append-only ? Hash chaîné (`previousHash`) ?
10. **Export audit** : Will peut-il exporter à la demande (régulateur, audit externe) la trace complète de génération d'un article donné ?
11. **DPA Anthropic** : signé par Will ? Référence document ?
12. **DPA OpenAI** (si embeddings) : signé ?
13. **DPA Voyage AI** (si embeddings) : signé ?
14. **DPA Copyscape ou plagiarism provider** : si applicable.
15. **RGPD art. 17 droit à l'oubli** : endpoint `DELETE /api/admin/content-gen/articles/<id>/forget` ? Effet : purge contenu + provenance + embeddings + sitemap removal + IndexNow remove.
16. **RGPD données client** : si articles citent cas clients anonymisés, vérifier `[Nom anonymisé]`, pas de fuite PII.
17. **RGPD données auteur** : Person JSON-LD avec email ? **PROBLÈME** — ne pas exposer email en JSON-LD public.
18. **CNIL declaration** : si AxionIA traite de la donnée de prospects FR via content-gen, déclaration ?
19. **Cookie banner** : compatible TCF v2.2 ? Plausible Analytics est cookie-less mais vérifier.
20. **Page mentions légales** : à jour ? Mention « IA générative utilisée pour contenus marketing » ?

**Scoring /45** :
- JSON-LD `aiGenerated:true` partout `/10`
- Mention humaine wording + visibilité `/8`
- GenerationProvenance table + immutabilité `/8`
- DPA providers signés (Anthropic + OpenAI/Voyage) `/8`
- RGPD art. 17 droit à l'oubli endpoint `/6`
- Page mentions légales + CNIL `/5`

**Délégations** :
- → P2 : schema GenerationProvenance + endpoints forget
- → P3 : JSON-LD aiGenerated normalization
- → P5 : audit logs view admin

**⚠️ Criticité absolue** : si verdict A17 < 25/45, **NO-GO publication 200/jour ou plus** avant fix. Risque amende AI Act = jusqu'à 7,5M€ ou 1,5% CA mondial.

---

### A18 — Scaled Content Abuse Policy Google + Helpful Content Update

**Mission** : Auditer le risque penalty Google `scaled content abuse policy` (mars 2024) et alignement Helpful Content Update + Search Quality Rater Guidelines.

**Périmètre** :
- Volume publication actuel (mesurer rythme 30j)
- Variance qualité articles (distribution quality_score)
- Templates patterns (risque pattern detection)
- Configuration scheduler / drip publishing

**Questions à investiguer (≥15)** :
1. **Volume publication 30j** : combien d'articles publiés ? Quel rythme moyen jour ?
2. **Burst publication** : y a-t-il eu un jour où >50 articles publiés simultanément ? Risque flag Google.
3. **Helpful Content Update compliance** : test « primarily for users vs primarily for ranking » sur 5 articles sample. Article répondrait-il à une recherche utilisateur même si Google n'existait pas ?
4. **People-first content** : test « est-ce qu'un humain expert pourrait écrire cela ? » sur 3 articles sample.
5. **Pattern detection risk** : article template patterns trop similaires (mêmes h2, même intro structure) → SimHash sur outline détectable ?
6. **Author authority** : E-E-A-T documenté (Person JSON-LD knowsAbout, sameAs LinkedIn, jobTitle, alumniOf) ?
7. **First-hand experience signals** : articles citent expérience réelle (« lors de notre accompagnement de la PME X… ») ou seulement théorie ?
8. **Engagement signals** : Plausible events de dwell time, scroll depth, return visits trackés ?
9. **Thin content detection** : combien d'articles publiés <800 mots (seuil thin) ?
10. **Duplicate value content** : articles différents ciblant exactement la même intention sans valeur additionnelle ?
11. **Keyword stuffing risk** : densité keyword principale >3% body sur sample articles ?
12. **Hidden text / cloaking** : aucun élément `display:none` keyword-rich ? Vérifier CSS computed.
13. **Doorway pages risk** : pages ville quasi-identiques avec juste nom ville changé ?
14. **Auto-generated content disclosure** : conformément Google guidelines, les contenus auto-générés doivent ajouter de la valeur. Mécanisme valeur ajoutée documenté ?
15. **Search Quality Rater Guidelines (oct 2024)** : audit subjectif `Page Quality (PQ)` rating sur 5 articles : Lowest / Low / Medium / High / Highest ?
16. **Cap journalier hard configurable** : variable `MAX_PUBLISH_PER_DAY` ? Si non → P0.
17. **Drip schedule random window** : publish étalé 8h-22h CET pas concentré ?
18. **Weekend pause** : option pause publication weekend (signal humain) ?
19. **Sample comparaison concurrent** : axionai.fr / Datacampus → leur rythme publication mesurable ?
20. **Action plan post-penalty** : si Google penalty détectée (Google Search Console manual action), runbook ?

**Scoring /40** :
- Volume / rythme actuel mesuré `/6`
- Helpful Content Update compliance (5 articles tested) `/8`
- E-E-A-T author authority `/6`
- Engagement signals trackés `/4`
- Cap journalier + drip schedule `/8`
- Pattern detection risk (templates trop répétitifs) `/4`
- Action plan recovery `/4`

**Délégations** :
- → P4 : doctrine valeur lecteur anti-thin + Helpful Content Update compliance framework
- → P5 : drip publishing scheduler + cap journalier hard + weekend pause

---

### A19 — Analyse compétitive (benchmarks concurrents)

**Mission** : Auditer le positionnement AxionIA vs concurrents directs et indirects, identifier gaps et opportunités exploitables.

**Périmètre** :
- Recherche manuelle SERP FR pour top 20 keywords AxionIA
- Sites concurrents (audit léger structure, schema, volume, fréquence publication)

**Concurrents à benchmarker (≥10)** :

| Type | Concurrent | URL | Priorité |
|---|---|---|---|
| 🚨 Homonyme | axionai.fr | rank #1 brand actuellement | P0 critique |
| Formation IA généraliste | Datacampus | datacampus.fr | P0 |
| Formation IA généraliste | Le Wagon Bootcamp IA | lewagon.com/fr/data-science-bootcamp | P0 |
| Formation IA généraliste | OpenClassrooms IA | openclassrooms.com (path IA) | P0 |
| Formation IA généraliste | Simplon | simplon.co | P1 |
| Cabinet conseil IA | Capgemini Invent | capgemini.com/fr-fr/invent | P0 |
| Cabinet conseil IA | Octo Technology | octo.com | P1 |
| Cabinet conseil IA | Sia Partners | sia-partners.com | P1 |
| Blog référent | FrenchWeb (rubrique IA) | frenchweb.fr | P2 |
| Blog référent | Maddyness (IA) | maddyness.com | P2 |
| Influenceur LinkedIn FR | (à identifier top 5 « IA B2B FR » via Sales Navigator) | LinkedIn | P2 |

**Questions à investiguer par concurrent (≥10 par concurrent prio P0)** :

1. URL canonique + branding (couleurs, ton).
2. Structure site (combien de pages publiques estimées via `sitemap.xml`).
3. Verticales couvertes (formation, audit, conseil, etc.) vs nos 5 verticales.
4. Cibles déclarées (TPE / PME / ETI / particuliers).
5. Couverture villes (pages locales ?).
6. Stack technique observable (Wappalyzer : CMS, framework, analytics).
7. Top 10 keywords ranked (via Semrush ou Ahrefs si Will y a accès, sinon estimation manuelle).
8. DR / DA estimé (Moz si Will y a accès).
9. Backlinks profile estimé.
10. Schema.org markup utilisé (View source 3 pages, check JSON-LD).
11. Author E-E-A-T : pages auteurs présentes ? Bio + photo + LinkedIn ?
12. Mention humaine AI generation : présente ou non ?
13. Fréquence publication estimée (latest 5 articles dates).
14. Tone of voice : académique / commercial / journalistique / mixte ?
15. CTA stratégie : freemium / lead magnet / booking direct / pricing visible ?
16. Différenciateurs identifiables AxionIA vs concurrent.
17. **Position vs nos 20 keywords cibles** : pour chaque keyword `Formation IA PME`, `Audit IA TPE`, `Coaching IA dirigeant`, `Implémentation IA entreprise`, `Site web augmenté IA` (+ variantes), qui rank top 3 ?
18. **Gap exploitable** : quels sujets/keywords les concurrents NE couvrent PAS et qu'AxionIA peut dominer ?

**Cas particulier axionai.fr** :
- ⚠️ Concurrent homonyme — rank #1 actuellement sur brand « AxionIA ». Risque dilution brand search.
- Audit profond : leur stratégie content-gen ? Trafic estimé ? Auteur derrière ?
- Action recommandée : creuser bareland strategy (brand SEO domination → page « Différences AxionIA vs AxionAI » potentielle).

**Scoring /30** :
- Inventaire 10 concurrents + tableau structuré `/8`
- Position SERP sur 20 keywords cibles `/8`
- Analyse axionai.fr profonde (concurrent #1 brand) `/6`
- Gap exploitable identifié (top 10 opportunités) `/5`
- Différenciateurs AxionIA documentés `/3`

**Délégations** :
- → P3 : stratégie SEO brand domination (anti-axionai.fr)
- → P4 : doctrine différenciation éditoriale
- → P6 : roadmap top opportunités gap

---

### A20 — Observability + Cost Economics actuel

**Mission** : Auditer l'observabilité du système (Sentry, Grafana, Plausible) et mesurer les coûts content-gen actuels (Claude API + infra + tools).

**Périmètre** :
- Configuration Sentry (DSN, capture rates, integrations)
- Plausible Analytics events (custom events tracked)
- Workers BullMQ instrumentation
- Grafana / Coolify dashboards
- Anthropic Console (consumption logs)
- Hetzner CPX42 utilization (RAM, CPU, disk)

**Questions à investiguer (≥15)** :
1. **Sentry capture** : couverte sur tous workers content-gen ? Cf. [[axionia_sprint_s4_p1_livre_2026-05-18]] mentions sentry capture 4 workers — étendu à tous ?
2. **Sentry context** : chaque erreur incluse `{ campaignId, articleId, step, vertical, contentType }` ?
3. **Sentry PII sanitize** : helper `sanitize-job-data` PII appliqué ?
4. **Sentry alerts** : seuils définis (error rate >5% en 5 min → notify Slack) ?
5. **Plausible events** : événements custom trackés (`article_published`, `article_quality_score`, `claude_cost_alert`) ?
6. **Plausible dashboard sécurité** : credentials Will / accès Manon / etc. ?
7. **Workers observability** : logs structurés Pino ? Format JSON pour Loki/Loki ingestion ?
8. **Grafana dashboards** : existants ? Métriques content-gen (jobs/min, latency p50/p95/p99, error rate) ?
9. **Loki log aggregation** : configurée ?
10. **Coolify deploy logs** : visibles ? Coolify health checks content-gen workers ?
11. **Hetzner monitoring** : RAM/CPU/disk live ? Alertes seuils ?
12. **Anthropic Console** : Will a accès ? Spend daily / monthly visible ?
13. **Spend Claude 30j** : combien dépensé en API Anthropic ? Décomposition par modèle (Opus / Sonnet / Haiku) ?
14. **Spend OpenAI 30j** : (si embeddings) combien ?
15. **Cost per article observed** : moyenne dollars/article généré ? Variance ?
16. **Cost per step** : input tokens + output tokens × prix Claude par étape (outline/body/faq/review) ?
17. **Cache hit rate Anthropic** : visible Console ? % cache hits ?
18. **Projection scénarios A/B/C** : extrapolation cost à 50/200/500 articles/jour ?
19. **Infra cost mensuel** : Hetzner CPX42 = ~30€/mois ? Domain + CDN + DB backup ?
20. **Tools cost** : Ahrefs / Semrush / Copyscape souscriptions ?
21. **Total monthly run-rate** : addition complète mois M (Claude + infra + tools) ?
22. **ROI projection** : revenue généré par contenu (conversions track) ? CTR funnel article → service → contact → close ?

#### Approfondissement « Anomaly detection infra + Cohort métrique »

23. **Latency anomaly** : p95 latency par étape pipeline trackée 30j. Alert si p95 spike >2× moyenne mobile 7j.
24. **Throughput anomaly** : articles/heure tracking. Alert si throughput drops >40% sans cause connue (campagne pausée).
25. **Cost anomaly** : Anthropic spend daily tracked. Alert si daily spend >150% moving avg 7j (probable bug : retry infinity loop, cache miss, etc.).
26. **Error rate anomaly** : worker error rate (Sentry). Alert si >5% sur 1h window.
27. **DB query slow anomaly** : Postgres `pg_stat_statements` query >500ms → alert.
28. **Disk space anomaly** : Hetzner CPX42 disk usage >85% → alert (logs accumulation, DB growth).
29. **Cohort cost analysis** : cost par article par cohorte semaine → mesurer optimisation prompt caching, baisser cost/article au fil du temps.
30. **Cohort quality analysis** : quality_score moyen par cohorte semaine → mesurer impact des changements prompts/templates.
31. **Cohort indexation analysis** : taux d'indexation Google à J+30 par cohorte semaine → identifier semaines où Google penalty / quality update.

**Scoring /35** :
- Sentry coverage + context + alerts `/6`
- Plausible events custom `/3`
- Workers logs structurés + Loki/Grafana `/5`
- Anthropic Console + spend mesuré 30j `/5`
- Cost per article + per step observé `/4`
- **Anomaly detection (latency + throughput + cost + error rate + DB + disk)** `/6`
- **Cohort analysis (cost + quality + indexation)** `/3`
- Projections scénarios A/B/C `/2`
- ROI funnel mesuré `/1`

**Délégations** :
- → P2 : architecture observability complète
- → P5 : dashboards admin cost + perf
- → P6 : budget total annuel chiffré

---

### A21 — i18n FR/EN bilingue (hreflang + miroir + canonical)

**Mission** : Auditer le support bilingue FR canonique / EN miroir, hreflang, canonical cross-locale, sitemaps par locale.

**Périmètre** :
- Routes Next.js `[locale]` (FR + EN)
- Middleware locale detection
- Hreflang generation
- Sitemap multi-locale
- KB villes EN traduite

**Questions à investiguer (≥12)** :
1. **Locale routing** : `/fr/...` + `/en/...` ou root `/` = FR + `/en/...` ?
2. **Default locale** : `fr` ? Détection automatique via Accept-Language ?
3. **Hreflang complet** : balises `<link rel="alternate" hreflang="fr|en|x-default">` présentes sur toutes pages ?
4. **Hreflang réciproques** : si page FR pointe vers EN, page EN pointe vers FR (test reciprocity) ?
5. **Canonical cross-locale** : page EN miroir pointe canonical vers self ou vers FR ?
6. **Sitemap multi-locale** : sub-sitemaps FR + EN distincts ? Hreflang dans sitemap (Google supporte `<xhtml:link>`) ?
7. **Articles EN traduits** : combien d'articles ont une version EN ? % du corpus ?
8. **Traduction automatique** : Claude vision/translate déjà utilisé ou attente Phase 2 ?
9. **Quality EN** : test 3 articles EN sample. Qualité native ou « franglais » détectable ?
10. **EN KB** : KB villes traduites EN ? KB sectorielle ?
11. **EN admin UI** : peut switcher en EN ?
12. **EN keywords** : DB Keyword avec colonne `locale` ? Distribution FR/EN ?
13. **EN dedup** : SimHash + embeddings cross-language gérés ?
14. **EN sitemap submission** : GSC EN property verified ?
15. **EN robots.txt** : autorise crawlers IA même politique que FR ?

**Scoring /25** :
- Locale routing + middleware `/4`
- Hreflang complet + réciproques `/5`
- Sitemap multi-locale `/4`
- Couverture EN articles `/4`
- Quality EN (3 articles testés) `/4`
- KB EN + admin EN `/4`

**Délégations** :
- → P3 : stratégie hreflang + canonical 2026
- → P2 : architecture i18n cross-language dedup

---

### A22 — Tests Coverage (Vitest + Playwright)

**Mission** : Auditer la couverture de tests automatisés sur le système content-gen.

**Périmètre** :
- `src/server/content-gen/**/__tests__/**`
- `e2e/**` ou `playwright/**`
- `vitest.config.ts` coverage thresholds
- CI workflows

**Questions à investiguer (≥10)** :
1. **Tests Vitest content-gen** : combien de fichiers `*.test.ts` dans `src/server/content-gen/` ?
2. **Coverage actuel** : `pnpm test --coverage` sur le module content-gen → quel % ?
3. **Coverage thresholds CI** : `vitest.config.ts` impose un floor ? Si oui combien ?
4. **Tests unitaires keywords selector** : tests existent ?
5. **Tests unitaires dedup (SimHash / embeddings)** : tests existent ?
6. **Tests unitaires quality gate (LLM-as-judge mocked)** : tests existent ?
7. **Tests unitaires prompt builder (XML construction, partials)** : tests existent ?
8. **Tests snapshot par template (7 types)** : tests existent ?
9. **Tests E2E Playwright pipeline complet** : `admin click generate → article published → sitemap updated` ?
10. **Tests régression visuelle Percy/Chromatic ou snapshot Playwright** : composants article ?
11. **Tests performance lighthouse** : LHCI CI sur pages générées ?
12. **Tests Web Vitals** : LCP <1800ms, INP <80ms, CLS <0.05 testés ?
13. **CI workflows** : `.github/workflows/test.yml` lance tous tests sur PR ?
14. **CI deploy workflows** : tests bloquent merge si fail ?
15. **Test data fixtures** : faker/factory + seed cohérent ?

**Scoring /30** :
- Vitest count + coverage actuel mesuré `/8`
- Coverage thresholds CI configurés `/5`
- Tests unités critiques (keywords, dedup, quality, prompts, templates) `/8`
- Tests E2E Playwright pipeline `/5`
- LHCI + Web Vitals tests `/2`
- CI workflows blocking PR `/2`

**Délégations** :
- → P2 : plan tests architecturaux
- → P6 : roadmap tests complète (P0/P1) + DoD

---

## 7. CROSS-CUTTING ANALYSES (post-spawn agents)

Après que les 16 agents aient livré leurs rapports, l'agent maître P1 produit `CROSS-CUTTING.md` analysant **les patterns transverses** :

### 7.1 — CC1 : Convergence Manon impact

État du repo, branches actives Manon, fichiers WIP non poussés impactant content-gen.

### 7.2 — CC2 : Conformité légale (AI Act art. 50 + RGPD + scaled content)

Audit transverse de la conformité légale. **CRITIQUE deadline août 2026 AI Act**.

### 7.3 — CC3 : Cost current run-rate + projections

Sur base des 30 derniers jours :
- Articles générés
- Cost Claude observé
- Cost embeddings si applicable
- Projection scénarios A/B/C (50/200/500 articles/jour)

### 7.4 — CC4 : Test coverage

- Vitest coverage `src/server/content-gen/**` actuel
- E2E Playwright sur pipeline ? Si NON → P1.

### 7.5 — CC5 : Failure modes & resilience

Synthèse cross-agents des failure modes audités : Claude API down, image-bank vide, worker crash mid-article, DB lock contention, queue stuck, embedding provider down.

### 7.6 — CC6 : Contradiction findings

Si A03 dit X et A11 dit Y contradictoire → flag arbitrage.

### 7.7 — CC7 : Gaps majeurs (Top 10 P0)

Synthèse top 10 P0 tous agents confondus, classés par impact.

### 7.8 — CC8 : Quick wins (Top 10 P1 avec effort <4h)

Pour input P6 roadmap.

---

## 8. VERDICT PHASE 1 — `PHASE-1-VERDICT.md`

### Structure obligatoire

```markdown
# VERDICT PHASE 1 — AUDIT FORENSIQUE EXISTANT

## Date : 2026-05-XX
## Commit HEAD audité : <sha>
## Durée audit : <h>

## Score D-Etat /1000 (pondéré par criticité business)

| Agent | Score /poids | Poids | Catégorie sous-jacente | Statut |
|---|---|---|---|---|
| A01 Inventory | XX/40 | 40 | C1 Pipeline | 🟢/🟡/🟠/🔴 |
| A02 Pipeline E2E | XX/45 | 45 | C1 Pipeline | ... |
| A03 Quality (enrichi valeur lecteur) | XX/65 | 65 | C2 Qualité | ... |
| A04 Keywords-intent | XX/50 | 50 | C3 SEO | ... |
| A05 Templates 7 types | XX/45 | 45 | C11 Templates | ... |
| A06 SEO/AEO/GEO (enrichi Featured + KG + Wikidata) | **XX/75** | **75** ⭐ | C3-C7 | ... |
| A07 Images | XX/40 | 40 | C8 Images | ... |
| A08 Liens internes/externes/suggested | XX/40 | 40 | C9 Maillage | ... |
| A09 Dedup anti-thin | XX/50 | 50 | C10 Anti-doublons | ... |
| A10 Géo villes coverage | XX/55 | 55 | C2+C3 | ... |
| A11 KB zero invention | XX/60 | 60 | C2 Qualité | ... |
| A12 Admin console (enrichi GSC+Bing+refresh+drip) | XX/45 | 45 | C13 Console | ... |
| A13 Campagnes multi-parallèles | XX/45 | 45 | C1+C15 | ... |
| A14 Prompts architecture | XX/45 | 45 | C12 Prompts | ... |
| A15 Publish/Sitemap/IndexNow | XX/45 | 45 | C1+C15 | ... |
| A16 Auto-review LLM-as-judge | XX/50 | 50 | C2+C15 | ... |
| **A17 AI Act + RGPD forensique** | XX/45 | 45 🚨 | C14 Compliance | ... |
| **A18 Scaled Content Abuse Policy Google** | XX/40 | 40 🚨 | C14 Compliance | ... |
| **A19 Analyse compétitive** | XX/30 | 30 | Strategy | ... |
| **A20 Observability + Cost economics** | XX/35 | 35 | C15 Ops | ... |
| **A21 i18n FR/EN bilingue** | XX/25 | 25 | C3 SEO | ... |
| **A22 Tests Coverage** | XX/30 | 30 | C15 Ops | ... |
| **TOTAL D-Etat** | **XXX/1000** | — | — | **🟢/🟡/🟠/🔴** |

### Seuils verdict D-Etat /1000

- 🟢 **GO Phase 2** : ≥ 800/1000 (système solide, optimisations marginales)
- 🟡 **GO conditionnel** : 600-799 (sprint correctif P0 avant scale)
- 🟠 **REFONTE PARTIELLE** : 400-599 (P2 doit redessiner les modules <50% scoring)
- 🔴 **REFONTE TOTALE / PLAN B** : < 400 (cf. Master §4ter Plan B)

### Cas critique compliance

⚠️ Si A17 (AI Act) < 25/45 OU A18 (Google policy) < 22/40 → **HOLD publication 200+/jour** quelle que soit la note globale. Risque amende AI Act 7,5M€ + penalty Google = bloquant business.

## Top 10 P0 (bloquants)

1. ...
2. ...

## Top 20 P1 (optimisations critiques)

1. ...

## Quick wins (effort <4h, impact ≥P1)

1. ...

## UNKNOWNs (à confirmer Will)

1. ...

## Inputs pour phases suivantes

### → P2 (Architecture Data Pipeline)
- ...

### → P3 (SEO/AEO/GEO/AI Overviews)
- ...

### → P4 (Editorial Quality Templates)
- ...

### → P5 (Console Admin Ops)
- ...

### → P6 (Roadmap Execution)
- ...

## Verdict synthétique 1 paragraphe

[Bla bla constat 1 paragraphe pour Will : système 62% mature, 10 P0 à fixer, cost actuel X€/mois, throughput Y/jour, recommandation Phase 2 démarrage immédiat.]
```

---

## 9. STOP & ASK Will — Phase 1 (12 axes d'amélioration)

À la fin de Phase 1, Master demande à Will validation sur **12 axes prioritaires** sortis de l'audit (à raffiner selon findings réels, exemples typiques) :

1. **Verticale `sites_web_augmentes`** : ajouter migration Prisma maintenant ou attendre ?
2. **Cap journalier sécurité** : capper la génération à X articles/jour hard, anti-burst Google scaled content abuse ?
3. **Embedding provider** : OpenAI text-embedding-3-large (~$0.13/M) / Voyage AI / autre ?
4. **KB sectorielle** : prioriser création kb/verticals/*.ts en P0 ou P1 ?
5. **Wikidata Q-ID AxionIA** : créer maintenant (1-2h Will) pour ancrer KG entity ?
6. **Auteur E-E-A-T** : Will alone (Person Will Jullin) ou personae fictifs AxionIA ?
7. **Adresse FR Local SEO** : WeWork Paris ~300€/mo (cf. city domination audit) ou alternative ?
8. **Cost cap mensuel** : 500€ / 1000€ / 1500€ / 3000€ pour Claude API total ?
9. **Plagiarism check externe** : Copyscape (~$0.05/scan = $1500/30K articles) — OK budget ?
10. **GSC API service account** : activé ou Will préfère manuel ?
11. **Robots.txt CF Managed Content** : autoriser ClaudeBot/GPTBot/PerplexityBot/OAI-SearchBot/CCBot tous ?
12. **Sandbox preview mode** : obligatoire pré-publish ou skippable si quality_score ≥9.0 ?

---

## 10. LIVRABLES — Structure finale `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/`

```
_AUDIT/CONTENT-GEN-PERFECTION-2026/
├── phase-1/
│   ├── README.md                    # Index Phase 1 + lien vers verdict
│   ├── PHASE-1-VERDICT.md           # Score D-Etat /1000 + top P0/P1 + STOP & ASK
│   ├── CROSS-CUTTING.md             # CC1-CC8 analyses transverses
│   ├── agents/
│   │   ├── A01-inventory-cartographie.md
│   │   ├── A02-pipeline-end-to-end.md
│   │   ├── A03-quality-criteria.md
│   │   ├── A04-keywords-intent.md
│   │   ├── A05-templates-7-types.md
│   │   ├── A06-seo-aeo-geo-speakable.md
│   │   ├── A07-images-assignment.md
│   │   ├── A08-internal-external-suggested.md
│   │   ├── A09-dedup-anti-thin.md
│   │   ├── A10-geo-coverage-villes.md
│   │   ├── A11-kb-zero-invention.md
│   │   ├── A12-admin-console-suivi.md
│   │   ├── A13-campaigns-multi-parallel.md
│   │   ├── A14-prompts-architecture.md
│   │   ├── A15-publish-sitemap-indexnow.md
│   │   ├── A16-auto-review-improve.md
│   │   ├── A17-ai-act-rgpd-forensique.md
│   │   ├── A18-scaled-content-abuse-policy-google.md
│   │   ├── A19-analyse-competitive.md
│   │   ├── A20-observability-cost-economics.md
│   │   ├── A21-i18n-fr-en-bilingue.md
│   │   └── A22-tests-coverage.md
│   ├── data/
│   │   ├── article-sample-10-published.json    # Snapshot 10 articles publiés récents
│   │   ├── keyword-distribution.csv             # Distribution 747 seeds
│   │   ├── city-coverage-matrix.csv             # Matrice ville × verticale × type
│   │   ├── cost-runrate-30d.json                # Coût Claude observé 30j
│   │   └── failure-modes-inventory.md           # Failure modes catalogués
│   └── snapshots/
│       ├── article-paris-formation-2026-05-15.html   # Snapshot HTML rendu (DevTools)
│       └── article-lyon-audit-2026-05-12.html
```

---

## 11. DÉCLENCHEMENT — Comment lancer P1

### Étape 1 — Vérifications préalables

```bash
# Convergence Manon
git log --all --oneline -30
git branch --all | grep -iE "feat/(content-gen|villes|image-bank|keywords)"

# Branche actuelle
git status

# Commit HEAD à auditer
git rev-parse HEAD
```

### Étape 2 — Création dossier

```bash
mkdir -p _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents
mkdir -p _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/data
mkdir -p _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/snapshots
```

### Étape 3 — Spawn 16 sous-agents en parallèle

L'agent maître P1 envoie **1 seul message** avec **16 tool calls `Agent`** parallèles. Chaque appel reçoit :
- `description` : court (3-5 mots)
- `subagent_type` : `Explore` (lectures pures) OU `general-purpose` (analyses synthèse)
- `prompt` : briefing complet de l'agent (§6 ci-dessus), self-contained avec tout le contexte AxionIA condensé + template output

### Étape 4 — Agrégation findings

Quand les 16 agents ont rendu leurs rapports :
1. Lecture parallèle des 16 fichiers.
2. Production `CROSS-CUTTING.md` (CC1-CC8).
3. Production `PHASE-1-VERDICT.md`.
4. Score D-Etat `/1000` calculé.

### Étape 5 — Sauvegarde mémoire

Créer une mémoire `axionia_content_gen_phase1_audit_2026-MM-DD.md` avec :
- Score final
- Top 5 findings
- Top 5 actions Will
- Lien `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/PHASE-1-VERDICT.md`

### Étape 6 — STOP & ASK Will

Message final à Will : verdict 1 paragraphe + 12 questions D&D (cf. §9 ci-dessus).

**Aucun commit. Aucun push. Aucune modification prod.** Will valide → on lance P2/P3/P4 ensemble.

---

## 12. ANTI-PATTERNS — Erreurs à éviter pendant P1

1. ❌ **Spawn agents sans briefing complet** : chaque agent doit avoir contexte AxionIA + son §6 entier, sinon il fera du « best practices Wikipedia ».
2. ❌ **Lecture exhaustive de tout le repo** : reste sur le périmètre content-gen + adjacent. Ne pas auditer `src/components/marketing/` ou `src/lib/auth/`.
3. ❌ **Inventer des chiffres** : si latence non instrumentée, écris `[NON MESURÉ]`. Pas « ~200ms estimé ».
4. ❌ **Conclure sans citer** : tout finding cite fichier:lignes (ou commit hash).
5. ❌ **Suggestions architecturales** : P1 audite, P2 propose. Ne pas pré-écrire P2.
6. ❌ **Sur-scorer pour rassurer Will** : Will préfère un 600/1000 honnête à un 800/1000 complaisant.
7. ❌ **Sub-agent autonomie déviante** : si un agent dérive vers SEO 2026 (alors qu'il devrait juste constater), reset son périmètre.
8. ❌ **Boucler infiniment sur 1 agent** : si un agent prend >2h, force-completion avec ce qu'il a.
9. ❌ **Oublier les UNKNOWNs** : chaque agent doit lister ce qu'il n'a pas pu vérifier.
10. ❌ **Race condition sur fichiers Manon** : lecture seule sur villes/copy/<slug>.ts + image-bank/seed-images.ts, JAMAIS écriture.

---

## 13. FIN — Étape suivante

À la livraison de P1, l'agent maître renvoie à Will :

```
✅ Phase 1 AUDIT FORENSIQUE livrée — score D-Etat XX/1000.

📊 Top findings :
- P0 critiques : N
- P1 critiques : M
- Quick wins : K

📁 Livrables : _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/

⏸️  STOP & ASK Will — 12 décisions à trancher avant lancement P2/P3/P4 (cf. PHASE-1-VERDICT.md §STOP & ASK).

Une fois validé, j'enchaîne avec création P2 (Architecture) + P3 (SEO/AEO/GEO 2026) + P4 (Editorial Templates) en parallèle, intégrant les findings réels de P1.
```

---

*Fin du PROMPT 1. Will valide les 12 décisions → P2/P3/P4 créés ensuite, calibrés sur les findings réels.*
