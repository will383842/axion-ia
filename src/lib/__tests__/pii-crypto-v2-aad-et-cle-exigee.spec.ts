/**
 * 🔐 `enc:v2:` — AAD FACULTATIVE ET « CLÉ EXIGÉE » (schéma n° 1 du chantier
 * formateurs freelance, M-A1 ; ADR 0066 (e), IBAN chiffré).
 *
 * L'IBAN d'un formateur est stocké chiffré, lié à SA fiche. Deux garanties que
 * `enc:v1:` ne donne pas :
 *   1. l'AAD (données authentifiées associées) lie le chiffré à la ligne : un
 *      IBAN recopié sur une autre fiche ne se déchiffre plus (anti row-swap) ;
 *   2. « clé exigée » : sans clé, on LÈVE — jamais de repli en clair, ni à
 *      l'écriture (un IBAN lisible en base) ni à la lecture (un faux-semblant).
 *
 * ⚠️ `enc:v1:` est lu À L'IDENTIQUE, et `encryptPii(x)` sans option produit
 * toujours `enc:v1:` : les Submission et tous les appelants existants ne
 * bougent pas (leurs tests restent verts sans retouche).
 *
 * Mutations qui font rougir : ignorer l'AAD au déchiffrement ; rendre le clair
 * quand `cleExigee` et pas de clé ; produire `enc:v2:` sans option.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PII_DECRYPT_PLACEHOLDER,
  PREFIX_V1,
  PREFIX_V2,
  decryptPii,
  encryptPii,
  isEncryptedPii,
} from "../pii-crypto";

const CLE = "c".repeat(64);
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];
const IBAN = "FR7630006000011234567890189";

function poserCle(valeur: string | undefined): void {
  if (valeur === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = valeur;
}

beforeEach(() => poserCle(CLE));
afterEach(() => poserCle(CLE_INITIALE));

describe("pii-crypto enc:v2", () => {
  it("le préfixe v2 est exporté et distinct de v1", () => {
    expect(PREFIX_V2).toBe("enc:v2:");
    expect(PREFIX_V1).toBe("enc:v1:");
  });

  it("sans option, rien ne change : enc:v1:", () => {
    expect(encryptPii(IBAN).startsWith(PREFIX_V1)).toBe(true);
  });

  it("avec option, enc:v2: — aller-retour avec la même AAD", () => {
    const chiffre = encryptPii(IBAN, { aad: "trainers:fiche-a:iban" });
    expect(chiffre.startsWith(PREFIX_V2)).toBe(true);
    expect(chiffre).not.toContain(IBAN);
    expect(decryptPii(chiffre, { aad: "trainers:fiche-a:iban" })).toBe(IBAN);
    expect(isEncryptedPii(chiffre)).toBe(true);
  });

  it("l'AAD est facultative : v2 sans AAD fait l'aller-retour", () => {
    const chiffre = encryptPii(IBAN, {});
    expect(chiffre.startsWith(PREFIX_V2)).toBe(true);
    expect(decryptPii(chiffre)).toBe(IBAN);
  });

  it("une autre AAD (autre fiche) LÈVE : le chiffré est lié à sa ligne", () => {
    const chiffre = encryptPii(IBAN, { aad: "trainers:fiche-a:iban" });
    expect(() => decryptPii(chiffre, { aad: "trainers:fiche-b:iban" })).toThrow();
    expect(() => decryptPii(chiffre)).toThrow();
  });

  it("un chiffré altéré LÈVE", () => {
    const chiffre = encryptPii(IBAN, { aad: "x" });
    const parts = chiffre.slice(PREFIX_V2.length).split(":");
    const ct = parts[1] as string;
    const altere = `${PREFIX_V2}${parts[0]}:${(ct[0] === "0" ? "1" : "0") + ct.slice(1)}:${parts[2]}`;
    expect(() => decryptPii(altere, { aad: "x" })).toThrow();
  });

  it("idempotent : un v2 n'est pas re-chiffré", () => {
    const chiffre = encryptPii(IBAN, { aad: "x" });
    expect(encryptPii(chiffre, { aad: "x" })).toBe(chiffre);
  });

  it("enc:v1: est lu à l'identique, même si l'on passe des options", () => {
    const v1 = encryptPii(IBAN);
    expect(decryptPii(v1)).toBe(IBAN);
    expect(decryptPii(v1, { aad: "ignorée pour v1" })).toBe(IBAN);
  });

  describe("clé exigée — aucun repli en clair", () => {
    it("sans clé, le chiffrement LÈVE au lieu de rendre le clair", () => {
      poserCle(undefined);
      expect(() => encryptPii(IBAN, { cleExigee: true })).toThrow(/PII_ENCRYPTION_KEY/);
    });

    it("sans clé, le déchiffrement LÈVE au lieu de rendre le placeholder", () => {
      const chiffre = encryptPii(IBAN, { aad: "x", cleExigee: true });
      poserCle(undefined);
      expect(() => decryptPii(chiffre, { aad: "x", cleExigee: true })).toThrow(
        /PII_ENCRYPTION_KEY/,
      );
    });

    it("clé exigée : un clair (non préfixé) à la lecture LÈVE", () => {
      expect(() => decryptPii(IBAN, { cleExigee: true })).toThrow();
    });

    it("contre-témoin : SANS l'option, le repli historique demeure", () => {
      const chiffre = encryptPii(IBAN, { aad: "x" });
      poserCle(undefined);
      expect(decryptPii(chiffre, { aad: "x" })).toBe(PII_DECRYPT_PLACEHOLDER);
      expect(encryptPii(IBAN)).toBe(IBAN);
    });
  });
});
