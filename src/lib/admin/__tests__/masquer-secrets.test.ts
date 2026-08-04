import { describe, it, expect } from "vitest";
import { masquerSecrets, contientUnSecret, masquerValeur } from "../masquer-secrets";

/** La valeur réellement lue en production sur `/settings` le 2026-08-03. */
const LEGAL_OVERRIDES = {
  bic: "FNOMFRP2",
  iban: "FR7630833830000360828987966",
  siren: "100018631",
  bankName: "FINOM PAYMENTS",
};

describe("masquage des valeurs sensibles des réglages", () => {
  it("masque l'IBAN et le BIC, laisse le reste intact", () => {
    const sortie = masquerSecrets(LEGAL_OVERRIDES) as Record<string, string>;
    expect(sortie["iban"]).not.toContain("30833830000360828987");
    expect(sortie["iban"]).toContain("FR76");
    expect(sortie["bic"]).not.toBe("FNOMFRP2");
    // Ce qui n'est pas un secret ne bouge pas : le SIREN est public.
    expect(sortie["siren"]).toBe("100018631");
    expect(sortie["bankName"]).toBe("FINOM PAYMENTS");
  });

  it("masque entièrement une chaîne trop courte pour garder des extrémités", () => {
    // Huit caractères ou moins : montrer début ET fin suffirait à reconstituer.
    expect(masquerValeur("FNOMFRP2")).toBe("••••••••");
  });

  it("descend dans les objets et les tableaux imbriqués", () => {
    const sortie = masquerSecrets({
      comptes: [{ iban: "FR7612345678901234567890123" }],
      nested: { apiKey: "sk-abcdefghijklmnop" },
    }) as { comptes: Array<Record<string, string>>; nested: Record<string, string> };
    expect(sortie.comptes[0]?.["iban"]).not.toContain("12345678901234567890");
    expect(sortie.nested["apiKey"]).not.toContain("abcdefghijklmnop");
  });

  it("reconnaît la présence d'un secret — c'est ce qui pilote le bouton", () => {
    expect(contientUnSecret(LEGAL_OVERRIDES)).toBe(true);
    expect(contientUnSecret({ tier1: 49000, tier2: 79000 })).toBe(false);
    expect(contientUnSecret({ a: { b: { token: "xyz" } } })).toBe(true);
  });

  it("ne touche ni aux nombres ni aux booléens ni à null", () => {
    expect(masquerSecrets({ n: 42, b: true, z: null })).toEqual({ n: 42, b: true, z: null });
  });
});
