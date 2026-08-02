/**
 * Tests CONTENU — clauses de protection des contrats formateurs.
 *
 * Ces clauses ne sont pas décoratives : chacune ferme un risque nommé. Un test
 * par risque, pour qu'une suppression accidentelle se voie.
 *
 * 🔴 Le test le plus important est celui qui vérifie l'ABSENCE de clause de
 * non-concurrence : la réintroduire nourrirait la requalification en contrat de
 * travail, et c'est le genre de « complément » qu'on ajoute de bonne foi.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { LettreMissionPdf, type LettreMissionData } from "./lettre-mission";
import { ContratSousTraitancePdf, type ContratSousTraitanceData } from "./contrat-sous-traitance";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-001",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
  rcsVille: "Grenoble",
};

const LETTRE: LettreMissionData = {
  numero: "AXI-DOC-2026-070",
  formateur: {
    nomPrenom: "Paul Externe",
    email: "paul@exemple.fr",
    specialite: "IA générative",
    statut: "sous_traitant",
  },
  objetMission: "Animation de formations.",
  formations: [
    {
      intitule: "IA pour l'immobilier",
      dateDebut: "31/07/2026",
      dateFin: "31/07/2026",
      lieuOuModalite: "Saint-Étienne / Présentiel",
      dureeHeures: 7,
    },
  ],
  tarifJourHt: 850,
  dateMission: "02/08/2026",
};

const CONTRAT: ContratSousTraitanceData = {
  numero: "AXI-DOC-2026-071",
  sousTraitant: { nom: "Externe Formation SARL", siret: "98765432100011" },
  missions: ["Animer les modules IA générative"],
  dateDebut: "01/09/2026",
  remuneration: "850 € HT par journée",
  dateContrat: "02/08/2026",
};

const lettre = collectPdfTextNormalized(
  React.createElement(LettreMissionPdf, { data: LETTRE, identite: IDENTITE }),
);
const contrat = collectPdfTextNormalized(
  React.createElement(ContratSousTraitancePdf, { data: CONTRAT, identite: IDENTITE }),
);

const LES_DEUX: ReadonlyArray<[string, string]> = [
  ["lettre de mission", lettre],
  ["contrat de sous-traitance", contrat],
];

describe("🔴 aucune clause de non-concurrence — elle nourrirait la requalification", () => {
  for (const [nom, texte] of LES_DEUX) {
    it(`${nom} : ne contient pas de non-concurrence`, () => {
      expect(texte).not.toContain("non-concurrence");
      expect(texte).not.toContain("non concurrence");
      // Le vrai marqueur : interdire d'exercer ailleurs.
      expect(texte).not.toMatch(/s'interdit d'exercer|ne pourra exercer/i);
    });

    it(`${nom} : protège la clientèle par la NON-SOLLICITATION`, () => {
      expect(texte).toContain("Non-sollicitation");
      expect(texte).toContain("dix-huit (18) mois");
    });
  }
});

describe("RGPD article 28 — les mentions imposées au sous-traitant", () => {
  for (const [nom, texte] of LES_DEUX) {
    it(`${nom} : porte les huit engagements`, () => {
      expect(texte).toContain("responsable de traitement");
      expect(texte).toContain("instruction documentée");
      expect(texte).toContain("obligation de confidentialité");
      expect(texte).toContain("mesures techniques et organisationnelles");
      expect(texte).toContain("aucun autre sous-traitant sans autorisation écrite");
      expect(texte).toContain("exercice des droits");
      expect(texte).toContain("violation de données");
      expect(texte).toContain("permettre les audits");
      expect(texte).toContain("sans en conserver de copie");
    });
  }
});

describe("clauses de protection de l'organisme", () => {
  for (const [nom, texte] of LES_DEUX) {
    it(`${nom} : cède la propriété des supports créés`, () => {
      expect(texte).toContain("Propriété intellectuelle");
      expect(texte).toContain("cédés à l'organisme à titre exclusif");
      // Le formateur garde ses supports antérieurs : sans cette réserve, la
      // clause serait déséquilibrée, donc plus facile à faire tomber.
      expect(texte).toMatch(/supports (qu'il avait développés avant|antérieurs)/);
    });

    it(`${nom} : plafonne la responsabilité et exclut les dommages indirects`, () => {
      expect(texte).toContain("limitée au montant hors taxes");
      expect(texte).toContain("dommages indirects");
      // Un plafond sans exception pour la faute lourde est réputé non écrit.
      expect(texte).toContain("faute lourde");
    });

    it(`${nom} : prévoit la force majeure (art. 1218)`, () => {
      expect(texte).toContain("force majeure");
      expect(texte).toContain("1218");
    });

    it(`${nom} : interdit la sous-traitance en cascade`, () => {
      expect(texte).toContain("ne peut se faire remplacer");
      expect(texte).toContain("accord écrit préalable");
    });

    it(`${nom} : désigne le droit applicable et le tribunal`, () => {
      expect(texte).toContain("droit français");
      expect(texte).toContain("tribunal compétent du ressort du siège");
    });

    it(`${nom} : exige une assurance RC professionnelle`, () => {
      expect(texte).toContain("responsabilité civile professionnelle");
    });

    it(`${nom} : documente l'indépendance — l'anti-requalification`, () => {
      expect(texte).toContain("aucun lien de subordination");
    });
  }
});

describe("équilibre du contrat", () => {
  it("la lettre énonce AUSSI les obligations de l'organisme", () => {
    // Un engagement unilatéral se conteste plus facilement.
    expect(lettre).toContain("Obligations de l'organisme");
    expect(lettre).toContain("trente (30) jours suivant la réception de la facture");
    expect(lettre).toContain("situation de handicap");
  });
});
