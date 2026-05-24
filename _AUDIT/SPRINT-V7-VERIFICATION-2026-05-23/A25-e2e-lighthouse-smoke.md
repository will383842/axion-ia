# A25 — E2E + Lighthouse smoke

## Statut : ❓ Skipped env down (parsing/listing ✅, execution impossible sans Docker)

Justification : Docker Desktop daemon DOWN (`failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`) → Postgres + Redis du projet inaccessibles → `pnpm dev` ne peut pas servir les pages SSG DB-dependent (les magic strings `stub.invalid` ne s'appliquent qu'au build, pas au runtime). Aucune dev server vivante détectée sur `http://localhost:3000/fr` (HTTP 000). Per consignes A25, c'est un skip attendu, **pas un échec**.

Listing Playwright (`--list`) exécuté avec succès → les 2 specs **compilent + parsent + sont collectables** par Playwright. C'est le maximum vérifiable sans backend live.

## Préalables

- `tests/e2e/landing-ville-verticale.spec.ts` : ✅ exists (`C:/Users/willi/Documents/Projets/Axion-IA/axionia/tests/e2e/landing-ville-verticale.spec.ts`)
- `tests/e2e/perfection-extreme.spec.ts` : ✅ exists (`C:/Users/willi/Documents/Projets/Axion-IA/axionia/tests/e2e/perfection-extreme.spec.ts`)
- playwright installed : ✅ yes, version **1.60.0** (devDep declared `^1.59.1` dans `axionia/package.json` ligne 186 — version installée légèrement plus récente)
- `playwright.config.ts` : ✅ présent (`C:/Users/willi/Documents/Projets/Axion-IA/axionia/playwright.config.ts`)
- script npm `test:e2e` : ✅ défini → `"test:e2e": "playwright test"` (package.json ligne 45)
- Docker daemon : 🔴 **DOWN** (Docker Desktop pas lancé — `docker ps` fail "find no path dockerDesktopLinuxEngine")
- dev server `localhost:3000` : 🔴 absent (HTTP code 000 au probe)

## Listing (sans run)

Commande : `pnpm exec playwright test tests/e2e/landing-ville-verticale.spec.ts tests/e2e/perfection-extreme.spec.ts --list`

- **Total détectable : 70 tests** ✅ (parsing sans erreur)
- Décomposition logique :
  - `landing-ville-verticale.spec.ts` : 7 tests logiques (5 `E1.*` verticales [interventions/audits/implementations/un-a-un/sites-web-ia] + 1 `E2` breadcrumb + 1 `E3` verticale invalide → 404) → labellés Sprint v7 Phase 5 commit 2
  - `perfection-extreme.spec.ts` : 7 tests logiques (5 `PE.*` pages publiques [Home/Audit/Interventions/Hub Paris/Paris × interventions] + 1 `PE.JSON-LD` + 1 `PE.canonical-fr`) → labellés Sprint v7 Phase 18
- Total brut 70 = 14 tests × ~7 projets (chromium / firefox / webkit / mobile-chrome / mobile-safari / edge / branded — extensions cross-browser).

## Execution (si possible)

- dev server up : **NO** (Docker daemon DOWN → impossible de booter Postgres/Redis ; runtime needs them)
- Tentative `pnpm dev` background : **skipped délibérément** — sans DB live, la 1ère page DB-dependent (sitemap, hubs villes) crash le worker Next + spam erreurs Prisma. Le run E2E sur instance partiellement-bootée serait non-significatif (False negatives garantis).
- Tentative `pnpm exec playwright test landing-ville-verticale + perfection-extreme` : **non lancé** (aucun baseURL servable)
- Result : **skipped** (env infra down — comportement attendu pour A25 read-only)

## Lighthouse

- lhci installed : ✅ yes, version **0.15.1** (`@lhci/cli` via `pnpm lhci --version`)
- `lighthouserc.json` : ✅ présent (`C:/Users/willi/Documents/Projets/Axion-IA/axionia/lighthouserc.json`)
- Script npm `lhci` : ✅ défini → `"lhci": "lhci collect"` (package.json ligne 48)
- Smoke run : **skipped** (même raison — pas de dev server `localhost:3000`, `lhci collect` aurait `ECONNREFUSED` sur chaque URL ciblée)
- Result : **skipped**

## Verdict / écarts trouvés

**Conclusion A25 : ❓ Skipped — env down, mais infra E2E saine au repos.**

Findings positifs (parsing-level, READ-ONLY) :

1. ✅ Les **2 spec files attendus existent** au chemin canonique `axionia/tests/e2e/` (cohérent avec note Sprint v7 Phase 5/Phase 18 dans la memory).
2. ✅ **Playwright 1.60.0 installé et fonctionnel** (`--list` retourne 70 tests collectés sans erreur de parsing/compilation).
3. ✅ **70 tests listés** = 14 logiques × ~7 projets/navigateurs (config Playwright multi-browser bien câblée).
4. ✅ **lhci 0.15.1 installé** + `lighthouserc.json` + script npm `lhci` câblés → infrastructure Web Vitals 2026 budget gate prête.
5. ✅ Scripts npm `test:e2e` + `lhci` cohérents avec `package.json` (lignes 45, 48).

Écarts/blocages observés (purement environnemental, **pas un défaut Sprint v7**) :

- 🔴 **Docker Desktop daemon DOWN au moment de l'audit** → impossibilité de booter Postgres + Redis localement → `pnpm dev` non-viable → execution réelle des suites E2E + Lighthouse skipée. Solution Will (hors scope A25 READ-ONLY) : lancer Docker Desktop, puis `pnpm db:up && pnpm dev && pnpm test:e2e -- tests/e2e/landing-ville-verticale.spec.ts tests/e2e/perfection-extreme.spec.ts --project=chromium --reporter=line` pour run réel (~3-5 min).
- Note : aucune dépendance live de prod testée non plus (pas de probe vers `axion-ia.com` — hors scope A25 qui est strict local smoke).

Aucun écart de code/config Sprint v7 détecté à ce niveau de vérification (parsing-only). La couche E2E + Lighthouse est **infra-ready** ; seul l'environnement local de l'agent au moment T n'est pas suffisant pour un run réel, ce qui est conforme aux constraints A25 (« Acceptable de tout skip si env down — c'est attendu, pas un échec »).
