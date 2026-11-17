// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));

import {
  CONDITIONS_PARTICULIERES_MAX,
  MOTS_SENSIBLES,
  PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES,
  motsSensiblesTrouves,
  normaliserConditionsParticulieres,
} from "./conditions-particulieres";
import { entreeDevisClassiqueSchema } from "./champs-classiques";

const base = {
  clientId: "11111111-1111-4111-8111-111111111111",
  lignes: [{ designation: "Atelier", quantite: 1, prixUnitaireHtCents: 100000 }],
};

describe("conditions particulières — normalisation", () => {
  it("la limite est de 4000 caractères", () => {
    expect(CONDITIONS_PARTICULIERES_MAX).toBe(4000);
  });
  it("convertit CRLF en LF", () => {
    expect(normaliserConditionsParticulieres("a\r\nb")).toBe("a\nb");
  });
  it("retire les caractères de contrôle sauf \\n et \\t", () => {
    expect(normaliserConditionsParticulieres("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });
  it("ramène trois sauts de ligne ou plus à deux", () => {
    expect(normaliserConditionsParticulieres("a\n\n\n\n\nb")).toBe("a\n\nb");
  });
  it("retire les espaces de début et de fin", () => {
    expect(normaliserConditionsParticulieres("  \n a \n ")).toBe("a");
  });
  it("vide ou blanc donne null", () => {
    expect(normaliserConditionsParticulieres("")).toBeNull();
    expect(normaliserConditionsParticulieres(" \r\n\t ")).toBeNull();
  });
});

describe("conditions particulières — schéma de saisie", () => {
  it("accepte 4000 caractères, refuse 4001", () => {
    expect(
      entreeDevisClassiqueSchema.safeParse({ ...base, conditionsParticulieres: "x".repeat(4000) })
        .success,
    ).toBe(true);
    expect(
      entreeDevisClassiqueSchema.safeParse({ ...base, conditionsParticulieres: "x".repeat(4001) })
        .success,
    ).toBe(false);
  });
  it("normalise à la lecture ; vide donne null ; clé absente reste absente", () => {
    const a = entreeDevisClassiqueSchema.parse({ ...base, conditionsParticulieres: "  a\r\nb " });
    expect(a.conditionsParticulieres).toBe("a\nb");
    const b = entreeDevisClassiqueSchema.parse({ ...base, conditionsParticulieres: "   " });
    expect(b.conditionsParticulieres).toBeNull();
    const c = entreeDevisClassiqueSchema.parse({ ...base });
    expect("conditionsParticulieres" in c).toBe(false);
    const d = entreeDevisClassiqueSchema.parse({ ...base, conditionsParticulieres: null });
    expect(d.conditionsParticulieres).toBeNull();
  });
});

describe("conditions particulières — mots sensibles", () => {
  it("la liste est celle convenue", () => {
    expect([...MOTS_SENSIBLES]).toEqual([
      "certification",
      "certifié",
      "qualiopi",
      "opco",
      "prise en charge",
      "financement",
      "financeur",
    ]);
  });
  it("détecte sans casse ni accents", () => {
    expect(motsSensiblesTrouves("Notre CERTIFICATION et le Financement")).toEqual([
      "certification",
      "financement",
    ]);
    expect(motsSensiblesTrouves("Organisme certifie")).toEqual(["certifié"]);
    expect(motsSensiblesTrouves("Qualiopi, OPCO, prise en charge, financeur")).toEqual([
      "qualiopi",
      "opco",
      "prise en charge",
      "financeur",
    ]);
  });
  it("rien à signaler sur un texte neutre", () => {
    expect(motsSensiblesTrouves("Paiement à 30 jours.")).toEqual([]);
  });
});

describe("phrase de primauté", () => {
  it("texte contractuel exact", () => {
    expect(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES).toBe(
      "Les présentes conditions particulières, acceptées par la signature du présent devis, dérogent aux Conditions générales de vente ; en cas de contradiction, elles prévalent.",
    );
  });
});
