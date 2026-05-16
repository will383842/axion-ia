# 09 — Tests + CI Gates

> **Pondération** : 50 pts | **Score** : **20/50** (40%) 🔴

---

## 9.1 Couverture tests — ❌ 0/30

**Vérification exhaustive** :

```bash
ls tests/image-bank/ 2>/dev/null
find tests -name '*image*' -type f 2>/dev/null
```

- `tests/image-bank/unit/` → **VIDE** (0 fichiers)
- `tests/image-bank/integration/` → **VIDE** (0 fichiers)
- `tests/image-bank/e2e/` → **VIDE** (0 fichiers)

**Aucun test livré V1** alors que :

- Plan IMPLEMENTATION-PLAN.md §1.4 exit criteria demande **≥ 80% coverage services**
- 11 services (`*.service.ts`) à `src/server/image-bank/` : ~2728 LOC TS non couverts

### Tests attendus (manquants)

| #   | Test                                                              | Cible                                |
| --- | ----------------------------------------------------------------- | ------------------------------------ |
| 1   | `tests/image-bank/unit/image-bank.service.spec.ts`                | CRUD + revalidateTag + trackUsage    |
| 2   | `tests/image-bank/unit/image-import.service.spec.ts`              | Sharp pipeline + EXIF strip          |
| 3   | `tests/image-bank/unit/image-seo.service.spec.ts`                 | JSON-LD + score calc                 |
| 4   | `tests/image-bank/unit/image-country-detector.service.spec.ts`    | Pattern + DB lookup                  |
| 5   | `tests/image-bank/unit/image-attribute-validator.service.spec.ts` | 8 validators                         |
| 6   | `tests/image-bank/unit/image-taxonomy-detector.service.spec.ts`   | Pattern + Claude fallback            |
| 7   | `tests/image-bank/integration/upload-flow.spec.ts`                | End-to-end upload → enrich → publish |
| 8   | `tests/image-bank/e2e/admin-upload.spec.ts` (Playwright)          | Admin UX upload                      |
| 9   | `tests/image-bank/e2e/public-detail-page.spec.ts`                 | SSR detail + SEO meta                |

**Effort estimé** : 12-16h pour 80% coverage acceptable.

**Status** : Plan ADR 0027 §5 reporte tests Sprint 2.x/3.x — acceptable V1 conditionnel (CONDITIONAL GO).

**Classement** : **P1 (pas P0)** car V1 image-bank en autopilot avec workers désactivés. Tests requis AVANT activation prod.

## 9.2 verify:all extension — ✅ 15/15

`package.json:69` :

```json
"verify:all": "pnpm typecheck && pnpm lint && ... && pnpm image-bank:isolation-check && pnpm test"
```

✅ `pnpm image-bank:isolation-check` inclus AVANT `pnpm test`.

`scripts/image-bank/isolation-check.ts` (200 LOC) :

- Path-based check (ALLOWED_PATTERNS 19 patterns)
- Content-based check (IMAGE_BANK_MARKERS si fichier mentionne image-bank hors zone)
- Mode `--staged` (pre-commit) + full scan (CI)
- Exit code 1 on violation

✅ Standalone `pnpm image-bank:isolation-check` OK.

## 9.3 Pre-commit hooks — ✅ 5/5

`.husky/pre-commit` :

```bash
pnpm anti-siren:check
pnpm anti-hex:check
pnpm use-client:check
pnpm typecheck
```

- ✅ 4 gates actifs
- ✅ Gitleaks protection ajoutée 2026-05-15 (secrets)
- ✅ Aucune exception bypass détectée dans cette branche

---

## 📋 Issues identifiées

### P1 (1)

- **P1-1** : Zéro test Vitest livré. Plan §1.4 exige ≥80% coverage. Effort 12-16h.

---

## 🎯 Sous-pondération

| Check                                       |    Pts |  Score |
| ------------------------------------------- | -----: | -----: |
| 9.1 Tests Vitest unit+integration+e2e       |     30 |      0 |
| 9.2 verify:all + image-bank:isolation-check |     15 |     15 |
| 9.3 Pre-commit hooks                        |      5 |      5 |
| **TOTAL**                                   | **50** | **20** |

---

## ✅ Verdict Phase 9

**🔴 SPRINT CORRECTIF 20/50 (40%)** — Zero tests livrés. Plan ADR 0027 reporte tests Sprint 2.x/3.x (acceptable doctrine V1 CONDITIONAL).

**P1 bloquant prod activation workers** : ajouter au minimum les 9 tests cibles avant flip switch `worker.ts`. Effort 12-16h.

verify:all + pre-commit OK : infrastructure CI prête à recevoir tests.
