/**
 * Tests — canonical.ts
 *
 * Ce que ces tests protègent : la REPRODUCTIBILITÉ octet-à-octet du hachage.
 * Une régression ici ne casse rien de visible — elle rend juste toutes les
 * signatures antérieures invérifiables, en silence.
 */

import { describe, it, expect } from "vitest";
import { canonicalJson, CanonicalisationError } from "./canonical";

describe("canonicalJson", () => {
  describe("ordre des clés", () => {
    it("trie les clés, donc l'ordre d'insertion n'a aucun effet", () => {
      const a = canonicalJson({ b: "2", a: "1", c: "3" });
      const b = canonicalJson({ c: "3", a: "1", b: "2" });
      expect(a).toBe(b);
      expect(a).toBe('{"a":"1","b":"2","c":"3"}');
    });

    it("trie aussi les clés imbriquées", () => {
      const s = canonicalJson({ z: { y: "1", x: "2" }, a: "0" });
      expect(s).toBe('{"a":"0","z":{"x":"2","y":"1"}}');
    });

    it("trie par point de code, pas selon la locale", () => {
      // En locale française, « é » se classerait après « e » mais avant « f ».
      // Par point de code UTF-16, « é » (U+00E9) vient APRÈS « z » (U+007A).
      const s = canonicalJson({ ["é"]: "1", z: "2", a: "3" });
      expect(s).toBe('{"a":"3","z":"2","é":"1"}');
    });
  });

  describe("préservation de l'information", () => {
    it("ne produit aucun espace", () => {
      expect(canonicalJson({ a: ["x", "y"], b: { c: "d" } })).not.toMatch(/\s/);
    });

    it("distingue null, chaîne vide et zéro", () => {
      const vus = new Set([
        canonicalJson({ v: null }),
        canonicalJson({ v: "" }),
        canonicalJson({ v: 0 }),
        canonicalJson({ v: false }),
      ]);
      expect(vus.size).toBe(4);
    });

    it("préserve l'ordre des tableaux — un ordre de modules différent change le hash", () => {
      const a = canonicalJson({ modules: ["Module 1", "Module 2"] });
      const b = canonicalJson({ modules: ["Module 2", "Module 1"] });
      expect(a).not.toBe(b);
    });

    it("échappe correctement guillemets, antislashs et accents", () => {
      const s = canonicalJson({ nom: 'Jean "Le Bref" O\\Neil — éàü' });
      expect(JSON.parse(s)).toEqual({ nom: 'Jean "Le Bref" O\\Neil — éàü' });
    });

    it("normalise -0 en 0 : deux zéros ne peuvent pas produire deux hash", () => {
      expect(canonicalJson({ v: -0 })).toBe(canonicalJson({ v: 0 }));
    });
  });

  describe("refus explicite plutôt que coercition silencieuse", () => {
    it("refuse `undefined` — ambigu avec l'absence de clé", () => {
      expect(() => canonicalJson({ v: undefined } as never)).toThrow(CanonicalisationError);
    });

    it("refuse un flottant — sa représentation textuelle n'est pas stable", () => {
      expect(() => canonicalJson({ v: 1.5 })).toThrow(CanonicalisationError);
    });

    it("refuse NaN et Infinity", () => {
      expect(() => canonicalJson({ v: NaN })).toThrow(CanonicalisationError);
      expect(() => canonicalJson({ v: Infinity })).toThrow(CanonicalisationError);
    });

    it("refuse une Date — la conversion ISO doit être EXPLICITE côté appelant", () => {
      expect(() => canonicalJson({ v: new Date() } as never)).toThrow(CanonicalisationError);
    });

    it("le message d'erreur nomme le chemin fautif", () => {
      try {
        canonicalJson({ a: { b: [{ c: undefined }] } } as never);
        throw new Error("aurait dû lever");
      } catch (e) {
        expect((e as Error).message).toContain("a.b[0].c");
      }
    });
  });
});
