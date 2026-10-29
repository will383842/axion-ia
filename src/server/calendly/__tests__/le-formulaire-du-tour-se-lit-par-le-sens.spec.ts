// Le formulaire de la visio du Tour France IA se lit par le SENS des questions
// (2026-10-25) : secteur, entreprise, origine, taille, tâches, usage de l'IA.
// Aucun libellé n'est écrit dans le code : un libellé reformulé chez Calendly
// reste reconnu, une question inconnue est ignorée.

import { describe, expect, it } from "vitest";

import { payloadRendezVousAuContrat } from "@/server/crm-sync";
import {
  PROFIL_TOUR_REPONSE_MAX,
  champDeLaQuestion,
  profilDuTour,
} from "@/server/calendly/reponses-du-tour";

describe("champDeLaQuestion", () => {
  it.each([
    ["Dans quel secteur d'activité travaillez-vous ?", "secteur"],
    ["Nom de l'entreprise", "entreprise"],
    ["Comment nous avez-vous connu ?", "origine"],
    ["Quelle est la taille de votre entreprise ?", "taille"],
    ["Combien de salariés ?", "taille"],
    ["Quelles tâches vous prennent le plus de temps ?", "taches"],
    ["Utilisez-vous déjà l'IA aujourd'hui ?", "usageIa"],
  ] as const)("« %s » → %s", (question, champ) => {
    expect(champDeLaQuestion(question)).toBe(champ);
  });

  it("la ville, le téléphone et l'inconnu ne sont pas du profil", () => {
    expect(champDeLaQuestion("Ville de l'entreprise")).toBeNull();
    expect(champDeLaQuestion("Un mot pour la suite ?")).toBeNull();
  });
});

describe("profilDuTour", () => {
  const reponses = [
    { question: "Dans quel secteur d'activité travaillez-vous ?", reponse: "Bâtiment" },
    { question: "Nom de l'entreprise", reponse: "Martin SARL" },
    { question: "Comment nous avez-vous connu ?", reponse: "LinkedIn" },
    { question: "Quelle est la taille de votre entreprise ?", reponse: "10 à 49" },
    {
      question: "Quelles tâches vous prennent le plus de temps ?",
      reponse: "Les devis fournisseurs",
    },
    { question: "Utilisez-vous déjà l'IA ?", reponse: "Un peu, ChatGPT" },
  ];

  it("range chaque réponse dans son champ", () => {
    expect(profilDuTour(reponses)).toEqual({
      secteur: "Bâtiment",
      entreprise: "Martin SARL",
      origine: "LinkedIn",
      taille: "10 à 49",
      taches: "Les devis fournisseurs",
      usageIa: "Un peu, ChatGPT",
    });
  });

  it("rien d'exploitable → null, jamais une erreur", () => {
    expect(profilDuTour([])).toBeNull();
    expect(profilDuTour([{ question: "Un mot ?", reponse: "x" }])).toBeNull();
  });

  it("borne la réponse, et garde la première en cas de doublon", () => {
    const long = "a".repeat(PROFIL_TOUR_REPONSE_MAX + 50);
    const p = profilDuTour([
      { question: "Quel secteur ?", reponse: long },
      { question: "Autre secteur d'activité ?", reponse: "Second" },
    ]);
    expect(p?.secteur).toHaveLength(PROFIL_TOUR_REPONSE_MAX);
  });
});

describe("le payload CRM de la visio du Tour", () => {
  const reponses = [
    { question: "Dans quel secteur ?", reponse: "Santé" },
    { question: "Votre numéro ?", reponse: "x" },
  ];

  it("porte le profil en plus des réponses, sous `autre` + `circuit`", () => {
    const p = payloadRendezVousAuContrat({
      eventTypeName: "Tour France IA",
      typeRendezVous: "tour_de_france_ia",
      reponses,
    });
    expect(p.typeRendezVous).toBe("autre");
    expect(p["circuit"]).toBe("tour_de_france_ia");
    expect(p["profil"]).toMatchObject({ secteur: "Santé" });
    expect(Array.isArray(p.reponses)).toBe(true);
  });

  it("sans réponse lisible, aucune clé `profil`", () => {
    const p = payloadRendezVousAuContrat({
      eventTypeName: "Tour France IA",
      typeRendezVous: "tour_de_france_ia",
    });
    expect("profil" in p).toBe(false);
  });

  it("un autre type n'a jamais de profil", () => {
    const p = payloadRendezVousAuContrat({
      eventTypeName: "Diagnostic IA",
      typeRendezVous: "diagnostic",
      reponses,
    });
    expect("profil" in p).toBe(false);
  });
});
