# A07 Phase 7 — E2E baseline Playwright

## Statut : ⚠️ STUB-OK

Constat : la claim "7 tests Playwright" est cohérente avec l'exécution runtime (5 itérations E1 par verticale + E2 + E3 = 7 cas Playwright effectifs), mais le fichier ne contient que **3 déclarations `test()`** au sens source, ce que confirme le commit message d'origine ("3 smoke tests Playwright"). Pas de fraude, juste un comptage différent (déclaration vs cas exécutés).

## Files claimed vs found

| Claim                                                   | Found                                                                      | Match |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | ----- |
| Commit `a36ce1dc` test(e2e) phase 7                     | Commit `a36ce1dc913040821b28767941fb0176a2bf3519`, auteur Manon, 1 fichier | ✅    |
| `tests/e2e/landing-ville-verticale.spec.ts` (72 lignes) | `axionia/tests/e2e/landing-ville-verticale.spec.ts`, 72 lignes (`+72`)     | ✅    |
| Route ciblée Phase 5 commit 2                           | `/fr/implantations/[region]/[ville]/[verticale]`                           | ✅    |

## Nombre de tests détectés dans landing-ville-verticale.spec.ts

- **3 déclarations `test(...)`** dans la source (lignes 32, 51, 66) :
  - L.32 : `E1.${verticale}: répond 200` (à l'intérieur d'un `for (const verticale of VERTICALES)`)
  - L.51 : `E2: breadcrumb complet`
  - L.66 : `E3: verticale invalide → 404`
- **7 cas Playwright à l'exécution** : 5 itérations E1 (5 verticales : `interventions`, `audits`, `implementations`, `un-a-un`, `sites-web-ia`) + E2 + E3.
- Le commit message déclare honnêtement "3 smoke tests" ; le prompt parle de "7 tests" — les deux sont vrais selon l'angle (source vs runtime).

## Cross-checks

- `playwright.config.ts` inclut `tests/e2e/` : **oui** (`testDir: "./tests/e2e"`, L.6 de `axionia/playwright.config.ts`).
- Edge cases E1-E7 identifiables par naming : **partiellement**. Le prompt parle de "E1-E7" (7 edge cases distincts) ; le fichier expose **3 catégories E1/E2/E3** uniquement (E4-E7 absents). Le naming runtime serait `E1.interventions`, `E1.audits`, … → ce sont 5 instances d'E1, pas 5 edge cases distincts E1-E5.
- 5 projets configurés dans `playwright.config.ts` (chromium, webkit, firefox, mobile-chrome, mobile-safari) → 7 cas × 5 projets = **35 exécutions** par run complet.
- `webServer` auto-start configuré (CI : `pnpm start`, local : `pnpm dev`, override via `E2E_BASE_URL`).
- Pas d'exécution Playwright effectuée (skip explicite, infra non démarrée).
- Pas de mocks DB : tests honnêtes — assertions tolèrent stub minimal noindex (cf. Phase 5 commit 2) ET rendu complet.
- `page.on("console")` capture les erreurs JS console (assertion `errors).toEqual([])`) → signal régression rendering.
- Test E3 ciblé `unknown-vertical` → status 404 attendu (cohérent avec `notFound()` server-side).

## Verdict / écarts trouvés

**Verdict : STUB-OK** — baseline E2E livrée et structurellement correcte, mais avec une **discordance de naming entre la claim du prompt et la réalité du fichier**.

Écarts identifiés :

1. **Naming "E1-E7" trompeur dans la claim** : le fichier ne contient pas 7 edge cases distincts. Il contient 3 catégories (E1 paramétrée × 5 + E2 + E3). Les "E4-E7" n'existent pas. Le commit message est honnête ("3 smoke tests"), le prompt sur-vend.
2. **Couverture limitée** : aucun test sur les pages de campagne, le wizard admin, le worker orchestrator (Phases 1-4), l'API d'expansion (Phase 4). Baseline restreinte au seul "route publique landing-ville × verticale" de Phase 5 commit 2.
3. **Pas d'exécution observée** : aucune trace de run Playwright (pas de `test-results/`, pas de rapport HTML committed). Verdict structurel uniquement.
4. **Tolérance stub forte** : l'assertion `expect(page.locator("h1").first()).toBeVisible()` passe que le rendu soit le stub minimal noindex ou le rendu complet — utile pour ne pas dépendre de la DB en CI, mais réduit la valeur du smoke test (un stub vide passerait aussi tant qu'il a un h1).
5. **Aucun fichier `.spec.ts` E2E concurrent dans `tests/e2e/`** non vérifié dans ce sub-agent (hors scope A07, mais à noter pour audit global).

Pas de bug technique, pas de mock prod, pas de skip de tests. Le code est propre. La seule réserve est sémantique : "baseline 7 tests E2E" est une lecture généreuse de "3 smoke tests dont un loop ×5".
