/**
 * 🔴 F1 — l'entreprise du stagiaire ne doit plus être une SECONDE saisie libre.
 *
 * Ce qui a été constaté en production le 2026-09-04 : `clients/new` crée
 * « SCI Invest Sun », puis `stagiaires/new` redemande « Entreprise » dans un
 * `<input>` libre. Rien ne relie les deux, et rien ne rapproche jamais les
 * valeurs. « SCI invest sun », « Invest Sun » et « SCI INVEST SUN » cohabitent
 * alors dans la base sans qu'un seul écran ne le signale — et c'est la
 * convention, pièce contractuelle, qui porte l'écart.
 *
 * Les trois cas qui font la valeur de ce correctif, et qu'aucune relecture à
 * l'œil ne garantit :
 *   1. une valeur déjà en base qui DÉSIGNE un client existant doit re-pointer
 *      vers ce client — sinon rien ne converge et on a juste déplacé le champ ;
 *   2. une variante de casse / d'accent doit être reconnue, sinon le correctif
 *      ne répare que les fiches parfaites, c'est-à-dire celles qui n'ont pas
 *      le défaut ;
 *   3. une entreprise hors registre doit SURVIVRE — la perdre en ouvrant la
 *      fiche serait plus grave que l'écart qu'on corrige.
 */

import { describe, it, expect } from "vitest";

import {
  OPTION_ENTREPRISE_AUCUNE,
  OPTION_ENTREPRISE_LIBRE,
  entrepriseRetenue,
  normaliserRaisonSociale,
  optionInitialeEntreprise,
} from "../entreprise-client";

/** Raisons sociales telles qu'elles sont ÉCRITES en base, casse comprise. */
const CLIENTS = ["SCI Invest Sun", "Boulangerie Délifrance", "ACME"] as const;

describe("optionInitialeEntreprise", () => {
  it("ouvre sur « aucune entreprise » quand rien n'est enregistré", () => {
    expect(optionInitialeEntreprise(null, CLIENTS)).toBe(OPTION_ENTREPRISE_AUCUNE);
    expect(optionInitialeEntreprise("", CLIENTS)).toBe(OPTION_ENTREPRISE_AUCUNE);
    expect(optionInitialeEntreprise("   ", CLIENTS)).toBe(OPTION_ENTREPRISE_AUCUNE);
  });

  it("re-pointe une valeur EXACTE vers son client", () => {
    expect(optionInitialeEntreprise("SCI Invest Sun", CLIENTS)).toBe("SCI Invest Sun");
  });

  // 🔴 LE cas du défaut : ce sont les variantes qui existent en base, pas les
  // valeurs exactes. Une reconnaissance sensible à la casse ne réparerait que
  // les fiches déjà propres.
  it("reconnaît les variantes de casse, d'accent et d'espaces", () => {
    expect(optionInitialeEntreprise("sci invest sun", CLIENTS)).toBe("SCI Invest Sun");
    expect(optionInitialeEntreprise("SCI   INVEST  SUN ", CLIENTS)).toBe("SCI Invest Sun");
    expect(optionInitialeEntreprise("boulangerie delifrance", CLIENTS)).toBe(
      "Boulangerie Délifrance",
    );
  });

  it("bascule en saisie libre — sans effacer — pour une entreprise hors registre", () => {
    expect(optionInitialeEntreprise("Mairie de Saint-Étienne", CLIENTS)).toBe(
      OPTION_ENTREPRISE_LIBRE,
    );
  });

  // Contre-témoin : « Invest Sun » N'EST PAS « SCI Invest Sun ». La
  // normalisation ne doit pas rapprocher deux raisons sociales différentes —
  // une pré-sélection fausse écrirait en base le nom d'un AUTRE client.
  it("ne rapproche pas deux raisons sociales réellement différentes", () => {
    expect(optionInitialeEntreprise("Invest Sun", CLIENTS)).toBe(OPTION_ENTREPRISE_LIBRE);
  });
});

describe("entrepriseRetenue", () => {
  it("écrit la raison sociale du client TELLE QU'ELLE EST en base", () => {
    // C'est tout l'objet du correctif : une COPIE, jamais une seconde frappe.
    expect(entrepriseRetenue("SCI Invest Sun", "peu importe")).toBe("SCI Invest Sun");
  });

  it("écrit la saisie libre, élaguée, quand l'entreprise est hors registre", () => {
    expect(entrepriseRetenue(OPTION_ENTREPRISE_LIBRE, "  Mairie de Firminy ")).toBe(
      "Mairie de Firminy",
    );
  });

  it("rend une chaîne vide quand aucune entreprise n'est choisie", () => {
    expect(entrepriseRetenue(OPTION_ENTREPRISE_AUCUNE, "résidu d'une saisie abandonnée")).toBe("");
  });
});

describe("normaliserRaisonSociale", () => {
  // Témoin positif de la normalisation elle-même : sans lui, une fonction qui
  // renverrait toujours "" ferait passer tous les tests d'égalité ci-dessus en
  // rapprochant TOUT — « aucun écart » et « je ne compare rien » seraient
  // indiscernables.
  it("ne réduit pas tout à la même valeur", () => {
    expect(normaliserRaisonSociale("ACME")).toBe("acme");
    expect(normaliserRaisonSociale("Délifrance")).toBe("delifrance");
    expect(normaliserRaisonSociale("ACME")).not.toBe(normaliserRaisonSociale("Délifrance"));
  });
});
