/**
 * L'aide au devis montre « à trancher » TEL QUEL (PR 7, décision de Will du 29/09).
 *
 * Deux rendez-vous disent 12 puis 15 participants pour le même projet : le
 * panneau montre les DEUX valeurs et la mention « à trancher » — aucune n'est
 * choisie en silence, et rien n'est écrit dans le devis (qui reste vide).
 *
 * Mutation qui rougit : ne garder que le premier fait d'une valeur à trancher
 * dans `valeursAffichees` ; ou retaper une mention dans l'aide au lieu de lire
 * `MENTION_ETAT` (Will lirait deux phrases pour le même état).
 * Contre-témoin : une seule valeur → « courante », sans mention.
 * Angle mort : deux valeurs égales dites dans deux rendez-vous ne sont pas en
 * conflit (une ligne, deux phrases) — c'est voulu.
 */

import { describe, expect, it } from "vitest";

import { MENTION_ETAT } from "@/features/dossier-client/libelles";

import { aide, element, PROJET } from "./_aide";
import { faitProjet, ilYA } from "./_faits";

describe("l'aide au devis affiche « à trancher »", () => {
  it("deux nombres de participants différents : deux valeurs et la mention", () => {
    const a = aide([
      faitProjet(PROJET, { type: "nb_participants", quantite: 12, constateLe: ilYA(20) }),
      faitProjet(PROJET, { type: "nb_participants", quantite: 15, constateLe: ilYA(3) }),
    ]);
    const e = element(a, "nb_participants");
    expect(e?.etat).toBe("a_trancher");
    // Même phrase que la fiche : une seule table des mentions (`MENTION_ETAT`).
    expect(e?.mention).toBe(MENTION_ETAT.a_trancher);
    expect(e?.valeurs.map((v) => v.texte).sort()).toEqual(["12", "15"]);
  });

  it("contre-témoin : une seule valeur est courante, sans mention", () => {
    const a = aide([faitProjet(PROJET, { type: "nb_participants", quantite: 12 })]);
    const e = element(a, "nb_participants");
    expect(e?.etat).toBe("courante");
    expect(e?.mention).toBeNull();
    expect(e?.valeurs.map((v) => v.texte)).toEqual(["12"]);
  });

  it("une valeur remise en cause n'est montrée qu'avec sa mention, sans valeur", () => {
    const a = aide([
      faitProjet(PROJET, { type: "budget", montantMaxCents: 300000, suivi: "a_reconfirmer" }),
    ]);
    const e = element(a, "budget");
    expect(e?.etat).toBe("a_reconfirmer");
    expect(e?.valeurs).toEqual([]);
    expect(e?.mention).toBe(MENTION_ETAT.a_reconfirmer);
  });
});
