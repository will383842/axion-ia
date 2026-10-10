// @vitest-environment node
// Le PDF du registre se rend pour de vrai (polices de la charte comprises).
import { describe, expect, it } from "vitest";

import { rendreRegistreEnPdf } from "../registre-pdf";
import { validerRegistre } from "../schema";
import { registreFictif } from "./fixtures";

describe("PDF du registre — rendu", () => {
  it("produit un PDF", async () => {
    const r = validerRegistre(registreFictif);
    if (!r.ok) throw new Error(r.erreur);
    const pdf = await rendreRegistreEnPdf(r.registre, new Date("2000-01-01T12:00:00Z"));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
  }, 30_000);
});
