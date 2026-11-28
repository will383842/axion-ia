/**
 * 🔐 Trousseau de clés — lecture avec plusieurs clés (#2464, PR O, point 27).
 *
 * `PII_ENCRYPTION_KEY` chiffre ; `PII_ENCRYPTION_KEYS_LECTURE` ne sert qu'à
 * DÉCHIFFRER (anciennes clés, pendant une rotation). Aucun changement de format.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PII_DECRYPT_PLACEHOLDER,
  PREFIX_V1,
  PREFIX_V2,
  chiffrerOctetsPii,
  cleQuiDechiffre,
  decryptPii,
  dechiffrerOctetsPii,
  encryptPii,
} from "../pii-crypto";

const ANCIENNE = "a".repeat(64);
const NOUVELLE = "b".repeat(64);
const AUTRE = "d".repeat(64);
const IBAN = "FR7630006000011234567890189";

const INITIALES = {
  cle: process.env["PII_ENCRYPTION_KEY"],
  lecture: process.env["PII_ENCRYPTION_KEYS_LECTURE"],
};

function poser(nom: string, valeur: string | undefined): void {
  if (valeur === undefined) delete process.env[nom];
  else process.env[nom] = valeur;
}
function cles(courante: string | undefined, lecture?: string): void {
  poser("PII_ENCRYPTION_KEY", courante);
  poser("PII_ENCRYPTION_KEYS_LECTURE", lecture);
}

beforeEach(() => cles(ANCIENNE));
afterEach(() => {
  poser("PII_ENCRYPTION_KEY", INITIALES.cle);
  poser("PII_ENCRYPTION_KEYS_LECTURE", INITIALES.lecture);
  vi.restoreAllMocks();
});

describe("trousseau de lecture", () => {
  it("lit un chiffré v1 fait avec l'ancienne clé", () => {
    const chiffre = encryptPii(IBAN);
    cles(NOUVELLE, ANCIENNE);
    expect(decryptPii(chiffre)).toBe(IBAN);
  });

  it("chiffre toujours avec la clé courante, jamais avec une clé de lecture", () => {
    cles(NOUVELLE, ANCIENNE);
    const chiffre = encryptPii(IBAN);
    expect(chiffre.startsWith(PREFIX_V1)).toBe(true);
    cles(NOUVELLE);
    expect(decryptPii(chiffre)).toBe(IBAN);
    cles(ANCIENNE);
    expect(() => decryptPii(chiffre)).toThrow();
  });

  it("respecte l'AAD v2 avec l'ancienne clé", () => {
    const chiffre = encryptPii(IBAN, { aad: "iban-historique:7" });
    expect(chiffre.startsWith(PREFIX_V2)).toBe(true);
    cles(NOUVELLE, ANCIENNE);
    expect(decryptPii(chiffre, { aad: "iban-historique:7" })).toBe(IBAN);
    expect(() => decryptPii(chiffre, { aad: "iban-historique:8" })).toThrow();
  });

  it("lit des octets AXB1 faits avec l'ancienne clé", () => {
    const enveloppe = chiffrerOctetsPii(Buffer.from("pièce"));
    cles(NOUVELLE, ANCIENNE);
    expect(dechiffrerOctetsPii(enveloppe).toString("utf8")).toBe("pièce");
  });

  it("ignore une clé de lecture invalide ou doublon, sans lever", () => {
    const chiffre = encryptPii(IBAN);
    const avertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    cles(NOUVELLE, `pas-une-cle, ${NOUVELLE},${ANCIENNE} ,${ANCIENNE}`);
    expect(decryptPii(chiffre)).toBe(IBAN);
    expect(avertir).toHaveBeenCalled();
    for (const appel of avertir.mock.calls) {
      expect(String(appel[0])).not.toContain("pas-une-cle");
      expect(String(appel[0])).not.toContain(ANCIENNE);
    }
  });

  it("aucune clé ne passe : lève comme avant (clé exigée ou non)", () => {
    const chiffre = encryptPii(IBAN);
    const octets = chiffrerOctetsPii(Buffer.from("x"));
    cles(NOUVELLE, AUTRE);
    expect(() => decryptPii(chiffre)).toThrow();
    expect(() => decryptPii(chiffre, { cleExigee: true })).toThrow();
    expect(() => dechiffrerOctetsPii(octets)).toThrow();
  });

  it("sans clé courante : placeholder, ou levée si clé exigée (inchangé)", () => {
    const chiffre = encryptPii(IBAN);
    cles(undefined, ANCIENNE);
    expect(decryptPii(chiffre)).toBe(PII_DECRYPT_PLACEHOLDER);
    expect(() => decryptPii(chiffre, { cleExigee: true })).toThrow();
  });
});

describe("cleQuiDechiffre", () => {
  it("dit courante, lecture ou null", () => {
    const ancien = encryptPii(IBAN);
    const ancienV2 = encryptPii(IBAN, { aad: "x:1" });
    cles(NOUVELLE, ANCIENNE);
    const recent = encryptPii(IBAN);
    expect(cleQuiDechiffre(recent)).toBe("courante");
    expect(cleQuiDechiffre(ancien)).toBe("lecture");
    expect(cleQuiDechiffre(ancienV2, "x:1")).toBe("lecture");
    expect(cleQuiDechiffre(ancienV2, "x:2")).toBeNull();
    cles(NOUVELLE);
    expect(cleQuiDechiffre(ancien)).toBeNull();
    expect(cleQuiDechiffre("texte clair")).toBeNull();
  });
});
