import { describe, expect, it } from "vitest";

import { DELAI_MINIMAL_BASCULE_JOURS, MARQUEUR_CLAUSE_BASCULE } from "../regle-attribution";
import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import {
  FORFAIT_JOURNEE_IA_CENTS,
  PRIX_REFERENCE_JOURNEE_IA_CENTS,
  TAUX_BPS,
  calculerCommission,
} from "../regles";

// Contrat 2.8 (OUI final de Will, 25/11/2026) : réservation provisoire de 60 jours puis 30 jours,
// validation au premier rendez-vous tenu ou à la commande signée, commission de 15 % due au
// paiement à 100 % sans condition de réalisation, virement sous 30 jours.
const texte = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");

describe("contrat 2.8", () => {
  it("la version est 2.8", () => {
    expect(CONTRAT_VERSION).toBe("2.8");
  });

  it("réservation de 60 jours jusqu'à minuit (Paris), puis 30 jours réservés", () => {
    expect(texte).toContain("pour une durée de **60 jours**");
    expect(texte).toContain("à minuit, heure de Paris");
    expect(texte).toContain("compte pour le premier jour");
    expect(texte).toContain(
      "Pendant les 30 jours qui suivent la fin de la réservation provisoire sans validation, personne d'autre ne peut déclarer cette entreprise",
    );
    expect(texte).not.toMatch(/90 jours de réservation/);
  });

  it("validation : rendez-vous tenu pris pendant la réservation, commande signée ; règles d'annulation", () => {
    expect(texte).toContain("**premier rendez-vous qui a eu lieu**");
    expect(texte).toContain(
      "dès lors que ce rendez-vous a été pris pendant la réservation provisoire",
    );
    expect(texte).toContain("Le rendez-vous peut avoir lieu après le terme des 60 jours");
    expect(texte).toContain("est réputé avoir eu lieu à la date à laquelle il était fixé");
    expect(texte).toContain(
      "un rendez-vous annulé, manqué ou reporté par l'entreprise ne valide pas l'attribution tant qu'il n'a pas eu lieu",
    );
    expect(texte).toContain(
      "**Un rendez-vous pris avant l'enregistrement de la déclaration est sans effet",
    );
    expect(texte).toContain("**vaut validation**");
  });

  it("commission : 15 %, due à l'encaissement intégral, sans condition de réalisation, virement sous 30 jours", () => {
    expect(texte).toContain("**15 % du montant hors taxes facturé**");
    expect(texte).toContain("Elle est acquise et due dès que la Société a encaissé l'intégralité");
    expect(texte).toContain("même si le travail n'est pas terminé");
    expect(texte).toContain(
      "Le versement a lieu par virement, au plus tard 30 jours après cet encaissement",
    );
    expect(texte).toContain("calculée une seule fois");
    expect(texte).toMatch(/Abonnements \| \*\*Aucune\*\*/);
    expect(texte).toMatch(/Journée IA \| 1 490 € \| 500 €/);
    expect(texte).not.toMatch(
      /réputée réalisée|prestation est réalisée|prestation commandée a été réalisée/,
    );
  });

  it("décisions de Will du 25/11 : A1.3 sans commission ; file d'attente de 15 jours après les 30 jours de repos", () => {
    expect(texte).toContain(
      "L'accompagnement individuel (coaching « one to one »), vendu à la séance ou à la journée, ne donne lieu à aucune commission ; il relève de A1.6.",
    );
    expect(texte).toContain(
      "la réservation provisoire a pris fin à son terme sans validation, ces quinze jours ne s'ouvrent qu'à l'expiration des 30 jours qui suivent la fin de la réservation provisoire (article 3.2)",
    );
    expect(texte).toContain("soixante jours (annexe 1, A1.8)");
    expect(texte).not.toContain("A1.7).");
  });

  it("aucun astérisque parasite pour le rendu PDF (gras et italique imbriqués)", () => {
    expect(CONTRAT_V2_MARKDOWN).not.toContain("***");
  });

  it("information RGPD dans le premier message, sans e-mail séparé ; jamais de vérification annoncée", () => {
    expect(texte).toContain("dans le premier message qu'elle lui adresse");
    expect(texte).toContain("Aucun message d'information distinct n'est envoyé.");
    expect(texte).toContain("La Société ne demande à l'entreprise de confirmer aucun échange");
  });

  it("aucun objectif, plafond, compteur ni rythme imposé à l'apporteur", () => {
    expect(texte).toContain("L'Apporteur n'est tenu à aucun résultat");
    expect(texte).toContain(
      "n'est soumise à aucun plafond, à aucun compteur, à aucun délai d'attente et à aucun rythme",
    );
  });

  it("aucune mention interdite, aucun marqueur de rédaction", () => {
    for (const interdit of [
      "Aucun gain garanti",
      "sans discussion",
      "5 fois",
      "À CONFIRMER",
      "DÉCISION DU DIRIGEANT",
    ])
      expect(texte).not.toContain(interdit);
    // « Grenoble » : uniquement l'adresse du siège de la Société (première page, inchangée depuis la 2.6).
    expect(texte.match(/Grenoble/g)?.length).toBe(1);
    expect(texte).toContain("38100 Grenoble");
  });

  it("parité contrat ↔ moteur : Journée IA 500 € pour 1 490 €, développement web 15 %, coaching 0", () => {
    expect(texte).toContain(
      "Forfait de 500 € HT par Journée IA vendue et payée au prix de référence de 1 490 € HT",
    );
    expect(FORFAIT_JOURNEE_IA_CENTS).toBe(50_000);
    expect(PRIX_REFERENCE_JOURNEE_IA_CENTS).toBe(149_000);
    expect(texte).toContain("tout développement effectué par la Société pour l'entreprise");
    expect(TAUX_BPS.site_web).toBe(TAUX_BPS.implementation);
    expect(calculerCommission({ activite: "un_a_un", factureHtCents: 90_000 })).toEqual({
      statut: "aucune",
    });
  });

  it("article 13.5 : la clause transitoire existe et son délai est celui du code", () => {
    expect(texte).toContain(MARQUEUR_CLAUSE_BASCULE);
    expect(texte).toContain(
      "passent à la règle du premier rendez-vous tenu (article 3.2) ; l'Apporteur dispose d'au moins trente jours à compter de ce jour pour obtenir ce rendez-vous, et il en est informé par courrier électronique",
    );
    // « trente jours » écrit au contrat = DELAI_MINIMAL_BASCULE_JOURS (30).
    expect(DELAI_MINIMAL_BASCULE_JOURS).toBe(30);
  });
});
