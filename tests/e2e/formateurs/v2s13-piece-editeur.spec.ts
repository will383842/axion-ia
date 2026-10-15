// @formateurs V2-S13 (vérification n° 2, sécurité) — Fausse pièce par un éditeur.
//
// Un éditeur ne valide aucune pièce ; un administrateur ne valide pas la pièce de
// garde qu'il a lui-même saisie (quatre yeux) ; un autre administrateur la valide
// (témoin).
//
// Défaut consigné (`test.fixme`), COUVERT PAR #1539 (non fusionnée à l'écriture) :
//   · V2-S-4 — un éditeur AJOUTE une pièce de garde (attestation URSSAF, avis
//     SIRENE) à la fiche d'un indépendant ; il suffit ensuite qu'un autre la
//     valide. #1539 réserve l'ajout aux personnes habilitées (écart E29).

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Observations {
  editeurAjoute: Record<string, string>;
  pieceEditeurNee: boolean;
  editeurValide: string;
  ajoutAdmin: string;
  adminValideLaSienne: string;
  autreAdminValide: string;
  cibleValidee: boolean;
}

test.describe("@formateurs V2-S13 — fausse pièce déposée par un éditeur", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s13-piece-editeur");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("un éditeur ne valide aucune pièce", () => {
    expect(o.editeurValide).toMatch(/^refus: /);
    expect(o.cibleValidee).toBe(false);
  });

  test("quatre yeux : l'auteur de la pièce de garde ne la valide pas ; un autre, si", () => {
    expect(o.ajoutAdmin).toBe("ok");
    expect(o.adminValideLaSienne).toContain("autre personne");
    expect(o.autreAdminValide).toBe("ok");
  });

  // V2-S-4 — BLOQUANT (sécurité), couvert par #1539. Probable :
  // trainer-documents.ts `createTrainerDocumentAction` (~l. 84, `requireAdminWrite`
  // admet `editor`).
  test.fixme("V2-S-4 — un éditeur n'ajoute aucune pièce de garde", () => {
    expect(o.editeurAjoute["attestation_vigilance_urssaf"]).toMatch(/^refus: /);
    expect(o.editeurAjoute["kbis_avis_sirene"]).toMatch(/^refus: /);
    expect(o.pieceEditeurNee).toBe(false);
  });
});
