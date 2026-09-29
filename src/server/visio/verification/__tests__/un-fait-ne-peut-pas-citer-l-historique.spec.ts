/**
 * G2 — UN FAIT NE PEUT PAS CITER L'HISTORIQUE : segments réels du jour, au
 * plus trois, consécutifs sur leur piste, d'une seule piste. Une référence
 * `H…`, `C…` ou `PRJ-…` en preuve ⇒ `preuve_historique`.
 */

import { describe, expect, it } from "vitest";

import { avec, leFait, verifier } from "./outils";

describe("un fait ne peut pas citer l'historique", () => {
  it("une preuve `H001` → preuve_historique", () => {
    const b = verifier(
      avec("F01", {
        preuves: [{ segment_ids: ["H001"], citation: "On serait douze commerciaux à former" }],
      }),
    );
    expect(leFait(b, "F01")).toMatchObject({ statut: "rejete", motif: "preuve_historique" });
  });

  it("un segment inexistant, deux pistes mêlées, ou non consécutifs → segment_inconnu", () => {
    for (const ids of [["S9999"], ["S0003", "S0004"], ["S0004", "S0008"]]) {
      const b = verifier(
        avec("F01", {
          preuves: [{ segment_ids: ids, citation: "On serait douze commerciaux à former" }],
        }),
      );
      expect(leFait(b, "F01"), ids.join(",")).toMatchObject({
        statut: "rejete",
        motif: "segment_inconnu",
      });
    }
  });

  it("contre-témoin : deux segments consécutifs de la même piste sont admis", () => {
    // S0008 et S0009 : deux segments client qui se suivent sur la piste client.
    const b = verifier(
      avec("F03", {
        preuves: [
          { segment_ids: ["S0008", "S0009"], citation: "que ce soit fait avant le 15 décembre" },
        ],
      }),
    );
    expect(leFait(b, "F03").statut).toBe("propose");
  });
});
