# PROMPT — Vérification complète Pass B refonte console admin Axion-IA · Mai 2026

> **Type** : Audit AUDIT-ONLY (lecture seule, aucun commit, aucune modification de code)
> **Mode** : 12 sous-agents Explore parallèles + 1 tie-breaker + synthèse + verdict
> **Cible** : valider que le travail du prompt 1 (`PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`) atteint la **perfection mai 2026** sans régression
> **À lancer** : APRÈS que le prompt 1 a terminé Phase 8 (verdict initial livré dans `_AUDIT/ADMIN-REFONTE-2026-05-17/VERDICT-FINAL.md`)
> **Effort** : 4-8 h autopilote
> **Date** : 2026-05-17
> **Verdict cible** : ≥ **2700 / 3000** sur la grille étendue + **0 P0 ouvert** + **0 régression** documentée

---

## 0. RÉSULTAT ATTENDU EN UNE PHRASE

Un **verdict indépendant à froid** (sous-agents qui n'ont pas écrit le code) qui certifie ou infirme le verdict du prompt 1, détecte les angles morts qu'il aurait pu manquer, vérifie point-par-point les **30 non-négociables** du prompt 1, et produit une **liste actionnable de P0/P1/P2** si des écarts subsistent. **Aucun fix appliqué** — verdict seulement.

---

## 1. MODE AUDIT-ONLY STRICT (non-négociable)

> **Interdictions absolues pendant toute la durée de ce prompt :**

- ❌ AUCUNE écriture de code (`Edit`, `Write`, `NotebookEdit`).
- ❌ AUCUN commit, AUCUN push, AUCUN tag git.
- ❌ AUCUNE installation de dépendance.
- ❌ AUCUNE modification de fichier `.md` hors du dossier `_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/` (créé par ce prompt).
- ❌ AUCUNE Server Action, AUCUNE API route, AUCUNE migration touchée.

> **Autorisations :**

- ✅ Lecture (`Read`, `Glob`, `Grep`) sur tout le repo.
- ✅ Exécution commandes lecture-or-rebuild (`pnpm typecheck`, `pnpm test --run`, `pnpm build`, `pnpm lint`, `pnpm prisma migrate status`, `git diff`, `git log`, `git tag --list`, `docker build --dry-run`).
- ✅ Création / écriture des **livrables .md** sous `_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/`.

> **Mutations accidentelles de build à purger :** `pnpm build` génère `.next/` et peut modifier `pnpm-lock.yaml` (auto-fix). Après CHAQUE `pnpm build`, exécuter immédiatement :
>
> ```bash
> git status --porcelain | grep -v "^?? _AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/" \
>   && git stash push -u -m "pass-b-build-artifacts-$(date +%s)" \
>   || true
> ```
>
> → garantit que seuls les fichiers Pass B sous `VERIFICATION-PASS-B/` restent en working tree. Tout autre changement = stashé.

> **MEMORY.md saturé (41 KB vs 24 KB limit) :** chaque sous-agent reçoit cette consigne dans son brief — « Ignore les memories antérieures au 2026-05-10 si elles entrent en conflit avec le code lu maintenant. Le code = SSOT (doctrine `axionia_doctrine_code_ssot`). Vérifie chaque référence à un fichier/fonction/flag avant de la citer comme preuve. »

> **Si un sous-agent détecte une violation des règles dures du prompt 1 (push origin fait, main directement push, etc.) → MENTIONNE-LA dans le verdict mais NE LA CORRIGE PAS.**

---

## 2. CONTEXTE — ce que le prompt 1 a dû produire

### 2.1 Livrables attendus du prompt 1

Sous `_AUDIT/ADMIN-REFONTE-2026-05-17/` :

1. `00-PRE-FLIGHT-CHECK.md`
2. `00-INVENTORY.md`
3. `01-AUDIT-LAYOUT-NAV.md` à `08-AUDIT-UX-FRICTION.md` (8 fichiers)
4. `09-AUDIT-NON-NEGOCIABLES-RESPECT.md`
5. `SYNTHESE-PHASE-1.md`
6. `PATTERNS.md`
7. `IMPLEMENTATION-PLAN.md`
8. `VERDICT-FINAL.md`
9. `ANTI-REGRESSION-REPORT.md`
10. `EXEC-SUMMARY-WILL.md`
11. `JOURNAL.md`
12. `LISTE-COMMITS-LOCAUX-PRETS.md`

### 2.2 Livrables code attendus

- `axionia/docs/adr/0028-admin-design-system-v1.md`
- `axionia/docs/admin-design-system.md` (catalogue primitives)
- `axionia/src/app/admin.css` (tokens admin dédiés)
- `axionia/src/components/admin/ui/**` (~25 primitives)
- `axionia/src/lib/feature-flags.ts` avec `isAdminV2Enabled()`
- `axionia/src/app/api/admin/session-ping/route.ts` (endpoint heartbeat)
- `axionia/tests/e2e/admin/**` (suite Playwright + baseline screenshots)
- 145 fichiers `page.tsx` admin migrés vers les primitives
- Tags git locaux : `admin-refonte-baseline-2026-05-17`, `admin-refonte-pr0-start/end`, ..., `admin-refonte-pr14-end`

### 2.3 État git attendu

- **`main` local** : 50-80 commits Conventional ajoutés depuis le tag `admin-refonte-baseline-2026-05-17`.
- **Origin main** : **inchangé** (pas de push).
- **Branches** : aucune branche `feat/admin-refonte-*` (commits directs main).
- **Tags locaux** : ~30 tags `admin-refonte-prX-start/end` + 1 baseline.

---

## 3. PHASE 0 — Reality check du livré (30 min)

> **Mode** : toi (orchestrateur), aucun sous-agent. Vérification de la complétude des livrables.

### 3.1 Inventaire des livrables réels

Pour chaque fichier listé §2.1 :

```bash
test -f _AUDIT/ADMIN-REFONTE-2026-05-17/<fichier>.md && echo OK || echo MISSING
```

Pour chaque fichier listé §2.2 : `Glob` ou `ls`.

### 3.2 Snapshot git

```bash
git log admin-refonte-baseline-2026-05-17..HEAD --oneline | wc -l
git tag --list "admin-refonte-*"
git status --short
git diff origin/main..HEAD --stat | tail -5
```

→ Documenter dans `_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/00-LIVRAISON-INVENTORY.md`.

### 3.3 Sortie Phase 0

```
- Livrables .md attendus : 12 / 12 présents ? __
- Livrables code attendus : __ / __ présents
- Commits depuis baseline : __ (cible 50-80)
- Tags locaux refonte : __ (cible ~30)
- Push origin détecté : OUI/NON (doit être NON)
- Branches dédiées détectées : __ (doit être 0 — commits directs main)
- Verdict complétude : 🟢 COMPLET / 🟡 PARTIEL / 🔴 ABSENT
```

> **Gate** : si livraison < 70 % complète → STOP & rapport « Prompt 1 n'a pas fini. Verdict Pass B impossible. Re-lancer prompt 1 sur les phases manquantes. »

---

## 4. PHASE 1 — 12 sous-agents Explore parallèles (3-5 h)

> **Mode** : 12 sous-agents `Explore` en **parallèle absolu** (un seul message, 12 tool uses simultanés). Chaque sous-agent est briefé qu'il n'a PAS écrit le code (lecture à froid).
> **Sortie** : 12 fichiers .md distincts dans `_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/`.

### 4.1 Sous-agent B1 — Conformité au prompt 1 (poids 1×, /200)

**Brief** :

> Lis intégralement `_AUDIT/PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`. Liste les **40+ exigences explicites** du prompt 1 (phases, livrables, primitives, gates). Pour chacune, vérifie dans le repo si elle est livrée. Sortie : tableau exigence × statut (✅/❌/partiel) + score /200.

**Critères** :

- 17 livrables .md (§12.3 prompt 1) présents.
- ~25 primitives admin (§6.2) créées.
- Layout shell refondu (§7.2).
- Feature flag `ADMIN_V2_ENABLED` câblé (§3bis.3).
- Endpoint `/api/admin/session-ping` créé (§3.6).
- Suite Playwright admin baseline (§3bis.2) en place.
- 14 PR-équivalents tagués start/end.
- ADR 0028 + docs/admin-design-system.md.
- 30 anti-patterns §13 absents du diff.

**Livrable** : `01-CONFORMITE-PROMPT-1.md`.

### 4.2 Sous-agent B2 — Non-régression Server Actions / API / Prisma (poids 2×, /400)

**Brief** :

> Tu n'as PAS écrit le code. Tu reviens à froid. Vérifie qu'aucune Server Action, aucune API route, aucune query Prisma, aucune migration n'a été modifiée hors strict besoin UI.

**Méthode** :

- `git diff admin-refonte-baseline-2026-05-17..HEAD -- "src/app/api/**" "src/server/**" "prisma/**" "src/lib/prisma.ts"` → doit être **vide ou trivial**.
- Pour chaque Server Action repérée Phase 0 (cf. inventaire prompt 1) : grep signature avant/après, doit être identique.
- Worker BullMQ (`src/server/queue/workers/**`) : `git diff` doit être vide.
- Auth.js config (`src/auth.ts`, `src/auth.config.ts`) : doit être vide.
- Middleware admin (`adminPrefix` validation, FR redirect) : doit être inchangé.

**Critères (10 × /40)** :

1. 0 Server Action mutée.
2. 0 API route mutée.
3. 0 Prisma schema modifié.
4. 0 migration ajoutée.
5. 0 RLS policy touchée.
6. 0 worker touché.
7. 0 seed touché.
8. 0 Auth.js touchée.
9. 0 middleware admin touché.
10. `force-dynamic` admin préservé sur toutes les routes admin.

**Livrable** : `02-NON-REGRESSION-BACKEND.md`. Tout écart = **P0 bloquant**.

### 4.2bis Sous-agent B2bis — Intégrité frontend partagé + workflows + Prisma drift (poids 2×, /400)

**Brief** :

> La refonte admin devait toucher UNIQUEMENT `src/components/admin/**`, `src/app/[locale]/(admin)/**`, et créer `src/app/admin.css` + `src/lib/feature-flags.ts`. Vérifie qu'aucun fichier frontend partagé public+admin n'a été touché, qu'aucun workflow CI/CD ne dérive, et qu'aucun drift Prisma silencieux n'existe.

**Méthode** :

```bash
git diff admin-refonte-baseline-2026-05-17..HEAD --stat -- \
  "src/components/ui/**" \
  "src/components/layout/**" \
  "src/components/sections/**" \
  "src/components/marketing/**" \
  "src/components/nav/**" \
  "src/app/globals.css" \
  "tailwind.config.*" \
  "next.config.*" \
  "postcss.config.*" \
  ".github/workflows/**" \
  "Dockerfile" \
  "Dockerfile.coolify-pull" \
  "Dockerfile.worker" \
  "Caddyfile" \
  "package.json" \
  "pnpm-lock.yaml" \
  "prisma/schema.prisma" \
  "prisma/migrations/**" \
  "src/middleware.ts" \
  "src/proxy.ts"
```

→ Doit être **vide ou strictement justifié** (ex. `package.json` peut avoir +1 dep si ADR 0028 le justifie).

Plus :

```bash
pnpm prisma migrate status  # exit 0 + "Database schema is up to date"
pnpm prisma format --check  # 0 drift
pnpm prisma validate         # 0 erreur
```

**Critères (10 × /40)** :

1. `src/components/ui/**` (composants partagés public+admin) **0 modification** (sinon régression sur ~17 500 routes pSEO publiques).
2. `src/components/{layout,sections,marketing,nav}/**` 0 modification.
3. `src/app/globals.css` 0 modification (tokens publics intouchables).
4. `tailwind.config.*`, `postcss.config.*` 0 modification.
5. `next.config.*` 0 modification (sauf si feature flag exige).
6. `.github/workflows/**` 0 modification (sinon pipeline GHCR/Coolify peut casser au prochain push).
7. `Dockerfile*` 0 modification (sinon build externalisé GH Actions casse — ADR 0026).
8. `package.json` + `pnpm-lock.yaml` : 0 dep ajoutée non documentée dans ADR 0028, et lockfile cohérent (`pnpm install --frozen-lockfile` exit 0).
9. `prisma/schema.prisma` + `prisma/migrations/**` : `pnpm prisma migrate status` exit 0 + `pnpm prisma format --check` 0 drift.
10. `src/middleware.ts` + `src/proxy.ts` : 0 modification (logique admin URL prefix + EN→FR redirect intactes).

**Bonus check PR #14 coordination** :

```bash
git fetch origin
git diff origin/main..HEAD -- "src/components/admin/image-bank/**" \
                              "src/app/[locale]/(admin)/[adminPrefix]/image-bank/**"
```

→ Comparer avec le diff que PR #14 introduira sur origin/main au merge. Si chevauchement sur les mêmes fichiers → flag P1 : « conflict prévisible au push ; merge PR #14 d'abord puis rebase main local. »

**Livrable** : `02bis-INTEGRITE-FRONTEND-PARTAGE.md`. Tout écart sur critères 1-3 = **P0 bloquant push** (régression site public). Écarts 4-10 = P0 sauf justification ADR.

### 4.3 Sous-agent B3 — Non-négociables §3 prompt 1 (poids 2×, /600)

**Brief** :

> Audite point-par-point les **30 non-négociables** des §3, §3.5, §3.6, §3.7, §3.8, §3.9, §3.10 du prompt 1.

**Méthode pour chaque** :

| Non-négo | Méthode de vérification |
| --- | --- |
| CSP nonce préservé | `grep -rn "nonce={\|getNonce\|headers().get('x-nonce')" src/app/[locale]/\(admin\)/` avant/après diff. Curl prod `Content-Security-Policy` header diff. |
| ActivityLog câblage | `grep -rn "logActivity\|ActivityLog\.create" src/app/[locale]/\(admin\)/` — chaque Server Action mutante en a un. |
| Sentry tags / breadcrumbs | `grep -rn "Sentry\." src/app/[locale]/\(admin\)/ src/components/admin/` avant/après — count identique ou supérieur. |
| `force-dynamic` admin | `grep -rn "force-dynamic" src/app/[locale]/\(admin\)/` — toutes routes admin en ont. |
| `useActionState` / `useFormStatus` / `useOptimistic` | `grep -rn "useActionState\|useFormStatus\|useOptimistic" src/components/admin/ src/app/[locale]/\(admin\)/` — présents sur forms nouveaux. |
| Session expiry heartbeat | `/api/admin/session-ping` existe + `AdminSessionExpiryWarning` câblé layout admin. |
| Multi-tab `updatedAt` optimistic concurrency | Top-4 ressources (Publication, Reservation, Devis, Facture) ont le champ envoyé + `AdminConflictDialog`. |
| JobLogStream contrat | `git diff` sur `src/components/content-gen/JobLogStream.tsx` ne touche pas EventSource/endpoint/payload signature. |
| `error.tsx`/`loading.tsx`/`not-found.tsx` par route | Toutes routes admin couvertes (héritage parent OK). |
| Mode print | `@media print` présent dans CSS admin sur factures/devis. |
| Tablet 768-1280 | Sidebar drawer < 1024px, tables scroll horizontal sticky col. |
| Reduced motion | Transitions `motion-reduce:` Tailwind ou `@media (prefers-reduced-motion: reduce)` couvrent shimmer / spin / heavy animations. |
| Drag-and-drop a11y | Si D&D ajouté, support clavier complet (Tab/Space/Arrow/ESC). |
| Auto-logout idle | Toast 60s avant logout (couplé heartbeat). |
| Doctrine code = SSOT | 0 token public `globals.css @theme` modifié. |
| Pas d'EN dans admin | `grep -rn "useTranslations\|t\\(\"" src/app/[locale]/\(admin\)/` ne ramène rien (FR hardcodé en admin). |
| 0 dark mode | `grep -rn "dark:" src/components/admin/ src/app/[locale]/\(admin\)/` = 0. |
| 0 noir pur | `grep -rn "bg-black\|text-black\|border-black\|#000\b" src/components/admin/ src/app/[locale]/\(admin\)/` = 0. |
| 0 emoji icône produit | Audit visuel `axionia/src/components/admin/AdminSidebar.tsx` — emojis remplacés par `lucide-react` ou SVG. |
| Italique terracotta hors CTA primaire | Audit `<em>` + `italic` dans composants CTA primaire = 0. |
| Anti-hex gate | `pnpm anti-hex` exit 0. |
| Use-client gate | `pnpm use-client-check` exit 0. |
| Isolation gate | `pnpm isolation-check` exit 0 (admin/ui jamais importé hors admin). |

**30 lignes à auditer minimum.** Score /600 = 20 pts par non-négociable respecté, -300 pts par violation détectée (pénalité prompt 1 §12.2).

**Livrable** : `03-NON-NEGOCIABLES-AUDIT.md` — tableau 30 lignes ✅/❌ + verdict 🟢/🔴 par bloc + score brut + score après malus.

### 4.4 Sous-agent B4 — Design system centralisation réelle (poids 1.5×, /200)

**Brief** :

> Audite si le design system admin est **réellement centralisé** ou si des duplications subsistent.

**Méthode** :

- Inventorier les ~25 primitives livrées sous `src/components/admin/ui/**`.
- Pour chacune : compter usages dans `src/app/[locale]/(admin)/` (grep import).
- Pour les patterns clés (page header, table, form field, empty state) : repérer si certains pages re-codent à la main au lieu d'utiliser la primitive.
- Détecter les duplications restantes (>3 occurrences quasi-identiques d'un JSX).

**Critères (10 × /20)** :

1. PageHeader utilisé sur ≥ 90 % des `page.tsx` admin.
2. PageShell utilisé sur ≥ 90 % des pages.
3. Table primitive utilisée partout où il y a un tableau.
4. FormField utilisé sur ≥ 90 % des inputs.
5. EmptyState utilisé partout où no-data.
6. LoadingState (skeleton) sur loading.tsx ou Suspense.
7. ErrorState sur error.tsx.
8. ConfirmDialog utilisé pour toute destructive action.
9. Breadcrumbs présent sur pages `[id]`.
10. 0 duplication JSX > 3 occurrences identiques restante.

**Livrable** : `04-CENTRALISATION-DESIGN-SYSTEM.md` — score + Top 10 duplications résiduelles si présentes.

### 4.5 Sous-agent B5 — Doctrine Design.md respectée (poids 1×, /150)

**Brief** :

> Vérifie que la refonte respecte intégralement `axionia/Design.md` v3 (Editorial Premium Light).

**Critères (15 × /10)** :

1. Palette surfaces (`--color-bg`, `--color-paper`, `--color-sand`, `--color-mocha`) utilisée — pas de gris froid type Notion.
2. Foreground (`--color-fg`, `--color-fg-soft`, `--color-fg-muted`) avec WCAG AA respecté.
3. `--color-primary #1a4dd9` seule couleur CTA primaire (grep CI).
4. `--color-terracotta` jamais sur CTA primaire (vérifier composants admin Button primary).
5. `--color-sage` utilisé pour proof / succès / cas concrets.
6. Tokens `--color-admin-*` préfixés, isolés dans `src/app/admin.css`, jamais en `globals.css`.
7. Typography hierarchy v3.2 respectée (text-lg → text-7xl, hero cap 88px).
8. Hero schema carré 576×576 lg+ (si applicable admin).
9. Border-radius admin 4-12px max (pas 24px+ éditorial public).
10. Shadows subtiles admin (1-3px, pas shadow-2xl).
11. Spacing scale admin 2/4/6/8/12/16/24/32 (dense).
12. Italique serif terracotta : signature éditoriale uniquement (jamais sur CTA primaire admin).
13. 0 noir pur dans admin.
14. Aucun token public `globals.css @theme` modifié.
15. Aucun import croisé : `admin.css` jamais importé hors layout admin.

**Livrable** : `05-DOCTRINE-DESIGN.md`.

### 4.6 Sous-agent B6 — Modernité mai 2026 (poids 1.5×, /200)

**Brief** :

> Audite la sensation visuelle / UX vs benchmarks mai 2026 : Linear, Vercel Dashboard, Stripe Dashboard, Supabase Studio, Anthropic Console. Récupère 8-12 screenshots Playwright des pages admin clés livrées et compare critère par critère.

**Critères (10 × /20)** :

1. Hiérarchie visuelle claire (eye tracking 1-2-3).
2. Densité informationnelle équilibrée (ni vide ni encombré).
3. Typographie dense lisible (12-14px corps, lh 1.4-1.5).
4. Couleurs sobres + accents fonctionnels (pas SaaS B2C coloré).
5. Iconographie cohérente (lucide-react ou équivalent, 16/20/24px).
6. Micro-interactions présentes (hover subtil, focus 2px, transitions ≤ 200ms).
7. Empty states soignés (pas générique).
8. Loading states dimensionnels (skeleton sans CLS).
9. Tables informatives (sort, filter, pagination, density toggle).
10. Command palette riche (Cmd+K, recent, shortcuts visibles).

**Livrable** : `06-MODERNITE-MAI-2026.md` — score + comparaison textuelle benchmarks + Top 5 améliorations P1 si gap.

### 4.7 Sous-agent B7 — Content Generator UX (FOCUS WILL, poids 3×, /600)

**Brief** :

> Audite spécifiquement la refonte du content generator (48 routes). C'est la priorité absolue de Will.

**Méthode** :

- Parcourir les 48 routes : `find "src/app/[locale]/(admin)/[adminPrefix]/content-gen" -name "page.tsx"`.
- Pour chaque storyboard du §10.1 prompt 1 (onboarding, création campagne, suivi, review, édition, qualité, costs) : vérifier l'implémentation.
- Vérifier les composants §10.2 prompt 1 (OnboardingWizard, CampaignFormPreview, JobStatusBanner, JobLogStream v2, ReviewDiffView, ReviewActionsBar, AutosaveIndicator, CostStatGrid, BudgetAlertBanner) créés.
- Vérifier shortcuts §10.3 prompt 1 (Cmd+K, Cmd+B, G then D/C/J/R/I, J/K, Cmd+S, Cmd+Enter) câblés.

**Critères (12 × /50)** :

1. Onboarding wizard 3 étapes fluide.
2. Création campagne 1 page avec preview live coûts.
3. Suivi jobs : status banner sticky + ETA + JobLogStream v2.
4. Review queue : diff côte-à-côte + Approve/Edit/Reject + shortcuts + undo 10s.
5. Édition publication : Tiptap fluide + autosave + heartbeat session + draft localStorage.
6. Optimistic updates sur toggle/approve/reject.
7. Quality dashboard avec drill-down.
8. Costs avec graphes + alertes budget.
9. JobLogStream contrat préservé (cf. B3).
10. Multi-tab conflict détection sur publication edit.
11. Shortcuts globaux fonctionnels.
12. 48 routes migrées vers primitives (0 page « ancienne UI » résiduelle).

**Livrable** : `07-CONTENT-GEN-VERIFICATION.md` — score /600 + storyboard end-to-end testé manuellement (mental walk-through) + Top 10 frictions résiduelles.

### 4.8 Sous-agent B8 — Performance budget tenu (poids 1.5×, /200)

**Brief** :

> Vérifie que les budgets Web Vitals d'AGENTS.md sont tenus sur les pages admin migrées.

**Méthode** :

```bash
pnpm build  # snapshot tailles bundles admin
pnpm lhci collect  # Lighthouse sur 3 URLs admin pilotes (cf. §11.3 prompt 1)
```

Comparer aux gates :

- First Load JS ≤ 75 KB gz standard, ≤ 120 KB graphs/tables, ≤ 150 KB Tiptap edit.
- LCP ≤ 1 800 ms p75.
- INP ≤ 100 ms p75.
- CLS = 0.
- TBT ≤ 150 ms desktop.

**Critères (10 × /20)** :

1. Dashboard admin First Load JS ≤ 80 KB gz.
2. Content-gen dashboard ≤ 100 KB gz.
3. Content-gen jobs (avec stream) ≤ 100 KB gz.
4. Content-gen publications edit (Tiptap) ≤ 150 KB gz.
5. Image-bank library ≤ 100 KB gz.
6. Lighthouse Perf ≥ 90 sur 3 URLs admin pilotes.
7. Lighthouse A11y ≥ 95.
8. Lighthouse BP ≥ 95.
9. CLS = 0 sur toutes pages (skeletons dimensionnels).
10. Aucune nouvelle dep > 30 KB gz ajoutée.

**Livrable** : `08-PERFORMANCE-AUDIT.md`.

### 4.9 Sous-agent B9 — A11y WCAG 2.2 AA (poids 1×, /150)

**Brief** :

> Audite l'accessibilité réelle via axe-core (`pnpm test:a11y` si dispo) + revue manuelle des composants critiques.

**Critères (15 × /10)** :

1. Skip-to-content présent.
2. Landmarks (banner / nav / main / contentinfo) corrects.
3. Focus visible 3:1 minimum.
4. Contrast 4.5:1 texte normal.
5. Keyboard nav complet (Tab/Shift+Tab/Enter/ESC/arrows).
6. Screen reader labels (aria-label / aria-describedby / aria-live).
7. Target size 24×24px desktop minimum.
8. Reduced motion respecté.
9. Form errors associated (aria-invalid / aria-errormessage).
10. Modals focus trap + ESC close + return focus.
11. `aria-current="page"` sur lien actif sidebar.
12. Headings hierarchy logique (h1 unique, pas de skip h2→h4).
13. `<button>` vs `<a>` corrects (action vs nav).
14. Images alt présent ou `alt=""` si décorative.
15. Tables `<th scope>` et `<caption>` si pertinent.

**Livrable** : `09-A11Y-WCAG22-AUDIT.md`.

### 4.10 Sous-agent B10 — Tests anti-régression couverture (poids 1×, /150)

**Brief** :

> Vérifie la qualité des tests livrés et la couverture anti-régression.

**Méthode** :

```bash
pnpm test --run --coverage  # Vitest coverage
pnpm test:e2e:admin --reporter=list  # Playwright admin
ls tests/e2e/admin/__screenshots__/baseline-2026-05-17/  # baseline présent ?
```

**Critères (10 × /15)** :

1. Playwright admin smoke ≥ 30 flows verts.
2. Visual diff Playwright vs baseline disponible.
3. Vitest primitives admin coverage ≥ 80 %.
4. Vitest 100 % vert (0 skip nouveau, 0 fail).
5. Lighthouse CI gate admin câblé (Option A ou B).
6. Tests session-expiry mock présents.
7. Tests multi-tab conflict mock présents.
8. Tests reduced-motion présents.
9. Tests print mode présents (manuel acceptable).
10. JOURNAL.md tenu à jour avec gates par PR-équivalent.

**Livrable** : `10-TESTS-ANTI-REGRESSION.md`.

### 4.11 Sous-agent B11 — Code quality & documentation (poids 1×, /150)

**Brief** :

> Audite la qualité du code livré et la doc.

**Critères (15 × /10)** :

1. `pnpm typecheck` exit 0 sur tout `axionia/`.
2. `pnpm lint` exit 0.
3. 0 nouvelle dette technique (`TODO/FIXME/HACK`) ajoutée.
4. 0 `any` TypeScript ajouté.
5. 0 `console.log` ajouté.
6. ADR 0028 rédigé (≥ 500 mots, structuré).
7. `docs/admin-design-system.md` catalogue ≥ 20 primitives avec exemples.
8. JSDoc / commentaires sur primitives publiques exportées.
9. Naming cohérent (`Admin*` préfixe partout `src/components/admin/ui/`).
10. Imports triés (déjà gate ESLint si présent).
11. Commits Conventional respectés (`git log` since baseline).
12. Pas de commit fixup non rebasé.
13. Pas de fichier > 500 LOC sans justification (sauf catalogue primitives).
14. JOURNAL.md cohérent.
15. EXEC-SUMMARY-WILL.md ≤ 1 page lisible 60 sec.

**Livrable** : `11-CODE-QUALITY-DOC.md`.

### 4.12 Sous-agent B12 — Risques résiduels & angles morts (poids 1×, /200)

**Brief** :

> Pose-toi à froid. Pense aux **scénarios edge case** non couverts par les audits B1-B11. Cherche les angles morts.

**Pistes à explorer** :

- Session expirée + multi-tab + connexion intermittente combinés.
- Tiptap + image upload + drag-and-drop + autosave concurrent.
- JobLogStream avec 50 000 lignes (perf scroll).
- Command palette avec 1000+ entrées indexées.
- Sidebar collapsed sur tablet portrait.
- Print depuis page filtrée (querystring).
- Activity logs avec 100k entries (pagination).
- Bulk actions sur 5000 lignes sélectionnées (perf state).
- 2FA setup avec session expirée mid-flow.
- Webhook Stripe arrive pendant édition manuelle invoice.
- Sentry samp rate admin (peut surcharger free tier).
- Cookie `ADMIN_V2_ENABLED` cross-domain.
- Service Worker / cache admin si présent.
- Refresh hydration mismatch avec `useActionState`.
- React 19 Compiler errors silencieux.

**Critères (10 × /20)** :

1. 5+ scénarios edge case audités.
2. Risques RGPD identifiés (admin = données perso).
3. Risques sécu identifiés (token bypass Lighthouse, CSP).
4. Risques perf futurs (scalabilité tables > 10k rows).
5. Risques UX dégradée (offline, slow network).
6. Risques dette technique introduits.
7. Risques opérationnels (rollback feature flag).
8. Risques tests (faux positifs visual diff).
9. Risques de couplage primitives (breaking change futur).
10. Recommandations P1/P2 actionnables documentées.

**Livrable** : `12-RISQUES-ANGLES-MORTS.md`.

---

## 5. PHASE 2 — Tie-breaker sur les findings critiques (1 h)

> **Mode** : si deux sous-agents (B2 et B3, ou B7 et B12) ont des verdicts **divergents** sur un même finding (ex. B7 dit « JobLogStream OK », B3 dit « JobLogStream contrat muté ») → lancer un **13e sous-agent tie-breaker** indépendant.

### 5.1 Détection des désaccords

À la fin Phase 1, scanner les 12 livrables et lister les findings :

- Marqués P0 par un agent et absents/P2 par un autre.
- Verdict 🟢 d'un, 🔴 d'un autre, sur la même primitive.

### 5.2 Brief tie-breaker

> Lance sous-agent B13 — Tie-breaker :
>
> « Tu n'as PAS écrit le code, ni les audits B1-B12. Tu reviens à froid sur les N findings divergents listés ci-dessous. Pour chacun, lis la preuve dans le code et tranche : APPROVE_AGENT_X / APPROVE_AGENT_Y / NUANCED (les deux ont raison partiellement). Justifie chaque tranche par citation de code. »

**Livrable** : `13-TIE-BREAKER.md`.

---

## 6. PHASE 3 — Synthèse & verdict final (1-2 h)

> **Mode** : toi (orchestrateur), agrégation.

### 6.1 Score consolidé /3400 (B12 bonus hors total)

| Catégorie | Sous-agent | Score max |
| --- | --- | --- |
| Conformité prompt 1 | B1 | 200 |
| Non-régression backend (Server Actions / API / Prisma / RLS / workers) | B2 | 400 |
| Intégrité frontend partagé + workflows + Prisma drift | B2bis | 400 |
| Non-négociables §3 prompt 1 (30 items) | B3 | 600 |
| Centralisation design system réelle | B4 | 200 |
| Doctrine Design.md respectée | B5 | 150 |
| Modernité mai 2026 vs benchmarks | B6 | 200 |
| Content Generator UX (FOCUS WILL ×3) | B7 | 600 |
| Performance budget tenu | B8 | 200 |
| A11y WCAG 2.2 AA | B9 | 150 |
| Tests anti-régression couverture | B10 | 150 |
| Code quality & doc | B11 | 150 |
| **TOTAL** | | **3400** |
| Risques résiduels (bonus hors total) | B12 | +200 bonus |

> **Malus -300 pts par non-négociable §3 violé** (cumulable jusqu'à -900). 3 violations = NO-GO automatique.
> **Malus -500 pts** par critère B2bis-1, B2bis-2 ou B2bis-3 violé (régression site public = critique).

### 6.2 Verdict

- **≥ 3060 / 3400** (90 %) : 🟢 **CERTIFIÉ PERFECTION MAI 2026 — passer Phase 4 pré-push, puis Will peut pusher origin/main.**
- **2720-3059** (80-89 %) : 🟢 **GO — quelques P1 traçables en suivi post-push, Phase 4 pré-push obligatoire.**
- **2380-2719** (70-79 %) : 🟡 **CONDITIONAL — fixer les P0 listés avant Phase 4 pré-push.**
- **1700-2379** (50-69 %) : 🟠 **CORRECTIF SPRINT — relancer un prompt 3 de fix on residuals.**
- **< 1700** (< 50 %) : 🔴 **NO-GO — refonte à revoir, STOP & ASK Will sur la stratégie.**

### 6.3 Sortie consolidée

`_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/VERDICT-PASS-B.md` :

```
# Verdict Pass B refonte admin — 2026-05-XX

Score : ___ / 3000 (🟢/🟡/🟠/🔴)
Malus non-négociables : -___ pts (N violations)
Score final : ___ / 3000

## Top findings P0 (bloquant push)
1. ...
2. ...

## Top findings P1 (à fixer post-push)
1. ...

## Top findings P2 (V2 / nice-to-have)
1. ...

## Risques résiduels (B12)
- ...

## Recommandations Will
- Action humaine 1 : ...
- Action humaine 2 : ...

## Décision push origin/main
🟢 GO / 🟡 CONDITIONAL / 🔴 NO-GO

## Commits prêts à pusher (si GO)
- SHA range : <sha-baseline+1>..<sha-HEAD>
- N commits Conventional
- Branches locales : 0 (commits directs main)
- Tags locaux à pusher : admin-refonte-*

## Si push autorisé, commande Will :
git push origin main && git push origin --tags
```

### 6.4 Exec summary Will

`_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/EXEC-SUMMARY-PASS-B-WILL.md` :

```
# Pass B — Verdict 60 secondes

Score : ___ / 3000 (___ % perfection)
Décision : 🟢 GO PUSH / 🟡 CONDITIONAL / 🔴 NO-GO

Top 3 wins refonte :
1. ...
2. ...
3. ...

Top 3 risques résiduels :
1. ...
2. ...
3. ...

Action immédiate Will :
- Si 🟢 : `git push origin main && git push origin --tags`
- Si 🟡 : fixer les ___ P0 listés VERDICT-PASS-B.md puis re-Pass B partielle.
- Si 🔴 : STOP & ASK humain, refonte à revoir.

Anti-régression vs baseline 2026-05-17 :
- Backend : 0 régression / N régressions
- Frontend partagé : 0 modif / N modifs (CRITIQUE si > 0)
- Performance : LCP/INP/CLS/TBT/FirstLoadJS budget tenu : OUI/NON
- A11y : score WCAG 2.2 AA : ___ / 150
- Tests : Playwright 30/30 vert, Vitest ___ / ___ vert
- Visual diff : N pages diff > 5 %
- PR #14 conflict prévisible : OUI/NON
```

---

## 6bis. PHASE 4 — Pré-push checklist (obligatoire si verdict 🟢 ou 🟡, 30-60 min)

> **Mode** : toi (orchestrateur), commandes lecture-or-rebuild + stash après chaque mutation. **Aucun push** (toujours interdit pour l'agent). Cette phase **gate l'autorisation à Will** de pusher lui-même.

### 6bis.1 Build Docker local (équivalent CI GHCR)

Le pipeline prod build sur GH Actions → push GHCR → Coolify pull (ADR 0026). Si le `docker build` local échoue, le push origin déclenchera un échec CI. À vérifier AVANT push :

```bash
cd axionia
docker build \
  --build-arg DATABASE_URL=postgresql://stub:stub@stub.invalid:5432/stub \
  --build-arg REDIS_URL=redis://stub.invalid:6379 \
  --build-arg SKIP_ENV_VALIDATION=true \
  --build-arg BULLMQ_DISABLED=true \
  --target builder \
  -t axion-ia-prepush-check:latest \
  -f Dockerfile .
```

> **Si échec** : P0 bloquant push. Documenter dans `14-PRE-PUSH-CHECKLIST.md` + traces stderr. Will fixe manuellement avant push.
> **Si OOM expected** (cf. ADR 0026 — build local OOM normal sur CPX42) → marquer OK avec note « OOM local attendu, CI GH Actions disk 75 GB free le passera ».

### 6bis.2 Prisma migrate diff vs prod schema

```bash
pnpm prisma migrate status                # exit 0 + "up to date"
pnpm prisma migrate diff \
  --from-url "$DATABASE_URL_PROD_READONLY" \
  --to-schema-datamodel prisma/schema.prisma \
  --script  # → 0 ligne attendue (refonte ne touche pas schema)
```

> Si Will n'a pas `DATABASE_URL_PROD_READONLY` exposé → skip, marquer P1 « vérification manuelle Will requise ».

### 6bis.3 PR #14 conflict pré-push

```bash
git fetch origin
git diff origin/main..HEAD -- \
  "src/components/admin/image-bank/**" \
  "src/app/[locale]/(admin)/[adminPrefix]/image-bank/**"
```

→ Comparer avec le diff que PR #14 introduit (consulter PR #14 sur GitHub).

- Si chevauchement nul → ✅ push direct possible.
- Si chevauchement → **STOP avant push** : Will doit choisir (a) merger PR #14 d'abord et rebaser main local, ou (b) reporter le push admin refonte après merge PR #14.

### 6bis.4 Sentry source maps upload check

Si la prod utilise Sentry pour debug stack traces minifiés, les source maps doivent être uploadées au release. Vérifier :

```bash
grep -rn "sentry-cli\|withSentryConfig\|sourcemaps:upload\|hideSourceMaps" \
  next.config.* package.json .github/workflows/
```

→ Si présent : workflow de release Sentry doit tourner au push (ou en post-deploy). Si absent : marquer P1 « observabilité prod sera aveugle sur stack traces minifiés post-push ».

### 6bis.5 Plan de rollback documenté

Avant push, Will doit avoir un plan rollback prêt en cas de crash prod. Documenter dans `14-PRE-PUSH-CHECKLIST.md` :

```
Plan rollback (si prod KO post-push) :

Option A — Revert main local + force-push (le plus sûr) :
  git tag prod-revert-2026-05-XX HEAD
  git reset --hard admin-refonte-baseline-2026-05-17
  # ⚠️ Force-push UNIQUEMENT après confirmation Will :
  # git push origin main --force-with-lease

Option B — Coolify rollback image GHCR :
  Coolify → Application → Deployments → précédente image SHA → Redeploy
  (équivalent à revert deploy sans toucher git)

Option C — Feature flag toggle (si PR 14 retrait flag PAS encore fait) :
  Coolify env vars → ADMIN_V2_ENABLED=false → restart container
  (admin retombe sur ancien UI sans revert code)

Option recommandée selon état : ___
SHA de baseline : ___
SHA de HEAD prêt à pusher : ___
```

### 6bis.6 Bundle delta vs baseline (pas seulement vs budget absolu)

```bash
# Snapshot tailles à baseline
git checkout admin-refonte-baseline-2026-05-17
pnpm build > /tmp/build-baseline.log
git stash push -u -m "pre-pass-b-stash"

# Tailles actuelles déjà mesurées par B8 (snapshot HEAD)
# Comparer route-par-route :
diff /tmp/build-baseline.log /tmp/build-head.log
git checkout main  # retour HEAD
git stash pop  # restaure Pass B livrables
```

Critère : aucune route admin avec **delta > +30 KB gz** vs baseline sans justification ADR.

### 6bis.7 Livrable Phase 4

`_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/14-PRE-PUSH-CHECKLIST.md` :

```
# Pré-push checklist — date

1. Build Docker local : ✅ / ❌ / OOM-expected
2. Prisma migrate status + diff prod : ✅ / ❌ / skip-prod-url-absent
3. PR #14 conflict : ✅ aucun / ⚠️ chevauchement sur N fichiers
4. Sentry source maps upload : ✅ / ❌ / non-applicable
5. Plan rollback documenté : ✅ Option A/B/C choisie
6. Bundle delta vs baseline : ✅ tous < +30 KB / ❌ routes ___ dépassent

Décision push :
🟢 GO (5/6 minimum verts, 0 critique rouge)
🟡 CONDITIONAL (fixer ___ avant push)
🔴 NO-GO (régression bloquante détectée)

Commande push (si GO) — à exécuter MANUELLEMENT par Will :
  git push origin main
  git push origin --tags
```

---

## 6ter. PHASE 5 — Smoke prod post-push (optionnelle, si Will a pushé, 30 min)

> **Mode** : à lancer par Will dans une nouvelle session après son `git push origin main` réussi + déploiement Coolify terminé (~30 min). **Cette phase n'est PAS automatique** — Will déclenche en disant : « Lance smoke prod post-push admin refonte. »

### 6ter.1 Smoke 11 URLs critiques

```
PUBLIC (anti-régression site public — refonte admin doit pas l'avoir cassé) :
1. https://axion-ia.com/fr
2. https://axion-ia.com/fr/interventions
3. https://axion-ia.com/fr/reserver
4. https://axion-ia.com/fr/audit/par-ville/paris
5. https://axion-ia.com/fr/blog
6. https://axion-ia.com/fr/sitemap.xml
7. https://axion-ia.com/fr/sitemap-index.xml

ADMIN (V2 actif si feature flag retiré PR 14) :
8. https://axion-ia.com/fr/<adminPrefix> (login)
9. https://axion-ia.com/fr/<adminPrefix>/ (dashboard, après login)
10. https://axion-ia.com/fr/<adminPrefix>/content-gen
11. https://axion-ia.com/fr/<adminPrefix>/content-gen/jobs
```

Pour chaque URL : `curl -I` + extraction code HTTP + `cf-cache-status` + `x-robots-tag`.

### 6ter.2 Sentry events post-push (24h)

Si Sentry intégré : vérifier dashboard `events?project=axion-ia&statsPeriod=24h` :

- Aucun nouvel `error.boundary` admin déclenché.
- Aucun spike `429` ou `500` admin.
- Taux d'événements Sentry admin pas multiplié × 10 vs avant push (sinon free tier saturé sous 3-5 jours).

### 6ter.3 Lighthouse prod 5 URLs

```bash
pnpm lhci collect --url=https://axion-ia.com/fr,https://axion-ia.com/fr/interventions,https://axion-ia.com/fr/reserver,https://axion-ia.com/fr/audit/par-ville/paris,https://axion-ia.com/fr/<adminPrefix>
```

Comparer aux scores baseline (avant refonte). Régression > -5 pts sur Performance / A11y / BP / SEO = P0.

### 6ter.4 Livrable Phase 5

`_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/15-SMOKE-PROD-POST-PUSH.md` :

```
# Smoke prod post-push — date

URLs publiques : 7/7 OK / __ erreurs
URLs admin : 4/4 OK / __ erreurs
Sentry 24h : 0 spike / __ events anormaux
Lighthouse delta : ___ pts (Perf / A11y / BP / SEO)

Verdict :
🟢 PROD STABLE — refonte certifiée live.
🟡 ALERTES MINEURES — surveiller 48h.
🔴 REGRESSION PROD — rollback (Option A/B/C cf. 14-PRE-PUSH-CHECKLIST.md).
```

---

## 7. LIVRABLES TOTAUX PASS B

Sous `_AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/` :

1. `00-LIVRAISON-INVENTORY.md`
2. `01-CONFORMITE-PROMPT-1.md`
3. `02-NON-REGRESSION-BACKEND.md`
4. `02bis-INTEGRITE-FRONTEND-PARTAGE.md`
5. `03-NON-NEGOCIABLES-AUDIT.md`
6. `04-CENTRALISATION-DESIGN-SYSTEM.md`
7. `05-DOCTRINE-DESIGN.md`
8. `06-MODERNITE-MAI-2026.md`
9. `07-CONTENT-GEN-VERIFICATION.md`
10. `08-PERFORMANCE-AUDIT.md`
11. `09-A11Y-WCAG22-AUDIT.md`
12. `10-TESTS-ANTI-REGRESSION.md`
13. `11-CODE-QUALITY-DOC.md`
14. `12-RISQUES-ANGLES-MORTS.md`
15. `13-TIE-BREAKER.md` (si désaccords)
16. `14-PRE-PUSH-CHECKLIST.md` (Phase 4, obligatoire si verdict 🟢 ou 🟡)
17. `15-SMOKE-PROD-POST-PUSH.md` (Phase 5, optionnelle après push Will)
18. `VERDICT-PASS-B.md`
19. `EXEC-SUMMARY-PASS-B-WILL.md`

---

## 8. PHRASE D'INVOCATION (à coller en nouvelle conversation)

```
Lance la vérification Pass B refonte admin selon
_AUDIT/PROMPT-ADMIN-FRONTEND-VERIFICATION-PASS-B-2026.md.

═══════════════════════════════════════════════════════════════
⚠️ MODE AUDIT-ONLY STRICT
═══════════════════════════════════════════════════════════════

- AUCUNE écriture de code (Edit/Write/NotebookEdit interdits hors
  _AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/).
- AUCUN commit, AUCUN push, AUCUN tag git.
- AUCUNE installation de dépendance.
- AUCUNE modification de Server Action / API / Prisma / migration.

Autorisé : lecture (Read/Glob/Grep), commandes lecture seule
(pnpm typecheck/test/build/lint, git diff/log/tag), création des
16 livrables .md du Pass B.

═══════════════════════════════════════════════════════════════
📋 ORDRE D'EXÉCUTION (autopilote)
═══════════════════════════════════════════════════════════════

1. Phase 0 — Reality check du livré par prompt 1 (30 min).
   Si livraison < 70 % complète → STOP & rapport « Re-lancer prompt 1 ».

2. Phase 1 — 13 sous-agents Explore parallèles (UN seul message,
   13 tool uses simultanés : B1, B2, B2bis, B3, B4, B5, B6, B7, B8,
   B9, B10, B11, B12). Chaque sous-agent briefé qu'il n'a PAS écrit
   le code (lecture à froid + consigne « ignore memories < 2026-05-10
   en conflit avec code »). 13 livrables .md distincts.

3. Phase 2 — Si désaccords entre sous-agents sur findings critiques,
   lance sous-agent B14 tie-breaker. Sinon skip.

4. Phase 3 — Synthèse, scoring /3400 pondéré, malus -300 par
   non-négociable §3 violé + malus -500 par critère B2bis-1/2/3 violé.
   VERDICT-PASS-B.md + EXEC-SUMMARY-PASS-B-WILL.md.

5. Phase 4 — Pré-push checklist (si verdict 🟢 ou 🟡) :
   build Docker local, prisma migrate diff, PR #14 conflict, Sentry
   source maps, plan rollback, bundle delta vs baseline.
   → 14-PRE-PUSH-CHECKLIST.md avec décision GO/CONDITIONAL/NO-GO push.

6. Phase 5 — Smoke prod post-push (OPTIONNELLE, seulement si Will
   relance après son push). 11 URLs critiques + Sentry 24h + Lighthouse
   prod delta. → 15-SMOKE-PROD-POST-PUSH.md.

⚠️ Après CHAQUE `pnpm build`, exécuter immédiatement :
   git status --porcelain | grep -v "^?? _AUDIT/ADMIN-REFONTE-2026-05-17/VERIFICATION-PASS-B/" \
     && git stash push -u -m "pass-b-build-artifacts-$(date +%s)" \
     || true
   → garantit 0 mutation accidentelle hors livrables Pass B.

═══════════════════════════════════════════════════════════════
🎯 CIBLE
═══════════════════════════════════════════════════════════════

- Score ≥ 3060 / 3400 (90 %) + 0 P0 + 0 régression backend
  + 0 modif src/components/ui/** = 🟢 CERTIFIÉ.
- Phase 4 pré-push GO + plan rollback documenté = autorisation push.
- Will lit EXEC-SUMMARY-PASS-B-WILL.md en 60s et décide push ou pas.
- Si push fait par Will : il peut relancer ce prompt en mode
  « lance uniquement Phase 5 smoke prod post-push » 30 min après.

Démarre maintenant par Phase 0. Pas d'accusé de réception, go directement.
```

---

**Fin du prompt.**

> Note : ce prompt est conçu pour fonctionner même si le prompt 1 a partiellement échoué — le sous-agent B1 détecte la complétude livraison et la Phase 0 gate sur 70 %. En cas d'échec partiel, le verdict pointe vers un prompt 3 de fix-on-residuals.
