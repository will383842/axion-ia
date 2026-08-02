/**
 * Tests — nom de fichier de téléchargement d'une pièce.
 *
 * Le nom part dans `Content-Disposition: filename="…"` : il doit être ASCII,
 * sans caractères réservés, et dire le TYPE + le CONTEXTE avant le numéro.
 */

import { describe, it, expect } from "vitest";
import { nomFichierDocument } from "./nom-fichier";

describe("nomFichierDocument", () => {
  it("type + contexte + numéro, dans cet ordre", () => {
    expect(
      nomFichierDocument({
        type: "convention",
        numero: "AXI-DOC-2026-009",
        contexte: "INVEST SUN",
      }),
    ).toBe("Convention de formation - INVEST SUN - AXI-DOC-2026-009.pdf");
  });

  it("suffixe d'état (exemplaire signé)", () => {
    expect(
      nomFichierDocument({
        type: "convention",
        numero: "AXI-DOC-2026-009",
        contexte: "INVEST SUN",
        suffixe: "signee",
      }),
    ).toBe("Convention de formation signee - INVEST SUN - AXI-DOC-2026-009.pdf");
  });

  it("translittère les accents et retire les caractères réservés — ASCII pur", () => {
    const nom = nomFichierDocument({
      type: "organisation_action",
      numero: "AXI-DOC-2026-012",
      contexte: 'IA pour l\'immobilier — INVEST SUN (Saint-Étienne) "v2" a/b',
    });
    expect(nom).toMatch(/^[\x20-\x7e]+\.pdf$/);
    expect(nom).not.toMatch(/["\\/:*?<>|]/);
    expect(nom).toContain("Organisation de l'action");
    expect(nom).toContain("Saint-Etienne");
  });

  it("sans contexte : type + numéro seulement, jamais de tiret orphelin", () => {
    expect(nomFichierDocument({ type: "reglement_interieur", numero: "AXI-DOC-2026-005" })).toBe(
      "Reglement interieur - AXI-DOC-2026-005.pdf",
    );
  });

  it("tronque un contexte démesuré à 60 caractères", () => {
    const nom = nomFichierDocument({
      type: "programme",
      numero: "AXI-DOC-2026-002",
      contexte: "x".repeat(200),
    });
    expect(nom.length).toBeLessThan(120);
  });
});
