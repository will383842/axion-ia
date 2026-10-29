/**
 * Garde du socle (lot 0) : la page fiche client porte chaque emplacement UNE fois et n'importe
 * que `fiche/emplacements`. Les lots suivants remplissent LEUR fichier, jamais la page.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string => readFileSync(join(process.cwd(), c), "utf8");
const PAGE = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx");

const ANCRES = [
  "EN-TETE",
  "ARCHIVAGE",
  "COMPTEURS",
  "ONGLET-ACTIVITE",
  "RESUME-TACHES",
  "RESUME-PRESTATIONS",
  "RESUME-NOTES",
  "QUESTIONNAIRE-EN-BREF",
  "PERSONNES-DECISION",
  "DEVIS-FACTURES",
] as const;

const compter = (texte: string, motif: string): number => texte.split(motif).length - 1;

describe("les emplacements de la fiche client sont posés", () => {
  for (const nom of ANCRES) {
    it(`EMPLACEMENT:${nom} apparaît une fois dans la page`, () => {
      expect(compter(PAGE, `EMPLACEMENT:${nom} (lot `)).toBe(1);
    });
  }

  it("la page n'importe aucun fichier de fiche/ sauf emplacements", () => {
    const imports = [...PAGE.matchAll(/from\s+"([^"]*dossier-client\/fiche\/[^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(imports).toEqual(["@/components/admin/dossier-client/fiche/emplacements"]);
  });

  it("OngletDevisFactures porte EMPLACEMENT:RELANCE-DEVIS une fois", () => {
    const f = lire("src/components/admin/dossier-client/fiche/OngletDevisFactures.tsx");
    expect(compter(f, "EMPLACEMENT:RELANCE-DEVIS (lot B9)")).toBe(1);
  });
});
