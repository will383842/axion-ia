// FAC-1 — Registre générique « texte validé par Will », par gabarit ET par variante.
// Défaut = non validé : un texte absent, illisible ou d'une autre variante ne vaut rien.
import { describe, expect, it } from "vitest";

import {
  PREFIXE_TEXTES_VALIDES,
  cleTexteValide,
  estTexteValide,
  textesValidesDepuisLignes,
} from "../textes-valides";

describe("cleTexteValide", () => {
  it("une clé par gabarit, et une par variante", () => {
    expect(cleTexteValide("g-un")).toBe(`${PREFIXE_TEXTES_VALIDES}g-un`);
    expect(cleTexteValide("g-un", "freelance")).toBe(`${PREFIXE_TEXTES_VALIDES}g-un#freelance`);
  });
  it("refuse un nom de gabarit ou de variante hors alphabet", () => {
    expect(() => cleTexteValide("G un")).toThrow();
    expect(() => cleTexteValide("g", "a#b")).toThrow();
  });
});

describe("estTexteValide — défaut = non validé", () => {
  const lignes = [
    { key: cleTexteValide("g-un"), value: { valide: true } },
    { key: cleTexteValide("g-deux", "freelance"), value: { valide: true } },
    { key: cleTexteValide("g-trois"), value: { valide: "oui" } },
    { key: cleTexteValide("g-quatre"), value: { valide: false } },
    { key: "autre.cle", value: { valide: true } },
  ];
  const registre = textesValidesDepuisLignes(lignes);

  it("validé seulement si la ligne dit exactement `valide: true`", () => {
    expect(estTexteValide(registre, "g-un")).toBe(true);
    expect(estTexteValide(registre, "g-trois")).toBe(false);
    expect(estTexteValide(registre, "g-quatre")).toBe(false);
    expect(estTexteValide(registre, "absent")).toBe(false);
  });
  it("la validation d'une variante ne vaut pas pour le gabarit, ni l'inverse", () => {
    expect(estTexteValide(registre, "g-deux", "freelance")).toBe(true);
    expect(estTexteValide(registre, "g-deux")).toBe(false);
    expect(estTexteValide(registre, "g-un", "freelance")).toBe(false);
  });
  it("une ligne hors préfixe n'est jamais lue", () => {
    expect(estTexteValide(registre, "autre.cle")).toBe(false);
  });
});
