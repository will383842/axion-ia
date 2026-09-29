/**
 * LES 7 SORTIES PIÉGÉES DE LA CI SONT TOUTES REJETÉES, CHACUNE AVEC LE BON MOTIF
 * (`compte-rendu-et-extraction.md` §6.8 ; fixtures `tests/fixtures/visio/scenarios/ci`).
 *
 * On teste le CODE (V1), pas le modèle : ces sorties sont écrites à la main.
 */

import { describe, expect, it } from "vitest";

import { entrelacer } from "../dialogue";
import { verifierFaits } from "../verification/verifier-faits";
import { PIEGES } from "../../../../tests/fixtures/visio/scenarios/ci/pieges";
import {
  DATE_ECHANGE,
  extraction,
  SEGMENTS,
} from "../../../../tests/fixtures/visio/scenario-menuiserie";
import { catalogueDeTest } from "../../../../tests/outils/faux-circuit-visio";

describe("les sorties piégées sont toutes rejetées", () => {
  it("il y a bien 7 pièges", () => {
    expect(PIEGES).toHaveLength(7);
  });

  for (const p of PIEGES) {
    it(`${p.nom} → ${p.motif}`, () => {
      const b = verifierFaits({
        extraction: extraction([p.fait]),
        segments: entrelacer(SEGMENTS).segments,
        catalogue: catalogueDeTest().refs,
        connus: new Set(["H001"]),
        dateEchange: DATE_ECHANGE,
      });
      expect(b.faits[0]).toMatchObject({ statut: "rejete", motif: p.motif, citation: null });
    });
  }
});
