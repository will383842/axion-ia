// @vitest-environment node

/**
 * `details.identite` : prénom et nom chiffrés, civilité en clair, lecture
 * tolérante. Vrai chiffrement (clé posée par le test), pas de mock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PII_DECRYPT_PLACEHOLDER } from "@/lib/pii-crypto";
import { CLE_IDENTITE, identitePourDetails, lireIdentiteDetails } from "../identite-contact";

const CLE = "0123456789abcdef".repeat(4);

beforeEach(() => {
  vi.stubEnv("PII_ENCRYPTION_KEY", CLE);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const VIDE = { civilite: null, prenom: null, nomFamille: null };

describe("identite-contact", () => {
  it("aller-retour : chiffré dans details, clair à la lecture", () => {
    const rangee = identitePourDetails({ civilite: "madame", prenom: "Camille", nomFamille: "Dupont" });
    expect(rangee["prenom"]).toMatch(/^enc:v/);
    expect(rangee["nomFamille"]).toMatch(/^enc:v/);
    expect(rangee["civilite"]).toBe("madame");
    expect(lireIdentiteDetails({ [CLE_IDENTITE]: rangee })).toEqual({
      civilite: "madame",
      prenom: "Camille",
      nomFamille: "Dupont",
    });
  });

  it("civilité absente : la clé est omise et la lecture rend null", () => {
    const rangee = identitePourDetails({ prenom: "Camille", nomFamille: "Dupont" });
    expect(rangee).not.toHaveProperty("civilite");
    expect(lireIdentiteDetails({ identite: rangee }).civilite).toBeNull();
  });

  it("clé de chiffrement absente à la lecture : le marqueur devient null", () => {
    const rangee = identitePourDetails({ civilite: "monsieur", prenom: "Camille", nomFamille: "Dupont" });
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    const lu = lireIdentiteDetails({ identite: rangee });
    expect(lu).toEqual({ civilite: "monsieur", prenom: null, nomFamille: null });
    expect(JSON.stringify(lu)).not.toContain(PII_DECRYPT_PLACEHOLDER);
  });

  it("valeur chiffrée corrompue : null, sans lever", () => {
    expect(
      lireIdentiteDetails({ identite: { prenom: "enc:v1:zz:zz:zz", nomFamille: "enc:v1:abc" } }),
    ).toEqual(VIDE);
  });

  it.each([undefined, null, 42, "x", [], {}, { identite: null }, { identite: "x" }, { identite: [] }])(
    "details mal formé %j → tout null",
    (details) => {
      expect(lireIdentiteDetails(details)).toEqual(VIDE);
    },
  );

  it("civilité inconnue ou valeurs non textuelles → null", () => {
    expect(
      lireIdentiteDetails({ identite: { civilite: "docteur", prenom: 3, nomFamille: {} } }),
    ).toEqual(VIDE);
  });
});
