import { describe, expect, it } from "vitest";
import { SIGNATURE_NOM, SIGNATURE_TITRE } from "../../crible-stock/analyse";
import { SIGNATURE_AVIS } from "../brand/expert-bank";

describe("crible du stock : la signature réattribuée est celle de l'avis", () => {
  it("même nom et même titre que SIGNATURE_AVIS", () => {
    expect(SIGNATURE_NOM).toBe(SIGNATURE_AVIS.name);
    expect(SIGNATURE_TITRE).toBe(SIGNATURE_AVIS.title);
  });
});
