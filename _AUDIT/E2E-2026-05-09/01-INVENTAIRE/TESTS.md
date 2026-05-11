# 01-INVENTAIRE — Tests

## Snapshot

```
> pnpm test (vitest run)
 Test Files  19 passed (19)
      Tests  127 passed (127)
   Duration  24.54 s
```

→ ✅ Tous les tests unitaires verts.

## Répartition par type

### Vitest unitaires (19 files, 127 tests)

Inclus :

- Composants UI primitives (`ui/button`, `ui/card`, `ui/alert`, `ui/badge`, …)
- Components layout (`layout/Container`)
- Components typography (`typography/Eyebrow`)
- Sections (`sections/Hero`, `sections/ProcessSteps`)
- Components marketing (`marketing/JsonLd`)
- Components calendar (`calendar/HouseCalendar`)
- Lib (`lib/utils`)
- `src/lib/pii-redaction.test.ts` (Sprint 24.1)

### Tests Playwright E2E (9 specs sous `tests/e2e/`)

```
tests/e2e/a11y.spec.ts
tests/e2e/i18n.spec.ts
tests/e2e/smoke.spec.ts
tests/e2e/flows/admin-auth.spec.ts
tests/e2e/flows/contact-submission.spec.ts
tests/e2e/flows/language-switch.spec.ts
tests/e2e/flows/public-pages-smoke.spec.ts
tests/e2e/flows/security-headers.spec.ts
tests/e2e/flows/seo-jsonld.spec.ts
```

→ Couverture : a11y, i18n, smoke, admin auth, contact flow, language switch, public pages smoke, headers sécurité, JSON-LD SEO.

### Tests Vitest intégration (1 spec)

`tests/integration/server-actions.test.ts` — Requiert DB. Non lancé en Phase 0 / Phase 1 (effet de bord).

### Tests schemas (3 specs)

```
tests/schemas/auth.test.ts
tests/schemas/forms.test.ts
tests/schemas/locale.test.ts
```

→ Tests Zod schemas — devraient être inclus dans `pnpm test` (déjà comptés dans 127).

## Total spec files

- **19** vitest files + **9** e2e + **1** integration + **3** schemas = **32 spec files**.
  - (Note : les 3 schemas sont peut-être déjà comptés dans 19 vitest.)

## Coverage

`pnpm test` n'inclut pas `--coverage` par défaut. Coverage par dossier : **[NON MESURÉ — `pnpm test --coverage` non lancé Phase 1 pour éviter overhead]**. AGT-13 TESTS pourra exécuter sur ses sous-périmètres.

## Mocks

- Component `JsonLd` testé avec snapshot virtuel (jsdom).
- Tests forms : Zod schema parse sans mock DB.
- Tests admin-auth E2E : Playwright avec creds env (skip si `[ACTION WILL]`).

## Citations

- Output vitest : `pnpm test` 127/127 passed.
- `tests/e2e/flows/*.spec.ts` (6 flows + a11y + i18n + smoke).
- `tests/integration/server-actions.test.ts`.

## Détails AGT-13 TESTS

Couverture précise par dossier, flakiness, mocks-vs-real DB, snapshots → AGT-13.
