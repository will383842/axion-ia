/**
 * Lecture du positionnement — constats C2-03 et I10-02 (audit initial 2026-09-14).
 *
 * Le portail écrit dans `Questionnaire.reponses` : attentes, tâche visée,
 * fonction, outils, niveau par objectif et « besoin d'adaptation » oui/non.
 * AUCUN écran ni export de la console ne relisait ces réponses. Ce module est
 * la seule traduction de ce JSON vers ce qu'on montre : l'écran de session et
 * la pièce nominative du dossier d'audit lisent la même chose.
 */
import { describe, it, expect } from "vitest";
import {
  chronologieReponse,
  lirePositionnement,
  libelleBesoinAdaptation,
} from "./lecture-positionnement";

describe("lirePositionnement", () => {
  it("rend les réponses du portail telles que la stagiaire les a écrites", () => {
    const lu = lirePositionnement({
      fonction: "Assistante de direction",
      secteur: "Immobilier",
      outilsUtilises: "ChatGPT",
      frequenceUsage: "Quelques fois par mois",
      niveauParObjectif: { "Rédiger des annonces": 1, "Estimer un bien": 3 },
      attentes: "Gagner du temps sur les annonces",
      tacheVisee: "Les comptes rendus de visite",
      besoinAdaptation: true,
      detailAdaptation: "Salle accessible en fauteuil",
    });

    expect(lu.fonction).toBe("Assistante de direction");
    expect(lu.attentes).toBe("Gagner du temps sur les annonces");
    expect(lu.tacheVisee).toBe("Les comptes rendus de visite");
    expect(lu.niveaux).toEqual([
      { objectif: "Rédiger des annonces", niveau: 1, libelle: "Je découvre" },
      { objectif: "Estimer un bien", niveau: 3, libelle: "Je maîtrise" },
    ]);
    expect(lu.besoinAdaptation).toBe(true);
    expect(lu.detailAdaptation).toBe("Salle accessible en fauteuil");
    expect(lu.saisieAdmin).toBe(false);
  });

  it("« non » est une RÉPONSE : la case décochée se lit non, pas « non renseigné »", () => {
    const lu = lirePositionnement({ besoinAdaptation: false, attentes: "" });
    expect(lu.besoinAdaptation).toBe(false);
    expect(libelleBesoinAdaptation(lu.besoinAdaptation)).toBe("Non");
    // Une chaîne vide n'est pas une attente exprimée.
    expect(lu.attentes).toBeNull();
  });

  it("une question jamais posée (saisie par l'organisme) ne se lit PAS « non »", () => {
    const lu = lirePositionnement({ commentaire: "Appel téléphonique", saisie_admin: true });
    // Sans la clé, affirmer « aucun besoin d'adaptation » serait fabriquer
    // l'absence de besoin que l'indicateur 10 demande de documenter.
    expect(lu.besoinAdaptation).toBeNull();
    expect(libelleBesoinAdaptation(lu.besoinAdaptation)).toBe("Non renseigné");
    expect(lu.saisieAdmin).toBe(true);
  });

  it("une valeur hors barème se DIT au lieu de disparaître", () => {
    const lu = lirePositionnement({ niveauParObjectif: { A: 7, B: null } });
    expect(lu.niveaux).toEqual([
      { objectif: "A", niveau: null, libelle: "Valeur hors barème (7)" },
      { objectif: "B", niveau: null, libelle: "Non renseigné" },
    ]);
  });

  it("un JSON illisible rend une lecture vide, jamais une exception", () => {
    for (const brut of [null, undefined, "texte", 42, []]) {
      const lu = lirePositionnement(brut);
      expect(lu.niveaux).toEqual([]);
      expect(lu.besoinAdaptation).toBeNull();
    }
  });

  // Cohérence avec la règle de l'indicateur 10 (PR 1083) : la saisie par
  // l'organisme ne pose PAS la question du besoin d'adaptation. Un booléen
  // glissé dans une telle saisie n'est pas la réponse du bénéficiaire.
  it("un booléen glissé dans une saisie par l'organisme ne se lit PAS comme une réponse", () => {
    const lu = lirePositionnement({ saisie_admin: true, besoinAdaptation: false });
    expect(lu.saisieAdmin).toBe(true);
    expect(lu.besoinAdaptation).toBeNull();
    expect(libelleBesoinAdaptation(lu.besoinAdaptation, lu.saisieAdmin)).toBe(
      "Non posée (saisie par l'organisme)",
    );
  });
});

describe("chronologieReponse", () => {
  const DEBUT = new Date("2026-09-05T07:00:00.000Z");

  it("dit si la réponse précède le début de la session", () => {
    expect(chronologieReponse(new Date("2026-09-04T21:12:00.000Z"), DEBUT)).toBe(
      "avant le début de la session",
    );
    // Même instant : la réponse est acquise au début, comme pour l'indicateur 10.
    expect(chronologieReponse(DEBUT, DEBUT)).toBe("avant le début de la session");
  });

  it("dit si la réponse est arrivée après le début", () => {
    expect(chronologieReponse(new Date("2026-09-05T07:01:00.000Z"), DEBUT)).toBe(
      "après le début de la session",
    );
  });
});
