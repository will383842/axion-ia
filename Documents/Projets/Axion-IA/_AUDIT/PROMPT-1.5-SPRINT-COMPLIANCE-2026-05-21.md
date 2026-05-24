# 🚨 PROMPT 1.5 — SPRINT COMPLIANCE + REFONTE P0 (Content-Gen AxionIA)

> **Fichier** : `_AUDIT/PROMPT-1.5-SPRINT-COMPLIANCE-2026-05-21.md`
> **Phase** : P1.5 sur 7 (pipeline content-gen perfection 2026 — activé Plan B « REFONTE PARTIELLE » suite à P1 score 531.5/1000 + double HOLD compliance)
> **Date création** : 2026-05-21
> **Durée estimée** : Phase A ≤4h + Phase B 24-32h = ~28-36h Claude autopilot
> **Mode** : `IMPLEMENTATION` (pas AUDIT) — code écrit, tests ajoutés, commits + push autorisés sous conditions
> **Self-contained** : ce fichier suffit (lecture PHASE-1-VERDICT.md recommandée pour contexte findings)

---

## 0. CONTEXTE — POURQUOI P1.5 EXISTE

L'audit P1 du 2026-05-21 a livré le verdict suivant (lecture obligatoire `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/PHASE-1-VERDICT.md`) :

- **Score D-État : 531.5/1000 — 🟠 REFONTE PARTIELLE** (Plan B activé selon Master §4ter)
- **DOUBLE HOLD COMPLIANCE** :
  - A17 AI Act : 22/45 < seuil 25 → HOLD publication 200+/jour, deadline **2026-08-02** (73 jours)
  - A18 Google Policy : 17/40 < seuil 22 → HOLD publication 200+/jour
- **Top 10 P0 identifiés** dont 5 quick wins compliance levant le double HOLD en ~3h

Le Master §4ter prescrit : *« Pause création P2-P6 standards → Création P1.5 prioritaire qui fixe les P0 absolus avant tout autre travail. »*

P1.5 est donc **PRIORITAIRE** sur P2/P3/P4/Addendum. Aucune de ces phases ne peut démarrer avant que P1.5 ait au minimum livré Phase A (lift HOLD).

---

## 1. DÉCISIONS WILL VALIDÉES (à respecter dans P1.5)

| # | Décision Will | Conséquence implémentation |
|---|---|---|
| D-W1 | **Cap journalier publication** = **30/jour initial** puis augmente progressivement jusqu'à 500/jour | `MAX_PUBLISH_PER_DAY=30` const + design une rampe progressive avec gates qualité |
| D-W2 | **DPA Anthropic + Perplexity** : aucun signé, Will signera « plus tard quand tout fonctionnera » | P1.5 documente le risque résiduel mais ne bloque pas l'implémentation. Recommandation forte Will : signer Anthropic DPA via [Anthropic Console Trust Center](https://console.anthropic.com) cette semaine (5 min gratuit) avant scale >30/jour |
| D-W3 | **`factoryAutoPublishAllBlogTypes`** : **garder activé pour l'instant — review plus tard** | ⚠️ **RISQUE RÉSIDUEL ASSUMÉ Will**. P1.5 NE désactive PAS ce flag. Conséquence : score A18 Google Policy restera sub-optimal post-P1.5 (~25-30/40 au lieu de 35+/40 visé). Quick Win QW-3 SKIPPED. Will assume risque AI Act art. 50 « supervision humaine » + HCU |

---

## 2. RÔLE & MISSION

<role>
Tu es **développeur senior content-gen + compliance officer AI Act** AxionIA OÜ. Tu implémentes les fixes P0 identifiés par l'audit P1, dans l'ordre prioritaire, en respectant strictement le périmètre + les gates qualité + les décisions Will.

Tu écris du code production-grade : typecheck strict, lint clean, tests Vitest associés, snapshot tests si UI, pre-commit hooks ×8 verts. Tu commits + push uniquement si tous gates verts.
</role>

<mission>
Livrer 2 phases séquentielles :

### Phase A — LIFT HOLD (≤4h Claude + 5 min Will)

Lever le double HOLD compliance via 4 quick wins (QW-3 désactivation flag SKIPPED selon D-W3) :
- QW-1 : Migrer `/blog/[slug]` → `buildBlogPostingJsonLd` avec `aiGenerated:true` (30 min)
- QW-2 : `MAX_PUBLISH_PER_DAY=30` const + check publish-worker + drip 8h-22h CET (2h)
- QW-6 : `AiContentDisclaimer` sur `/cas-concrets/[slug]` (30 min)
- QW-7 : Fix `isAiGenerated = !isLogo` bug seed-images.ts (1h)

**À l'issue Phase A** : score A17 monte à ~35/45 (HOLD AI Act levé) + A18 monte à ~22/40 (HOLD Google levé conditionnellement — résiduel risk factoryAutoPublish). Publication 30/jour techniquement débloquée.

### Phase B — REFONTE P0 (24-32h Claude autopilot)

Implémenter les 8 P0 restants pour passer le système de 531.5/1000 → ~750-800/1000 :
- P0-3 : LLM-as-judge complet (Claude Sonnet reviewer, multi-dim scoring) (8-12h)
- P0-4 : Image hero pipeline assignment depuis image-bank (4-6h)
- P0-5 : `internalLinkCount` passé aux 4 generators (1h)
- P0-6 : SimHash couches 3+4 réelles (4-8h)
- P0-7 : Connecter 747 keyword seeds au pipeline (4h)
- P0-9 : `GenerationProvenance` model + service complet (4h)
- P0-10 : `pauseCampaign()` purge BullMQ jobs (2h)
- Verticale `sites_web_augmentes` migration Prisma + enum (2h)

**À l'issue Phase B** : score cible 700-800/1000 (CONDITIONAL) → P2/P3/P4 + Addendum lançables sereinement.
</mission>

---

## 3. OPERATING MODE — Hard constraints

<operating-mode>

| Règle | Valeur |
|-------|--------|
| Mode | **IMPLEMENTATION** (code écrit) — pas AUDIT |
| Lecture/Écriture | `Read`, `Edit`, `Write`, `Glob`, `Grep`, `Bash` (typecheck, vitest, prisma migrate dev), `Agent` pour spawn sous-tâches |
| Commits | ✅ **Autorisés** sur main (cf. mémoire [[feedback_commit_no_push]] 2026-05-14 lever interdiction). Conventional Commits format. Co-Authored-By Claude. **JAMAIS `--no-verify`**. |
| Push | ✅ Autorisé sur `origin/main` UNIQUEMENT si : (a) tous gates verts (typecheck + lint + vitest + pre-commit ×8) ET (b) convergence Manon vérifiée (cf. §4) |
| Convergence Manon | Avant CHAQUE commit : `git log --all --oneline -10` + `git branch -r` → vérifier qu'aucune branche `feat/villes-*` ou `feat/image-bank-*` active. Si oui → flag dans commit message « parallel-session-coexistence-noted » |
| DPA risk note | Au début de Phase A, ajouter dans logs commit Phase A : « ⚠️ DPA Anthropic non signé — risque résiduel assumé Will jusqu'à signature future » |
| factoryAutoPublishAllBlogTypes | **NE PAS désactiver** (décision D-W3 Will). Documenter dans commit Phase B note « factoryAutoPublishAllBlogTypes reste activé — décision Will reportée » |
| STOP & ASK | Obligatoire entre Phase A et Phase B (Will valide HOLD levé + autorise Phase B) |
| Anti-régression | Chaque fix doit avoir ≥1 test Vitest + snapshot Playwright si UI |
| Pas de feature creep | Ne pas ajouter au-delà des 12 items prescrits. P2/P3/P4 traiteront le reste. |

### Anti-patterns interdits

- ❌ `git push --force` ou `--no-verify` sur main (sauf accord explicite Will)
- ❌ Modifier `_AUDIT/PROMPT-1-AUDIT-EXISTANT-FORENSIQUE.md` (P1 verrouillé)
- ❌ Modifier `axionia/villes/copy/<slug>.ts` ou `axionia/image-bank/seed-images.ts` (session Manon)
- ❌ Désactiver `factoryAutoPublishAllBlogTypes` (D-W3 Will)
- ❌ Signer DPAs à la place de Will (action Will Trust Center 5 min)
- ❌ Ajouter dépendances npm non strictement nécessaires (économie bundle size)
- ❌ Refactor pour le plaisir hors scope P0

</operating-mode>

---

## 4. PRÉ-REQUIS — Lectures + Convergence Manon

### Avant TOUTE action

```bash
# 1. Lecture contexte
Read _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/PHASE-1-VERDICT.md
Read _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/CROSS-CUTTING.md
Read _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents/A17-ai-act-rgpd-forensique.md  # détail compliance
Read _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents/A16-auto-review-improve.md     # détail LLM-judge
Read _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1/agents/A07-images-assignment.md       # détail images

# 2. Convergence Manon
git log --all --oneline -30
git branch --all
git status

# Si branche `feat/villes-*` ou `feat/image-bank-*` active >24h récent → flag

# 3. État actuel commit + branches
git rev-parse HEAD
git diff --stat origin/main HEAD
```

### Lectures mémoires Claude

- `axionia_content_gen_phase1_audit_*` (le verdict P1 récent)
- `axionia_image_bank_complet_2026-05-20`
- `axionia_keywords_747seeds_2026-05-20`
- `feedback_commit_no_push` (autorisation commits)
- `axionia_sprint_s5_p2_pending_push_2026-05-20`
- `feedback_no_dalle_images`

---

## 5. PHASE A — LIFT HOLD (≤4h)

### A.1 — QW-1 : Migrer /blog → buildBlogPostingJsonLd (30 min)

#### Périmètre
- Fichier probable : `src/app/[locale]/(public)/blog/[slug]/page.tsx`
- Helper SEO : `src/lib/seo/factories/seo-content-gen-factories.ts` (contient déjà `buildBlogPostingJsonLd`)
- Helper actuel : `src/lib/seo/factories/seo.ts` (générique, sans `aiGenerated:true`)

#### Tâches
1. Identifier l'import actuel de SEO sur `/blog/[slug]/page.tsx`
2. Remplacer par `buildBlogPostingJsonLd({ ...article, aiGenerated: true })`
3. Vérifier la sortie JSON-LD via Read d'un article rendu (snapshot test SSR ou `curl https://axion-ia.com/fr/blog/<slug>` en dev)
4. Tester via Rich Results Test (Google) que le schema est valid
5. Ajouter snapshot test Vitest `seo-content-gen-factories.test.ts` qui assert présence `aiGenerated: true`

#### Acceptance criteria
- ✅ JSON-LD `<script type="application/ld+json">` contient `"aiGenerated": true` sur 3 articles blog sample
- ✅ Schema valid Rich Results Test
- ✅ Test Vitest passe

### A.2 — QW-2 : MAX_PUBLISH_PER_DAY=30 + drip 8h-22h CET (2h)

#### Périmètre
- Fichier worker publish : probable `src/server/queue/workers/publish-worker.ts`
- Config : probable `src/server/content-gen/config.ts` ou `src/lib/constants.ts`
- Lib date : `date-fns` ou natif

#### Tâches
1. Créer/ajouter const `MAX_PUBLISH_PER_DAY = 30` dans config (env override possible : `process.env.MAX_PUBLISH_PER_DAY ?? 30`)
2. Dans publish-worker : avant `publish()`, vérifier nb articles publiés today (UTC ou CET ?) → si ≥ MAX → re-queue pour next day window
3. Drip schedule : publish autorisé uniquement entre 8h CET et 22h CET (semaine + weekend ou semaine seulement ?)
4. Si publish appelé hors window → re-queue avec `delay = next_window_start - now`
5. Logging structuré : `pino` log `{ event: 'publish_throttled', reason: 'max_daily' | 'out_of_window', nextRetry }`
6. Test Vitest : mock date, publier 31 articles le même jour → 30 publish + 1 throttled
7. Test Vitest : mock heure 3h CET → throttle out_of_window

#### Acceptance criteria
- ✅ `MAX_PUBLISH_PER_DAY=30` const utilisée
- ✅ Worker respecte cap (vérifier mocked test)
- ✅ Drip 8h-22h CET respecté
- ✅ Logs structurés émis sur throttle

### A.3 — QW-6 : AiContentDisclaimer sur /cas-concrets/[slug] (30 min)

#### Périmètre
- Fichier probable : `src/app/[locale]/(public)/cas-concrets/[slug]/page.tsx`
- Composant existant : `src/components/articles/AiContentDisclaimer.tsx` (probablement déjà utilisé sur /blog)

#### Tâches
1. Si composant `<AiContentDisclaimer />` existe ailleurs (e.g. /blog/[slug]) → l'importer + l'ajouter en fin de page /cas-concrets/[slug] (avant footer suggestions)
2. Si composant n'existe pas → le créer dans `src/components/articles/AiContentDisclaimer.tsx` avec wording :
   > « Contenu rédigé avec l'assistance de Claude (Anthropic). Édité et validé par l'équipe AxionIA. »
3. Style : encadré subtil, terracotta `#c24a1b` bordure gauche 3px, fond ivoire `#faf8f3` (cf. mémoire [[axionia_couleurs]])
4. Snapshot Playwright /cas-concrets/[slug-test] vérifie présence du texte

#### Acceptance criteria
- ✅ Composant rendu sur 3 cas-concrets sample
- ✅ Wording exact présent
- ✅ Snapshot Playwright passe

### A.4 — QW-7 : Fix isAiGenerated bug seed-images.ts (1h)

#### Périmètre
- Fichier : `axionia/src/server/image-bank/seed-images.ts` (ou équivalent)
- Bug identifié A07 : `isAiGenerated = !isLogo` → faux car les images Will importées (photos réelles) sont marquées `isAiGenerated=true` parce que `!isLogo` = `true`

#### Tâches
1. Identifier la ligne `isAiGenerated = !isLogo`
2. Remplacer par `isAiGenerated = false` (doctrine [[feedback_no_dalle_images]] : 0 image IA générative)
3. Migration data : `UPDATE Image SET isAiGenerated = false WHERE isAiGenerated = true AND aiProvider IS NULL` (les 126 images mal taguées)
4. Test Vitest : seed run → 0 image avec `isAiGenerated=true`

⚠️ **Convergence Manon** : ce fichier est dans la zone d'écriture Manon (image-bank/seed-images.ts). AVANT modification :
```bash
git log --all --oneline -10 -- axionia/src/server/image-bank/seed-images.ts
git diff origin/main -- axionia/src/server/image-bank/seed-images.ts
```
Si Manon a commité dessus dernières 24h → coordination requise OU skip cette tâche (à faire en P1.6) + flag dans verdict.

#### Acceptance criteria
- ✅ Code corrigé
- ✅ Migration data effectuée (126 rows updated)
- ✅ Test Vitest passe
- ✅ Pas de conflit Manon

### A.5 — Bonus QW-9 : Page désambiguïsation Axion-IA ≠ axionai.fr (2h, optionnel si temps)

#### Périmètre
- Nouvelle page : `src/app/[locale]/(public)/axionia-vs-axionai/page.tsx`
- Slug : `/axion-ia-vs-axionai`

#### Tâches
1. Créer page statique explicative
2. Contenu : court FAQ « Sommes-nous le même que axionai.fr ? Non, voici les différences. »
3. JSON-LD `Article` + canonical
4. Lien depuis footer + page about
5. Si temps Phase A insuffisant → reporter en Phase B

#### Acceptance criteria
- ✅ Page accessible /axion-ia-vs-axionai (FR)
- ✅ Linkée depuis footer
- ✅ Indexable (`robots: index, follow`)

### Phase A — Commit & Push

Une fois A.1 → A.4 verts (A.5 optionnel) :

```bash
# Gates obligatoires
pnpm typecheck && pnpm lint && pnpm test --run && pnpm test:e2e --grep="qw-"

# Commit
git add <fichiers modifiés>
git commit -m "$(cat <<'EOF'
feat(content-gen): P1.5 Phase A — lift double HOLD compliance

- QW-1: /blog/[slug] uses buildBlogPostingJsonLd with aiGenerated:true
- QW-2: MAX_PUBLISH_PER_DAY=30 const + drip 8h-22h CET in publish-worker
- QW-6: AiContentDisclaimer on /cas-concrets/[slug]
- QW-7: Fix isAiGenerated bug (126 images re-tagged)

Lifts AI Act HOLD (A17 22/45 → ~35/45) + Google Policy HOLD (A18 17/40 → ~22/40 conditional, factoryAutoPublishAllBlogTypes kept ON per Will D-W3).

⚠️ DPA Anthropic non signé — risque résiduel assumé Will jusqu'à signature future (recommandation: 5 min Trust Center).

Phase B (refonte P0) à valider Will avant lancement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# Push si convergence Manon OK
git push origin main
```

### STOP & ASK Will (post-Phase A)

Message Will :
```
✅ Phase A livrée. Double HOLD compliance levé:
- A17 AI Act ~22/45 → ~35/45 ✅
- A18 Google Policy ~17/40 → ~22/40 (conditionnel factoryAutoPublishAllBlogTypes)

📊 Score D-État estimé post-Phase A : 531.5 → ~590-620/1000

✅ Publication 30/jour techniquement débloquée.

📁 Commit pushed: <sha>

⏸️  STOP — Tu valides ?
   [A] OK lancer Phase B (refonte 8 P0, ~24-32h autopilot)
   [B] Pause — valider en prod d'abord avant Phase B
   [C] Ajuster une décision (e.g. cap journalier, factoryAutoPublishAllBlogTypes)
```

---

## 6. PHASE B — REFONTE P0 (24-32h)

### B.1 — P0-3 : LLM-as-judge complet (8-12h)

#### Périmètre
- Worker actuel : `src/server/queue/workers/quality-improver-worker.ts` (skeleton confirmé A03+A16)
- Service : `src/server/content-gen/reviewer/llm-judge.ts` (à créer si absent)
- Modèle : `Article.editorialScore` (probablement existe Prisma)

#### Tâches
1. **Implémenter le service `llm-judge.ts`** :
   - Input : `Article` complet (markdown body + meta + SEO + FAQ)
   - LLM : Claude Sonnet 4.6 (reviewer ≠ generator si generator=Sonnet → reviewer=Opus pour piliers, Sonnet pour standards)
   - Prompt XML-tagged avec rubric :
     - `factual_accuracy` /10
     - `depth` /10
     - `originality` /10
     - `readability` /10
     - `seo_completeness` /10
     - `value_to_reader` /10
     - `tone_axionia_alignment` /10
   - Output JSON strict (Zod validated) avec `globalScore` (moyenne pondérée), `issues[]` (severity + section + fix), `verdict` (`publish` | `improve` | `reject`)
   - Seuils Will :
     - `globalScore >= 8.5` ET 0 P0 → `publish`
     - `7.0 <= globalScore < 8.5` OU P1 présents → `improve` (max 2 iter)
     - `globalScore < 7.0` OU P0 → `reject` (notif Will)
2. **Connecter `quality-improver-worker`** à `llm-judge` :
   - Pour chaque article `status=draft`, appeler `llm-judge.review(article)`
   - Stocker résultat dans `Article.editorialScore` + `Article.reviewIssues` (JSON)
   - Selon verdict : `publish` (déclenche publish-worker), `improve` (déclenche improve-worker), `reject` (status `rejected`)
3. **Implémenter `improve-worker`** :
   - Reçoit article + `issues[]` du reviewer
   - LLM prompt ciblé sur les sections faibles (multi-axis improvement targeting)
   - Maximum 2 itérations
   - Si après 2 iter score reste <8.5 → status `rejected` + escalate humain
4. **Tests Vitest** : mock LLM, articles synthétiques, assert verdict
5. **Tests E2E Playwright** : pipeline gen → review → publish ou improve ou reject

#### Acceptance criteria
- ✅ `editorialScore` calculé sur tous nouveaux articles
- ✅ Verdict cohérent vs prompt rubric
- ✅ Boucle improve max 2 iter respectée
- ✅ Cost reviewer mesuré (logs)
- ✅ Tests Vitest >85% coverage

### B.2 — P0-4 : Image hero pipeline assignment (4-6h)

#### Périmètre
- Generators : `src/server/content-gen/generators/{blog,landing,pilier,...}.ts` (7 fichiers)
- Image-bank : services existants (cf. `axionia_image_bank_complet_2026-05-20`)

#### Tâches
1. **Helper `assign-hero-image.ts`** :
   - Input : `Article` (avec keyword + verticale + cityId optionnel + topic_tags)
   - Algorithme :
     1. Embeddings cosine entre keyword + topic_tags vs `Image.tags`
     2. Si verticale → boost images tagged matching verticale
     3. Si cityId → boost images tagged matching city
     4. Filtre `Image.isAiGenerated=false` (doctrine)
     5. Filtre `Image.status='approved'`
     6. Top 1 → assigner à `Article.heroImageId`
   - Si aucune image match → status `pending_image` + alerte admin
2. **Connecter les 7 generators** : à la fin de chaque generator, appel `assignHeroImage(article)` avant `save()`
3. **Pour piliers + comparatifs** : ≥3 images (hero + 2 inline) ou ≥1 par option comparée → helper `assign-additional-images.ts`
4. **Alt text rédactionnel** : si `Image.alt` vide → générer via LLM short (`Image.title + context article`) limité 125 chars
5. **Test Vitest** : 7 generators × 3 articles sample → 100% ont heroImageId OR status=pending_image
6. **Test E2E Playwright** : article rendu has `<img>` avec `alt` non vide

#### Acceptance criteria
- ✅ Tous nouveaux articles ont heroImageId OU status=pending_image
- ✅ Alt rédactionnel <125 chars
- ✅ Doctrine 0 IA générative respectée
- ✅ Tests Vitest passent

### B.3 — P0-5 : internalLinkCount passé aux 4 generators (1h)

#### Périmètre
- Service : `src/server/content-gen/seo/seo-score.ts`
- Generators : 4 fichiers identifiés A08

#### Tâches
1. Identifier la signature `seoScore({ ..., internalLinkCount })` (déjà attend ce param)
2. Dans les 4 generators : compter les liens internes dans le body (regex `[text](/internal-path)` ou markdown link parser) → passer count
3. Test Vitest : article avec 5 liens internes → seoScore.internalLinkCount = 5 (pas 0)

#### Acceptance criteria
- ✅ `internalLinkCount` réel passé dans 4 generators
- ✅ SEO score reflète maillage interne réel
- ✅ Test Vitest passe

### B.4 — P0-6 : SimHash couches 3+4 réelles (4-8h)

#### Périmètre
- Service : `src/server/content-gen/dedup/simhash.ts` ou équivalent
- Bug identifié A09 : couches 3 (outline templatique) + 4 (cosine embeddings) = NO-OP (void fingerprint)

#### Tâches
1. **Couche 3 — Outline templatique SimHash** :
   - Compute SimHash 64-bit sur séquence h2/h3 normalisée
   - Stocker `Article.outlineSimhash`
   - Pre-publish check : distance Hamming ≤4 vs corpus publié → flag `duplicate_template`
2. **Couche 4 — Embeddings cosine** :
   - Provider : prompt Will dans STOP & ASK D4 (OpenAI text-embedding-3-large ou Voyage AI)
   - Si Will encore indécis → SKIP couche 4 + flag dans verdict P1.5
   - Si Will tranche → ajouter pgvector extension Postgres (`CREATE EXTENSION IF NOT EXISTS vector`)
   - Stocker `Article.embedding` (vector(1536))
   - Index HNSW : `CREATE INDEX article_embedding_hnsw ON Article USING hnsw (embedding vector_cosine_ops)`
   - Pre-publish check : top-5 closest cosine > 0.85 → flag `duplicate_semantic`
3. **Actions sur flag** :
   - Duplicate detected → status `pending_human_review` + admin alert
   - Score similarité exposé dans admin pour debug
4. **Tests Vitest** : 2 articles quasi-identiques → flag duplicate

#### Acceptance criteria
- ✅ Couche 3 implémentée + indexée
- ✅ Couche 4 implémentée si Will tranche provider (sinon skip + flag)
- ✅ Pre-publish check effectif
- ✅ Tests Vitest passent

### B.5 — P0-7 : Connecter 747 keyword seeds au pipeline (4h)

#### Périmètre
- Seeds : `axionia/prisma/seeds/keywords/*.ts` (29 secteurs, commit `7289de1`)
- DB : table `Keyword` (existe ou à créer)
- Service : `src/server/content-gen/keyword-selector.ts`

#### Tâches
1. **Si table `Keyword` n'existe pas en DB** → migration Prisma :
   ```prisma
   model Keyword {
     id              String   @id @default(cuid())
     term            String   @unique
     termNormalized  String
     vertical        Vertical
     audienceFit     Audience[]
     searchIntent    SearchIntent?
     contentTypeFit  ContentType[]
     isLongTail      Boolean @default(false)
     isLocal         Boolean @default(false)
     cityIds         String[]
     searchVolume    Int?
     difficulty      Int?
     clusterId       String?
     usageCount      Int @default(0)
     lastUsedAt      DateTime?
     createdAt       DateTime @default(now())
   }
   ```
2. **Seed runner** : `pnpm prisma db seed` charge les 747 keywords dans table Keyword (mapping depuis fichiers seeds)
3. **Service `keyword-selector.ts`** :
   - Filtres : vertical + audience + contentType
   - Lock atomique : `SELECT FOR UPDATE` ou `Keyword.usageCount++` atomique
   - Priorité : `lastUsedAt asc` + `searchVolume desc` + `difficulty asc`
4. **Connecter generators** : remplacer keywords hardcodés par `selectKeyword({ vertical, audience, contentType })`
5. **Validation keyword-in-title** : helper `validateKeywordInTitle(title, keyword)` avec lemmatisation FR (`wink-lemmatizer`) → enforce sur generators
6. **Tests Vitest** : 100 articles générés → 100 keywords distincts (lock fonctionne) + 100% keyword dans titre

#### Acceptance criteria
- ✅ Table Keyword peuplée avec 747 seeds
- ✅ Generators utilisent `selectKeyword()` au lieu de hardcodé
- ✅ Lock atomique fonctionnel
- ✅ Keyword-in-title validé
- ✅ Tests Vitest passent

### B.6 — P0-9 : GenerationProvenance model + service (4h)

#### Périmètre
- Schema Prisma : ajout model `GenerationProvenance`
- Service : `src/server/content-gen/provenance/provenance-logger.ts`

#### Tâches
1. **Migration Prisma** :
   ```prisma
   model GenerationProvenance {
     id                String   @id @default(cuid())
     articleId         String
     article           Article  @relation(fields: [articleId], references: [id], onDelete: Cascade)
     step              String   // outline | body | faq | review | improve
     provider          String   // anthropic | openai | voyage
     model             String   // claude-sonnet-4-6 | claude-opus-4-7 | ...
     modelVersion      String?
     promptHash        String   // SHA-256 du prompt
     inputTokens       Int
     outputTokens      Int
     cacheReadInputTokens Int @default(0)
     cost              Decimal  @db.Decimal(10, 6)
     regulationVersion String   @default("AI-Act-2024/1689")
     previousHash      String?  // chain hash pour immutabilité
     hash              String   // SHA-256 de ce record
     timestamp         DateTime @default(now())
   }
   ```
   - Index `articleId`, `timestamp`
   - Retention 6 ans (cron nettoyage `>6y`)
2. **Service** : helper appelé à chaque LLM invocation pour persister
3. **Endpoint admin** `/api/admin/provenance/<articleId>` : exporter trace complète JSON pour régulateur
4. **Endpoint RGPD art.17** : `DELETE /api/admin/articles/<id>/forget` purge `Article` + cascade `GenerationProvenance` + embeddings + sitemap removal + IndexNow remove
5. **Tests Vitest** : article généré → provenance logged ; forget endpoint → 0 trace résiduelle

#### Acceptance criteria
- ✅ Model créé + migration appliquée
- ✅ Tous LLM calls loggés
- ✅ Export régulateur fonctionnel
- ✅ Forget endpoint fonctionnel
- ✅ Tests Vitest passent

### B.7 — P0-10 : pauseCampaign() purge BullMQ jobs (2h)

#### Périmètre
- Service : `src/server/content-gen/campaign/campaign-service.ts` ou équivalent
- BullMQ queues : noms à identifier

#### Tâches
1. Identifier les queues utilisées par chaque type job campagne (`gen:<campaignId>:*` selon convention)
2. Sur `pauseCampaign(campaignId)` : appeler `queue.removeJobs(pattern: 'gen:campaignId:*')` ou équivalent BullMQ
3. Logger les jobs purgés pour audit
4. Test Vitest : campaign avec 100 jobs en queue → pause → 0 jobs restants

#### Acceptance criteria
- ✅ Pause purge effective
- ✅ Coût stoppé immédiatement
- ✅ Logs audit
- ✅ Test Vitest passe

### B.8 — Verticale sites_web_augmentes (2h)

#### Périmètre
- Schema Prisma : enum `ServiceSector` ou `Vertical`
- Pricing : `src/lib/pricing.ts` (cf. mémoire [[axionia_positionnement_4_verticales]] qui dit 5 verticales maintenant)
- Page hub : `src/app/[locale]/(public)/sites-web-augmentes/page.tsx`

#### Tâches
1. **Migration Prisma** : ajout `sites_web_augmentes` à enum `Vertical`
2. **Pricing** : ajouter pricing.ts entry
3. **Page hub** : créer `/sites-web-augmentes/page.tsx` minimal (header + description + CTA) — full content viendra en P4
4. **Sitemap** : ajouter URL au sitemap services
5. **JSON-LD `Service`** sur la page
6. **Navigation** : ajouter au header mega-menu + footer
7. **KB sectorielle** : créer stub `axionia/kb/verticals/sites_web_augmentes.ts` (full content P4)

#### Acceptance criteria
- ✅ Migration appliquée
- ✅ Page accessible et indexable
- ✅ Sitemap include
- ✅ Pricing OK

### Phase B — Commits & Push (incrémentaux)

Chaque B.x livré → commit incrémental + push :

```bash
# Exemple B.1
git add <fichiers>
git commit -m "feat(content-gen): P1.5 B.1 — LLM-as-judge complet (P0-3)

- llm-judge.ts service implémenté Claude Sonnet reviewer
- quality-improver-worker connecté à llm-judge
- improve-worker max 2 iter
- Seuils: publish ≥8.5, improve 7-8.5, reject <7
- Tests Vitest >85% coverage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## 7. VERDICT P1.5 — Format final

À l'issue Phase B, créer `_AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/VERDICT-P1.5.md` :

```markdown
# VERDICT P1.5 — SPRINT COMPLIANCE + REFONTE P0

## Date : <date livraison>
## Durée totale : <h>

## Score D-État avant / après

| Avant P1.5 | Après Phase A | Après Phase B |
|---|---|---|
| 531.5/1000 | ~590-620/1000 | ~750-800/1000 (estimé) |

## Items livrés

### Phase A (Lift HOLD)
- ✅ QW-1
- ✅ QW-2
- ✅ QW-6
- ✅ QW-7
- ⚠️ QW-3 SKIPPED (décision Will D-W3)

### Phase B (Refonte P0)
- ✅ P0-3 LLM-as-judge
- ✅ P0-4 Image hero
- ... etc

## P0 non traités (reportés P2/P3/P4)
- P0-8 Adresse FR Local SEO (action Will, hors P1.5)

## P1 quick wins additionnels livrés (bonus si temps)
- ... liste

## STOP & ASK Will (3-5 décisions résiduelles)
1. Embedding provider (si pas tranché en cours P1.5)
2. Adresse FR Local SEO timing
3. Lancement P2/P3/P4 + Addendum en parallèle ?
4. ...

## Sauvegarde mémoire
- Mémoire `axionia_content_gen_p1_5_livre_<date>.md` créée

## Next step
P2 + P3 + P4 + Addendum lançables en parallèle.
```

---

## 8. STOP & ASK Will (post-P1.5)

À la livraison complète, message Will :
```
✅ P1.5 SPRINT COMPLIANCE + REFONTE P0 livré.

📊 Score D-État : 531.5 → ~<score>/1000
🚨 Double HOLD levé (modulo factoryAutoPublishAllBlogTypes risque résiduel)

📁 Commits pushed: <N commits>
📁 Tests added: <N tests Vitest + N E2E Playwright>
📁 Coverage: <X>% (vs 7.9% baseline)

⏸️  STOP — Tu valides ?
   [A] OK lancer P2 + P3 + P4 + Addendum en parallèle (4 conversations)
   [B] Pause — valider en prod 24-48h avant continuer
   [C] Trancher décisions résiduelles d'abord (embedding provider, etc.)

📁 Verdict: _AUDIT/CONTENT-GEN-PERFECTION-2026/phase-1.5/VERDICT-P1.5.md
```

---

## 9. ANTI-PATTERNS À ÉVITER

1. ❌ Sauter le STOP entre Phase A et Phase B
2. ❌ Désactiver factoryAutoPublishAllBlogTypes (D-W3 Will)
3. ❌ Modifier fichiers session Manon sans coordination
4. ❌ Force-push main
5. ❌ Skip tests Vitest pour aller plus vite
6. ❌ Refactor au-delà du scope (P0 only)
7. ❌ Inventer un embedding provider sans Will tranche
8. ❌ Modifier P1 verrouillé
9. ❌ Oublier `Co-Authored-By: Claude` dans commits
10. ❌ Push si gates pre-commit fail

---

*Fin du PROMPT 1.5 SPRINT COMPLIANCE + REFONTE P0. Lecture obligatoire avant lancement : PHASE-1-VERDICT.md du parent P1.*
