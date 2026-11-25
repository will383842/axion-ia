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
  it("contrat 2.8 : plus de confirmation tacite ni de délai de 45 jours (art. 3.2) ; 60 jours de réservation", () => {
    expect(TEXTE).not.toMatch(/délai de \*\*\d+ jours\*\* à compter de la prise de contact/);
    expect(TEXTE).not.toMatch(/délai de \*\*\d+ jours\*\* à compter de la déclaration/);
    expect(TEXTE).toMatch(/pour une durée de \*\*60 jours\*\*/);
  });
  it("contrat 2.2 : plus de péremption à 90 jours (art. 3.4)", () => {
    expect(TEXTE).not.toMatch(/90 jours/);
    expect(TEXTE).not.toMatch(/expire par anticipation/);
  });
  it("6 mois de protection à compter du rendez-vous (art. 3.4, contrat 2.8)", () => {
    attendre(
      "protection, en mois",
      lire(
        "protection",
        /consentie pour \*\*(\d+) mois à compter du jour où le rendez-vous a eu lieu\*\*/,
      ),
      PROTECTION_MOIS,
      "PROTECTION_MOIS",
    );
  });
  it("plus aucun seuil minimum ni relevé mensuel (art. 5.1, 5.3)", () => {
    expect(TEXTE).toMatch(/Aucun montant minimum ne s'applique/);
    expect(TEXTE).not.toMatch(/solde est inférieur à \d+ € hors taxes/);
    expect(TEXTE).not.toMatch(/premier jour ouvré de chaque mois/);
  });
  it("contrat 2.8 : plus de forfait de conférence (A1.4 bis supprimée) ; le code l'a encore jusqu'au lot de la grille", () => {
    expect(TEXTE).not.toMatch(/par conférence figurant à la commande/);
    expect(TEXTE).not.toContain("A1.4 bis");
    expect(FORFAIT_CONFERENCE_CENTS / 100).toBe(500);
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
      lire("forfait par journée", /Formation générale \| 1 jour \| 1 900 € \| (\d+) € \|/),
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
  it("30 % audit, aucune commission 1-to-1, 15 % intégration (annexe 1)", () => {
    attendre(
      "audit, en pourcent",
      lire("audit", /\*\*(\d+) % du montant hors taxes facturé\*\* de tout audit vendu seul/),
      TAUX_BPS.audit / 100,
      "TAUX_BPS.audit / 100",
    );
    // Décision de Will du 25/11 : plus aucune commission sur l'accompagnement individuel (A1.3).
    // Le code (TAUX_BPS.un_a_un) relève du lot qui aligne les règles sur la 2.8.
    expect(TEXTE).toContain(
      "L'accompagnement individuel (coaching « one to one »), vendu à la séance ou à la journée, ne donne lieu à aucune commission ; il relève de A1.6.",
    );
    attendre(
      "intégration, en pourcent",
      lire("intégration", /\*\*(\d+) % du montant hors taxes facturé\*\* : \(a\)/),
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
