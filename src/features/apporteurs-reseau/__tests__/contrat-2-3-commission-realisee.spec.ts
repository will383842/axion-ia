import { describe, expect, it } from "vitest";

import { CONTRAT_V2_MARKDOWN, CONTRAT_VERSION } from "../contrat-v2";
import { ACCEPTATIONS } from "../regles-dossier";

// Contrat 2.3 (décision de Will, 07/10/2026) : la commission n'est due que sur une prestation
// RÉALISÉE et intégralement encaissée ; reprise quelle qu'en soit la cause, sous garde-fou ;
// suspension pendant une contestation écrite ; reprise sur 24 mois ; fraude ; CPF constaté après.
const texte = CONTRAT_V2_MARKDOWN.replace(/\s+/g, " ");

describe("contrat 2.3 : commission sur prestation réalisée, reprise et litige", () => {
  it("version 2.3", () => {
    expect(CONTRAT_VERSION).toBe("2.3");
  });

  it("4.2 : réalisée ET encaissée ; non réalisée, même du fait de la Société : pas due, réduite ou reprise", () => {
    expect(texte).toContain(
      "lorsque la prestation commandée a été réalisée et que la Société a encaissé l'intégralité",
    );
    expect(texte).toContain(
      "Lorsque la prestation n'est pas réalisée, en tout ou partie, quelle qu'en soit la cause, y compris du fait de la Société, la commission n'est pas due",
    );
    expect(texte).toContain("si elle a déjà été versée, la différence fait l'objet d'une reprise");
  });

  it("4.5 : plus d'exclusion ; geste commercial compris ; garde-fou de l'article 1304-3", () => {
    expect(texte).not.toContain("à l'exclusion des restitutions décidées par la Société");
    expect(texte).not.toContain("qui ne donnent lieu à aucune reprise");
    expect(texte).toContain(
      "y compris une restitution consentie sans réclamation du client, à titre de geste commercial",
    );
    expect(texte).toContain(
      "une annulation, un remboursement ou un avoir consenti dans le seul but de priver l'Apporteur de sa commission est sans effet sur celle-ci",
    );
    expect(texte).toContain("article 1304-3 du code civil");
  });

  it("4.2 bis et 5.4 : suspension pendant une contestation écrite du client, sans délai promis", () => {
    expect(texte).toContain("4.2 bis — Contestation du client");
    expect(texte).toContain("la commission correspondante est **suspendue**");
    expect(texte).toContain("selon le prix finalement conservé par la Société");
    expect(texte).toContain("Hors la contestation écrite du client prévue à l'article 4.2 bis");
  });

  it("4.5 : reprise dans les vingt-quatre mois de l'annulation", () => {
    expect(texte).toContain("dans les vingt-quatre mois suivant **la date de l'annulation**");
    expect(texte).not.toContain("dans les douze mois suivant **la date de l'annulation**");
  });

  it("4.5 bis : déclaration non sincère (3.7), intérêt non déclaré (8.4), fraude", () => {
    expect(texte).toContain("4.5 bis — Déclaration non sincère, intérêt non déclaré, fraude");
    expect(texte).toContain(
      "les commissions déjà versées au titre de cette affaire font l'objet d'une reprise",
    );
  });

  it("8.1 et A1.6 : CPF constaté après le versement = reprise", () => {
    expect(texte).toContain(
      "Lorsque ce financement est constaté après le versement de la commission, celle-ci fait l'objet d'une reprise",
    );
    expect(texte).toContain(
      "Un financement par le compte personnel de formation constaté après le versement de la commission donne lieu à sa reprise",
    );
  });

  it("12.4 : remboursement d'un solde négatif aligné sur la reprise à vingt-quatre mois", () => {
    expect(texte).toContain(
      "versées à l'Apporteur au cours des vingt-quatre mois précédant l'annulation",
    );
  });

  it("5.4 et 6.1 : SIREN valide ET ACTIF (non cessé au répertoire SIRENE)", () => {
    expect(texte).toContain(
      "sans numéro SIREN valide **et actif** (entreprise non cessée au répertoire SIRENE)",
    );
    expect(texte).toContain(
      "notamment lorsque l'entreprise de l'Apporteur est cessée au répertoire SIRENE",
    );
    expect(texte).toContain(
      "c'est une condition de la signature du présent contrat, de sa contresignature par la Société et de tout versement",
    );
  });

  it("la case d'acceptation de l'article 4.5 dit ce qu'elle accepte", () => {
    const a45 = ACCEPTATIONS.find((a) => a.cle === "art_4_5")!.texte;
    expect(a45).toContain("prestation non réalisée");
    expect(a45).toContain("vingt-quatre mois");
  });
});
