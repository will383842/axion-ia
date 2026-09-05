/**
 * L'ENVOI GROUPÉ AUX POSTULANTS — ce qu'il personnalise, et ce qu'il écarte.
 *
 * 🔑 Ces tests appellent la VRAIE `remplirModele`, celle du composeur unitaire,
 * jamais une doublure. C'est le point : si les deux substitutions divergeaient,
 * une doublure verdirait pendant que la production enverrait « Bonjour
 * {prenom}, » — un test qui construit lui-même la fonction qu'il éprouve ne
 * prouve rien de la production.
 */

import { describe, expect, it } from "vitest";

import { MODELES_REPONSE, remplirModele } from "@/content/recrutement/modeles-reponse";

import {
  preparerEnvois,
  variablesEmployees,
  type DestinatairePrepare,
} from "../reponse-en-masse";

const AMINA: DestinatairePrepare = { id: "a", prenom: "Amina", poste: "Monteur vidéo" };
const BORIS: DestinatairePrepare = { id: "b", prenom: "Boris", poste: "Développeur" };

describe("variablesEmployees", () => {
  it("ne retient que les variables que la substitution sait résoudre", () => {
    expect(variablesEmployees("Bonjour {prenom}, pour {poste}")).toEqual(["prenom", "poste"]);
  });

  it("IGNORE une variable inconnue — elle restera à l'écran, ce n'est pas un motif d'écart", () => {
    // `remplirModele` laisse `{societe}` tel quel, accolades comprises. Écarter
    // sur elle bloquerait tout envoi sans jamais dire quoi corriger, puisque
    // aucun dossier ne la porte : le geste deviendrait inutilisable.
    expect(variablesEmployees("Bonjour {prenom} de {societe}")).toEqual(["prenom"]);
  });

  it("ne compte pas deux fois la même variable", () => {
    expect(variablesEmployees("{prenom} … {prenom}")).toEqual(["prenom"]);
  });
});

describe("preparerEnvois — un message PAR personne", () => {
  it("🔴 substitue avec le dossier de CHACUN, jamais avec celui du premier", () => {
    // LE défaut que ce module existe pour empêcher : le prénom du premier
    // candidat parti à tous les autres. Il ne se voit que du côté des
    // destinataires — d'où un test qui le regarde de face.
    const { envois, ecartes } = preparerEnvois(
      [AMINA, BORIS],
      { objet: "Votre candidature — {poste}", corps: "Bonjour {prenom}," },
      remplirModele,
    );

    expect(ecartes).toEqual([]);
    expect(envois).toEqual([
      { id: "a", objet: "Votre candidature — Monteur vidéo", corps: "Bonjour Amina," },
      { id: "b", objet: "Votre candidature — Développeur", corps: "Bonjour Boris," },
    ]);
  });

  it("laisse intact un texte sans variable — le cas du message libre", () => {
    const { envois } = preparerEnvois(
      [AMINA],
      { objet: "Un mot", corps: "Merci de votre passage." },
      remplirModele,
    );
    expect(envois[0]).toEqual({ id: "a", objet: "Un mot", corps: "Merci de votre passage." });
  });

  it("🔴 ÉCARTE celui dont le prénom manque, et NOMME la variable en cause", () => {
    const sansPrenom: DestinatairePrepare = { id: "c", prenom: null, poste: "Monteur vidéo" };
    const { envois, ecartes } = preparerEnvois(
      [AMINA, sansPrenom],
      { objet: "Votre candidature", corps: "Bonjour {prenom}," },
      remplirModele,
    );

    // Le geste n'est pas annulé : Amina part quand même.
    expect(envois.map((e) => e.id)).toEqual(["a"]);
    expect(ecartes).toEqual([
      { id: "c", motif: "variable_non_resolue", variables: ["prenom"] },
    ]);
  });

  it("écarte aussi sur un prénom fait d'espaces — `remplirModele` ne le résoudrait pas", () => {
    // Un prénom « <espace> » n'est pas absent au sens de la base, mais il laisse
    // l'accolade : la règle d'écart doit être EXACTEMENT celle de la
    // substitution, sans quoi le trou passerait.
    const blanc: DestinatairePrepare = { id: "d", prenom: "   ", poste: "X" };
    const { envois, ecartes } = preparerEnvois(
      [blanc],
      { objet: "o", corps: "Bonjour {prenom}," },
      remplirModele,
    );
    expect(envois).toEqual([]);
    expect(ecartes[0]?.variables).toEqual(["prenom"]);
  });

  it("nomme les DEUX variables quand les deux manquent", () => {
    const nu: DestinatairePrepare = { id: "e", prenom: null, poste: null };
    const { ecartes } = preparerEnvois(
      [nu],
      { objet: "{poste}", corps: "Bonjour {prenom}," },
      remplirModele,
    );
    // L'ordre suit le TEXTE — l'objet d'abord, puis le corps — et pas l'ordre de
    // `VARIABLES_CONNUES`. C'est celui dans lequel l'écran les lira au recruteur,
    // donc celui qu'on fige. (Écrit d'abord à l'envers ici : le test l'a dit.)
    expect(ecartes[0]?.variables).toEqual(["poste", "prenom"]);
  });

  it("n'écarte PAS sur une variable inconnue — elle part visible, et se corrige", () => {
    const { envois, ecartes } = preparerEnvois(
      [AMINA],
      { objet: "o", corps: "Bonjour {prenom} chez {societe}" },
      remplirModele,
    );
    expect(ecartes).toEqual([]);
    expect(envois[0]?.corps).toBe("Bonjour Amina chez {societe}");
  });

  it("rend deux listes vides sur une sélection vide — pas d'exception à gérer côté appelant", () => {
    expect(preparerEnvois([], { objet: "o", corps: "c" }, remplirModele)).toEqual({
      envois: [],
      ecartes: [],
    });
  });
});

describe("les modèles livrés passent tous par ce chemin", () => {
  // 🔑 TÉMOIN POSITIF, et il vaut plus qu'il n'en a l'air. Les tests ci-dessus
  // emploient des textes écrits pour eux ; celui-ci prend les modèles RÉELS du
  // dépôt. Le jour où quelqu'un ajoute un modèle avec une variable que
  // `VARIABLES_CONNUES` ignore, ce test rougit — alors qu'aucun des autres ne
  // le verrait, et qu'en production le geste écarterait tout le monde en
  // silence.
  const AVEC_TEXTE = MODELES_REPONSE.filter((m) => m.corps.length > 0);

  it("il y a bien des modèles à éprouver — sinon ce bloc verdirait sur du vide", () => {
    expect(AVEC_TEXTE.length).toBeGreaterThan(0);
  });

  for (const modele of AVEC_TEXTE) {
    it(`« ${modele.libelle} » se résout entièrement pour un dossier complet`, () => {
      const { envois, ecartes } = preparerEnvois(
        [AMINA],
        { objet: modele.objet, corps: modele.corps },
        remplirModele,
      );
      expect(ecartes).toEqual([]);
      // Aucune accolade de variable CONNUE ne doit survivre au rendu.
      expect(variablesEmployees(envois[0]!.objet)).toEqual([]);
      expect(variablesEmployees(envois[0]!.corps)).toEqual([]);
    });
  }
});
