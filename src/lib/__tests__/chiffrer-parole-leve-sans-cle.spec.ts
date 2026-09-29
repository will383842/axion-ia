/**
 * `chiffrerParole` / `dechiffrerParole` LÈVENT là où `encryptPii` et
 * `decryptPii` tolèrent (chantier visio, PR 2 ; PA-11).
 *
 * Les trois tolérances de `pii-crypto` — clair rendu sans clé, valeur non
 * chiffrée rendue telle quelle, texte de remplacement au lieu d'une erreur —
 * sont justes pour un formulaire, et fausses pour une conversation : une
 * parole écrite en clair en base, ou un compte rendu qui afficherait
 * « [encrypted — key missing] ». Chacune doit ici LEVER.
 *
 * Mutation qui fait rougir : retirer `exigerCle(...)` de `chiffrerParole`
 * (le test « sans clé, le chiffrement lève » passe au rouge : `encryptPii`
 * rendrait le clair).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chiffrerParole, dechiffrerParole, dechiffrerParoleOuNull } from "../chiffrer-parole";
import { encryptPii, PREFIX_V1 } from "../pii-crypto";

const CLE = "a".repeat(64);
const CLE_INITIALE = process.env["PII_ENCRYPTION_KEY"];

function poserCle(valeur: string | undefined): void {
  if (valeur === undefined) delete process.env["PII_ENCRYPTION_KEY"];
  else process.env["PII_ENCRYPTION_KEY"] = valeur;
}

beforeEach(() => poserCle(CLE));
afterEach(() => poserCle(CLE_INITIALE));

describe("chiffrer-parole lève sans clé", () => {
  it("fait l'aller-retour avec la clé", () => {
    const chiffre = chiffrerParole("Nous serons douze à former.");
    expect(chiffre.startsWith(PREFIX_V1)).toBe(true);
    expect(chiffre).not.toContain("douze");
    expect(dechiffrerParole(chiffre)).toBe("Nous serons douze à former.");
  });

  it("sans clé, le chiffrement lève (encryptPii rendrait le clair)", () => {
    poserCle(undefined);
    expect(encryptPii("parole")).toBe("parole");
    expect(() => chiffrerParole("parole")).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("une clé mal formée est une clé absente", () => {
    poserCle("pas-une-cle");
    expect(() => chiffrerParole("parole")).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("sans clé, le déchiffrement lève (decryptPii rendrait un texte de remplacement)", () => {
    const chiffre = chiffrerParole("parole");
    poserCle(undefined);
    expect(() => dechiffrerParole(chiffre)).toThrow();
  });

  it("une valeur en clair en base lève au lieu d'être rendue telle quelle", () => {
    expect(() => dechiffrerParole("parole en clair")).toThrow(/enc:v1:/);
  });

  it("un double chiffrement est refusé", () => {
    const chiffre = chiffrerParole("parole");
    expect(() => chiffrerParole(chiffre)).toThrow(/double/);
  });

  it("une valeur altérée lève (étiquette d'authentification)", () => {
    const chiffre = chiffrerParole("parole");
    const altere = chiffre.slice(0, -2) + (chiffre.endsWith("00") ? "11" : "00");
    expect(() => dechiffrerParole(altere)).toThrow();
  });

  it("la chaîne vide reste vide (colonne vidée par un effacement)", () => {
    expect(chiffrerParole("")).toBe("");
    expect(dechiffrerParole("")).toBe("");
    expect(dechiffrerParoleOuNull(null)).toBeNull();
  });
});
