# PROMPT — Vérification end-to-end refonte admin Axion-IA (Sprint 0 → PR 14)

> **Type** : Audit AUDIT-ONLY (lecture-seule code, écriture rapports uniquement).
> **Mode** : Autopilot orchestrateur + 12 sous-agents Explore en parallèle.
> **Cible** : 0 P0 résiduel + 0 régression mesurable + 0 violation §3 master prompt + score pondéré ≥ 1700/2000 confirmé indépendamment.
> **Date prompt** : 2026-05-18.
> **Auteur prompt** : Claude Opus 4.7 (1M context).
> **Format prompt** : self-contained, best-practices 2026 (plan-and-execute + reality-check + multi-agent + anti-hallucination).

---

## 0. INVOCATION PHRASE (à copier-coller pour démarrer)

```
Audite end-to-end la refonte admin Axion-IA selon
_AUDIT/PROMPT-ADMIN-REFONTE-VERIFICATION-2026-05-18.md. Mode AUDIT-ONLY,
12 sous-agents parallèles, livrables _AUDIT/ADMIN-REFONTE-VERIFICATION-
2026-05-18/. Réponds STOP & ASK uniquement sur les 4 cas §17.
```

---

## 1. CONTEXTE (self-contained, lis bien avant de commencer)

Tu es invoqué pour vérifier **end-to-end** une refonte admin livrée entre le 2026-05-09 et 2026-05-17 (sub-repo `C:\Users\willi\Documents\Projets\Axion-IA\axionia`, branche `main`, pushée sur `origin/main`).

### 1.1 Ce qui a été livré (claim à vérifier indépendamment)

- **15 PRs livrées** (PR 0 → PR 14), 27+ commits, ~250 fichiers touchés, ~16 100 LOC ajoutés.
- **116 routes admin V2** prêtes derrière feature flag `ADMIN_V2_ENABLED` (default false → V1 toujours rendue).
- **32 primitives** `src/components/admin/ui/**` (28 PR 2-4 + 4 polish PR 12).
- **3 helpers stub/scaffold** (`AdminListScaffold`, `AdminFilterTabs`, `AdminStubPageV2`).
- **Score pondéré 1753 / 2000 (87.7 %)** annoncé vs cible ≥ 1700 (85 %).
- **0 régression** annoncée. **945/945** tests Vitest (vs 887 baseline = +58).
- **Tags git** : `admin-refonte-baseline-2026-05-17` (avant tout) → `admin-refonte-pr14-end` (HEAD).
- **HEAD actuel** : `1cd3d5f docs(admin-refonte): closure session 2026-05-17 soir post pr 12`.

### 1.2 Documents de référence (à lire avant la Phase 0)

- **Master prompt initial** : `Axion-IA/_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md` (la doctrine, ~1200 lignes).
- **Plan implémentation** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md` (PR 0-14 spec).
- **ADR 0028** : `axionia/docs/adr/0028-admin-design-system-v1.md`.
- **Patterns templates** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md`.
- **Verdict claim** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (à VÉRIFIER, pas à croire).
- **Anti-régression claim** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md` (à VÉRIFIER).
- **Exec summary** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/EXEC-SUMMARY-WILL.md`.
- **Journal SHA** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/JOURNAL.md`.
- **Liste commits** : `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/LISTE-COMMITS-LOCAUX-PRETS.md`.

### 1.3 Stack technique (rappel)

- **Next.js 16** App Router + React 19 (RSC + Server Actions).
- **Prisma 5.22** + Postgres 16 + Redis (BullMQ workers).
- **Auth.js v5** (session strategy `jwt`, MFA TOTP).
- **Sentry** (instrumentation.ts + sentry.*.config.ts), **logActivity** helper.
- **CSP nonce** + COEP (Sprint 24). **force-dynamic** sur toutes routes admin.
- **next-intl v4.11** (FR canonique, EN désactivé runtime cf. CLAUDE.md).
- **Vitest** + **Playwright** + **Lighthouse CI** + **size-limit**.
- **Pipeline** : push main → GH Actions build → GHCR pull → Coolify deploy → CF purge → LHCI gate.

### 1.4 ⚠️ Pré-requis dur (BLOQUANT)

Tu travailles **sur l'état actuel du repo** (HEAD `1cd3d5f`). Si une réalité observée diffère de ce qui est documenté, **fais confiance à la réalité, jamais à la documentation**. Marque les écarts.

---

## 2. MISSION

Vérifier que la refonte admin v2 est **réellement** :

1. **Complète** : 116 routes admin migrées V2 (pas 100, pas 120 — exactement 116, à compter).
2. **Sans régression** : V1 byte-pour-byte inchangée (flag default false), V2 fonctionnelle (flag true / cookie admin_v2=1).
3. **Conforme §3** : 16 non-négociables master prompt préservés.
4. **Testée** : 945/945 vitest + 0 erreur typecheck/lint/anti-hex/use-client/anti-siren.
5. **Bien architecturée** : cloisonnement admin/ui/** respecté, primitives non leakées en public, helpers stub correctement isolés.
6. **Score justifié** : la décomposition 1753/2000 est cohérente avec les livrables observés.
7. **Push synchronisé** : origin/main reflète exactement le local, aucune divergence.
8. **Tags propres** : 30+ tags `admin-refonte-*-start/end`, aucun orphelin, baseline immutable.

**Hors scope** :
- ❌ Lancer un build prod (délégué GH Actions).
- ❌ Lancer Playwright e2e (nécessite dev server + seed humain).
- ❌ Modifier du code (AUDIT-ONLY).
- ❌ Réviser la pertinence du design (`PATTERNS.md` est la doctrine, on vérifie l'application).

---

## 3. MODE OPÉRATOIRE

### 3.1 Doctrine

- **Lecture seule** sur `axionia/src/**`, `axionia/prisma/**`, `axionia/scripts/**`, `axionia/.github/**`.
- **Écriture autorisée** : `axionia/_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/**` uniquement.
- **Pas de commit** par les sous-agents. L'orchestrateur fait UN seul commit final `docs(admin-refonte): verification end-to-end 2026-05-18` après acceptation Will (si non-autopilot) ou auto (si autopilot).
- **Pas de push** sans signal humain explicite.

### 3.2 Outils autorisés

- `Read`, `Glob`, `Grep` (massif).
- `Bash` pour : `git log/diff/show/tag`, `npx tsc --noEmit`, `npx eslint`, `npx vitest run --reporter`, `pnpm anti-hex:check`, `pnpm use-client:check`, `pnpm anti-siren:check`, `pnpm image-bank:isolation-check`, `pnpm content-gen:isolation-check`.
- `Agent` (sous-agent `Explore` ou `general-purpose`) pour les 12 audits parallèles.
- **Pas de** `Write`/`Edit` sur le code de prod. **Pas de** `Bash` qui mute (`git commit`, `pnpm install`, `prisma migrate`, etc.).

### 3.3 Anti-hallucination (RÈGLES DURES)

- **Cite-don't-guess** : chaque claim doit pointer vers un SHA, un chemin de fichier, un numéro de ligne, ou une commande grep avec output réel.
- **Si tu ne peux pas vérifier, marque 🟡 UNVERIFIED** + raison. Ne fabrique JAMAIS un chiffre/path/SHA.
- **Compte exact** : si tu écris « 116 routes », `find ... | wc -l` doit le confirmer. Sinon mets « ~XXX » et explique.
- **Pas de copier-coller du VERDICT-FINAL.md** : tes chiffres viennent de ta vérification, pas de la doc.
- **Pas de « j'ai testé » sans output joint** : copie l'output ou marque 🟡.

---

## 4. CIBLE & CRITÈRES DE SUCCÈS

### 4.1 Score global /2000 (à recalculer indépendamment)

| Catégorie                         | Poids | Cible /200    | Justification                                              |
| --------------------------------- | ----- | ------------- | ---------------------------------------------------------- |
| C1 — Inventaire & comptage        | ×1    | 200           | Routes V2 comptées exactement, primitives énumérées        |
| C2 — Conformité pattern           | ×2    | 400           | Pattern PR 6 reproduit fidèlement sur 116 routes           |
| C3 — Cross-checks §C              | ×3    | 600           | Sentry/logActivity/nonce/force-dynamic/SSE intacts         |
| C4 — Gates santé code             | ×2    | 400           | tsc/lint/tests/anti-hex/use-client/isolation               |
| C5 — Non-négociables §3           | ×3    | 600           | 16/16 préservés                                            |
| C6 — Architecture/cloisonnement   | ×1    | 200           | admin/ui isolation, V1↔V2 séparés                          |
| C7 — Activabilité V2              | ×1    | 200           | Flag effectif, cookie route fonctionnel, no leak           |
| C8 — Tags & push sync             | ×0.5  | 100           | 30+ tags, origin/main sync, baseline immutable             |
| C9 — Documentation cohérente      | ×0.5  | 100           | JOURNAL/VERDICT/EXEC-SUMMARY non auto-contradictoires      |

**Total** : 2 800 pts bruts × poids → normalisé /2000.

### 4.2 Verdict global

- **≥ 1700 / 2000 (85 %)** : 🟢 GO — refonte certifiée prête activation prod.
- **1400-1699 / 2000 (70-84 %)** : 🟡 CONDITIONAL — gaps P1 à fix.
- **1000-1399 / 2000 (50-69 %)** : 🟠 SPRINT CORRECTIF — gaps P0+P1.
- **< 1000 / 2000** : 🔴 NO-GO — STOP & ASK Will (improbable).

### 4.3 Bonus / malus

- **Malus -300 pts par violation §3** détectée (master prompt §10).
- **Bonus +50 pts** si écart documentation/réalité **détecté ET corrigé proactivement** dans tes livrables.
- **Bonus +30 pts** par P1 résiduel identifié dans les claims du verdict (signal honnêteté audit).

---

## 5. PHASE 0 — REALITY CHECK (BLOQUANT, ~30 min)

Avant de lancer les 12 audits parallèles, tu DOIS produire `_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/00-REALITY-CHECK.md` avec les vérifications suivantes :

### 5.1 État git

```bash
cd C:/Users/willi/Documents/Projets/Axion-IA/axionia
git rev-parse HEAD                                          # attendu: 1cd3d5f
git status --short                                          # attendu: ?? .claude/worktrees/, ?? _AUDIT/PROMPT-DEPLOY...
git log admin-refonte-baseline-2026-05-17..HEAD --oneline | wc -l   # attendu: 27+
git tag | grep "admin-refonte-" | wc -l                     # attendu: 30+
git rev-list --count origin/main..HEAD                      # attendu: 0 (sync)
git rev-list --count HEAD..origin/main                      # attendu: 0 (sync)
```

Tout écart → marque ❌ et documente le delta.

### 5.2 Working tree propreté

```bash
git diff --stat HEAD                                        # attendu: vide
git diff --staged                                           # attendu: vide
```

### 5.3 Comptage routes admin (vérité)

```bash
find "src/app/[locale]/(admin)/[adminPrefix]" -type f -name "page.tsx" | wc -l
# Note attendue : 116. Si différent, signal exact comptage observé.
```

### 5.4 Comptage V2 components

```bash
find "src/app/[locale]/(admin)/[adminPrefix]" -type d -name "_v2" | wc -l
find "src/app/[locale]/(admin)/[adminPrefix]" -type f -path "*/_v2/*.tsx" | wc -l
```

Vérifie qu'**il y a exactement autant de page.tsx wired V2 que de routes** (= 116 OU avec exceptions documentées comme `geo/batches/[id]` redirect).

```bash
grep -rln "isAdminV2Enabled" "src/app/[locale]/(admin)/[adminPrefix]" --include="page.tsx" | wc -l
# Doit être 116 (toutes les routes ont le early-return V2).
# Note: layout.tsx peut aussi l'avoir, ne le compte pas.
```

### 5.5 Comptage primitives admin/ui

```bash
ls src/components/admin/ui/*.tsx | grep -v ".test.tsx" | wc -l
# Attendu: 32 primitives (28 PR 2-4 + 4 polish PR 12).
ls src/components/admin/ui/*.test.tsx | wc -l
# Attendu: ~14 test files (≈50 tests primitives + 8 PR 12).
```

### 5.6 Validité du flag

Lis `src/lib/feature-flags.ts` et vérifie :

- Export `isAdminV2Enabled()` async.
- Lit cookie `admin_v2=1` OU env `ADMIN_V2_ENABLED === "true"`.
- Default `false` quand aucun des deux n'est set.

### 5.7 Tag baseline immuable

```bash
git rev-parse admin-refonte-baseline-2026-05-17
# Attendu: 568d92e^ ou ancêtre direct (avant PR 1).
git log --oneline admin-refonte-baseline-2026-05-17..HEAD | tail -1
# Premier commit après baseline (devrait être pr0/pr1 setup).
```

### 5.8 STOP & ASK Phase 0

Si **3 ou plus** des assertions Phase 0 échouent (état git divergent, working tree sale, comptes incohérents), STOP & ASK Will avant de lancer la Phase 1. Sinon, continue.

---

## 6. PHASE 1 — 12 AUDITS PARALLÈLES (sous-agents Explore)

Tu spawnes **12 sous-agents `Explore` (ou `general-purpose` si Explore indisponible) en parallèle, dans un seul message multi-tool-uses**.

Chaque sous-agent reçoit :
- Briefing self-contained (~100-300 lignes selon scope).
- Périmètre exact + commandes à exécuter + chemins à lire.
- Format de livrable strict.
- Délai indicatif (~20-40 min par agent).

### 6.1 Audit A1 — Pattern Conformité 116 routes

**Fichier livrable** : `01-AUDIT-PATTERN-CONFORMITE.md`

**Brief** :
> Lis `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/PATTERNS.md` (template pattern). Puis pour chaque `page.tsx` admin avec `isAdminV2Enabled`, vérifie :
> 1. Imports `isAdminV2Enabled` + `<PageV2>` présents.
> 2. Early-return `if (await isAdminV2Enabled()) return <PageV2 ... />;` AVANT le `return (` V1.
> 3. V2 component dans `_v2/PageV2.tsx` (ou `_v2/AdminStubPageV2` import via helper partagé).
> 4. V1 code en-dessous du early-return inchangé byte-pour-byte (compare avec tag start de la PR concernée via `git diff tag-start..HEAD -- chemin/page.tsx`).
>
> Output : tableau Markdown avec une ligne par route (116 lignes), colonnes : route / PR (par git log/blame) / pattern conforme (✓/✗) / déviation (si ✗).
>
> Quantifie : nombre routes 100% conformes / déviations P0 / déviations P1.

**Score /200** : (conformes / total) × 200.

### 6.2 Audit A2 — Sentry preservation diff baseline..HEAD

**Fichier livrable** : `02-AUDIT-SENTRY.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- 'src/**/*.tsx' 'src/**/*.ts' | head -20
> git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.tsx' 'src/**/*.ts' | grep -E '^[\+\-].*Sentry\.'
> ```
> Liste toutes les lignes Sentry.* ajoutées ou retirées.
>
> Vérification :
> 1. Aucune ligne `Sentry.setTag()`, `Sentry.setContext()`, `Sentry.addBreadcrumb()`, `Sentry.captureException()` retirée.
> 2. Aucun `data-sentry-component` retiré.
> 3. Les ajouts (ex: PR 3 error.tsx admin) sont **enrichissements documentés**, pas remplacements.
>
> Vérifie aussi `src/instrumentation.ts`, `src/sentry.*.config.ts` : 0 modif attendue.
>
> Output : liste exhaustive ajouts/retraits + verdict §3.1.

**Score /200** : 200 si 0 retrait + ajouts justifiés, sinon -50 par ligne Sentry retirée injustifiée.

### 6.3 Audit A3 — ActivityLog / logActivity preservation

**Fichier livrable** : `03-AUDIT-ACTIVITY-LOG.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.tsx' 'src/**/*.ts' | grep -E '^[\+\-].*(logActivity|ActivityLog\.create)'
> grep -rn "logActivity\|ActivityLog\.create" src/server/actions src/features --include="*.ts" | wc -l
> # Doit retourner ≥ 26 (baseline)
> ```
>
> Vérifie :
> 1. Aucune Server Action mutante (POST/PATCH/DELETE) ne perd son call `logActivity(...)` ou `ActivityLog.create(...)`.
> 2. La table audit `ActivityLog` schema Prisma intacte (`git diff baseline..HEAD -- prisma/schema.prisma | wc -l` = 0).
>
> Output : count occurrences avant/après + tableau Server Actions admin avec logActivity présent.

**Score /200** : 200 si count baseline = count HEAD, 0 si retraits non justifiés.

### 6.4 Audit A4 — CSP nonce + inline style/script

**Fichier livrable** : `04-AUDIT-CSP-NONCE.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD -- 'src/**/*.tsx' | grep -E '^[\+].*(<style|<script|dangerouslySetInnerHTML)'
> ```
>
> Pour chaque hit :
> 1. Identifie le fichier + ligne + commit SHA.
> 2. Vérifie : est-ce du serveur sanitizé ? Si dangerouslySetInnerHTML, le HTML provient-il d'une source de confiance (sanitizeTiptapHtml, etc.) ?
> 3. Vérifie qu'aucun `<style>` ou `<script>` n'a été introduit sans `nonce={headers().get('x-nonce')}`.
>
> Vérifie `proxy.ts` / `middleware.ts` / `instrumentation-client.ts` : CSP headers inchangés (`git diff baseline..HEAD -- src/proxy.ts src/middleware.ts src/instrumentation-client.ts | wc -l` = 0 ou seulement comments).
>
> Output : liste exhaustive + verdict pour chaque hit (PRESERVATION V1 / VIOLATION / NEW NONCE).

**Score /200** : -50 pts par violation CSP (=script/style sans nonce introduit).

### 6.5 Audit A5 — force-dynamic + revalidate sur routes admin

**Fichier livrable** : `05-AUDIT-FORCE-DYNAMIC.md`

**Brief** :
> Exécute :
> ```bash
> grep -rn "export const dynamic\|export const revalidate" "src/app/[locale]/(admin)/[adminPrefix]" --include="page.tsx" --include="layout.tsx" | sort
> ```
>
> Vérifie :
> 1. **Toutes les 116 routes** ont `export const dynamic = "force-dynamic"` OU héritent du layout (qui doit l'avoir).
> 2. Aucune route admin n'a `export const revalidate = N` (ISR interdit sur admin).
> 3. `axionia/src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` a bien `export const dynamic = "force-dynamic"`.
>
> Output : tableau routes / mode rendering / verdict.

**Score /200** : 200 si toutes en force-dynamic. -50 pts par route en revalidate.

### 6.6 Audit A6 — Server Actions inchangées + signatures

**Fichier livrable** : `06-AUDIT-SERVER-ACTIONS.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- 'src/server/actions/**' 'src/features/**/actions.ts'
> # Attendu: vide ou seulement ajouts additifs documentés
> ```
>
> Pour chaque fichier `actions.ts` modifié :
> 1. Liste les fonctions exportées avant/après.
> 2. Vérifie signatures inchangées (params + return type).
> 3. Vérifie qu'aucun appel `'use server'` n'est ajouté inline dans `_v2/` V2 (V2 doit consommer V1 actions via imports).
>
> Vérification spécifique :
> ```bash
> grep -rn "'use server'" "src/app/[locale]/(admin)/[adminPrefix]/**/_v2/" | head -20
> # Attendu: 0 hit (sauf si helper documenté)
> ```
>
> Output : liste actions modifiées + diff signature + verdict.

**Score /200** : -100 pts par signature changée.

### 6.7 Audit A7 — Prisma schema + migrations + RLS

**Fichier livrable** : `07-AUDIT-PRISMA-RLS.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- prisma/
> # Attendu: vide
> ls prisma/migrations/ | wc -l
> # Compare avec baseline (note: utilise git show baseline:prisma/migrations 2>&1 | wc -l si besoin)
> ```
>
> Vérifie :
> 1. `prisma/schema.prisma` byte-pour-byte identique à baseline.
> 2. Aucune nouvelle migration créée pendant la refonte.
> 3. Aucun seed modifié (`prisma/seed.ts`, `prisma/seeds/**`).
> 4. Policies RLS dans `prisma/migrations/**/migration.sql` intactes (grep pour `CREATE POLICY`, `ALTER TABLE.*ENABLE ROW LEVEL SECURITY`).
>
> Output : liste fichiers prisma touchés (devrait être vide) + verdict.

**Score /200** : -100 pts par migration ajoutée pendant refonte, -50 pts par modif schema.

### 6.8 Audit A8 — SSE JobLogStream + GeoEventsBanner contracts

**Fichier livrable** : `08-AUDIT-SSE-CONTRATS.md`

**Brief** :
> Exécute :
> ```bash
> git diff admin-refonte-baseline-2026-05-17..HEAD -- \
>   'src/components/admin/content-gen/JobLogStream.tsx' \
>   'src/components/admin/content-gen/GeoEventsBanner.tsx' \
>   'src/app/api/content-gen/jobs/[id]/stream/route.ts' \
>   'src/app/api/content-gen/geo-events/route.ts' \
>   | wc -l
> # Attendu: 0
> ```
>
> Vérifie :
> 1. EventSource côté client : pas de modif (`grep -rn "new EventSource\|withCredentials" src/ | wc -l` = identique baseline).
> 2. Le V2 `JobsDetailV2` importe `JobLogStream` tel quel sans wrapper qui modifie le contrat.
> 3. Le V2 `GeoCockpitV2` importe `GeoEventsBanner` tel quel.
>
> Output : diff stats + grep results + verdict.

**Score /200** : -150 pts par modif SSE non versionnée.

### 6.9 Audit A9 — Cloisonnement admin/ui isolation

**Fichier livrable** : `09-AUDIT-ISOLATION-ADMIN-UI.md`

**Brief** :
> Exécute :
> ```bash
> # Trouver tout import de @/components/admin/ui ou ../admin/ui dans des fichiers HORS admin
> grep -rn "from ['\"].*components/admin/ui" src/ --include="*.tsx" --include="*.ts" | grep -v "src/components/admin/" | grep -v "src/app/\\[locale\\]/(admin)/"
> # Attendu: 0 hit
>
> grep -rn "from ['\"].*components/admin/image-bank" src/ --include="*.tsx" --include="*.ts" | grep -v "src/components/admin/" | grep -v "src/app/\\[locale\\]/(admin)/"
> # Attendu: 0 hit
> ```
>
> Vérifie aussi :
> 1. `src/components/admin/ui/index.ts` n'exporte rien depuis hors `./Admin*`.
> 2. Les tests `*.test.tsx` n'introduisent pas d'import public-side.
> 3. `scripts/content-gen/isolation-check.ts` + `scripts/image-bank/isolation-check.ts` passent OK (lance `pnpm content-gen:isolation-check` + `pnpm image-bank:isolation-check`).
>
> Output : liste leaks (devrait être vide) + verdict.

**Score /200** : -50 pts par leak.

### 6.10 Audit A10 — Tests Vitest, count, passing

**Fichier livrable** : `10-AUDIT-TESTS-VITEST.md`

**Brief** :
> Exécute :
> ```bash
> npx vitest run --reporter=verbose 2>&1 | tee /tmp/vitest-output.txt | tail -40
> ```
>
> Vérifie :
> 1. Test count total = **945 passed + 2 skipped** (claim VERDICT-FINAL).
> 2. Si différent, recompte les test files admin/ui (`ls src/components/admin/ui/*.test.tsx | xargs grep -E "(it|test)\\(" -c | awk -F: '{sum+=$2} END {print sum}'`).
> 3. Aucun test failed (EXIT 0).
> 4. Aucune flakiness signalée.
>
> Output : count exact + verdict + liste test files admin/ui avec count individuel.

**Score /200** : 200 si 945+ pass, baseline conservée (≥887), 0 fail. -100 pts par fail.

### 6.11 Audit A11 — Gates santé code (tsc / lint / anti-hex / use-client / anti-siren)

**Fichier livrable** : `11-AUDIT-GATES-SANTE.md`

**Brief** :
> Exécute en séquence :
> ```bash
> npx tsc --noEmit 2>&1 | tail -10; echo "tsc EXIT=$?"
> npx eslint 2>&1 | tail -10; echo "eslint EXIT=$?"
> # Note: eslint sur tout le repo, peut prendre 5-10 min
> pnpm anti-hex:check 2>&1 | tail -5; echo "anti-hex EXIT=$?"
> pnpm use-client:check 2>&1 | tail -5; echo "use-client EXIT=$?"
> pnpm anti-siren:check 2>&1 | tail -5; echo "anti-siren EXIT=$?"
> pnpm content-gen:isolation-check 2>&1 | tail -20; echo "EXIT=$?"
> pnpm image-bank:isolation-check 2>&1 | tail -20; echo "EXIT=$?"
> ```
>
> Vérifie :
> 1. tsc : 0 erreur.
> 2. eslint : 0 erreur (warnings pre-existants no-console workers OK, ne pas signaler).
> 3. anti-hex/use-client/anti-siren : OK.
> 4. content-gen:isolation-check : 7 violations PRE-EXISTANTES (vérifie sur tag `admin-refonte-pr1-start` = identique). Si > 7 ou nouvelles routes, c'est P1.
> 5. image-bank:isolation-check : 0 violation.
>
> Output : EXIT codes + tail outputs + verdict.

**Score /200** : -100 pts par gate failed. -50 pts par nouvelle violation isolation introduite.

### 6.12 Audit A12 — Activation V2 + feature flag effectif + V1 inchangée

**Fichier livrable** : `12-AUDIT-ACTIVATION-V2.md`

**Brief** :
> Vérifie 3 invariants :
>
> **Invariant 1** : Flag default false → V1 rendue.
> Lis `src/lib/feature-flags.ts`. Vérifie que `isAdminV2Enabled()` retourne `false` quand :
> - Pas de cookie `admin_v2` (utilise `cookies()` Next.js).
> - Pas d'env `ADMIN_V2_ENABLED` ou `ADMIN_V2_ENABLED !== "true"`.
>
> **Invariant 2** : Chaque route admin avec V2 a le pattern strict :
> ```
> if (await isAdminV2Enabled()) {
>   return <PageV2 ... />;
> }
> // V1 code...
> ```
>
> Vérifie sur 5 routes représentatives (1 par groupe : main, content-gen, image-bank, content, ops/système) :
> - `axionia/src/app/[locale]/(admin)/[adminPrefix]/page.tsx` (dashboard)
> - `axionia/src/app/[locale]/(admin)/[adminPrefix]/content-gen/jobs/page.tsx`
> - `axionia/src/app/[locale]/(admin)/[adminPrefix]/image-bank/library/page.tsx`
> - `axionia/src/app/[locale]/(admin)/[adminPrefix]/blog/page.tsx`
> - `axionia/src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx`
>
> Pour chacune, montre l'extract du flag-gate (5-10 lignes).
>
> **Invariant 3** : V1 code identique baseline → HEAD.
> Pour 3 pages prises au hasard, fais `git diff baseline..HEAD -- chemin/page.tsx` et vérifie que les hunks ne touchent QUE :
> - L'ajout d'imports (`isAdminV2Enabled`, `PageV2`).
> - L'ajout du bloc `if (await isAdminV2Enabled()) return <PageV2 ... />;`.
> - **JAMAIS** de modif dans le V1 (sous le early-return).
>
> Output : extraits code + verdict + alerte si modif V1.

**Score /200** : 200 si invariants 1+2+3 OK. -100 pts par invariant cassé.

### 6.13 Spawn parallèle

Dans **un seul message**, tu lances les 12 Agent calls en parallèle. Brief ~150-300 tokens chacun (self-contained, pas de référence circulaire au prompt master).

Attends que les 12 finissent (notification background). Récupère les 12 livrables.

---

## 7. PHASE 2 — SYNTHÈSE (~1h)

### 7.1 Fichier livrable : `SYNTHESE-PHASE-1.md`

Structure :

```markdown
# Synthèse Phase 1 — 12 audits parallèles

## Scoring par catégorie

| Audit              | Score brut | Poids | Score pondéré /200 |
| ------------------ | ---------- | ----- | ------------------ |
| A1 Pattern         | XXX        | ×2    | XXX                |
| A2 Sentry          | XXX        | ×3    | XXX                |
| A3 ActivityLog     | XXX        | ×3    | XXX                |
| A4 CSP nonce       | XXX        | ×3    | XXX                |
| A5 force-dynamic   | XXX        | ×3    | XXX                |
| A6 Server Actions  | XXX        | ×3    | XXX                |
| A7 Prisma RLS      | XXX        | ×3    | XXX                |
| A8 SSE contrats    | XXX        | ×3    | XXX                |
| A9 Isolation       | XXX        | ×1    | XXX                |
| A10 Tests Vitest   | XXX        | ×2    | XXX                |
| A11 Gates santé    | XXX        | ×2    | XXX                |
| A12 Activation V2  | XXX        | ×1    | XXX                |

**Total brut** : XXX / 2400 (12 × 200).
**Total pondéré** : XXX / 2000 (normalisé).
**Verdict** : 🟢/🟡/🟠/🔴 selon §4.2.

## Top findings (P0 / P1 / P2)

### P0 (bloquants, à fix avant activation)
- [ ] ...

### P1 (à fix court terme, pas bloquants)
- [ ] ...

### P2 (à fix éventuellement)
- [ ] ...

## Confirmations
- Claims vérifiés vs claims contestés (cf. VERDICT-FINAL.md scoring 1753/2000).
- Liste claims auto-référentiels où la doc disait X et la réalité observée disait Y.
```

### 7.2 STOP & ASK Phase 2

Si **score pondéré < 1400 / 2000 OU ≥ 3 P0 identifiés**, STOP & ASK Will avant la Phase 3 (le verdict diverge sérieusement du claim 1753/2000).

---

## 8. PHASE 3 — VERDICT FINAL & LIVRABLES

### 8.1 Fichier livrable : `VERDICT-FINAL-VERIFICATION.md`

Structure :

```markdown
# VERDICT FINAL — Vérification end-to-end refonte admin (2026-05-18)

## Score indépendant
- Calculé : XXX / 2000 (XX.X %)
- Claim VERDICT-FINAL.md : 1753 / 2000 (87.7 %)
- Écart : ±XX pts → justification

## Décisions
- 🟢 GO / 🟡 CONDITIONAL / 🟠 SPRINT CORRECTIF / 🔴 NO-GO

## Non-négociables §3 — table 16/16
| Item                                                  | Statut vérifié | Source preuve            |
| ----------------------------------------------------- | -------------- | ------------------------ |
| §3.1 Server Actions signatures inchangées             | ✓ / ✗          | Audit A6, ligne XXX      |
| §3.1 Routes admin pas renommées                       | ✓ / ✗          | Audit A1, ligne XXX      |
| §3.1 Prisma / RLS / workers intacts                   | ✓ / ✗          | Audit A7                 |
| §3.1 CSP nonce + COEP intacts                         | ✓ / ✗          | Audit A4                 |
| §3.1 logActivity audit trail préservé                 | ✓ / ✗          | Audit A3                 |
| §3.1 Sentry tags/breadcrumbs préservés                | ✓ / ✗          | Audit A2                 |
| §3.1 force-dynamic conservé                           | ✓ / ✗          | Audit A5                 |
| §3.2 globals.css @theme intouchable                   | ✓ / ✗          | git diff explicit        |
| §3.2 src/components/ui/** extensible only             | ✓ / ✗          | git diff explicit        |
| §3.3 No black pur / no emoji icons / italique terra   | ✓ / ✗          | grep tokens              |
| §3.4 First Load JS ≤ 75/120 KB gz                     | 🟡             | NON MESURÉ (GH Actions)  |
| §3.5 React 19 doctrine                                | ✓ / ✗          | Audit A1 spot-checks     |
| §3.6 Session expiry mitigation                        | ✓ / ✗          | grep AdminSessionExpiry  |
| §3.7 Multi-tab conflict mitigation                    | ✓ / ✗          | grep AdminConflictDialog |
| §3.8 Print mode                                       | ✓ / ✗          | print.css présent        |
| §3.9 Reduced motion / a11y                            | ✓ / ✗          | admin.css                |
| §3.10 JobLogStream contrat                            | ✓ / ✗          | Audit A8                 |

**Bilan** : XX/16 ✓, XX/16 🟡, XX/16 ✗.

## Top P0 / P1 / P2

(repris de la synthèse Phase 2)

## Recommandations activation
1. ...
2. ...

## Risques résiduels documentés
- ...
```

### 8.2 Fichier livrable : `EXEC-SUMMARY-WILL-VERIFICATION.md`

~150-300 lignes. Format pour Will (non-tech) :
- TL;DR en 5 lignes.
- Tableau go/no-go par dimension.
- Actions Will recommandées (3-5 max).
- Quick wins post-merge si applicables.

### 8.3 Fichier livrable : `MANIFEST-VERIFICATION.md`

Liste tous les fichiers produits dans `_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/` avec une ligne par fichier (description courte). Manifest = table des matières du dossier d'audit.

### 8.4 Mise à jour MEMORY.md

Crée un fichier mémoire `axionia_admin_refonte_verification_2026-05-18.md` (slug court) + entrée MEMORY.md.

---

## 9. STRUCTURE COMPLÈTE DES LIVRABLES

```
axionia/_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/
├── README.md                                    (orientation lecteur)
├── 00-REALITY-CHECK.md                          (Phase 0)
├── 01-AUDIT-PATTERN-CONFORMITE.md               (A1)
├── 02-AUDIT-SENTRY.md                           (A2)
├── 03-AUDIT-ACTIVITY-LOG.md                     (A3)
├── 04-AUDIT-CSP-NONCE.md                        (A4)
├── 05-AUDIT-FORCE-DYNAMIC.md                    (A5)
├── 06-AUDIT-SERVER-ACTIONS.md                   (A6)
├── 07-AUDIT-PRISMA-RLS.md                       (A7)
├── 08-AUDIT-SSE-CONTRATS.md                     (A8)
├── 09-AUDIT-ISOLATION-ADMIN-UI.md               (A9)
├── 10-AUDIT-TESTS-VITEST.md                     (A10)
├── 11-AUDIT-GATES-SANTE.md                      (A11)
├── 12-AUDIT-ACTIVATION-V2.md                    (A12)
├── SYNTHESE-PHASE-1.md                          (Phase 2)
├── VERDICT-FINAL-VERIFICATION.md                (Phase 3 principal)
├── EXEC-SUMMARY-WILL-VERIFICATION.md            (résumé Will)
└── MANIFEST-VERIFICATION.md                     (table des matières)
```

**Total attendu** : 17 fichiers. Volume cumulé : 1 500–3 000 lignes Markdown.

---

## 10. SCORING /2000 — DÉCOMPOSITION RIGOUREUSE

À la fin de Phase 3, le score doit être **calculé à la main** (pas copié d'un agent). Formule :

```
Score_pondéré = (Σ (score_brut_audit_i × poids_i) / Σ poids_i) × 2000 / 200
```

Avec les poids définis en §4.1.

**Exemple** :
- 12 audits → 12 × 200 = 2400 pts bruts max.
- Poids cumulés : (1+2+3+3+3+3+3+3+1+2+2+1) = 27 unités de poids.
- Si moyenne pondérée = 187/200, alors score = (187/200) × 2000 = **1870 / 2000**.

Affiche le calcul détaillé dans `VERDICT-FINAL-VERIFICATION.md`.

---

## 11. ANTI-HALLUCINATION — GUARDRAILS DURS

### 11.1 Forbidden patterns

❌ **Ne JAMAIS écrire** :
- « tous les tests passent » sans output Vitest collé.
- « 116 routes » sans `find ... | wc -l` output collé.
- « 0 régression » sans `git diff --stat` cité.
- « Sentry intact » sans `grep` output cité.
- « le pattern est conforme » sans extrait de code cité.
- « score 1753/2000 » sans calcul détaillé.

### 11.2 Required citations

✅ **TOUJOURS** :
- Cite SHA quand tu parles d'un commit (`52494bd`, pas « PR 10 »).
- Cite chemin complet quand tu parles d'un fichier (`src/app/[locale]/(admin)/[adminPrefix]/alerts/page.tsx`, pas « la page alerts »).
- Cite numéro de ligne quand tu pointes une instruction (`page.tsx:285` pour le early-return).
- Cite la commande exacte que tu as exécutée, avec son output (tail/head).
- Cite tag git quand tu parles d'une plage (`baseline..pr12-end`, pas « la session »).

### 11.3 Marquage 🟡 UNVERIFIED

Si tu **ne peux pas** vérifier (build prod, e2e Playwright, Lighthouse), marque **🟡 UNVERIFIED — raison** dans la cellule du tableau. Ne fabrique JAMAIS un OK ou un KO.

### 11.4 Honnêteté audit (bonus +30 pts par P1 résiduel identifié)

Si tu trouves un écart entre VERDICT-FINAL.md (claim 1753/2000) et la réalité, **signale-le explicitement** dans `SYNTHESE-PHASE-1.md` section « Claims contestés ». C'est valorisé, pas pénalisé.

---

## 12. CADRE TEMPOREL

| Phase                          | Effort estimé | Effort plafond |
| ------------------------------ | ------------- | -------------- |
| Phase 0 reality check          | 30 min        | 1 h            |
| Phase 1 (12 agents parallèles) | 30-45 min     | 1.5 h          |
| Phase 2 synthèse               | 45 min        | 1.5 h          |
| Phase 3 verdict + livrables    | 45 min        | 1.5 h          |
| **TOTAL**                      | **2.5-3 h**   | **5.5 h**      |

Si l'audit dépasse 6 h cumulé, STOP & ASK Will (signe que le périmètre est plus large que prévu).

---

## 13. ANTI-PATTERNS À ÉVITER (cf. master prompt §13)

❌ Ne pas lancer `pnpm build` (consomme ressources sans intérêt audit, et le pipeline le fait déjà).
❌ Ne pas lancer `pnpm test:e2e:admin` (besoin dev server humain).
❌ Ne pas spawner > 12 sous-agents en parallèle (au-delà = bruit).
❌ Ne pas modifier les fichiers `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/**` (claim sous audit, immutable pendant la vérification).
❌ Ne pas commiter pendant l'audit (le commit final est manuel, après acceptation Will).
❌ Ne pas pousser sur origin (jamais sans signal Will).
❌ Ne pas modifier `MEMORY.md` avant la fin (entrée mémoire = livrable Phase 3.4).
❌ Ne pas copier-coller VERDICT-FINAL.md → cite-le et conteste-le si besoin.
❌ Ne pas spawner un sous-agent pour qu'il « décide » du verdict — le verdict global est ton job, les agents fournissent la matière première.

---

## 14. ROLLBACK SAFETY

Si tu détectes un cas catastrophique (régression P0 cachée, donnée prod menacée, etc.), recommande dans `EXEC-SUMMARY-WILL-VERIFICATION.md` :

```bash
# Coolify : remove env var ADMIN_V2_ENABLED si set
# Code : flag default false suffit pour rollback
# Aucune migration DB à rollback (cf. Audit A7)
# Aucun cookie destructif à clear
```

Le flag par défaut false = filet de sécurité absolu. Mais SIGNALE-LE si P0 trouvé.

---

## 15. CHECKLIST DE FIN D'AUDIT (pour l'orchestrateur, à compléter)

```
[ ] Phase 0 reality check produit (00-REALITY-CHECK.md)
[ ] 12 audits parallèles spawnés et complets (12 fichiers 01-12)
[ ] Synthèse Phase 1 produite avec scoring
[ ] Verdict final produit (VERDICT-FINAL-VERIFICATION.md)
[ ] Exec summary Will produit (EXEC-SUMMARY-WILL-VERIFICATION.md)
[ ] Manifest produit (MANIFEST-VERIFICATION.md)
[ ] README.md d'orientation produit
[ ] Entrée mémoire `axionia_admin_refonte_verification_2026-05-18.md` créée
[ ] MEMORY.md entry ajoutée (1 ligne sous 200 chars)
[ ] Aucun commit fait (à laisser à Will)
[ ] Tableau §3 non-négociables complet (16/16)
[ ] Score final calculé à la main (formule §10)
[ ] Verdict 🟢/🟡/🟠/🔴 explicite
[ ] Cite-don't-guess : tous les claims ont une source
[ ] 🟡 UNVERIFIED marqués où applicable
```

---

## 16. CADRE DE COMMUNICATION RUNTIME

- En début de chaque phase, **annonce ce que tu vas faire en une phrase**.
- À la fin de chaque agent, **rapporte en ≤ 80 mots ce qu'il a livré**.
- Pas de blabla narratif (« je vais maintenant vérifier… »). Va au résultat.
- Si erreur transitoire (timeout grep, tool error), **réessaie 1 fois max**, sinon marque 🟡 UNVERIFIED et continue.
- Réponse finale Will : ≤ 300 mots de synthèse + liens vers les 17 livrables.

---

## 17. STOP & ASK CONDITIONS (uniquement les 4 cas)

🛑 **Tu STOP & ASK uniquement si** :

1. **Phase 0 reality check** échoue sur ≥ 3 assertions critiques (état git divergent, HEAD ≠ 1cd3d5f sans explication, etc.).
2. **Score global < 1000 / 2000** ET ≥ 5 P0 trouvés (refonte cassée, écart majeur claim/réalité).
3. **Un sous-agent ne peut pas démarrer** (outil indisponible, environnement KO) — STOP pour diagnostic.
4. **Will t'écrit explicitement** « STOP » ou « ATTENDS » pendant le run.

🟢 **Tu ne STOP & ASK PAS pour** :
- Un P0 isolé (marque-le, continue).
- Un test individuel KO (marque-le, continue).
- Un tool error transitoire (réessaie, sinon 🟡 et continue).
- Un écart score claim/réalité (signale-le, c'est l'objet de l'audit).
- Le temps qui passe (jusqu'à 6 h).

---

## 18. POUR L'ORCHESTRATEUR — CHECKLIST DE DÉPART

Avant de spawner les 12 agents, vérifie que tu as :

1. ✅ Lu intégralement ce prompt (16k+ tokens).
2. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/IMPLEMENTATION-PLAN.md` (~290 lignes).
3. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md` (~150 lignes, claim à vérifier).
4. ✅ Lu `axionia/_AUDIT/ADMIN-REFONTE-2026-05-17/ANTI-REGRESSION-REPORT.md` (~180 lignes).
5. ✅ Lu `axionia/docs/adr/0028-admin-design-system-v1.md` (rapide ~30 lignes).
6. ✅ Exécuté Phase 0 entièrement.
7. ✅ Créé le répertoire `axionia/_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/`.

Si une étape échoue, STOP & ASK Will.

---

## 19. POUR LE LECTEUR HUMAIN (Will)

Will : ce prompt te donne en sortie **17 fichiers Markdown** dans `axionia/_AUDIT/ADMIN-REFONTE-VERIFICATION-2026-05-18/`, dont :

- **Le verdict global indépendant** (🟢/🟡/🟠/🔴 + score sur 2000).
- **Une table des 16 non-négociables §3** (✓/✗/🟡 par item, avec source preuve).
- **Une liste P0/P1/P2** trouvés (devrait être quasi-vide si la refonte est aussi clean qu'annoncée).
- **Un exec summary** que tu peux lire en 5 min.

Le tout est **AUDIT-ONLY** : 0 modif de code, 0 commit, 0 push. Si verdict 🟢, tu peux activer V2 sereinement. Si 🟡/🟠/🔴, les findings priorisés te disent quoi fixer en premier.

---

## 20. RESSOURCES

- Master prompt original : `Axion-IA/_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`
- Doctrine code = SSOT : voir CLAUDE.md / AGENTS.md sub-repo (build externalisé GH Actions, stub.invalid, etc.)
- ADR 0028 : design system admin v1
- Pattern templates : PATTERNS.md
- Plan implémentation : IMPLEMENTATION-PLAN.md
- Verdict claim : VERDICT-FINAL.md
- Anti-régression claim : ANTI-REGRESSION-REPORT.md
- Exec summary : EXEC-SUMMARY-WILL.md
- Liste commits : LISTE-COMMITS-LOCAUX-PRETS.md
- Journal : JOURNAL.md

**Fin du prompt.** Toute déviation à ce cadre doit être tracée dans un STOP & ASK explicite ou un addendum dans `00-REALITY-CHECK.md`.
