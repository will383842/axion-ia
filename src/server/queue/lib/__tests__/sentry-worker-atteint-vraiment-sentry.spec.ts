/**
 * Garde : une erreur de worker doit ATTEINDRE Sentry, pas seulement l'appeler.
 *
 * ── DEUX CONTRÔLES VERTS QUI NE REGARDAIENT PAS LA PRODUCTION ─────────────
 *
 * 1. `sentry-worker.spec.ts`, juste à côté, porte 16 tests verts sur ce même
 *    helper. Ils sont restés verts pendant les six semaines où AUCUNE erreur de
 *    worker n'atteignait Sentry, parce qu'ils commencent par :
 *
 *        vi.mock("@sentry/nextjs", () => ({ captureException: captureExceptionMock }));
 *
 *    Une doublure qui expose `captureException` prouve que le helper l'appelle.
 *    Elle ne prouve pas que le VRAI paquet la fournit — et c'était exactement là
 *    qu'était la panne.
 *
 * 2. La PREMIÈRE version de cette garde-ci, écrite le 2026-09-01, retirait le
 *    mock et appelait le vrai paquet — en vitest. Elle est restée VERTE après
 *    neutralisation du correctif. Motif : **Vite ne résout pas `@sentry/nextjs`
 *    comme Node**. Sous Vite, l'import statique rend le build complet (201
 *    symboles) et le repli n'est jamais atteint ; sous `tsx`, il rend un build
 *    de 28 symboles sans `captureException`. Retirer le mock ne suffisait donc
 *    pas : il fallait changer de RUNTIME.
 *
 * ── CE QUE FAIT CELLE-CI ───────────────────────────────────────
 *
 * Elle lance `sonde-sentry-worker.fixture.mts` dans un PROCESSUS SÉPARÉ, sous
 * `node --import tsx` — la commande qui démarre le worker en production
 * (`package.json` → `"worker": "tsx src/server/queue/worker.ts"`). La sonde
 * initialise un vrai client, intercepte les événements en sortie, appelle
 * `captureWorkerError()` et dit si l'événement est arrivé.
 *
 * Éprouvée dans les deux sens le 2026-09-01 : `VERDICT:atteint` avec le repli
 * CJS de `resoudreCapture()`, `VERDICT:perdu` sans lui. Une garde qui ne rougit
 * pas quand on retire ce qu'elle surveille ne garde rien.
 *
 * Rien ne part sur le réseau : le `beforeSend` de la sonde rend `null`.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { captureWorkerError } from "../sentry-worker";

const ICI = dirname(fileURLToPath(import.meta.url));
const SONDE = join(ICI, "sonde-sentry-worker.fixture.mts");

describe("captureWorkerError — dans le runtime RÉEL du worker", () => {
  it("🔴 l'événement atteint le client sous tsx — ce qui manquait depuis juillet", () => {
    const r = spawnSync(process.execPath, ["--import", "tsx", SONDE], {
      encoding: "utf8",
      // Le worker est lancé depuis la racine du dépôt ; on reproduit.
      cwd: join(ICI, "..", "..", "..", "..", ".."),
      timeout: 60_000,
    });

    const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;

    expect(
      sortie,
      `La sonde n'a rendu aucun verdict. Sortie complète :
${sortie}`,
    ).toContain("VERDICT:");

    expect(
      sortie,
      "L'événement N'ATTEINT PAS le client Sentry dans le runtime du worker. " +
        "C'est le défaut du 2026-07-21 : `@sentry/nextjs` chargé en ESM sous " +
        "`tsx` n'expose pas `captureException` (28 symboles au lieu de 201), " +
        "et le helper abandonnait en silence — sur les 33 workers, pas " +
        "seulement l'e-mail. Vérifier le repli CJS de `resoudreCapture()` " +
        "dans `sentry-worker.ts`.",
    ).toContain("VERDICT:atteint");
  }, 90_000);

  it("un échec d'observabilité ne casse JAMAIS le worker qui l'appelle", () => {
    // Ce contrôle-là vaut en processus : il ne dépend d'aucune résolution de
    // module. Le helper est appelé depuis `worker.on("failed")` — ce n'est pas
    // le moment de lever une seconde exception.
    expect(() =>
      captureWorkerError("email", "email", undefined, { pas: "une Error" }),
    ).not.toThrow();
  });
});
