/**
 * ⛔ LES LIBELLÉS DE RÔLE ONT UNE SEULE SOURCE : `src/server/auth/garde-page.ts`.
 *
 * Le message de refus A2 (dossier client) et celui des appels réservés nomment
 * le rôle de la personne. Si un libellé était recopié, renommer un rôle dans la
 * garde de page laisserait un autre écran dire un autre mot.
 *
 * Mutation qui fait rougir : recopier la table (la ligne
 * `super_admin: "super-administrateur"`) dans n'importe quel fichier de `src/`.
 * Contre-témoin : la source elle-même la contient, et les deux gardes l'importent.
 * Angle mort : une copie qui changerait l'écriture du libellé (autre mot)
 * n'est pas une copie au sens de ce test — elle se verrait à la relecture.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const SOURCE = "src/server/auth/garde-page.ts";
const EMPREINTE = /super_admin:\s*"super-administrateur"/;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : fichiers(chemin);
    return /\.(ts|tsx)$/.test(e.name) && !/\.spec\.tsx?$/.test(e.name) ? [chemin] : [];
  });
}

const relatif = (f: string) => relative(process.cwd(), f).split(sep).join("/");

describe("⛔ les libellés de rôle ont une seule source", () => {
  it("seule la garde de page écrit la table des libellés", () => {
    const copies = fichiers(RACINE)
      .filter((f) => EMPREINTE.test(readFileSync(f, "utf8")))
      .map(relatif);
    expect(copies).toEqual([SOURCE]);
  });

  it("contre-témoin : les deux gardes importent la table de la source", () => {
    for (const f of [
      "src/features/dossier-client/acces.ts",
      "src/features/admin-calendly/acces.ts",
    ]) {
      expect(readFileSync(join(process.cwd(), f), "utf8")).toMatch(
        /import \{ LIBELLE_ROLE, [^}]*\} from "@\/server\/auth\/garde-page";/,
      );
    }
  });
});
