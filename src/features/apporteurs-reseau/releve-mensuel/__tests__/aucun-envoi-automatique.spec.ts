// @vitest-environment node

/**
 * Décision du dirigeant (D3, D7) : AUCUN e-mail à un apporteur sans son clic. `envoyerLot` n'est
 * appelé que par la Server Action du bouton ; ni le worker, ni la file, ni la reprise ne l'importent.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..", "..");

function fichiers(dir: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) {
      if (nom !== "node_modules" && nom !== ".next") fichiers(p, sortie);
    } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom) && nom !== "route.ts") {
      sortie.push(p);
    }
  }
  return sortie;
}

describe("aucun envoi automatique de relevé", () => {
  const sources = fichiers(RACINE);
  const lire = (p: string) => readFileSync(p, "utf8");

  it("`envoyerLot` n'est importé que par la Server Action du bouton", () => {
    const importeurs = sources
      .filter((p) => {
        const dansLeDossier = relative(RACINE, p).startsWith(
          "features/apporteurs-reseau/releve-mensuel/",
        );
        const motif = dansLeDossier
          ? /from\s+["'](?:\.\/envoi|[^"']*releve-mensuel\/envoi)["']/
          : /from\s+["'][^"']*releve-mensuel\/envoi["']/;
        return motif.test(lire(p));
      })
      .map((p) => relative(RACINE, p));
    expect(importeurs).toEqual(["features/apporteurs-reseau/releve-mensuel/actions-envoi.ts"]);
  });

  it("le gabarit `apporteur-releve-mensuel` n'est émis que par `envoi.ts`", () => {
    const emetteurs = sources
      .filter((p) => /gabarit:\s*["']apporteur-releve-mensuel["']/.test(lire(p)))
      .map((p) => relative(RACINE, p));
    expect(emetteurs).toEqual(["features/apporteurs-reseau/releve-mensuel/envoi.ts"]);
  });

  it("le worker et la file n'atteignent pas l'envoi", () => {
    for (const f of ["server/queue/workers/apporteur-crons-worker.ts", "server/queue/queues.ts"]) {
      expect(lire(join(RACINE, f))).not.toMatch(/releve-mensuel\/(envoi|actions-envoi)/);
    }
  });

  it("la Server Action du bouton exige la confirmation saisie et le droit de facturer", () => {
    const src = lire(join(RACINE, "features/apporteurs-reseau/releve-mensuel/actions-envoi.ts"));
    expect(src).toMatch(/peutEngager\(role, "facturer"\)/);
    expect(src).toMatch(/confirmation/);
  });
});
