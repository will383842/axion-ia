# PROMPT — Refonte admin Axion-IA · vérification + fix + 2× re-vérification + push + déploiement (AUTOPILOT BOUT-EN-BOUT)

> **Type** : autopilot complet end-to-end (audit → fix → re-audit ×2 → push → deploy → smoke prod → diagnostic+fix erreurs déploiement en boucle jusqu'à succès 100 %).
> **Mode** : **NE JAMAIS S'ARRÊTER** sauf 4 cas catastrophiques §28. Tout le reste = diagnostique, fix, retry.
> **Autorisation explicite Will** : « JE DONNE L'AUTORISATION DE TOUT FAIRE DE BOUT EN BOUT » (2026-05-18 message Will).
> **Cible finale** : déploiement prod 100 % réussi, 0 régression mesurable, 116 routes admin V2 prêtes derrière flag, smoke prod vert sur V1 ET V2 (cookie admin_v2=1).
> **Date prompt** : 2026-05-18.
> **Auteur prompt** : Claude Opus 4.7 (1M context).

---

## 0. INVOCATION PHRASE (à copier-coller dans la nouvelle conversation)

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-REFONTE-VERIFY-FIX-DEPLOY-AUTOPILOT-2026-05-18.md.
Phases 0→10 séquentielles, vérification + fix + 2× re-vérification + push +
déploiement, boucle de diagnostic jusqu'à smoke prod vert à 100 %.
Autorisation explicite Will déjà donnée. NE PAS S'ARRÊTER sauf 4 cas
catastrophiques §28. Confirme par « GO autopilot » et démarre Phase 0.
```

---

## 1. CONTEXTE (self-contained, lis intégralement avant de démarrer)

Tu es invoqué pour **terminer définitivement** la refonte admin Axion-IA livrée le 2026-05-17 (sub-repo `C:\Users\willi\Documents\Projets\Axion-IA\axionia`, branche `main`, déjà pushée sur `origin/main` jusqu'à HEAD `1cd3d5f`).

### 1.1 Ce qui a été livré le 2026-05-17 (à vérifier indépendamment)

- **15 PRs livrées** (PR 0 → PR 14), 27+ commits, ~250 fichiers touchés, ~16 100 LOC ajoutés.
- **116 routes admin V2** prêtes derrière feature flag `ADMIN_V2_ENABLED` (default false → V1 toujours rendue).
- **32 primitives** `src/components/admin/ui/**`.
- **Score pondéré 1753 / 2000 (87.7 %)** annoncé vs cible 1700 (85 %).
- **Tests Vitest** 945/945 passed (vs 887 baseline = +58).
- **Tags git** : 31 tags `admin-refonte-*` (baseline → pr14-end).
- **HEAD actuel** : `1cd3d5f docs(admin-refonte): closure session 2026-05-17 soir post pr 12`.
- **Push origin/main** : déjà sync jusqu'à HEAD (commits PR 10/11/8/9/12 + closure docs pushés).
- **Pipeline déploiement** : `.github/workflows/deploy-coolify.yml` lance à chaque push main : build GH Actions → push GHCR → Coolify pull (Dockerfile.coolify-pull) → CF purge → LHCI gate (Lighthouse 5 URLs prod).

### 1.2 Stack technique (rappel + ADRs critiques)

- **Next.js 16** App Router + React 19 (RSC + Server Actions).
- **Prisma 5.22** + Postgres 16 + Redis (BullMQ workers, **BULLMQ_DISABLED=true au build**).
- **Auth.js v5** (session JWT, MFA TOTP).
- **Sentry** + **logActivity** + **CSP nonce** + **force-dynamic** sur toutes routes admin.
- **next-intl v4.11** (FR canonique, **EN désactivé runtime** via `proxy.ts` `EN_LOCALE_ENABLED=false`, cf. CLAUDE.md).
- **Hetzner CPX42** Nuremberg (8c/16GB/320GB), `178.105.55.15`, Coolify + Caddy 2 + Cloudflare Free.
- **ADR 0026 BUILD EXTERNALISÉ GH ACTIONS** (cf. CLAUDE.md AGENTS.md du sub-repo) : build Docker sur GH Actions, push GHCR, Coolify `Dockerfile.coolify-pull` (un-liner `FROM ghcr.io/will383842/axion-ia:latest`). **VPS CPX42 ne fait QUE pull**. Magic string `"stub.invalid"` injectée au build pour bypass DB/Redis (`prisma.ts` + `redis.ts` Proxy stub-aware). **NE JAMAIS TOUCHER** sans propager dans 5 fichiers.
- **ADR 0028** : design system admin v1 (la refonte sous audit).

### 1.3 Incidents récents documentés (mémoire)

- **2026-05-17 deploy recovery** : pipeline GHCR+Coolify cassé par zombie queue Coolify (cf. mémoire `axionia_deploy_recovery_2026-05-17.md`). Workflows anti-récidive en place : `coolify-zombie-cleanup.yml` (cron daily) + `coolify-diagnose.yml` (autopilot). Commits `a2df64d` + `a21a0e1`.
- **2026-05-15 incident 503 origin** : régression fix avait cassé `NEXT_PUBLIC_SITE_URL`, ~50 routes en 503. Corrigé. Garder en tête comme pattern de panne possible.
- **2026-05-09 build OOM CPX32 → rescale CPX42** : 8 GB heap, 4 workers desserrés. Le build Docker prod a saturé les 150 GB à 117 GB peak avant ADR 0026.

### 1.4 Documents de référence (lecture obligatoire Phase 0)

- **Master prompt initial** : `Axion-IA/_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md` (la doctrine refonte, ~1200 lignes — non-négociables §3 + §3.5-3.10).
- **Plan implémentation** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md`.
- **ADR 0028** : `axionia/docs/adr/0028-admin-design-system-v1.md`.
- **Patterns templates** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md`.
- **VERDICT-FINAL.md claim** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (à VÉRIFIER, pas à croire).
- **ANTI-REGRESSION-REPORT.md claim** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md` (à VÉRIFIER).
- **EXEC-SUMMARY-WILL.md** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/EXEC-SUMMARY-WILL.md`.
- **JOURNAL.md** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/JOURNAL.md`.
- **CLAUDE.md / AGENTS.md sub-repo** : `axionia/CLAUDE.md` → `axionia/AGENTS.md` (build externalisé + stubs Prisma/Redis + magic string `stub.invalid` + EN locale désactivé).
- **Workflows GH Actions** : `axionia/.github/workflows/deploy-coolify.yml`, `coolify-zombie-cleanup.yml`, `coolify-diagnose.yml`.

---

## 2. MISSION & MODE OPÉRATOIRE

### 2.1 Objectif final

🟢 **DÉPLOIEMENT PROD COMPLET 100 % RÉUSSI** :

- ✅ Phase 0-3 audit verdict ≥ 1700/2000.
- ✅ Phase 4 fix tous les P0 et P1 trouvés (0 résiduel).
- ✅ Phase 5 vérification complémentaire #1 → 0 nouveau finding.
- ✅ Phase 6 fix delta si findings #1 (sinon skip).
- ✅ Phase 7 vérification complémentaire #2 → 0 finding final.
- ✅ Phase 8 push origin/main + push --tags + vérif sync.
- ✅ Phase 9 monitoring pipeline GH Actions → Coolify deploy → LHCI gate.
- ✅ Phase 10 self-healing : diagnostic + fix toute erreur de déploiement jusqu'à 100 % succès. Boucle while/until.
- ✅ Smoke prod 116 routes admin OK (V1 flag OFF) + smoke V2 (cookie admin_v2=1).

### 2.2 Mode opératoire — autopilot pur

- **TOUT AUTOPILOT.** Pas de STOP & ASK sauf 4 cas catastrophiques §28.
- **Diagnostique root cause** avant tout fix. Pas de bypass (`--no-verify`, `--force` destructif).
- **Boucle de fix** : si un gate échoue, identifie cause → fix → re-run → re-vérifie. Pas de plafond d'itérations sur la qualité — seulement plafond temps total §27.
- **Cite-don't-guess** : chaque action documente sa preuve (commande + output + SHA).
- **Tag à chaque étape majeure** pour permettre rollback rapide en cas d'incident.

### 2.3 Outils autorisés

- **Lecture** : `Read`, `Glob`, `Grep` (massif autorisé).
- **Écriture code** : `Edit`, `Write` (uniquement pour fix P0/P1 issus de l'audit).
- **Écriture docs** : `Write` sur `axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/**`.
- **Bash** : `git`, `npx tsc`, `npx eslint`, `npx vitest`, `pnpm <script>`, `gh api`, `curl` (smoke prod), `git push`, `git tag`. **PAS** `git push --force` sur main (rejet absolu sauf §28).
- **Agent (sous-agent)** : `Explore` ou `general-purpose` pour audits parallèles + diagnostic complexe.
- **gh CLI** : `gh run list`, `gh run view`, `gh run watch` pour suivi GH Actions.

### 2.4 Outils & commandes interdits (sauf §28)

- ❌ `git push --force` / `git push -f` sur main.
- ❌ `git reset --hard` qui détruirait du travail commité.
- ❌ `--no-verify` sur commit (skip pre-commit hooks).
- ❌ `--no-gpg-sign` sauf accord.
- ❌ Modifier `.github/workflows/deploy-coolify.yml` Dockerfile pipeline pendant le déploiement (uniquement si root cause prouvée).
- ❌ Toucher `prisma/schema.prisma` ou créer une migration (le master prompt §3 l'interdit).
- ❌ Toucher `axionia/CLAUDE.md` / `axionia/AGENTS.md` sans raison documentée.
- ❌ Modifier la magic string `stub.invalid` sans propager dans les 5 fichiers documentés.

---

## 3. ARCHITECTURE DES PHASES (vue d'ensemble)

```
Phase 0 — Reality check (état git, working tree, baseline, comptes routes/primitives)
Phase 1 — 12 audits parallèles A1-A12 (Sentry, logActivity, CSP, force-dynamic, etc.)
Phase 2 — Synthèse Phase 1 + scoring /2000
Phase 3 — Verdict initial + liste P0/P1/P2 priorisée
Phase 4 — FIX des P0 et P1 (commits atomiques per-fix, lint-staged automatique)
Phase 5 — Vérification complémentaire #1 (re-run A1-A12 subset + smoke gates)
Phase 6 — FIX delta si findings #1 (boucle Phase 4)
Phase 7 — Vérification complémentaire #2 (cleanup final, vérif full gates)
Phase 8 — Push origin/main + push --tags + vérif sync
Phase 9 — Monitoring déploiement GH Actions + Coolify + LHCI gate
Phase 10 — Self-healing : diagnostic + fix erreurs déploiement (boucle jusqu'à succès)
Smoke prod final — 116 routes admin (V1 + V2 cookie) → verdict final 🟢/🟡/🟠/🔴
```

**Durée plafond cumulée** : 8 h (cf. §27).

---

## 4. PHASE 0 — REALITY CHECK (BLOQUANT)

Produit `axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/00-REALITY-CHECK.md` avec les vérifications suivantes.

### 4.1 État git

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git rev-parse HEAD                                          # attendu: 1cd3d5f
git status --short                                          # attendu: ?? .claude/worktrees/ et/ou ?? _AUDIT/PROMPT-DEPLOY...
git log admin-refonte-baseline-2026-05-17..HEAD --oneline | wc -l   # attendu: 27+
git tag | grep "admin-refonte-" | wc -l                     # attendu: 30+
git rev-list --count origin/main..HEAD                      # attendu: 0
git rev-list --count HEAD..origin/main                      # attendu: 0
git remote -v                                               # attendu: will383842/axion-ia.git
```

### 4.2 Working tree propreté

```bash
git diff --stat HEAD
git diff --staged
```

Tout fichier modifié non commité non-attendu → flag P0 en Phase 0 (sera fixé Phase 4).

### 4.3 Comptage routes + V2 components

```bash
find "src/app/[locale]/(admin)/[adminPrefix]" -type f -name "page.tsx" | wc -l
# attendu ≥ 116
find "src/app/[locale]/(admin)/[adminPrefix]" -type d -name "_v2" | wc -l
find "src/app/[locale]/(admin)/[adminPrefix]" -type f -path "*/_v2/*.tsx" | wc -l
grep -rln "isAdminV2Enabled" "src/app/[locale]/(admin)/[adminPrefix]" --include="page.tsx" | wc -l
# attendu = nombre de routes
```

### 4.4 Comptage primitives admin/ui

```bash
ls src/components/admin/ui/*.tsx | grep -v ".test.tsx" | wc -l
# attendu: 32
ls src/components/admin/ui/*.test.tsx | wc -l
```

### 4.5 Validité du feature flag

Lis `src/lib/feature-flags.ts`. Vérifie :
- Export `isAdminV2Enabled()` async.
- Lit cookie `admin_v2=1` OU env `ADMIN_V2_ENABLED === "true"`.
- Default `false`.

### 4.6 Sanity de la pipeline déploiement

```bash
ls .github/workflows/deploy-coolify.yml                      # attendu: présent
ls Dockerfile.coolify-pull                                   # attendu: présent
gh run list --workflow=deploy-coolify.yml --limit=3          # historique récent
gh api repos/will383842/axion-ia/actions/runs?per_page=5 --jq '.workflow_runs[] | {id,name,status,conclusion,created_at,head_sha}'
```

### 4.7 Vérif env vars Coolify critiques

```bash
# Via API Coolify (lecture seule) — adapte selon le mécanisme local
# Au minimum vérifie qu'on a accès à ces 4 vars en prod :
# DATABASE_URL, REDIS_URL, AUTH_SECRET, NEXT_PUBLIC_SITE_URL
# (lecture seule, ne pas modifier sans validation phase 9/10)
```

Si impossible d'accéder → 🟡 UNVERIFIED, continue (la prod tournait au push précédent, donc env vars étaient OK).

### 4.8 STOP & ASK Phase 0

Si **≥ 3 assertions critiques échouent** (HEAD divergent, working tree sale non-attendu, baseline tag manquant) → STOP & ASK Will avant Phase 1. Sinon → continue automatiquement.

---

## 5. PHASE 1 — 12 AUDITS PARALLÈLES (Explore agents)

Spawne **12 sous-agents `Explore` (ou `general-purpose`) en parallèle dans un seul message**.

Chaque sous-agent reçoit briefing self-contained ~150-300 lignes. Périmètre A1-A12 (cf. §6 du prompt AUDIT-ONLY frère).

### 5.1 Liste audits (rappel court — détails sub-agents brief)

| ID  | Audit                              | Score brut /200 | Poids | Brief référence                        |
| --- | ---------------------------------- | --------------- | ----- | -------------------------------------- |
| A1  | Pattern conformité 116 routes      | XXX             | ×2    | extrait + tableau routes               |
| A2  | Sentry preservation                | XXX             | ×3    | git diff baseline..HEAD grep Sentry    |
| A3  | logActivity / ActivityLog preservation | XXX         | ×3    | git diff grep logActivity              |
| A4  | CSP nonce + inline style/script    | XXX             | ×3    | git diff grep style/script             |
| A5  | force-dynamic + revalidate         | XXX             | ×3    | grep export const                      |
| A6  | Server Actions inchangées          | XXX             | ×3    | git diff -- src/server/actions         |
| A7  | Prisma schema + migrations + RLS   | XXX             | ×3    | git diff -- prisma/                    |
| A8  | SSE JobLogStream + GeoEventsBanner | XXX             | ×3    | git diff -- src/components/admin/content-gen |
| A9  | Cloisonnement admin/ui isolation   | XXX             | ×1    | grep import + isolation-check          |
| A10 | Tests Vitest 945/945               | XXX             | ×2    | npx vitest run                         |
| A11 | Gates santé code                   | XXX             | ×2    | tsc + lint + anti-hex + use-client + isolation |
| A12 | Activation V2 + flag effectif      | XXX             | ×1    | 5 routes spot-check + invariants 1+2+3 |

### 5.2 Format briefing sous-agent (template)

```
Tu es un sous-agent Explore qui audite la refonte admin Axion-IA livrée 2026-05-17.
Tu travailles dans C:/Users/willi/Documents/Projets/Axion-IA/axionia (sub-repo Next 16).
Lecture seule. Pas de modif.

[Brief spécifique audit A<N> — 100-300 lignes selon scope]

Output : axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/<NN>-AUDIT-<NAME>.md
Format imposé : voir §6.1-6.12 du prompt orchestrateur.
Score /200 + verdict + preuves (SHA / chemin / ligne / commande+output).
Cite-don't-guess. Pas d'hallucination. 🟡 UNVERIFIED si pas accessible.
```

### 5.3 Anti-pattern parallèle

❌ Pas spawner > 12 sous-agents.
❌ Pas dépendances entre sous-agents (chacun indépendant).
❌ Pas faire pareil que sous-agents en parallèle dans l'orchestrateur (gaspillage).

### 5.4 Récupération + agrégation

Attends les 12 notifications de fin. Récupère les 12 livrables. Vérifie qu'aucun n'est `🟡 UNVERIFIED` sur des invariants critiques (Sentry/logActivity/force-dynamic/Server Actions).

---

## 6. PHASE 2 — SYNTHÈSE PHASE 1 (~45 min)

Produit `SYNTHESE-PHASE-1.md` avec :

### 6.1 Tableau scoring pondéré

```markdown
| Audit              | Score brut | Poids | Score pondéré /200 |
| ------------------ | ---------- | ----- | ------------------ |
| A1 Pattern         | XXX        | ×2    | XXX                |
| A2 Sentry          | XXX        | ×3    | XXX                |
| ...                | ...        | ...   | ...                |

Total pondéré : XXX / 2000.
Verdict : 🟢 GO (≥1700) / 🟡 CONDITIONAL (1400-1699) / 🟠 SPRINT CORRECTIF (1000-1399) / 🔴 NO-GO (<1000).
```

### 6.2 Liste P0 / P1 / P2 priorisée

```markdown
### P0 (bloquants, à FIX en Phase 4 obligatoirement)
- [ ] FINDING-P0-001 : <description> · source : Audit A<N>, ligne XXX · fix proposé : <résumé>
- [ ] FINDING-P0-002 : ...

### P1 (à FIX en Phase 4 si effort < 30 min/fix)
- [ ] FINDING-P1-001 : ...

### P2 (déférer post-deploy)
- [ ] FINDING-P2-001 : ...
```

### 6.3 Claims contestés (honnêteté audit)

Liste les claims VERDICT-FINAL.md (sub-repo) qui ne correspondent pas à la réalité observée. Ex : « VERDICT-FINAL claim 1753/2000 mais audit indépendant calcule XXX/2000 ».

### 6.4 STOP & ASK Phase 2 ?

❌ **NON** (autopilot, autorisation Will donnée). Va directement Phase 3.

---

## 7. PHASE 3 — VERDICT INITIAL + PRIORISATION FIX (~30 min)

Produit `VERDICT-PHASE-3-INITIAL.md` (état pré-fix).

### 7.1 Contenu

- Score /2000 calculé indépendamment.
- Verdict 🟢/🟡/🟠/🔴.
- Tableau 16 non-négociables §3 (✓/✗/🟡 avec source preuve).
- Liste P0/P1/P2 ordonnée par criticité.
- Estimation effort fix (en h) pour P0+P1.

### 7.2 Décision automatique pour Phase 4

- **0 P0 + 0 P1** : skip Phase 4, va Phase 5 (vérification complémentaire #1 = celle-ci suffit).
- **1+ P0 OU 1+ P1** : Phase 4 obligatoire (fix tout).
- **≥ 10 P0** : marque comme alerte mais continue (autopilot, autorisation Will).

---

## 8. PHASE 4 — FIX DES P0 + P1 (durée variable)

### 8.1 Workflow par finding

Pour chaque P0/P1 dans l'ordre :

1. **Tag start** : `git tag admin-refonte-fix-<NN>-<slug>-start HEAD`.
2. **Lis** le ou les fichiers concernés.
3. **Diagnostic root cause** (pas juste symptôme).
4. **Applique fix minimal** :
   - Pas d'over-engineering (rappel master prompt §13).
   - Pas de refacto opportuniste.
   - Just-fix-the-bug.
5. **Cross-checks §C** sur le diff fix (Sentry/logActivity/nonce/force-dynamic/Server Actions inchangés sauf intention explicite).
6. **Gates santé** (tsc + lint + tests + anti-hex + use-client) sur le diff fix.
7. **Commit atomique** :
   ```
   fix(admin): <slug-court-finding> (audit verif-fix-deploy 2026-05-18)
   
   <description ≤ 50 lignes>
   - Finding : FINDING-P0/P1-<NN>
   - Source : axionia/_AUDIT/.../<NN>-AUDIT-*.md
   - Root cause : <diagnostic>
   - Fix : <ce qui change>
   - Gates : tsc 0 / lint 0 / tests XX/XX
   - Preservations : Sentry/logActivity/nonce/force-dynamic/Server-Actions intacts
   
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```
8. **Tag end** : `git tag admin-refonte-fix-<NN>-<slug>-end HEAD`.

### 8.2 Cas spéciaux

- **Si fix nécessite > 30 min effort sur P1** : déclasse en P2 (à fixer post-deploy), documente dans `FIX-DEFERRED-2026-05-18.md`.
- **Si fix nécessite > 2 h effort sur P0** : prends-le quand même (autopilot), mais documente l'effort dans le commit.
- **Si fix touche §3 non-négociables** (Server Action signature, Prisma schema, etc.) : STOP & ASK §28 cas 2 (rare).
- **Si fix nécessite ajout dépendance npm > 30 KB gz** : STOP & ASK §28 cas 3.

### 8.3 Pré-commit hooks

Les hooks lint-staged + husky + commitlint **DOIVENT** passer. Si un hook fail :
- Lis l'erreur.
- Fix root cause (ne JAMAIS `--no-verify`).
- Re-commit.
- Si le hook fail 3× consécutif sur le même fix → mark P0 + documente + STOP & ASK §28 cas 1.

### 8.4 Test suite après chaque fix

```bash
npx tsc --noEmit
npx vitest run --reporter=default
```

Si test fail nouveau (non lié au fix) → rollback fix → diagnostic.
Si test fail lié au fix → mettre à jour le test (si test obsolète) OU corriger le fix.

### 8.5 Produit `PHASE-4-FIX-LOG.md`

Pour chaque finding fixé :

```markdown
## FINDING-P0-001
- Source : Audit A<N>, ligne XXX
- Description : ...
- Root cause : ...
- Fix appliqué : commit <SHA>
- Tags : admin-refonte-fix-001-<slug>-start/end
- Gates post-fix : tsc 0 / lint 0 / tests XX/XX vert
- Cross-checks §C : OK
```

---

## 9. PHASE 5 — VÉRIFICATION COMPLÉMENTAIRE #1 (~45 min)

### 9.1 Périmètre

Re-run uniquement les audits **impactés par les fixes Phase 4** + smoke gates global.

- Si fix touche Sentry/logActivity/nonce/force-dynamic/Server-Actions/Prisma/SSE/isolation → re-run audit correspondant complet.
- Sinon (fix mineur typo, type, etc.) → smoke gates suffit.

### 9.2 Smoke gates globaux (TOUJOURS)

```bash
npx tsc --noEmit 2>&1 | tail -5; echo "tsc EXIT=$?"
npx eslint 2>&1 | tail -5; echo "lint EXIT=$?"
npx vitest run --reporter=default 2>&1 | tail -10; echo "vitest EXIT=$?"
pnpm anti-hex:check
pnpm use-client:check
pnpm anti-siren:check
pnpm content-gen:isolation-check  # 7 violations PRE-EXISTANTES OK
pnpm image-bank:isolation-check    # 0 attendu
```

Tous doivent EXIT 0 ou avoir le même résultat qu'avant les fixes.

### 9.3 Re-vérification §3 non-négociables

```bash
# Ré-exécute les grep critiques sur la plage baseline..HEAD (qui inclut maintenant les fixes Phase 4)
git diff admin-refonte-baseline-2026-05-17..HEAD | grep -E '^[\+\-].*Sentry\.' | wc -l
git diff admin-refonte-baseline-2026-05-17..HEAD | grep -E '^[\+\-].*(logActivity|ActivityLog\.create)' | wc -l
git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.tsx' | grep -E '^[\+].*(<style|<script|dangerouslySetInnerHTML)' | wc -l
git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- 'src/server/actions/**' 'src/features/**/actions.ts'
git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- prisma/
```

Tous les chiffres doivent être identiques à la Phase 1, ou justifiés par les fixes.

### 9.4 Produit `VERIFICATION-COMPLEMENTAIRE-1.md`

```markdown
# Vérification complémentaire #1

## Audits re-runs
- A<N> : OK / FAIL → si FAIL, justification + nouveau finding
- A<M> : ...

## Smoke gates
- tsc EXIT 0
- lint EXIT 0
- vitest XX/XX vert
- ...

## §3 non-négociables ré-vérifiés
- Sentry diff : XX ajouts / XX retraits (justifiés)
- logActivity : ...

## Findings nouveaux (issus des fixes Phase 4)
- FINDING-P0-XXX : ... (si trouvé)
- FINDING-P1-XXX : ...

## Verdict #1
- 🟢 0 finding → Phase 7 directement (skip Phase 6).
- 🟡 1+ findings → Phase 6 obligatoire.
```

---

## 10. PHASE 6 — FIX DELTA POST-VÉRIFICATION #1 (si nécessaire)

Identique Phase 4, mais sur les findings #1 uniquement. Commits format :

```
fix(admin): <slug> (re-verif 2026-05-18, post phase 4)

Re-verification 1 a detecte un finding apres fix initial : <details>.
Root cause : <diagnostic>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Tags : `admin-refonte-fix-redux-<NN>-<slug>-{start,end}`.

Produit `PHASE-6-FIX-DELTA-LOG.md`.

Si **0 finding** Phase 5 → skip Phase 6 entièrement.

---

## 11. PHASE 7 — VÉRIFICATION COMPLÉMENTAIRE #2 (cleanup final)

Identique Phase 5 logique, mais avec une exigence supplémentaire :

### 11.1 Build local de validation (optionnel mais préféré)

```bash
# Seulement si la session le permet (~10 min). Si autopilote pressé, skip.
NODE_OPTIONS="--max-old-space-size=8192" npx next build --webpack 2>&1 | tail -20
```

Si build local fail → diagnostic ADR 0026 (stub.invalid, SKIP_ENV_VALIDATION, BULLMQ_DISABLED). Note : le build PROD via GH Actions est plus fiable (env vars build-args propres). Ne pas bloquer Phase 8 sur un build local OOM.

### 11.2 Diff cumulé baseline → HEAD final

```bash
git diff admin-refonte-baseline-2026-05-17..HEAD --stat | tail -5
# Devrait montrer ~250-260 fichiers, ~16k-16.5k insertions.
git log admin-refonte-baseline-2026-05-17..HEAD --oneline | wc -l
# Devrait montrer 27 + nb fixes Phase 4 + 6 si applicable.
```

### 11.3 Re-run smoke gates COMPLETS

Tous les gates §9.2 + Vitest **complet** (945+/945+ pass attendu, +N si nouveaux tests pour fixes).

### 11.4 Produit `VERIFICATION-COMPLEMENTAIRE-2.md`

Verdict final :
- 🟢 0 finding → Phase 8 immédiatement.
- 🟡 trouvé findings → boucle Phase 6 → 7 (max 2 itérations supplémentaires, sinon documente résiduels en P2 et continue).

### 11.5 Bonus : régénération docs verdict

Mets à jour `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` + `EXEC-SUMMARY-WILL.md` avec :

- Score post-fixes (recalculé).
- Liste fixes appliqués (commits SHAs).
- Verdict 🟢 final.

Commit dédié `docs(admin-refonte): verdict final post audit verification 2026-05-18 + fixes`.

---

## 12. PHASE 8 — PUSH ORIGIN/MAIN + TAGS

### 12.1 Préchecks

```bash
git status --short                                          # working tree clean (sauf untracked attendus)
git log origin/main..HEAD --oneline                         # liste commits à push (devrait inclure tous les fixes)
git rev-list --count HEAD..origin/main                      # 0 (pas de divergence remote)
```

### 12.2 Push commits

```bash
git push origin main 2>&1 | tee /tmp/push-output.txt | tail -10
echo "EXIT=$?"
```

Si push fail :
- Si `non-fast-forward` (qqn a push entretemps, improbable) → `git pull --rebase origin main` puis re-push.
- Si rejection hook → diagnostic + fix + re-push.
- Si network/auth → retry 3× avec backoff 30s/60s/120s.

### 12.3 Push tags

```bash
git push origin --tags 2>&1 | tail -10
# Pousse les 30+ tags admin-refonte-* + tous les fix tags ajoutés Phase 4/6
```

### 12.4 Vérif sync remote

```bash
git ls-remote origin refs/heads/main                        # SHA distant
git rev-parse HEAD                                          # SHA local
# Les deux doivent être identiques
```

### 12.5 Produit `PHASE-8-PUSH-LOG.md`

- Commits pushés (count + range).
- Tags pushés (count + liste).
- SHA local = SHA remote ✓.

### 12.6 Note : si HEAD = origin/main déjà sync (cas Phase 0)

Cas attendu si **0 fix Phase 4/6** (refonte initiale déjà parfaite). Dans ce cas :
- Le `git push origin main` retourne "Everything up-to-date".
- Le `git push origin --tags` push les tags non-pushés.
- Continue directement Phase 9.

---

## 13. PHASE 9 — MONITORING DÉPLOIEMENT (~30 min)

### 13.1 Identification du workflow run

```bash
# Récupère le run le plus récent déclenché par le push (HEAD SHA)
HEAD_SHA=$(git rev-parse HEAD)
gh api repos/will383842/axion-ia/actions/runs?per_page=10 \
  --jq ".workflow_runs[] | select(.head_sha == \"$HEAD_SHA\") | {id, name, status, conclusion, created_at, html_url}"
```

Cible attendue : `name: "deploy-coolify.yml"` ou équivalent (vérifie le nom exact dans `.github/workflows/`).

### 13.2 Watch en background ou polling

```bash
# Option A — gh run watch (foreground, bloquant) :
gh run watch <RUN_ID> --exit-status

# Option B — polling toutes 60 sec (background-friendly) :
while true; do
  status=$(gh run view <RUN_ID> --json status,conclusion --jq '.status + " " + (.conclusion // "")')
  echo "$(date) — $status"
  if [[ "$status" == *"completed"* ]]; then break; fi
  sleep 60
done
```

Note : si l'outil ScheduleWakeup est dispo, utilise-le pour polling long (max 8 min observé pour build GH Actions).

### 13.3 Étapes pipeline à monitorer

Le workflow `deploy-coolify.yml` a typiquement 5 jobs :

1. **build** (~25 min) : free disk space + docker build axionia/Dockerfile avec stubs + push GHCR multi-tag.
2. **deploy** (~30s à 28 min) : POST Coolify /api/v1/deploy + Coolify build Dockerfile.coolify-pull + docker pull + container restart + entrypoint `prisma migrate deploy` + healthcheck.
3. **purge** : Cloudflare `purge_everything`.
4. **lhci** : Lighthouse CI gate 5 URLs prod live.
5. (autres jobs selon le workflow).

Surveille chaque job. Si `conclusion: failure` → Phase 10.

### 13.4 Produit `PHASE-9-DEPLOY-MONITOR.md`

- Run ID + URL.
- Status par job : pending / in_progress / success / failure.
- Timing par job.
- Verdict : 🟢 all green / 🔴 failure → Phase 10.

---

## 14. PHASE 10 — SELF-HEALING : DIAGNOSTIC + FIX ERREURS DÉPLOIEMENT (boucle jusqu'à succès)

### 14.1 Boucle principale (pseudocode)

```
RETRY_COUNT = 0
MAX_RETRIES = 10  # plafond logique, pas temporel

while True:
    deploy_status = monitor_pipeline(HEAD_SHA)
    
    if deploy_status == "all_green":
        break  # succès → Phase 11 smoke prod
    
    if deploy_status == "failure":
        RETRY_COUNT += 1
        if RETRY_COUNT > MAX_RETRIES:
            STOP_AND_ASK_WILL("Plafond MAX_RETRIES atteint", details)
        
        failure = identify_failure_root_cause()
        apply_fix(failure)
        # apply_fix peut :
        #   - re-trigger workflow (gh run rerun) si flake transitoire
        #   - cancel zombie run + restart pipeline
        #   - commit fix + push (déclenche nouveau workflow)
        #   - modifier env var Coolify si root cause prouvée
        
        # Continue la boucle, monitor le nouveau run
```

### 14.2 Stratégies de diagnostic par symptôme

| Symptôme                                              | Root cause probable                                  | Fix autopilot                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Build GH Actions OOM                                  | ADR 0026 disk full / heap                            | Free disk space step présent ? Vérifier. Augmenter NODE_OPTIONS heap si besoin (~12 GB).        |
| Build "stub.invalid" Prisma error                     | Magic string non propagée                            | Vérifier `prisma.ts`, `redis.ts`, `knowledge-rss.ts`, `knowledge-sitemap.ts` Proxy stub-aware.   |
| Build "SKIP_ENV_VALIDATION" Zod fail                  | env.ts ne respecte plus SKIP_ENV_VALIDATION          | Lire env.ts, vérifier early-return si SKIP_ENV_VALIDATION === "true".                          |
| Build BullMQ tries to connect                         | BULLMQ_DISABLED=true non set au build                | Vérifier Dockerfile builder stage env. Sentry-instrumented workers ?                            |
| Build typecheck fail                                  | Régression typage suite à un fix Phase 4             | Lire output build, fix typage en local, re-push.                                               |
| GHCR push fail (rate limit, auth)                     | Token expiré ou rate limit                           | Vérifier secret GH `GITHUB_TOKEN` validity. Wait + retry si rate limit. STOP si auth permanent. |
| Coolify deploy "queued/zombie"                        | Incident 2026-05-17 deploy recovery déjà connu       | Cancel zombie run via Coolify API + retrigger workflow (cf. `coolify-diagnose.yml`).            |
| Coolify "image pull failed"                           | GHCR token Coolify expiré                            | Vérifier env var Coolify GHCR_TOKEN. Refresh si besoin.                                        |
| Coolify "prisma migrate deploy" fail                  | Migration P-2026-XX-XX manquante DB ou conflit       | **STOP & ASK §28 cas 4** (prod data potentiellement à risque).                                  |
| Coolify "container restart loop"                      | Healthcheck fail = app boot fail                     | `coolify logs` → identifier erreur runtime. Si Prisma → STOP §28. Si app code → fix + re-push. |
| Cloudflare purge fail                                 | Token CF API expiré                                  | Refresh CF token Coolify env vars. Non-bloquant pour deploy = peut continuer.                  |
| LHCI gate fail (Lighthouse < seuil)                   | Régression Web Vitals causée par la refonte         | **CRITIQUE** : identifier route concernée (LHCI rapport URL). Diagnostiquer LCP/INP/CLS.        |
| LHCI gate fail "First Load JS > 75 KB gz"             | Bundle gonflé par primitives admin                  | **À vérifier** : routes admin n'impactent pas budget public (cloisonnement admin/ui).           |
| Smoke prod 200 fail sur 1+ route                      | Régression runtime non détectée par tests           | `curl -I` → status → diagnostic logs Coolify → fix + re-push.                                  |

### 14.3 Fix workflow zombie queue (cas connu 2026-05-17)

```bash
# 1. Identifier zombie run via Coolify
gh workflow run coolify-diagnose.yml --ref main
gh run watch <DIAGNOSE_RUN_ID>

# 2. Cancel zombie si présent (le workflow coolify-zombie-cleanup.yml fait normalement le job en cron daily)
# Si manuel nécessaire :
gh workflow run coolify-zombie-cleanup.yml --ref main

# 3. Re-trigger déploiement
gh workflow run deploy-coolify.yml --ref main

# 4. Monitor nouveau run
```

### 14.4 Fix LHCI régression (cas Web Vitals)

```bash
# 1. Récupérer rapport LHCI
gh run view <RUN_ID> --log | grep -A 50 "Lighthouse CI"

# 2. Identifier route + métrique fail
# 3. Lire la route concernée
# 4. Diagnostic : V1 (devrait être inchangée) vs V2 ?
# 5. Si V1 régression : URGENCE rollback partiel — STOP §28
# 6. Si V2 régression : c'est attendu car V2 non testée perf. Désactiver V2 flag prod si déjà set ou skipper LHCI sur V2.
# 7. Marquer en P2 post-deploy si non-bloquant.
```

### 14.5 Fix après timeout / no notification

```bash
# Si pas de notification après 45 min, polling actif :
gh run list --workflow=deploy-coolify.yml --limit=5 --json status,conclusion,databaseId,createdAt
# Identifier état réel
```

### 14.6 Commits de fix Phase 10

Format :

```
fix(deploy): <root-cause-slug> (autopilot recovery 2026-05-18)

Pipeline failure run #<ID>, root cause : <diagnostic>.
Fix : <action prise>.
Re-trigger via push.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 14.7 Produit `PHASE-10-SELF-HEALING-LOG.md`

Pour chaque cycle de fix :

```markdown
## Cycle <N>
- Symptôme : ...
- Root cause : ...
- Fix appliqué : ...
- Commit SHA (si push) : ...
- Re-trigger : ...
- Verdict cycle : 🟢 success / 🔴 fail → cycle suivant
```

### 14.8 Plafond sécurité

Si **plus de 10 cycles** ou **temps cumulé > 4 h** sans succès :
- Documente état détaillé.
- STOP & ASK §28 cas 1 (pipeline irréparable autopilot).

---

## 15. PHASE 11 — SMOKE PROD FINAL

### 15.1 Smoke V1 (flag default OFF)

```bash
# Récupère le domaine prod (depuis Coolify ou env)
SITE_URL="https://app.axion-ia.com"  # ou domaine réel

# Liste 116 routes admin à smoke-tester
# Build la liste via find local + map vers URLs
find "axionia/src/app/[locale]/(admin)/[adminPrefix]" -name "page.tsx" \
  | sed 's|axionia/src/app/\[locale\]/(admin)/\[adminPrefix\]/|/<adminSlug>/|; s|/page.tsx||' \
  | head -20  # échantillon
```

**N.B.** : `<adminSlug>` est le slug admin de prod (env `ADMIN_PREFIX` ou config). À récupérer.

Si pas accessible (URL admin non publique pour audit non-auth), smoke test sur :
- Routes publiques pSEO/admin home/login.
- Vérifier 200/302 (auth redirect attendu).
- Pas 500.

```bash
# Smoke V1 — login + home
curl -s -o /dev/null -w "%{http_code}\n" "$SITE_URL/fr/<adminSlug>/login"
# Attendu: 200

# Smoke health
curl -s "$SITE_URL/api/health" | jq '.'
```

### 15.2 Smoke V2 (cookie admin_v2=1)

```bash
# Avec cookie admin_v2=1 — vérifie que V2 répond (pas 500)
curl -s -o /dev/null -w "%{http_code}\n" \
  -b "admin_v2=1" "$SITE_URL/fr/<adminSlug>/login"
# Attendu: 200
```

### 15.3 Smoke 5 URLs LHCI pilotes

Routes typiquement audit Lighthouse :
- `/fr/` (homepage)
- `/fr/interventions`
- `/fr/methodologie`
- `/fr/reserver`
- `/fr/stack-ia`

```bash
for url in /fr/ /fr/interventions /fr/methodologie /fr/reserver /fr/stack-ia; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$SITE_URL$url")
  echo "$url → $code"
done
```

Toutes doivent retourner 200.

### 15.4 Produit `PHASE-11-SMOKE-PROD-FINAL.md`

```markdown
# Smoke prod final 2026-05-18

## V1 (flag OFF default)
- /fr/<adminSlug>/login → 200 ✅
- /fr/<adminSlug>/ → 200/302 (auth redirect) ✅
- /api/health → OK ✅

## V2 (cookie admin_v2=1)
- /fr/<adminSlug>/login → 200 ✅
- ...

## Routes Lighthouse pilotes
- /fr/ → 200 ✅
- /fr/interventions → 200 ✅
- ...

## Verdict smoke
- 🟢 100 % vert → succès complet.
- 🟡 1+ fail → Phase 10 nouvelle itération.
```

Si 🟡 → retour Phase 10 cycle suivant (jusqu'à plafond §14.8).

---

## 16. PHASE 12 — VERDICT FINAL + LIVRABLES

### 16.1 Produit `VERDICT-FINAL-AUTOPILOT.md`

```markdown
# VERDICT FINAL — Autopilot end-to-end refonte admin (2026-05-18)

## Score post-fix /2000
- Calculé : XXX / 2000 (XX.X %)
- Cible : 1700 / 2000 (85 %) ✅/❌

## Déploiement
- Pipeline final : SUCCESS ✅
- Run ID : <ID>
- Smoke prod V1 : 🟢
- Smoke prod V2 : 🟢
- Cycles self-healing Phase 10 : <N>

## §3 non-négociables — table 16/16
(reprendre table Phase 3 + mises à jour post-fix)

## Bilan fixes appliqués
- Phase 4 : <N> P0 + <M> P1
- Phase 6 : <N> findings #1
- Phase 10 : <N> fixes deploy

## P2 résiduels (post-deploy)
- ...

## Activation V2 prod recommandée
1. Cookie admin_v2=1 sur ton navigateur → preview ta session.
2. Smoke ton workflow daily 24h.
3. Si OK → flip env var Coolify ADMIN_V2_ENABLED=true → restart.
4. Smoke prod global 1h.
5. Si ECG OK → terminé. Sinon : rollback (delete env var + restart).

## URL prod
- https://app.axion-ia.com
- Login admin : /fr/<adminSlug>/login

## Tags produits cette session
- admin-refonte-fix-001-... à 0XX-... (Phase 4)
- admin-refonte-fix-redux-... (Phase 6 si applicable)
- admin-refonte-deploy-<DATE>-success (Phase 11 final)
```

### 16.2 Produit `EXEC-SUMMARY-WILL-FINAL.md`

≤ 150 lignes. Format Will (non-tech). Inclus :

- TL;DR en 5 lignes (🟢 succès complet + chiffres clés).
- Timeline (durée par phase).
- Actions Will recommandées (3 max).
- URL prod + login.
- Lien vers tous les livrables (MANIFEST).

### 16.3 Mise à jour mémoire

Crée mémoire `axionia_admin_refonte_deploy_complete_2026-05-18.md` + ajoute ligne MEMORY.md.

Marquer `axionia_admin_refonte_complete_2026-05-17.md` comme remplacé.

---

## 17. STRUCTURE COMPLÈTE DES LIVRABLES

```
axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/
├── README.md                                       (orientation lecteur)
├── 00-REALITY-CHECK.md                             (Phase 0)
├── 01-AUDIT-PATTERN-CONFORMITE.md                  (Phase 1 A1)
├── 02-AUDIT-SENTRY.md                              (Phase 1 A2)
├── 03-AUDIT-ACTIVITY-LOG.md                        (Phase 1 A3)
├── 04-AUDIT-CSP-NONCE.md                           (Phase 1 A4)
├── 05-AUDIT-FORCE-DYNAMIC.md                       (Phase 1 A5)
├── 06-AUDIT-SERVER-ACTIONS.md                      (Phase 1 A6)
├── 07-AUDIT-PRISMA-RLS.md                          (Phase 1 A7)
├── 08-AUDIT-SSE-CONTRATS.md                        (Phase 1 A8)
├── 09-AUDIT-ISOLATION-ADMIN-UI.md                  (Phase 1 A9)
├── 10-AUDIT-TESTS-VITEST.md                        (Phase 1 A10)
├── 11-AUDIT-GATES-SANTE.md                         (Phase 1 A11)
├── 12-AUDIT-ACTIVATION-V2.md                       (Phase 1 A12)
├── SYNTHESE-PHASE-1.md                             (Phase 2)
├── VERDICT-PHASE-3-INITIAL.md                      (Phase 3)
├── PHASE-4-FIX-LOG.md                              (Phase 4)
├── VERIFICATION-COMPLEMENTAIRE-1.md                (Phase 5)
├── PHASE-6-FIX-DELTA-LOG.md                        (Phase 6, opt)
├── VERIFICATION-COMPLEMENTAIRE-2.md                (Phase 7)
├── PHASE-8-PUSH-LOG.md                             (Phase 8)
├── PHASE-9-DEPLOY-MONITOR.md                       (Phase 9)
├── PHASE-10-SELF-HEALING-LOG.md                    (Phase 10, opt)
├── PHASE-11-SMOKE-PROD-FINAL.md                    (Phase 11)
├── VERDICT-FINAL-AUTOPILOT.md                      (Phase 12 principal)
├── EXEC-SUMMARY-WILL-FINAL.md                      (Phase 12 résumé Will)
└── MANIFEST.md                                     (table des matières)
```

**Total attendu** : 24-26 fichiers. Volume cumulé : 3 000-6 000 lignes Markdown.

---

## 18. SCORING /2000 — FORMULE

À la fin de Phase 12, le score doit être **calculé à la main** (pas copié) :

```
Score_pondéré = (Σ (score_brut_audit_i × poids_i) / Σ poids_i) × 2000 / 200
```

Poids §5.1 : (2+3+3+3+3+3+3+3+1+2+2+1) = 29.

**Bonus +30 pts par P0 ou P1 fixé proactivement** (transparence audit).
**Bonus +50 pts si déploiement réussi du premier coup** (qualité pipeline).
**Malus -300 pts par violation §3** master prompt détectée et non-fixée.

---

## 19. ANTI-HALLUCINATION GUARDRAILS

### 19.1 Forbidden patterns

❌ « tous les tests passent » sans output Vitest collé.
❌ « 116 routes » sans `find ... | wc -l` output réel.
❌ « 0 régression » sans `git diff --stat` cité.
❌ « pipeline succès » sans `gh run view` output joint.
❌ « score 1753/2000 » sans calcul détaillé reproductible.
❌ « smoke prod vert » sans `curl -I` output joint.

### 19.2 Required citations

✅ Cite SHA quand tu parles d'un commit (`52494bd`, pas « PR 10 »).
✅ Cite chemin complet quand tu parles d'un fichier.
✅ Cite numéro de ligne quand tu pointes une instruction.
✅ Cite la commande exacte + son output réel.
✅ Cite tag git quand tu parles d'une plage (`baseline..pr12-end`).
✅ Cite Run ID GH Actions quand tu parles d'un déploiement.

### 19.3 Marquage 🟡 UNVERIFIED

Si tu ne peux pas vérifier (accès Coolify API, dev server local, secret prod inaccessible), marque **🟡 UNVERIFIED — raison**. Ne fabrique JAMAIS.

---

## 20. CADRE TEMPOREL

| Phase                          | Effort typique | Plafond |
| ------------------------------ | -------------- | ------- |
| Phase 0 reality check          | 30 min         | 1 h     |
| Phase 1 (12 agents parallèles) | 30-45 min      | 1.5 h   |
| Phase 2 synthèse               | 45 min         | 1.5 h   |
| Phase 3 verdict initial        | 30 min         | 1 h     |
| Phase 4 fix P0+P1              | 1-3 h          | 4 h     |
| Phase 5 vérif #1               | 30 min         | 1 h     |
| Phase 6 fix delta              | 0-2 h          | 3 h     |
| Phase 7 vérif #2               | 30 min         | 1 h     |
| Phase 8 push + tags            | 10 min         | 30 min  |
| Phase 9 monitor deploy         | 30 min         | 1 h     |
| Phase 10 self-healing          | 0-3 h          | 4 h     |
| Phase 11 smoke prod            | 15 min         | 30 min  |
| Phase 12 verdict final         | 30 min         | 1 h     |
| **TOTAL TYPIQUE**              | **5-8 h**      |         |
| **TOTAL PLAFOND**              | **20 h**       |         |

Si > 20 h cumulé → STOP & ASK §28.

---

## 21. RÈGLES DE COMMITS — RAPPELS DURS

- ✅ Conventional Commits (`feat(admin):`, `fix(admin):`, `docs(...)`, etc.).
- ✅ Header ≤ 100 chars (commitlint header-max-length).
- ✅ Body explicite (root cause + fix + gates verts).
- ✅ Co-Authored-By: Claude Opus 4.7 (1M context).
- ✅ Pre-commit hooks DOIVENT passer (lint-staged + husky).
- ✅ commit-msg hook (commitlint) DOIT passer.
- ❌ `--no-verify` JAMAIS.
- ❌ `--amend` sur un commit déjà pushé (nouveau commit à la place).
- ❌ Commit `.env*` ou secrets.
- ❌ Commit binaires > 1 MB sans justification.

---

## 22. RÈGLES DE TAGS

- Format : `admin-refonte-fix-<NN>-<slug-court>-{start,end}`.
- `admin-refonte-deploy-<YYYY-MM-DD>-success` une fois Phase 11 verte.
- Tous push remote via `git push origin --tags` Phase 8.

---

## 23. RÈGLES DE PUSH

- ✅ `git push origin main` (rebase si non-FF).
- ✅ `git push origin --tags` (mais pas `--force`).
- ❌ `git push --force` jamais.
- ❌ `git push --no-verify` jamais.
- ❌ `git push -u other-branch` jamais (on travaille sur main).

---

## 24. RÈGLES DE FIX (qualité du code)

Master prompt §13 anti-patterns rappelés :

- Pas d'over-engineering. Just-fix-the-bug.
- Pas de refacto opportuniste lors du fix.
- Pas de feature creep (« tant que je suis là, j'améliore X »).
- Pas de commentaires explicatifs WHAT (le code parle).
- Comments WHY uniquement si non-obvious.
- Pas de réinvention d'une primitive existante (utiliser admin/ui/**).
- Pas de dependance npm > 30 KB gz sans STOP §28.
- Pas d'inline style/script (CSP nonce).
- Pas de revalidate sur route admin.
- Pas de touch Server Action signature.
- Pas de touch Prisma schema.

---

## 25. MONITORING & PROGRESSION

À chaque phase, **annonce en ≤ 1 phrase** :
- Phase courante.
- Action en cours.
- ETA estimée.

Exemple :
> Phase 4/12. Fix de FINDING-P0-002 (Sentry tag retiré accidentellement dans content-gen/_v2/JobsListV2.tsx). ETA 10 min.

Pas de narration excessive. Va aux résultats.

---

## 26. ROLLBACK SAFETY NETS

Niveaux de rollback disponibles :

1. **Niveau 1 (instant)** : Coolify env var `ADMIN_V2_ENABLED` retiré ou false → restart container. V1 redevient default. 0 perte.
2. **Niveau 2 (rapide)** : `git revert <SHA>` du commit problématique + push. Le pipeline déploie le revert.
3. **Niveau 3 (radical)** : `git revert` toute la plage `baseline..HEAD` (multi-commits) — **NÉCESSITE STOP §28**.
4. **Niveau 4 (catastrophe)** : Coolify dashboard → rollback to previous image tag (last green deploy). **NÉCESSITE STOP §28**.

Niveau 1 est ton premier réflexe en cas d'incident V2.
Niveaux 2-4 nécessitent diagnostic préalable.

---

## 27. PLAFONDS DE SÉCURITÉ AUTOPILOT

- ⏱️ **Temps total cumulé** : ≤ 20 h.
- 🔁 **Cycles fix Phase 10** : ≤ 10.
- 🔧 **Fixes Phase 4 + 6** : ≤ 30.
- 💸 **Coût tokens** : pas de plafond imposé (autorisation Will).
- 🧪 **Tests Vitest** : doivent rester ≥ 945 passed (baseline) à la fin.
- 📊 **Score final** : doit être ≥ 1700 / 2000 final (cible §4).

Si un plafond est dépassé → STOP §28.

---

## 28. STOP & ASK CONDITIONS (les 4 SEULS cas catastrophiques)

🛑 **Tu STOP & ASK uniquement si** :

### Cas 1 — Plafonds de sécurité §27 atteints

- Temps > 20 h.
- Phase 10 cycle 10 atteint sans succès.
- 30+ fixes Phase 4 (signal de chaos).
- Test count < 945 et baisse non-justifiable.

### Cas 2 — Non-négociable §3 master prompt nécessairement touché

- Fix nécessite modifier signature Server Action.
- Fix nécessite modifier `prisma/schema.prisma`.
- Fix nécessite supprimer/renommer une route admin existante.
- Fix nécessite supprimer un call `logActivity()` / `Sentry.setTag()` / `data-sentry-component`.

### Cas 3 — Dépendance majeure / sécurité

- Fix nécessite ajout dep npm > 30 KB gz.
- Fix nécessite modif workflow GH Actions critique non-anticipée.
- Fix nécessite modif env var Coolify avec impact prod immédiat (DATABASE_URL, AUTH_SECRET, etc.).
- Détection fuite de secret dans un commit existant.

### Cas 4 — Risque données prod

- Coolify deploy échoue sur `prisma migrate deploy` avec conflit.
- Détection que la DB prod a divergé du schéma attendu.
- Symptôme de fuite de données ou faille auth.
- Demande de `git push --force` sur main pour résoudre.
- Demande de rollback Niveau 3/4.

**Dans tout autre cas** → diagnostique + fix + continue. Pas d'arrêt.

---

## 29. ANTI-PATTERNS À ÉVITER (rappels durs)

❌ Lancer `pnpm build` local pour valider (lent + ADR 0026 délègue à GH Actions).
❌ Lancer `pnpm test:e2e:admin` (besoin dev server + seed humain — sauf si Phase 0 le permet).
❌ Spawner > 12 sous-agents en parallèle.
❌ Modifier les docs `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/**` avant Phase 7.5 (claim sous audit, immutable Phase 0-6).
❌ Push tags via `--force`.
❌ Force-push sur main.
❌ Commit `--no-verify`.
❌ Rebase interactif (-i).
❌ Bypass lint-staged hooks.
❌ Modifier `axionia/CLAUDE.md` / `AGENTS.md`.
❌ Toucher magic string `stub.invalid` sans propager.

---

## 30. CHECKLIST DE FIN D'AUTOPILOT

À cocher avant déclarer 🟢 SUCCESS :

```
[ ] Phase 0 reality check produit + assertions OK
[ ] 12 audits parallèles spawnés + complets (12 fichiers 01-12)
[ ] Phase 2 synthèse + scoring brut /2000
[ ] Phase 3 verdict initial + liste P0/P1/P2
[ ] Phase 4 fix tous P0 + P1 (commits atomiques + tags)
[ ] Phase 5 vérif #1 → 0 finding OR Phase 6 traité
[ ] Phase 6 fix delta complet (si applicable)
[ ] Phase 7 vérif #2 → 0 finding final
[ ] Mise à jour VERDICT-FINAL.md + EXEC-SUMMARY-WILL.md sub-repo
[ ] Phase 8 push origin/main + push --tags
[ ] Phase 9 monitor pipeline → SUCCESS
[ ] Phase 10 self-healing complete (0+ cycles)
[ ] Phase 11 smoke prod V1 vert
[ ] Phase 11 smoke prod V2 (cookie) vert
[ ] Phase 12 VERDICT-FINAL-AUTOPILOT.md produit
[ ] EXEC-SUMMARY-WILL-FINAL.md produit
[ ] MANIFEST.md produit
[ ] Mémoire `axionia_admin_refonte_deploy_complete_2026-05-18.md` créée
[ ] MEMORY.md entrée ajoutée (≤ 200 chars)
[ ] Score final ≥ 1700 / 2000 ✅
[ ] 16 non-négociables §3 préservés ✅
[ ] Tag `admin-refonte-deploy-2026-05-18-success` posé sur HEAD ✅
```

---

## 31. POUR L'ORCHESTRATEUR — CHECKLIST DE DÉPART

Avant de spawner Phase 1, vérifie :

1. ✅ Lu intégralement ce prompt (~17k tokens).
2. ✅ Lu master prompt sub-repo (`axionia/CLAUDE.md` + `AGENTS.md`).
3. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md`.
4. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (claim à vérifier).
5. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md`.
6. ✅ Lu `axionia/docs/adr/0028-admin-design-system-v1.md` (rapide).
7. ✅ Vérifié accès `gh` CLI (`gh auth status`).
8. ✅ Vérifié accès `git push` (test : `git ls-remote origin` doit retourner).
9. ✅ Exécuté Phase 0 entièrement.
10. ✅ Créé répertoire `axionia/_AUDIT/ADMIN-REFONTE-VERIF-FIX-DEPLOY-2026-05-18/`.

Si une étape échoue → diagnostic + fix avant Phase 1. Pas de STOP automatique sauf §28.

---

## 32. RESSOURCES

- Master prompt original : `Axion-IA/_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`
- Prompt AUDIT-ONLY frère (référence) : `Axion-IA/_AUDIT/PROMPT-ADMIN-REFONTE-VERIFICATION-2026-05-18.md`
- Doctrine sub-repo : `axionia/CLAUDE.md`, `axionia/AGENTS.md`
- ADR 0026 (build externalisé) : voir CLAUDE.md
- ADR 0028 (design system admin) : `axionia/docs/adr/0028-admin-design-system-v1.md`
- Pattern templates : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md`
- Plan implémentation : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md`
- Mémoires session 2026-05-17 : `axionia_admin_refonte_complete_2026-05-17.md`, `axionia_deploy_recovery_2026-05-17.md`

---

## 33. PHRASE D'INVOCATION (rappel pour Will)

Dans une **nouvelle conversation Claude Code** (terminal local ou web), démarre avec cette phrase :

```
Exécute en autopilot complet bout-en-bout le prompt
_AUDIT/PROMPT-ADMIN-REFONTE-VERIFY-FIX-DEPLOY-AUTOPILOT-2026-05-18.md.
Phases 0→10 séquentielles, vérification + fix + 2× re-vérification + push +
déploiement, boucle de diagnostic jusqu'à smoke prod vert à 100 %.
Autorisation explicite Will déjà donnée. NE PAS S'ARRÊTER sauf 4 cas
catastrophiques §28. Confirme par « GO autopilot » et démarre Phase 0.
```

L'agent doit répondre par « GO autopilot » et démarrer la Phase 0 immédiatement, sans demander de confirmation supplémentaire.

---

**Fin du prompt.** Toute déviation à ce cadre doit être tracée dans un STOP & ASK explicite §28 ou un addendum dans `00-REALITY-CHECK.md`.
