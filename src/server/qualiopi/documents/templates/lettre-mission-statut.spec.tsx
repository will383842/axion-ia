/**
 * Tests CONTENU — lettre de mission selon le STATUT de l'intervenant.
 *
 * La lettre de mission est la pièce qui documente le lien contractuel des
 * intervenants — celle que réclame le dossier de déclaration d'activité. Elle
 * qualifiait tout intervenant de « mandataire sous-traitant », y compris le
 * dirigeant qui anime lui-même : juridiquement absurde (on ne se sous-traite
 * pas à soi-même) sur la pièce censée dire la vérité du lien.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { LettreMissionPdf, type LettreMissionData } from "./lettre-mission";
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

const BASE: LettreMissionData = {
  numero: "AXI-DOC-2026-007",
  formateur: {
    nomPrenom: "Williams Jullin",
    email: "williams@axion-ia.fr",
    specialite: "Formation Intelligence Artificielle",
  },
  objetMission: "Animation de la formation professionnelle continue.",
  formations: [
    {
      intitule: "IA pour l'immobilier",
      dateDebut: "31/07/2026",
      dateFin: "31/07/2026",
      lieuOuModalite: "Saint-Étienne / Présentiel",
      dureeHeures: 7,
    },
  ],
  tarifJourHt: 0,
  dateMission: "01/08/2026",
};

function rendre(patch: Partial<LettreMissionData["formateur"]>, tarif = 0): string {
  return collectPdfTextNormalized(
    React.createElement(LettreMissionPdf, {
      data: { ...BASE, tarifJourHt: tarif, formateur: { ...BASE.formateur, ...patch } },
      identite: IDENTITE,
    }),
  );
}

describe("LettreMissionPdf — qualification de l'intervenant", () => {
  it("dirigeant : jamais « sous-traitant », et le mandat social est dit", () => {
    const t = rendre({ statut: "dirigeant" });
    expect(t).toContain("dirigeant de l'organisme");
    expect(t).not.toContain("mandataire sous-traitant");
    expect(t).toContain("mandat social");
  });

  it("salarié : qualifié comme tel", () => {
    const t = rendre({ statut: "salarie" });
    expect(t).toContain("salarié de l'organisme");
    expect(t).not.toContain("mandataire sous-traitant");
  });

  it("sous-traitant : libellé historique inchangé", () => {
    expect(rendre({ statut: "sous_traitant" }, 850)).toContain("mandataire sous-traitant");
  });

  it("statut absent : repli sur sous-traitant, comportement historique", () => {
    expect(rendre({}, 850)).toContain("mandataire sous-traitant");
  });
});

describe("LettreMissionPdf — rémunération", () => {
  it("tarif à 0 : jamais « 0,00 € / jour » sur une pièce contractuelle", () => {
    const t = rendre({ statut: "dirigeant" });
    expect(t).not.toContain("0,00 €");
    expect(t).not.toContain("Tarif journalier HT");
  });

  it("tarif renseigné : la ligne est portée normalement", () => {
    const t = rendre({ statut: "sous_traitant" }, 850);
    expect(t).toContain("Tarif journalier HT");
    expect(t).toContain("850");
  });

  it("dirigeant : aucune mention de facturation — il n'émet pas de facture", () => {
    expect(rendre({ statut: "dirigeant" })).not.toContain("présentation de facture conforme");
  });

  it("sous-traitant : la mention de facturation reste", () => {
    expect(rendre({ statut: "sous_traitant" }, 850)).toContain("présentation de facture conforme");
  });
});
