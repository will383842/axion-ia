/**
 * ⛔ LES RÔLES DE L'ENREGISTREUR SONT CEUX DU DOSSIER CLIENT (PR 5, A2).
 *
 * La liste A2 n'est déclarée qu'UNE fois, dans le module pur
 * `src/features/dossier-client/roles-echanges.ts`. L'enregistreur (jeton,
 * route d'ouverture, page et actions de la console) la CONSOMME : il ne la
 * recopie pas et n'a pas sa propre garde.
 *
 * Mutations qui rougissent :
 *   · réécrire `["super_admin", "admin"]` dans un fichier de l'enregistreur ;
 *   · remplacer `peutVoirLesEchanges` par un prédicat local dans `jeton.ts` ;
 *   · rendre à la page une garde maison au lieu de `gardeLectureEchanges` ;
 *   · faire tirer `@/auth` au module pur (le worker ne pourrait plus le lire).
 * Contre-témoin : chaque fichier contrôlé existe et est lu.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  peutVoirLesEchanges,
  ROLES_DOSSIER_ECHANGES,
} from "@/features/dossier-client/roles-echanges";

const RACINE = process.cwd();
const lire = (chemin: string): string => readFileSync(join(RACINE, chemin), "utf8");

/** Les fichiers de l'enregistreur, hors tests. */
function fichiersEnregistreur(): string[] {
  const dossiers = [
    "src/server/visio",
    "src/features/admin-enregistreur",
    "src/app/api/enregistreur",
    "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/enregistreur",
  ];
  const sortie: string[] = [];
  const parcourir = (d: string): void => {
    for (const nom of readdirSync(join(RACINE, d))) {
      const chemin = `${d}/${nom}`;
      if (statSync(join(RACINE, chemin)).isDirectory()) {
        if (nom !== "__tests__") parcourir(chemin);
      } else if (/\.tsx?$/.test(nom)) sortie.push(chemin);
    }
  };
  for (const d of dossiers) parcourir(d);
  return sortie;
}

describe("⛔ les rôles de l'enregistreur sont ceux du dossier client", () => {
  it("contre-témoin : les fichiers contrôlés existent", () => {
    const fichiers = fichiersEnregistreur();
    expect(fichiers.length).toBeGreaterThan(10);
    expect(fichiers).toContain("src/server/visio/jeton.ts");
  });

  it("aucun fichier de l'enregistreur ne recopie la liste des rôles", () => {
    const fautifs = fichiersEnregistreur().filter((f) =>
      /["']super_admin["']\s*,\s*["']admin["']/.test(lire(f)),
    );
    expect(fautifs, `liste A2 recopiée dans : ${fautifs.join(", ")}`).toEqual([]);
  });

  it("le module de la liste est pur (lisible par le worker)", () => {
    const source = lire("src/features/dossier-client/roles-echanges.ts");
    expect(source).not.toMatch(/from\s+["'](@\/auth|next\/)/);
    expect([...ROLES_DOSSIER_ECHANGES].sort()).toEqual(["admin", "super_admin"]);
    expect(peutVoirLesEchanges("editor")).toBe(false);
  });

  it("le dossier client ré-exporte la liste au lieu de la déclarer", () => {
    const source = lire("src/features/dossier-client/acces.ts");
    expect(source).toContain('from "./roles-echanges"');
    expect(source).not.toMatch(/export const ROLES_DOSSIER_ECHANGES/);
  });

  it.each([
    ["src/server/visio/jeton.ts", "peutVoirLesEchanges(titulaire.role)"],
    ["src/app/api/enregistreur/ouvrir/route.ts", "peutVoirLesEchanges(role)"],
    [
      "src/app/[locale]/(admin)/[adminPrefix]/rendez-vous/enregistreur/page.tsx",
      "gardeLectureEchanges(",
    ],
    [
      "src/features/admin-enregistreur/actions.ts",
      "exigerAccesEchanges(motifSansAccesEnregistreur)",
    ],
  ])("%s consomme la garde du dossier client", (fichier, appel) => {
    expect(existsSync(join(RACINE, fichier))).toBe(true);
    expect(lire(fichier)).toContain(appel);
  });

  it("aucune garde maison ne subsiste", () => {
    const fautifs = fichiersEnregistreur().filter((f) =>
      /roleAutoriseEnregistreur|ROLES_ENREGISTREUR|gardeLectureEnregistreur|exigerAccesEnregistreur/.test(
        lire(f),
      ),
    );
    expect(fautifs.map((f) => relative(RACINE, join(RACINE, f)))).toEqual([]);
  });
});
