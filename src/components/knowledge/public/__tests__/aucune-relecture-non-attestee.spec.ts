import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..", "..", "..");
const DOSSIERS = ["components/knowledge/public", "components/marketing"].map((d) => join(RACINE, d));

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    if (nom === "__tests__") return [];
    const chemin = join(dir, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.tsx$/.test(nom) ? [chemin] : [];
  });
}

describe("relecture non attestée", () => {
  it("aucun composant public n'affiche « Dernière revue » / « revu par »", () => {
    const fautes = DOSSIERS.flatMap(fichiers).filter((f) =>
      /derni[èe]re revue|last reviewed|revu par|reviewed by/i.test(readFileSync(f, "utf8")),
    );
    expect(fautes).toEqual([]);
  });
});
