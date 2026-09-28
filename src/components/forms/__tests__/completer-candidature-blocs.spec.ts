import { describe, expect, it } from "vitest";

import { enBlocs } from "../CompleterCandidatureForm";

describe("page tarifs — les questions regroupées", () => {
  it("réunit les questions CONSÉCUTIVES d'un même groupe, avec ses attendus", () => {
    const blocs = enBlocs([
      { id: "v30", type: "price", groupe: "Vidéo verticale", attendus: ["Hook", "LUT"] },
      { id: "v60", type: "price", groupe: "Vidéo verticale" },
      { id: "h3", type: "price", groupe: "Vidéo horizontale" },
      { id: "libre" },
    ]);
    expect(blocs.map((b) => [b.titre, b.questions.map((q) => q.id), b.attendus])).toEqual([
      ["Vidéo verticale", ["v30", "v60"], ["Hook", "LUT"]],
      ["Vidéo horizontale", ["h3"], []],
      [null, ["libre"], []],
    ]);
  });

  it("une offre sans groupes garde une question par bloc (libellé complet)", () => {
    expect(enBlocs([{ id: "a" }, { id: "b" }]).map((b) => b.titre)).toEqual([null, null]);
  });
});
