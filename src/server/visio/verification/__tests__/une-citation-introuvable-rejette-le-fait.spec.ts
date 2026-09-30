/**
 * ⛔ G1 — UNE CITATION INTROUVABLE REJETTE LE FAIT (`compte-rendu-et-extraction.md` §4.2).
 *
 * La citation doit se retrouver MOT POUR MOT dans les segments cités (après
 * la seule normalisation permise). Une citation retouchée (« 12 » au lieu de
 * « douze », un mot changé, deux morceaux recollés) ⇒ `citation_introuvable`,
 * et le fait rejeté NE GARDE PAS sa citation.
 *
 * Mutation qui rougit : dans `verifierPreuve`, remplacer la recherche exacte
 * par un `true` → les trois cas passent. Contre-témoin : le scénario fidèle
 * passe (citations vérifiées, horodatées par le code). Angle mort : deux
 * phrases identiques à deux endroits — la citation est prouvée, l'horodatage
 * est celui du segment cité.
 */

import { describe, expect, it } from "vitest";

import { normaliserPourCitation } from "../g01-citation";
import { avec, leFait, verifier } from "./outils";

describe("une citation introuvable rejette le fait", () => {
  it.each([
    ["chiffre à la place du nombre en lettres", "On serait 12 commerciaux à former"],
    ["un mot changé", "On serait douze vendeurs à former"],
    ["deux morceaux recollés", "On serait douze commerciaux sur l'IA générative"],
  ])("%s → citation_introuvable, sans citation gardée", (_n, citation) => {
    const b = verifier(avec("F01", { preuves: [{ segment_ids: ["S0004"], citation }] }));
    expect(leFait(b, "F01")).toMatchObject({
      statut: "rejete",
      motif: "citation_introuvable",
      citation: null,
    });
  });

  it("contre-témoin : le scénario fidèle passe, horodaté par le code", () => {
    const b = verifier(avec("F01", {}));
    expect(leFait(b, "F01")).toMatchObject({
      statut: "propose",
      citationDebutMs: 25_000,
      locuteur: "client",
    });
  });

  it("la normalisation ne fait que ce qui est permis (hésitations, ponctuation, casse)", () => {
    expect(normaliserPourCitation("Euh, ON serait… douze !")).toBe("on serait douze");
    expect(normaliserPourCitation("douze")).not.toBe(normaliserPourCitation("12"));
  });
});
