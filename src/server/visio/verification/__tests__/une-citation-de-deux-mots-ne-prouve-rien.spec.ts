/**
 * G1b — UNE CITATION DE DEUX MOTS NE PROUVE RIEN : 3 à 40 mots après normalisation.
 */

import { describe, expect, it } from "vitest";

import { avec, leFait, verifier } from "./outils";

describe("une citation de deux mots ne prouve rien", () => {
  it("« douze commerciaux » (2 mots) → citation_trop_courte", () => {
    const b = verifier(
      avec("F01", { preuves: [{ segment_ids: ["S0004"], citation: "douze commerciaux" }] }),
    );
    expect(leFait(b, "F01")).toMatchObject({ statut: "rejete", motif: "citation_trop_courte" });
  });

  it("plus de 40 mots → citation_trop_longue", () => {
    const longue = Array.from({ length: 41 }, () => "mot").join(" ");
    const b = verifier(avec("F01", { preuves: [{ segment_ids: ["S0004"], citation: longue }] }));
    expect(leFait(b, "F01")).toMatchObject({ statut: "rejete", motif: "citation_trop_longue" });
  });

  it("contre-témoin : trois mots suffisent", () => {
    const b = verifier(
      avec("F01", { preuves: [{ segment_ids: ["S0004"], citation: "serait douze commerciaux" }] }),
    );
    expect(leFait(b, "F01").statut).toBe("propose");
  });
});
