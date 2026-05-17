# Refonte frontend admin Axion-IA — Mai 2026

> Master prompt : [`../PROMPT-ADMIN-FRONTEND-REFONTE-2026.md`](../PROMPT-ADMIN-FRONTEND-REFONTE-2026.md)
> Date de démarrage : 2026-05-17
> Mode : autopilote local (commits sur `main`, **0 push**)
> Baseline rollback : tag `admin-refonte-baseline-2026-05-17` (créé pré-Phase 0)

## Manifest des livrables (au fur et à mesure)

### Pré-flight §3bis

- `JOURNAL.md` — journal de bord chronologique (décisions, gates, verdicts)
- (à venir) `src/lib/feature-flags.ts` — toggle `ADMIN_V2_ENABLED`
- (à venir) `tests/e2e/admin-baseline-screenshots.spec.ts` — golden @baseline

### Phase 0 — Reality check

- `00-INVENTORY.md` — inventaire exhaustif 15 points

### Phase 1 — Audit 8 sous-agents //

- `01-AUDIT-LAYOUT-NAV.md`
- `02-AUDIT-DESIGN-SYSTEM.md`
- `03-AUDIT-PAGES-CATEGORIES.md`
- `04-AUDIT-CONTENT-GEN.md` (poids 2×)
- `05-AUDIT-FORMS-ACTIONS.md`
- `06-AUDIT-A11Y-KEYBOARD.md`
- `07-AUDIT-PERF-BUNDLE.md`
- `08-AUDIT-DX-PATTERNS.md`
- `SYNTHESE-PHASE-1.md`

### Phase 2 — Conception

- `ADR-0028-design-system-admin.md`
- `PATTERNS.md`
- `IMPLEMENTATION-PLAN.md`

### Phases 3-7 — Implémentation (PRs-équivalents 0 → 14)

- Tags locaux `admin-refonte-prX-start` / `admin-refonte-prX-end` (X = 0..14)
- JOURNAL entries par PR-équivalent

### Phase 8 — Certification

- `VERDICT-FINAL.md` (/2000)
- `ANTI-REGRESSION-REPORT.md`
- `EXEC-SUMMARY-WILL.md`
- `LISTE-COMMITS-LOCAUX-PRETS.md`

## Règles dures appliquées (override §17 du prompt master)

1. **0 push origin**. Tags locaux uniquement. Liste commits non pushés finale.
2. Commits directs sur `main` local. Conventional Commits, granularité fine.
3. Autopilote sauf 4 cas STOP & ASK (scope > 200 routes / score < 350 / régression non-réparable / npm > 30 KB gz).
4. Boucle de vérif obligatoire par PR-équivalent : gates A + self-review B + cross-checks C + journal D.
