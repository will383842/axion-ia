/**
 * Tests — templates LOT 2 (inventaire-moyens, registre générique, cv-formateur,
 * fiche-adaptation).
 *
 * Pour chaque template : fixture minimale → renderPdfToBuffer → buffer commence
 * par "%PDF" (pattern sessions-docs.spec) + assertions de CONTENU via
 * collectPdfTextNormalized (le texte hors <Text> est perdu en silence par
 * @react-pdf — les assertions de contenu empêchent toute régression).
 * Timeout généreux (30 s) car @react-pdf/renderer est lent.
 */

import { beforeAll, describe, it, expect } from "vitest";
import React from "react";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";

// Templates LOT 2
import { InventaireMoyensPdf, type InventaireMoyensData } from "./inventaire-moyens";
import { RegistrePdf, type RegistreData } from "./registre";
import { CvFormateurPdf, type CvFormateurData } from "./cv-formateur";
import { FicheAdaptationPdf, type FicheAdaptationData } from "./fiche-adaptation";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

// ============================================================
// Fixture partagée
// ============================================================

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS (test)",
  nda: "84691234567",
  qualiopi: "FR-2026-0001",
  siret: "12345678900001",
  adresseSiege: "11 Avenue Paul Verlaine, 38100 Grenoble",
  adresseExercice: "11 Avenue Paul Verlaine, 38100 Grenoble",
  email: "formation@axion-ia.fr",
  telephone: "+33 4 00 00 00 00",
  site: "https://axion-ia.com",
};

/** Vérifie que le buffer est un PDF valide (commence par %PDF). */
function expectPdf(buffer: Buffer): void {
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.byteLength).toBeGreaterThan(100);
  expect(buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
}

// ============================================================
// 1. InventaireMoyensPdf (A14)
// ============================================================

describe("InventaireMoyensPdf", () => {
  const data: InventaireMoyensData = {
    numero: "AXI-FORM-2026-042",
    dateEdition: "13/07/2026",
    moyens: [
      {
        categorie: "salle",
        libelle: "Salle de formation Grenoble — 12 places",
        description: "Vidéoprojecteur, paperboard, wifi",
        localisation: "Grenoble",
        actif: true,
        dateVerification: "01/07/2026",
      },
      {
        categorie: "plateforme",
        libelle: "Classe virtuelle",
        description: "",
        localisation: "",
        actif: true,
        dateVerification: "",
      },
      {
        categorie: "humain",
        libelle: "Formateur IA générative",
        description: "Intervenant habilité",
        localisation: "",
        actif: false,
        dateVerification: "01/06/2026",
      },
    ],
  };

  it("génère un PDF valide commençant par %PDF", async () => {
    const { buffer } = await renderPdfToBuffer(
      React.createElement(InventaireMoyensPdf, { data, identite: IDENTITE }),
    );
    expectPdf(buffer);
  }, 30_000);

  it("contient le numéro, les libellés, les catégories et les statuts", () => {
    const text = collectPdfTextNormalized(
      React.createElement(InventaireMoyensPdf, { data, identite: IDENTITE }),
    );
    expect(text).toContain("AXI-FORM-2026-042");
    expect(text).toContain("Salle de formation Grenoble — 12 places");
    expect(text).toContain("Plateformes et outils numériques");
    expect(text).toContain("Non vérifié");
    expect(text).toContain("Retiré");
    // Mention RNQ (indicateurs 17/18/19)
    expect(text).toMatch(/indicateurs 17 et 18/);
    expect(text).toMatch(/indicateur 19/);
  });
});

// ============================================================
// 2. RegistrePdf (générique — A3/A7/A8/A17/A18)
// ============================================================

describe("RegistrePdf", () => {
  const data: RegistreData = {
    titre: "Registre des réclamations",
    sousTitre: "Traitement des réclamations (indicateur 31).",
    colonnes: ["N°", "Reçue le", "Objet", "Statut"],
    lignes: [
      ["AXI-REC-2026-001", "02/05/2026", "Support illisible", "Résolue"],
      ["AXI-REC-2026-002", "10/06/2026", "Retard de convocation", "En cours"],
    ],
    mentionBasDePage: "Export d'état — ne remplace pas les pièces originales.",
    dateEdition: "13/07/2026",
  };

  it("génère un PDF valide commençant par %PDF", async () => {
    const { buffer } = await renderPdfToBuffer(
      React.createElement(RegistrePdf, { data, identite: IDENTITE }),
    );
    expectPdf(buffer);
  }, 30_000);

  it("contient titre, colonnes, lignes et mention de bas de page", () => {
    const text = collectPdfTextNormalized(
      React.createElement(RegistrePdf, { data, identite: IDENTITE }),
    );
    expect(text).toContain("Registre des réclamations");
    expect(text).toContain("Reçue le");
    expect(text).toContain("AXI-REC-2026-002");
    expect(text).toContain("Retard de convocation");
    expect(text).toContain("ne remplace pas les pièces originales");
    expect(text).toContain("Édité le 13/07/2026");
  });

  it("registre vide → mention « Aucune entrée »", () => {
    const text = collectPdfTextNormalized(
      React.createElement(RegistrePdf, {
        data: { ...data, lignes: [] },
        identite: IDENTITE,
      }),
    );
    expect(text).toMatch(/Aucune entrée enregistrée/);
  });
});

// ============================================================
// 3. CvFormateurPdf (A15)
// ============================================================

describe("CvFormateurPdf", () => {
  const data: CvFormateurData = {
    dateEdition: "13/07/2026",
    nom: "Martin",
    prenom: "Sophie",
    email: "sophie.martin@example.com",
    telephone: "+33 6 00 00 00 00",
    statut: "sous_traitant",
    dateEmbauche: "01/03/2026",
    domainesCompetences: [
      { domaine: "IA générative", niveauMaitrise: "expert", verifiedAt: "01/06/2026" },
      { domaine: "Prompt engineering", niveauMaitrise: "avancé", verifiedAt: "" },
    ],
    formationsHabilitees: ["IA générative pour dirigeants", "Automatiser avec l'IA"],
    cvJoint: true,
    afestHabiliteAt: "15/04/2026",
    sousTraitantNda: "84691234567",
    sousTraitantVerifieAt: "20/04/2026",
  };

  it("génère un PDF valide commençant par %PDF", async () => {
    const { buffer } = await renderPdfToBuffer(
      React.createElement(CvFormateurPdf, { data, identite: IDENTITE }),
    );
    expectPdf(buffer);
  }, 30_000);

  it("contient identité, compétences, habilitations, AFEST et sous-traitance", () => {
    const text = collectPdfTextNormalized(
      React.createElement(CvFormateurPdf, { data, identite: IDENTITE }),
    );
    expect(text).toContain("Martin");
    expect(text).toContain("Sous-traitant");
    expect(text).toContain("IA générative");
    expect(text).toContain("IA générative pour dirigeants");
    expect(text).toContain("Habilité le 15/04/2026");
    expect(text).toContain("84691234567");
    expect(text).toContain("Vérifié le 20/04/2026");
    expect(text).toContain("CV téléversé");
    // Mention RNQ ind. 21/22
    expect(text).toMatch(/indicateur 21/);
  });

  it("formateur salarié → pas de section sous-traitance", () => {
    const text = collectPdfTextNormalized(
      React.createElement(CvFormateurPdf, {
        data: { ...data, statut: "salarie", sousTraitantNda: "", sousTraitantVerifieAt: "" },
        identite: IDENTITE,
      }),
    );
    expect(text).not.toContain("Sous-traitance (ind. 27)");
  });
});

// ============================================================
// 4. FicheAdaptationPdf (A16/A9)
// ============================================================

describe("FicheAdaptationPdf", () => {
  const data: FicheAdaptationData = {
    dateEdition: "13/07/2026",
    nomStagiaire: "Dupont",
    prenomStagiaire: "Jean",
    intituleSession: "IA générative — session juin 2026",
    datesSession: "10/06/2026 – 11/06/2026",
    adaptationsRealisees: "Supports en corps 16, pauses supplémentaires toutes les 45 minutes.",
    referentHandicapNom: "Williams Jullin",
    referentHandicapEmail: "handicap@axion-ia.fr",
    referentHandicapTelephone: "+33 4 00 00 00 00",
    referentHandicapDelaiReponseH: 48,
  };

  it("génère un PDF valide commençant par %PDF", async () => {
    const { buffer } = await renderPdfToBuffer(
      React.createElement(FicheAdaptationPdf, { data, identite: IDENTITE }),
    );
    expectPdf(buffer);
  }, 30_000);

  it("contient stagiaire, session, adaptations et référent handicap", () => {
    const text = collectPdfTextNormalized(
      React.createElement(FicheAdaptationPdf, { data, identite: IDENTITE }),
    );
    expect(text).toContain("Dupont");
    expect(text).toContain("IA générative — session juin 2026");
    expect(text).toContain("pauses supplémentaires");
    expect(text).toContain("Williams Jullin");
    expect(text).toContain("48 heures");
    // Mentions RNQ ind. 10/26 + procédure
    expect(text).toMatch(/indicateur 10/);
    expect(text).toMatch(/référent handicap/i);
    expect(text).toMatch(/Recueil du besoin/);
  });

  it("aucune adaptation renseignée → mention explicite (pas de champ masqué)", () => {
    const text = collectPdfTextNormalized(
      React.createElement(FicheAdaptationPdf, {
        data: { ...data, adaptationsRealisees: "" },
        identite: IDENTITE,
      }),
    );
    expect(text).toMatch(/Aucune adaptation renseignée/);
  });
});
