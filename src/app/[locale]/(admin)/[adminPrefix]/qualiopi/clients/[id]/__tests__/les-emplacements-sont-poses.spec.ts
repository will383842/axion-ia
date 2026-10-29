/**
 * Garde du socle (lot 0) : la page fiche client porte chaque emplacement UNE fois et n'importe
 * que `fiche/emplacements`. Les lots suivants remplissent LEUR fichier, jamais la page.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (c: string): string => readFileSync(join(process.cwd(), c), "utf8");
const PAGE = lire("src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page.tsx");

/**
 * Pour chaque ancre : `suivante` est ce que la première ligne de code après l'ancre doit contenir,
 * `appel` l'appel d'emplacement qui doit figurer UNE fois dans la page.
 */
const ANCRES: ReadonlyArray<{ nom: string; suivante: string; appel: string }> = [
  { nom: "EN-TETE", suivante: "{enTete}", appel: "E.enTeteFiche(ctx)" },
  { nom: "ARCHIVAGE", suivante: "{archivage}", appel: "E.archivageFiche(ctx)" },
  { nom: "COMPTEURS", suivante: "E.compteursOnglets(ctx)", appel: "E.compteursOnglets(ctx)" },
  { nom: "ONGLET-ACTIVITE", suivante: "E.ongletActivite(ctx)", appel: "E.ongletActivite(ctx)" },
  { nom: "RESUME-TACHES", suivante: "{resumeDesTaches}", appel: "E.resumeTaches(ctx)" },
  {
    nom: "RESUME-PRESTATIONS",
    suivante: "{resumeDesPrestations}",
    appel: "E.resumePrestations(ctx)",
  },
  { nom: "RESUME-NOTES", suivante: "{resumeDesNotes}", appel: "E.resumeNotes(ctx)" },
  { nom: "QUESTIONNAIRE-EN-BREF", suivante: "{enBref}", appel: "E.questionnaireEnBref(ctx)" },
  { nom: "PERSONNES-DECISION", suivante: "{decision}", appel: "E.personnesDecision(ctx)" },
  {
    nom: "DEVIS-FACTURES",
    suivante: 'onglet === "devis-factures"',
    appel: "<E.OngletDevisFactures",
  },
];

const compter = (texte: string, motif: string): number => texte.split(motif).length - 1;

/** Empreinte de `page.tsx`, fins de ligne ramenées à LF. */
const empreinte = (texte: string): string =>
  createHash("sha256").update(texte.replace(/\r\n/g, "\n")).digest("hex");

// Seul le lot 0 met à jour ce hash : un lot B qui touche la page fait rougir ce test.
const HASH_PAGE = "8d24a69bd4c11d0f96ebc64a93cf4b027e8a644121374bd029f51cc6f172f959";

describe("les emplacements de la fiche client sont posés", () => {
  for (const { nom, suivante, appel } of ANCRES) {
    it(`EMPLACEMENT:${nom} apparaît une fois, suivi du bon code`, () => {
      expect(compter(PAGE, `EMPLACEMENT:${nom} (lot `)).toBe(1);
      const lignes = PAGE.replace(/\r\n/g, "\n").split("\n");
      const i = lignes.findIndex((l) => l.includes(`EMPLACEMENT:${nom} (lot `));
      const suiv = lignes.slice(i + 1).find((l) => l.trim() !== "") ?? "";
      expect(suiv).toContain(suivante);
      expect(compter(PAGE, appel)).toBe(1);
    });
  }

  it("la page est celle du lot 0 (seul le lot 0 met à jour ce hash)", () => {
    expect(empreinte(PAGE)).toBe(HASH_PAGE);
  });

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
