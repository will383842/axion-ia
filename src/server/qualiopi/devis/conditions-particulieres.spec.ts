// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));

import {
  CONDITIONS_PARTICULIERES_MAX,
  MOTS_SENSIBLES,
  CONDITIONS_PARTICULIERES_LIGNES_MAX,
  MESSAGE_CONDITIONS_PARTICULIERES_LIGNES,
  PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES,
  PHRASE_PRIMAUTE_VALIDEE,
  motsSensiblesTrouves,
  nombreDeLignes,
  phrasePrimauteAImprimer,
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
  it("retire les caractères de contrôle sauf \\n ; la tabulation devient une espace", () => {
    expect(normaliserConditionsParticulieres("a\u0000b\u0007c\td\ne")).toBe("abc d\ne");
  });
  it("retire les caractères invisibles (U+200B-200F, 202A-202E, 2060-2069, FEFF)", () => {
    const invisibles = [
      ...Array.from({ length: 5 }, (_, i) => 0x200b + i),
      ...Array.from({ length: 5 }, (_, i) => 0x202a + i),
      ...Array.from({ length: 10 }, (_, i) => 0x2060 + i),
      0xfeff,
    ];
    for (const cp of invisibles) {
      const c = String.fromCodePoint(cp);
      expect(normaliserConditionsParticulieres(`a${c}b`), cp.toString(16)).toBe("ab");
    }
  });
  it("un texte fait seulement d'invisibles donne null", () => {
    expect(normaliserConditionsParticulieres("\u200B\u202E\u2060\uFEFF")).toBeNull();
  });
  it("U+2028 et U+2029 deviennent un saut de ligne", () => {
    expect(normaliserConditionsParticulieres("a\u2028b\u2029c")).toBe("a\nb\nc");
  });
  it("chaque tabulation devient une espace", () => {
    expect(normaliserConditionsParticulieres("a\t\tb")).toBe("a  b");
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

describe("conditions particulières — nombre de lignes", () => {
  const lignes = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`).join("\n");
  it("la limite est de 80 lignes et le message est celui convenu", () => {
    expect(CONDITIONS_PARTICULIERES_LIGNES_MAX).toBe(80);
    expect(MESSAGE_CONDITIONS_PARTICULIERES_LIGNES).toBe(
      "Les conditions particulières ne peuvent pas dépasser 80 lignes.",
    );
  });
  it("nombreDeLignes compte les lignes du texte normalisé", () => {
    expect(nombreDeLignes("a")).toBe(1);
    expect(nombreDeLignes("a\n\nb")).toBe(3);
  });
  it("le serveur accepte 80 lignes et refuse 81, avec le message", () => {
    expect(
      entreeDevisClassiqueSchema.safeParse({ ...base, conditionsParticulieres: lignes(80) })
        .success,
    ).toBe(true);
    const r = entreeDevisClassiqueSchema.safeParse({
      ...base,
      conditionsParticulieres: lignes(81),
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(MESSAGE_CONDITIONS_PARTICULIERES_LIGNES);
  });
  it("le contrôle porte sur le texte NORMALISÉ (sauts de ligne multiples ramenés à deux)", () => {
    const brut = Array.from({ length: 50 }, () => "x").join("\n\n\n\n\n");
    // 50 lignes + 49 vides = 99 lignes ; les 5 sauts deviennent 2 : 99 > 80 reste refusé.
    expect(
      entreeDevisClassiqueSchema.safeParse({ ...base, conditionsParticulieres: brut }).success,
    ).toBe(false);
    const court = Array.from({ length: 30 }, () => "x").join("\n\n\n\n\n");
    expect(
      entreeDevisClassiqueSchema.safeParse({ ...base, conditionsParticulieres: court }).success,
    ).toBe(true);
  });
});

describe("phrase de primauté — drapeau de validation", () => {
  it("n'est pas validée pour l'instant : rien à imprimer", () => {
    expect(PHRASE_PRIMAUTE_VALIDEE).toBe(false);
    expect(phrasePrimauteAImprimer()).toBeNull();
  });
});
