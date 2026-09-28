/**
 * ⛔ LE CHIFFREMENT DES OCTETS LÈVE SANS CLÉ ET FAIT L'ALLER-RETOUR
 * (chantier visio, PR 2 ; ADR 0054).
 *
 * Les morceaux de son de l'enregistreur sont chiffrés par le serveur avant
 * d'être écrits dans R2. Un repli « sans clé, on écrit en clair » — celui
 * d'`encryptPii` — écrirait une conversation lisible dans un stockage : ici,
 * l'absence de clé est une erreur.
 *
 * Mutation qui fait rougir : faire rendre `clair` à `chiffrerOctetsPii` quand
 * la clé manque.
 */

import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chiffrerOctets, dechiffrerOctets } from "../chiffrer-parole";
import { ENTETE_OCTETS_V1 } from "../pii-crypto";

const CLE = "b".repeat(64);
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];

function poserCle(valeur: string | undefined): void {
  if (valeur === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = valeur;
}

beforeEach(() => poserCle(CLE));
afterEach(() => poserCle(CLE_INITIALE));

describe("le chiffrement des octets", () => {
  it("fait l'aller-retour, octet pour octet", () => {
    const son = randomBytes(40_000);
    const enveloppe = chiffrerOctets(son);
    expect(enveloppe.subarray(0, 4).equals(ENTETE_OCTETS_V1)).toBe(true);
    expect(enveloppe.length).toBe(son.length + 4 + 12 + 16);
    expect(dechiffrerOctets(enveloppe).equals(son)).toBe(true);
  });

  it("deux chiffrements du même son diffèrent (IV aléatoire)", () => {
    const son = Buffer.from("même son");
    expect(chiffrerOctets(son).equals(chiffrerOctets(son))).toBe(false);
  });

  it("le son n'apparaît pas en clair dans l'enveloppe", () => {
    const son = Buffer.from("PAROLE-RECONNAISSABLE-".repeat(20));
    const enveloppe = chiffrerOctets(son);
    expect(enveloppe.includes(Buffer.from("PAROLE-RECONNAISSABLE-"))).toBe(false);
  });

  it("sans clé, le chiffrement LÈVE", () => {
    poserCle(undefined);
    expect(() => chiffrerOctets(Buffer.from("son"))).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("sans clé, le déchiffrement LÈVE", () => {
    const enveloppe = chiffrerOctets(Buffer.from("son"));
    poserCle(undefined);
    expect(() => dechiffrerOctets(enveloppe)).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("une enveloppe altérée est refusée", () => {
    const enveloppe = chiffrerOctets(Buffer.from("son à protéger"));
    const altere = Buffer.from(enveloppe);
    altere[altere.length - 1] = (altere[altere.length - 1] ?? 0) ^ 0xff;
    expect(() => dechiffrerOctets(altere)).toThrow();
  });

  it("un en-tête inconnu est refusé", () => {
    const enveloppe = chiffrerOctets(Buffer.from("son"));
    const autre = Buffer.concat([Buffer.from("XXXX"), enveloppe.subarray(4)]);
    expect(() => dechiffrerOctets(autre)).toThrow(/AXB1/);
  });

  it("une enveloppe trop courte est refusée", () => {
    expect(() => dechiffrerOctets(Buffer.from("AXB1"))).toThrow(/courte/);
  });
});
