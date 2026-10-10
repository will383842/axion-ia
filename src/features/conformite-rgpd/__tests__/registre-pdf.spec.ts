// Le PDF du registre (art. 30) n'emporte JAMAIS les points à corriger.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/documents/fonts", () => ({ registerQualiopiPdfFonts: () => {} }));

import { activitesPourPdf } from "../registre-pdf";
import { validerRegistre } from "../schema";
import { registreFictif } from "./fixtures";

describe("PDF du registre", () => {
  it("ne transmet aucun écart au gabarit", () => {
    const r = validerRegistre(registreFictif);
    if (!r.ok) throw new Error(r.erreur);
    const activites = activitesPourPdf(r.registre);
    expect(activites).toHaveLength(3);
    for (const a of activites) expect(a).not.toHaveProperty("ecarts");
    expect(JSON.stringify(activites)).not.toContain("Constat");
  });
});
