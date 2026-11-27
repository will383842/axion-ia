import { describe, expect, it } from "vitest";

import { empreinteContenu, empreinteControle, jsonCanonique, sha256Hex } from "../empreinte";
import { contenuExemple, copieModifiable } from "./fixtures";

describe("jsonCanonique", () => {
  it("trie les clés à tous les niveaux : l'ordre d'insertion n'y change rien", () => {
    const a = { b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } };
    const b = { a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 };
    expect(jsonCanonique(a)).toBe(jsonCanonique(b));
    expect(jsonCanonique(a)).toBe('{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}');
  });

  it("garde l'ordre des tableaux et omet les clés undefined", () => {
    expect(jsonCanonique([2, 1])).toBe("[2,1]");
    expect(jsonCanonique({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("refuse un nombre non entier : tout est en centimes entiers", () => {
    expect(() => jsonCanonique({ montant: 10.5 })).toThrow(/entier/i);
    expect(() => jsonCanonique({ montant: Number.NaN })).toThrow();
    expect(() => jsonCanonique({ montant: Infinity })).toThrow();
  });

  it("sérialise une date en ISO", () => {
    expect(jsonCanonique({ d: new Date("2026-10-01T00:00:00Z") })).toBe(
      '{"d":"2026-10-01T00:00:00.000Z"}',
    );
  });

  it("échappe comme JSON", () => {
    expect(jsonCanonique({ s: 'a"b\n' })).toBe('{"s":"a\\"b\\n"}');
  });
});

describe("sha256Hex", () => {
  it("vecteur de référence", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("accepte des octets (PDF)", () => {
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(sha256Hex("abc"));
  });
});

describe("empreinteContenu", () => {
  it("64 caractères hexadécimaux, stable", () => {
    const c = contenuExemple();
    expect(empreinteContenu(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteContenu(c)).toBe(empreinteContenu(structuredClone(c)));
  });

  it("change au moindre centime", () => {
    const c = contenuExemple();
    const d = copieModifiable(c);
    d.totaux.factureHtCents += 1;
    expect(empreinteContenu(d)).not.toBe(empreinteContenu(c));
  });

  it("change au moindre jour", () => {
    const c = contenuExemple();
    const d = copieModifiable(c);
    d.facturees.pieces[0]!.emiseLe = "2026-10-16";
    expect(empreinteContenu(d)).not.toBe(empreinteContenu(c));
  });
});

describe("empreinteControle : exclut le report indicatif (D3)", () => {
  it("D3 change : l'empreinte de contrôle ne bouge pas, celle du contenu bouge", () => {
    const c = contenuExemple();
    const d = copieModifiable(c);
    d.report.indicatif.auJour = "2026-11-05";
    d.report.indicatif.lignes.push({
      entreprise: "Société fictive",
      prestation: "Audit",
      statut: "a_qualifier",
      montantHtCents: 1000,
    });
    expect(empreinteControle(d)).toBe(empreinteControle(c));
    expect(empreinteContenu(d)).not.toBe(empreinteContenu(c));
  });

  it("un changement hors D3 fait bouger l'empreinte de contrôle", () => {
    const c = contenuExemple();
    const d = copieModifiable(c);
    d.totaux.vireTtcCents += 1;
    expect(empreinteControle(d)).not.toBe(empreinteControle(c));
  });
});
