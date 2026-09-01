/**
 * Garde : le worker doit INITIALISER Sentry, pas seulement savoir l'appeler.
 *
 * ── LA PANNE À DEUX ÉTAGES ───────────────────────────────────────
 *
 * Étage 1 (PR #913) : `captureException` était introuvable sous `tsx`, à cause
 * des exports conditionnels de `@sentry/nextjs`. Résolu par un repli CJS.
 *
 * 🔴 Étage 2, trouvé juste après : le worker n'appelait JAMAIS
 * `Sentry.init`. Les trois `Sentry.init` du dépôt sont chargés par Next, dont le
 * hook d'instrumentation ne s'exécute pas sous `tsx`. La fonction était donc
 * résolue — et l'événement partait vers un client inexistant.
 *
 * 🔑 **Un appel qui part nulle part a exactement la même tête qu'un
 * appel qui marche.** Rien ne lève, rien ne se journalise, et l'absence
 * d'événements dans Sentry ressemble à « tout va bien ». C'est pourquoi cette
 * garde ne peut pas se contenter de vérifier qu'un appel réussit.
 *
 * ── POURQUOI LA PREMIÈRE SONDE N'AVAIT PAS VU L'ÉTAGE 2 ────────────────
 *
 * `sonde-sentry-worker.fixture.mts` appelait `Sentry.init` **de sa propre
 * main**. Elle mesurait donc le pont en fournissant elle-même la condition
 * qu'elle aurait dû vérifier. Une sonde qui installe ce qu'elle teste ne teste
 * rien. Celle utilisée ici (`sonde-worker-sentry-complet.fixture.mts`) appelle
 * `initialiserSentryWorker()`, c'est-à-dire le code que le worker exécute.
 *
 * Éprouvée dans les deux sens le 2026-09-01 : `atteint` avec les deux étages,
 * `perdu` dès qu'on retire l'un ou l'autre.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "..", "..", "..", "..");
const SONDE = join(ICI, "sonde-worker-sentry-complet.fixture.mts");
const ENTREE_WORKER = join(ICI, "..", "..", "worker.ts");

describe("le worker initialise Sentry", () => {
  it("🔴 le point d'entrée appelle initialiserSentryWorker()", () => {
    // Contrôle statique, complémentaire de la sonde : il attrape la réorganisation
    // des points d'entrée, où le module d'initialisation existe toujours mais
    // n'est plus appelé par personne. La sonde, elle, importe le module
    // directement — elle resterait verte dans ce cas.
    const source = readFileSync(ENTREE_WORKER, "utf8");
    expect(
      source.includes("initialiserSentryWorker"),
      "`server/queue/worker.ts` n'appelle plus `initialiserSentryWorker()`. Le " +
        "worker tourne HORS de Next : sans cet appel, aucun client Sentry " +
        "n'existe dans le processus, et les 33 workers redeviennent muets sans " +
        "que rien ne le signale.",
    ).toBe(true);
  });

  it("🔴 un événement atteint réellement le client, dans le runtime du worker", () => {
    const r = spawnSync(process.execPath, ["--import", "tsx", SONDE], {
      encoding: "utf8",
      cwd: RACINE,
      timeout: 60_000,
    });
    const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;

    expect(
      sortie,
      `La sonde n'a rendu aucun verdict :
${sortie}`,
    ).toContain("VERDICT:");

    expect(
      sortie,
      "L'événement n'atteint PAS le client Sentry dans le runtime du worker. " +
        "Deux causes possibles, toutes deux déjà survenues : (1) le repli CJS de " +
        "`resoudreCapture()` a disparu de `sentry-worker.ts`, donc " +
        "`captureException` est introuvable sous `tsx` ; (2) " +
        "`initialiserSentryWorker()` n'initialise plus de client, donc " +
        "l'appel part vers le vide. Les deux sont SILENCIEUSES en production.",
    ).toContain("VERDICT:atteint");
  }, 90_000);
});
