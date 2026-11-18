/**
 * 🔴 L'e-mail d'exemplaire signé d'un devis dit le numéro que le client connaît (AXI-DEV-…).
 * `numeroDevis` est FACULTATIF : un job posé par l'ancien code n'en porte pas.
 */
import { describe, expect, it } from "vitest";
import { pieceExemplaireSigneSubject } from "./piece-exemplaire-signe";

describe("pieceExemplaireSigneSubject", () => {
  it("préfère le numéro du devis à celui de la pièce", () => {
    const s = pieceExemplaireSigneSubject("fr", {
      numero: "AXI-DOC-2026-053",
      numeroDevis: "AXI-DEV-2026-001",
    });
    expect(s).toContain("AXI-DEV-2026-001");
    expect(s).not.toContain("AXI-DOC-2026-053");
  });

  it("ancien payload sans numeroDevis : numéro de pièce", () => {
    expect(pieceExemplaireSigneSubject("fr", { numero: "AXI-DOC-2026-039" })).toContain(
      "AXI-DOC-2026-039",
    );
  });
});
