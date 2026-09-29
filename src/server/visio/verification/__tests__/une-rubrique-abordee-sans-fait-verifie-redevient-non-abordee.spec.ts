/**
 * G6 — UNE RUBRIQUE ABORDÉE SANS FAIT VÉRIFIÉ REDEVIENT NON ABORDÉE (avec la
 * mention « faits rejetés à la vérification ») ; une référence hors rubrique
 * ou rejetée disparaît.
 */

import { describe, expect, it } from "vitest";

import { MENTION_FAITS_REJETES } from "../g06-couverture";
import { avec, verifier } from "./outils";

describe("une rubrique abordée sans fait vérifié redevient non abordée", () => {
  it("le seul fait du budget est rejeté → budget_financement non abordé, mention", () => {
    const b = verifier(
      avec("F02", {
        preuves: [{ segment_ids: ["S0006"], citation: "on avait prévu cinq mille euros" }],
      }),
    );
    expect(b.couverture.budget_financement).toEqual({
      statut: "non_aborde",
      faits_refs: [],
      remarque: MENTION_FAITS_REJETES,
    });
    expect(b.correctionsCouverture).toBeGreaterThan(0);
  });

  it("contre-témoin : une rubrique dont le fait est vérifié reste abordée", () => {
    const b = verifier(avec("F02", {}));
    expect(b.couverture.budget_financement).toMatchObject({
      statut: "aborde",
      faits_refs: ["F02"],
    });
  });
});
