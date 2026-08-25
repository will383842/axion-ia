/**
 * CLIQUET — aucun worker n'appelle Sentry directement.
 *
 * ## Le fait structurel, mesuré en production le 2026-07-21
 *
 * Le worker tourne en Node pur (`tsx src/server/queue/worker.ts`), **hors du
 * bundler Next**. Dans ce contexte `@sentry/nextjs` résout vers un build qui
 * n'expose que 27 symboles : `init` est présent, **`captureException` NON**.
 * `sentry-worker.ts:153-164` porte la mesure et le constat.
 *
 * `captureWorkerError()` le détecte et le signale bruyamment
 * (`sentry-worker.ts:170-177`). **Six workers appelaient `captureException`
 * directement, sans cette garde.**
 *
 * ## Ce que ça produisait
 *
 * Un appel à `undefined` lève un `TypeError` **à l'intérieur d'un gestionnaire
 * `worker.on("failed", …)`** — donc dans un `EventEmitter`, où il remonte en
 * exception non capturée.
 *
 * 🔴 **Et l'aggravation, mesurée sur `image-bank-import-worker.ts`** : l'appel
 * nu était placé **AVANT** l'appel gardé. Le repli sûr, écrit juste en dessous,
 * n'était donc **jamais atteint**. La ligne censée rattraper la panne était
 * rendue inaccessible par celle qui la causait.
 *
 * ## Pourquoi ce cliquet DÉRIVE
 *
 * Il ne nomme pas les six workers d'aujourd'hui : il balaye le répertoire et
 * refuse **tout** appel direct. Le septième, écrit demain, sera vu sans qu'on
 * touche à ce fichier — *une garde qui nomme sa cible ne peut pas voir le
 * jumeau*, et ce dépôt l'a payé assez de fois.
 *
 * ⚠️ Le bénéfice ne s'arrête pas à la garde : `captureWorkerError` passe la
 * charge utile du job par `sanitizeJobData`, qui masque adresses e-mail,
 * téléphones et mots de passe d'URL. Un appel direct envoyait `job.data` brut.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WORKERS = join(process.cwd(), "src", "server", "queue", "workers");

/**
 * Le code seul, commentaires VIDÉS et lignes préservées.
 *
 * 🔴 Sans cela, ce cliquet accuserait sa propre prose : l'en-tête ci-dessus
 * contient la chaîne `Sentry.captureException`, et un balayage naïf compterait
 * ce fichier comme fautif. Ce dépôt a payé « un test statique trouve ses
 * propres commentaires » plusieurs fois, dont deux le 2026-08-25.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
    .split(/\r?\n/)
    .map((l) => (l.trim().startsWith("//") ? "" : l))
    .join("\n");
}

/** Tous les workers de production. */
function fichiersWorkers(): string[] {
  return readdirSync(WORKERS)
    .filter((f) => f.endsWith(".ts") && !f.includes(".spec.") && !f.includes(".test."))
    .map((f) => join(WORKERS, f))
    .filter((f) => statSync(f).isFile());
}

/** L'appel DIRECT que l'on refuse — `Sentry.captureException(` ou `.captureMessage(`. */
const APPEL_DIRECT = /\bSentry\s*\.\s*capture(?:Exception|Message)\s*\(/;

describe("aucun worker n'appelle Sentry directement", () => {
  it("🔑 CONTRE-TÉMOIN : le balayage voit réellement les workers", () => {
    // Si `fichiersWorkers` cessait de trouver quoi que ce soit — répertoire
    // renommé, filtre trop strict — le test central rendrait une liste vide de
    // fautifs et passerait au vert sans avoir examiné un seul fichier.
    expect(
      fichiersWorkers().length,
      "le balayage ne trouve plus aucun worker : le test central ne garde plus rien.",
    ).toBeGreaterThanOrEqual(20);
  });

  it("🔑 CONTRE-TÉMOIN : le motif reconnaît bien un appel direct, et ignore l'appel gardé", () => {
    // Sans ceci, le motif pourrait cesser de reconnaître ce qu'il traque et
    // rendre zéro fautif sur un fichier qui en est plein.
    expect(APPEL_DIRECT.test('Sentry.captureException(err, { tags: { worker: "x" } });')).toBe(
      true,
    );
    expect(APPEL_DIRECT.test("Sentry . captureException ( err )")).toBe(true);
    expect(APPEL_DIRECT.test("Sentry.captureMessage('coucou')")).toBe(true);

    // Et ce qu'il ne doit PAS compter : le passage par le helper gardé.
    expect(APPEL_DIRECT.test('captureWorkerError("email", "emails", job, err);')).toBe(false);
  });

  it("chaque worker passe par `captureWorkerError`, jamais par Sentry en direct", () => {
    const fautifs = fichiersWorkers()
      .filter((chemin) => APPEL_DIRECT.test(codeSeul(chemin)))
      .map((chemin) => chemin.slice(WORKERS.length + 1));

    expect(
      fautifs,
      "appel DIRECT à Sentry dans un worker. `captureException` est ABSENT du " +
        "build `@sentry/nextjs` résolu hors bundler Next (mesuré en prod le " +
        "2026-07-21) : l'appel lève un TypeError dans un gestionnaire " +
        '`worker.on("failed")`, donc en exception non capturée — et quand il ' +
        "précède l'appel gardé, il rend le repli sûr inatteignable. " +
        "Passer par `captureWorkerError()`, qui détecte le cas, le signale, et " +
        "assainit la charge utile du job.",
    ).toEqual([]);
  });
});
