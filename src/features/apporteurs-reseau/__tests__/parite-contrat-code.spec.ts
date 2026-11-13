/**
 * PARITÉ CONTRAT / CODE. Le contrat (`CONTRAT_V2_MARKDOWN`) est le texte signé ; les règles du code
 * (regles.ts, autofacture-donnees.ts) calculent l'argent et les délais. Si l'un change sans l'autre,
 * l'apporteur est payé ou protégé autrement que ce qu'il a signé. Ce test lit les nombres CLÉS dans le
 * texte du contrat et échoue en disant LEQUEL diverge.
 */
import { describe, expect, it } from "vitest";

import {
  DELAI_CONTESTATION_APPORTEUR_JOURS,
  ECHEANCE_JOURS,
  OBJECTIF_VIREMENT_JOURS_OUVRES,
} from "../autofacture-donnees";
import { CONTRAT_V2_MARKDOWN } from "../contrat-v2";
import {
  ADRESSE_VALIDE_JOURS,
  CONFIRMATION_TACITE_JOURS,
  FORFAIT_CONFERENCE_CENTS,
  PALIERS_FORMATION,
  PARRAINAGE_BPS,
  PARRAINAGE_MOIS,
  PROTECTION_MOIS,
  TAUX_BPS,
} from "../regles";

// Espaces insécables (milliers, « 50 € ») et fins de ligne : le texte est lu à plat.
const TEXTE = CONTRAT_V2_MARKDOWN.replace(/[\u00a0\u202f]/g, " ").replace(/\s+/g, " ");

const MOTS: Record<string, number> = { cinq: 5, dix: 10, quinze: 15, vingt: 20, trente: 30 };

function lire(libelle: string, motif: RegExp): number {
  const m = TEXTE.match(motif);
  if (!m)
    throw new Error(
      `Parité contrat/code : « ${libelle} » est introuvable dans le contrat (phrase modifiée ?).`,
    );
  const brut = m[1]!.replace(/ /g, "");
  return /^\d+$/.test(brut) ? Number(brut) : (MOTS[brut] ?? Number.NaN);
}

function attendre(libelle: string, contrat: number, code: number, constante: string) {
  expect(
    contrat,
    `Le contrat dit ${contrat} pour « ${libelle} » mais le code (${constante}) dit ${code} : l'un des deux diverge.`,
  ).toBe(code);
}

const palier = (id: string) => PALIERS_FORMATION.find((p) => p.id === id)!;

describe("parité contrat / code : les nombres clés sont les mêmes", () => {
  it("30 jours de confirmation tacite (art. 3.2)", () => {
    attendre(
      "confirmation tacite, en jours",
      lire("confirmation tacite", /délai de \*\*(\d+) jours\*\* à compter de la prise de contact/),
      CONFIRMATION_TACITE_JOURS,
      "CONFIRMATION_TACITE_JOURS",
    );
  });
  it("45 jours pour une adresse valide (art. 3.2)", () => {
    attendre(
      "adresse valide, en jours",
      lire("adresse valide", /délai de \*\*(\d+) jours\*\* à compter de la déclaration/),
      ADRESSE_VALIDE_JOURS,
      "ADRESSE_VALIDE_JOURS",
    );
  });
  it("contrat 2.2 : plus de péremption à 90 jours (art. 3.4)", () => {
    expect(TEXTE).not.toMatch(/90 jours/);
    expect(TEXTE).not.toMatch(/expire par anticipation/);
  });
  it("6 mois de protection à compter de la DÉCLARATION (art. 3.4, contrat 2.2)", () => {
    attendre(
      "protection, en mois",
      lire("protection", /consentie pour \*\*(\d+) mois à compter de la déclaration\*\*/),
      PROTECTION_MOIS,
      "PROTECTION_MOIS",
    );
  });
  it("plus aucun seuil minimum ni relevé mensuel (art. 5.1, 5.3)", () => {
    expect(TEXTE).toMatch(/Aucun montant minimum ne s'applique/);
    expect(TEXTE).not.toMatch(/solde est inférieur à \d+ € hors taxes/);
    expect(TEXTE).not.toMatch(/premier jour ouvré de chaque mois/);
  });
  it("conférence : 500 € HT par conférence, jamais « Aucune » (A1.4 bis, A1.5)", () => {
    expect(TEXTE).toMatch(/500 € hors taxes par conférence figurant à la commande/);
    expect(FORFAIT_CONFERENCE_CENTS / 100).toBe(500);
    // A1.5 ne doit plus lister la conférence parmi les prestations non commissionnées.
    const a15 = TEXTE.slice(
      TEXTE.indexOf("A1.5 — Prestations non commissionnées"),
      TEXTE.indexOf("A1.6"),
    );
    expect(a15).not.toMatch(/\| Conférence \| \*\*Aucune\*\*/);
  });
  it("échéance ferme de trente jours après l'émission de l'autofacture (art. 5.3)", () => {
    expect(TEXTE).toMatch(/trentième jour suivant son émission/);
    expect(ECHEANCE_JOURS).toBe(30);
  });
  it("délai indicatif de deux jours ouvrés, sans engagement ni frais (art. 5.3)", () => {
    expect(TEXTE).toMatch(/s'efforce de verser la commission dans les deux jours ouvrés/);
    expect(TEXTE).toMatch(/ne constitue pas un engagement de la Société/);
    expect(OBJECTIF_VIREMENT_JOURS_OUVRES).toBe(2);
  });
  it("parrainage : 10 % pendant 6 mois (art. 4.6)", () => {
    attendre(
      "parrainage, en pourcent",
      lire("parrainage", /perçoit \*\*(\d+) % des commissions du filleul/),
      PARRAINAGE_BPS / 100,
      "PARRAINAGE_BPS / 100",
    );
    attendre(
      "parrainage, en mois",
      lire("durée du parrainage", /dans les (\d+) mois de la signature de son contrat/),
      PARRAINAGE_MOIS,
      "PARRAINAGE_MOIS",
    );
  });
  it("500 € par journée de formation, 250 € la demi-journée (annexe 1)", () => {
    attendre(
      "forfait par journée, en euros",
      lire("forfait par journée", /Forfait de (\d+) € HT par journée de formation/),
      palier("formation-generale-1j").forfaitCents / 100,
      "PALIERS_FORMATION[formation-generale-1j].forfaitCents / 100",
    );
    attendre(
      "forfait de la demi-journée (4 heures), en euros",
      lire("demi-journée", /Formation générale \| 4 heures \| 1 200 € \| (\d+) € \|/),
      palier("formation-generale-4h").forfaitCents / 100,
      "PALIERS_FORMATION[formation-generale-4h].forfaitCents / 100",
    );
  });
  it("30 % audit et 1-to-1, 15 % intégration (annexe 1)", () => {
    attendre(
      "audit, en pourcent",
      lire("audit", /Tous les audits \| à partir de 1 190 € \| (\d+) % \|/),
      TAUX_BPS.audit / 100,
      "TAUX_BPS.audit / 100",
    );
    attendre(
      "1-to-1, en pourcent",
      lire("1-to-1", /Accompagnement dirigeant \| 1 jour \| 1 390 € \| (\d+) % \|/),
      TAUX_BPS.un_a_un / 100,
      "TAUX_BPS.un_a_un / 100",
    );
    attendre(
      "intégration, en pourcent",
      lire("intégration", /Pilote IA \| 990 € à 4 900 € \| (\d+) % \|/),
      TAUX_BPS.implementation / 100,
      "TAUX_BPS.implementation / 100",
    );
  });
  it("le délai de contestation de l'autofacture est lu dans le contrat avant d'être imprimé", () => {
    // Le nombre imprimé sur l'autofacture vient de cette constante ; le contrat doit le dire.
    expect(
      TEXTE.includes(`${DELAI_CONTESTATION_APPORTEUR_JOURS} jours`),
      `Le contrat ne mentionne pas « ${DELAI_CONTESTATION_APPORTEUR_JOURS} jours » (DELAI_CONTESTATION_APPORTEUR_JOURS).`,
    ).toBe(true);
  });
  it("le test sait échouer : un nombre modifié est signalé avec son nom", () => {
    expect(() =>
      attendre(
        "confirmation tacite, en jours",
        31,
        CONFIRMATION_TACITE_JOURS,
        "CONFIRMATION_TACITE_JOURS",
      ),
    ).toThrow(/confirmation tacite, en jours.*CONFIRMATION_TACITE_JOURS/s);
  });
});
