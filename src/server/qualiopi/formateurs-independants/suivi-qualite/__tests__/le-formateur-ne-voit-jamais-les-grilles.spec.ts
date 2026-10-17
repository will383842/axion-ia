/**
 * Qualiopi ind. 21 — LE FORMATEUR NE VOIT JAMAIS LES GRILLES de suivi qualité ni les
 * décisions qui le concernent. Aucun fichier de son espace (pages, composants, lectures
 * serveur, routes) ne lit le module ni les deux tables ; et l'écran console exige l'acte
 * `habiliter_formateur`, comme les deux actions.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const ESPACES = [
  "src/app/formateur",
  "src/app/[locale]/espace-formateur",
  "src/components/espace-formateur",
  "src/server/formateur",
  "src/app/api/espace-formateur",
  "src/app/api/formateur",
];

function fichiers(dossier: string): string[] {
  const abs = join(RACINE, dossier);
  let entrees: string[];
  try {
    entrees = readdirSync(abs);
  } catch {
    return [];
  }
  return entrees.flatMap((e) => {
    const rel = join(dossier, e);
    return statSync(join(RACINE, rel)).isDirectory()
      ? fichiers(rel)
      : /\.(ts|tsx)$/.test(e)
        ? [rel]
        : [];
  });
}

const INTERDITS = [
  /suivi-qualite/,
  /grilleSuiviFormateur/,
  /decisionSuiviFormateur/,
  /grillesSuiviQualite/,
];

describe("le formateur ne voit jamais les grilles (ind. 21)", () => {
  it("aucun fichier de l'espace formateur ne les lit", () => {
    const tous = ESPACES.flatMap(fichiers);
    expect(tous.length).toBeGreaterThan(10);
    const fautifs = tous.filter((f) => {
      const s = readFileSync(join(RACINE, f), "utf8");
      return INTERDITS.some((r) => r.test(s));
    });
    expect(fautifs).toEqual([]);
  });

  it("l'écran et les actions exigent l'acte `habiliter_formateur`", () => {
    const page = readFileSync(
      join(
        RACINE,
        "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/suivi-qualite/page.tsx",
      ),
      "utf8",
    );
    expect(page).toMatch(/peutEngager\(acces\.role, "habiliter_formateur"\)/);
    const actions = readFileSync(
      join(RACINE, "src/server/actions/qualiopi/suivi-qualite-formateurs.ts"),
      "utf8",
    );
    expect(actions.match(/requireHabilitation\("habiliter_formateur"\)/g)).toHaveLength(2);
  });
});
