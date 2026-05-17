# Verdict Phase 3 — Initial pré-fix (autopilot 2026-05-18)

## Score initial

**1837.6 / 2000 (91.88 %)** — **🟢 GO** (≥1700 cible).

## Tableau 16 non-négociables §3

> Référence master prompt §3 + §3.5-3.10. ✓ = préservé, ✗ = violation, 🟡 = partiel/justifié.

| #   | Non-négociable                                           | Verdict | Source preuve                                       |
| --- | -------------------------------------------------------- | ------- | --------------------------------------------------- |
| 1   | Sentry.captureException / setTag préservé                | ✓       | A2 (200/200), 0 retrait, +1 ajout justifié          |
| 2   | logActivity / ActivityLog.create préservé                | ✓       | A3 (200/200), 0 retrait, 83 occurrences identiques  |
| 3   | force-dynamic sur routes admin                           | 🟡      | A5 (190/200), 115/116 conforme (1 redirect)         |
| 4   | Pas de `revalidate` sur routes admin                     | ✓       | A5 — 0 occurrence                                   |
| 5   | Server Actions inchangées                                | ✓       | A6 (200/200), 0 fichier touché, 81/81 use server    |
| 6   | Prisma schema + migrations inchangés                     | ✓       | A7 (200/200), 0 diff prisma/                        |
| 7   | RLS preservation                                         | ✓       | A7 — seeds inchangés                                |
| 8   | SSE JobLogStream contrat                                 | ✓       | A8 (200/200), 0 diff sur 4 fichiers SSE             |
| 9   | SSE GeoEventsBanner contrat                              | ✓       | A8 — 0 diff                                         |
| 10  | CSP nonce non-cassé (pas de inline `<script>`/`<style>`) | ✓       | A4 — 0 ajout script/style brut                      |
| 11  | Pas d'ajout `dangerouslySetInnerHTML` injustifié         | ✓       | A4 — baseline 16 → HEAD 18, 1 ajout preservation V1 |
| 12  | Pattern V1/V2 flag sur 116 routes                        | 🔴      | A1 (109.5/200), 104/116 conforme — **P0 dominant**  |
| 13  | Tests Vitest pass                                        | ✓       | A10 (170/200), 945/945 pass + 2 skipped             |
| 14  | Coverage thresholds CI                                   | 🔴      | A10 — 3/4 thresholds échouent (**P0**)              |
| 15  | Cloisonnement admin/ui (pas d'import public)             | ✓       | A9 (200/200), 0 violation                           |
| 16  | Gates santé (tsc/lint/anti-hex/use-client)               | 🟡      | A11 (165/200), 5/7 verts, 2 isolation-check delta   |

**Bilan** : **12/16 ✓**, **3/16 🟡** (mineurs), **2/16 🔴** (P0 fixables).

## Liste P0 / P1 / P2 ordonnée

### P0 (3) — Phase 4 obligatoire

1. **FINDING-P0-01** — 11 routes admin manquent pattern flag (effort ~2h, fix mécanique).
2. **FINDING-P0-02** — Coverage thresholds 24.43/26 + 24.43/26 + 31.71/33 (effort 5 min, ratchet).
3. **FINDING-P0-03** — Streak deploy 5+ ratés — auto-débloqué par Phase 9/10 après push frais.

### P1 (4) — Phase 4 si effort < 30 min

1. **FINDING-P1-01** — force-dynamic sur redirect page (2 min).
2. **FINDING-P1-02** — staging.yml `if:` syntax (5 min).
3. **FINDING-P1-03** — content-gen isolation whitelist (5 min).
4. **FINDING-P1-04** — image-bank isolation whitelist (5 min).

### P1 (2) — non-fixable autopilot

- FINDING-P1-05 (12 style{{}} JSX) — justifié runtime/CSP-safe, conserver.
- FINDING-P1-06 (login flag) — sera traité via P0-01.

### P2 (5) — déférer post-deploy

- 47/48 content-gen sub-routes V1 (par design).
- 26/31 primitives sans tests (Sprint 1.5).
- ECONNREFUSED ioredis logs (cosmétique).
- 2 `it.skip` à documenter.
- ESLint `.claude/worktrees` noise.

## Estimation effort Phase 4

| ID                          | Effort    | Type                   |
| --------------------------- | --------- | ---------------------- |
| P0-01 (11 routes)           | ~2 h      | Mécanique pattern flag |
| P0-02 (coverage)            | 5 min     | Config                 |
| P0-03 (deploy)              | 0 min     | Phase 9/10             |
| P1-01 force-dynamic         | 2 min     | 1 ligne                |
| P1-02 staging.yml           | 5 min     | YAML syntax            |
| P1-03 content-gen isolation | 5 min     | Doc whitelist          |
| P1-04 image-bank isolation  | 5 min     | Doc whitelist          |
| **TOTAL P0+P1 fixables**    | **~2h25** | —                      |

## Décision Phase 4

✅ **Lancer Phase 4 fix de tous les P0 + 4 P1 fixables**.

Ordre recommandé :

1. P0-02 coverage threshold (débloque CI Gate A — toutes itérations suivantes bénéficient).
2. P1-01 force-dynamic (trivial, regroupe diff Phase 4).
3. P1-02 staging.yml (trivial, regroupe diff).
4. P1-03/04 isolation whitelist (trivial).
5. P0-01 pattern flag 11 routes (gros morceau, à committer par batch de 3-4 routes pour traçabilité).

**Tag start Phase 4** : `admin-refonte-fix-2026-05-18-start`.
