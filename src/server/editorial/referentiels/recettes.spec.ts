/**
 * Console éditoriale — tests du registre des recettes.
 *
 * 🔴 `ed_recettes` était vide, et les deux vérificateurs à l'aveugle l'ont vu
 * séparément. Ces tests verrouillent les deux façons dont ce registre peut
 * redevenir inutile :
 *
 *   1. il se vide — et le critère 1 du lot 2 redevient inexerçable ;
 *   2. il vise une famille qui n'existe pas — et l'amorçage casse, ou pire,
 *      crée des dérivés orphelins.
 */

import { describe, it, expect } from "vitest";
import { ED_RECETTES, ED_RECETTES_ATTENDUES, totalDerives } from "./recettes";
import { ED_FAMILLES } from "./familles";

const SLUGS_FAMILLES = new Set(ED_FAMILLES.map((f) => f.slug));

describe("le registre des recettes", () => {
  it("🔴 n'est pas vide — c'est tout le défaut qu'il corrige", () => {
    expect(ED_RECETTES.length).toBeGreaterThan(0);
    expect(ED_RECETTES_ATTENDUES).toBe(ED_RECETTES.length);
  });

  it("🔴 ne vise QUE des familles qui existent, source comprise", () => {
    // Une recette qui pointe une famille absente échoue à l'amorçage — ce qui
    // vaut mieux que des dérivés orphelins, mais reste un semis cassé.
    for (const r of ED_RECETTES) {
      expect(SLUGS_FAMILLES.has(r.familleSourceSlug), `source de ${r.slug}`).toBe(true);
      for (const l of r.lignes) {
        expect(SLUGS_FAMILLES.has(l.familleSlug), `${r.slug} → ${l.familleSlug}`).toBe(true);
      }
    }
  });

  it("a des `slug` uniques — la clé naturelle doit rester rejouable", () => {
    const slugs = ED_RECETTES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("🔴 reste MODESTE en quantité", () => {
    // Une recette qui crée trente dérivés d'un coup remplit la médiathèque
    // d'assets `a_produire` que personne ne produira, et le tableau de bord
    // se met à mentir sur ce qui reste à faire.
    for (const r of ED_RECETTES) {
      expect(totalDerives(r), r.slug).toBeLessThanOrEqual(6);
      expect(totalDerives(r), r.slug).toBeGreaterThan(0);
    }
  });

  it("dit POURQUOI chaque ligne existe", () => {
    // La note s'affiche à l'application. « 3 shorts » sans raison ne se
    // discute pas ; « trois moments forts, pas trente » se discute.
    for (const r of ED_RECETTES) {
      for (const l of r.lignes) {
        expect(l.note.length, `${r.slug} → ${l.familleSlug}`).toBeGreaterThan(20);
      }
    }
  });

  it("n'a aucune quantité nulle ou négative", () => {
    for (const r of ED_RECETTES) {
      for (const l of r.lignes) {
        expect(Number.isInteger(l.quantite), `${r.slug}`).toBe(true);
        expect(l.quantite, `${r.slug}`).toBeGreaterThan(0);
      }
    }
  });
});
