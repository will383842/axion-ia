/**
 * Tests CONTENU — attestation, attestation partielle, certificat de réalisation.
 *
 * Vérifie la présence des mentions légales, des identifiants OF et — pour le
 * certificat — du format réglementaire des heures EN CENTIÈMES ("7,00"), via
 * l'extraction de texte de l'arbre React (collect-pdf-text).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { AttestationPdf } from "./attestation";
import type { AttestationData } from "./attestation";
import { AttestationPartiellePdf } from "./attestation-partielle";
import type { AttestationPartielleData } from "./attestation-partielle";
import { CertificatRealisationPdf } from "./certificat-realisation";
import type { CertificatRealisationData } from "./certificat-realisation";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
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
};

const ATTESTATION: AttestationData = {
  numero: "AXI-ATT-2026-001",
  dateEmission: "06/06/2026",
  identite: IDENTITE,
  dirigeant: "Alice Dupont",
  beneficiaire: { nom: "Martin", prenom: "Jean", entreprise: "Acme SAS" },
  formation: {
    intitule: "IA appliquée",
    objectifs: "Maîtriser l'IA générative",
    dureeHeures: 14,
    dateDebut: "01/06/2026",
    dateFin: "02/06/2026",
    modalite: "Présentiel",
    formateur: "Bob",
  },
  resultats: { heuresSuivies: 14, heuresTotales: 14, competencesAcquises: "Prompt engineering" },
};

const PARTIELLE: AttestationPartielleData = {
  numero: "AXI-ATT-2026-002",
  dateEmission: "06/06/2026",
  identite: IDENTITE,
  dirigeant: "Alice Dupont",
  beneficiaire: { nom: "Bernard", prenom: "Sophie" },
  formation: {
    intitule: "IA appliquée",
    objectifs: "Maîtriser l'IA générative",
    dureeHeures: 14,
    dateDebut: "01/06/2026",
    dateFin: "02/06/2026",
    modalite: "Distanciel",
    formateur: "Bob",
  },
  resultats: {
    heuresSuivies: 10,
    heuresTotales: 14,
    competencesPartiellesValidees: "Modules 1-3",
  },
};

const CERTIFICAT: CertificatRealisationData = {
  numero: "AXI-CERT-2026-001",
  dateEmission: "06/06/2026",
  identite: IDENTITE,
  dirigeant: "Alice Dupont",
  entreprise: { raisonSociale: "Acme SAS", siret: "98765432100011" },
  stagiaire: { nom: "Leroy", prenom: "Pierre" },
  intituleAction: "IA appliquée",
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  dureeHeures: 7,
};

describe("AttestationPdf — contenu", () => {
  const text = collectPdfTextNormalized(React.createElement(AttestationPdf, { data: ATTESTATION }));
  it("porte la mention L.6353-1 / D.6353-1", () => {
    expect(text).toContain(LEGAL_MENTIONS.attestation);
  });
  it("affiche le bénéficiaire et l'identité OF (header/footer)", () => {
    expect(text).toContain("Jean Martin");
    expect(text).toContain("12345678901234"); // SIRET OF en en-tête/pied
    expect(text).toContain("84691234567"); // NDA OF
  });
  it("affiche l'assiduité", () => {
    expect(text).toContain("100 %");
  });
});

describe("AttestationPartiellePdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(AttestationPartiellePdf, { data: PARTIELLE }),
  );
  it("signale fortement le caractère partiel", () => {
    expect(text).toContain("Attestation partielle");
    expect(text).toContain("60 %");
  });
  it("porte la mention légale + les compétences partiellement validées", () => {
    expect(text).toContain(LEGAL_MENTIONS.attestation);
    expect(text).toContain("Modules 1-3");
  });
});

describe("CertificatRealisationPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(CertificatRealisationPdf, { data: CERTIFICAT }),
  );
  it("porte la mention R.6313-3 / arrêté 21/12/2018", () => {
    expect(text).toContain(LEGAL_MENTIONS.certificatRealisation);
  });
  it("affiche la durée AU FORMAT CENTIÈMES (7,00), jamais 7h00", () => {
    expect(text).toContain("7,00 heures");
    expect(text).not.toMatch(/7h00/);
  });
  it("affiche les identifiants OF (jamais masqués)", () => {
    expect(text).toContain("84691234567");
    expect(text).toContain("FR-2024-001");
  });
  it("signale un NDA manquant au lieu de le masquer", () => {
    const t = collectPdfTextNormalized(
      React.createElement(CertificatRealisationPdf, {
        data: { ...CERTIFICAT, identite: { ...IDENTITE, nda: "" } },
      }),
    );
    expect(t).toContain("Non renseigné");
  });

  // 🔴 F30 — le modèle annexé à l'arrêté du 21 décembre 2018 impose de qualifier
  // l'action. Sans nature, un OPCO ne sait pas au titre de quel dispositif il
  // rembourse ; sans modalité, un contrôle de service fait n'a rien à vérifier.
  it("F30 : qualifie la nature de l'action, même sans valeur explicite", () => {
    expect(text).toContain("Nature de l'action");
    expect(text).toContain("Action de formation");
  });

  it("F30 : porte la modalité d'exécution quand elle est connue", () => {
    const t = collectPdfTextNormalized(
      React.createElement(CertificatRealisationPdf, {
        data: { ...CERTIFICAT, modalite: "hybride" },
      }),
    );
    expect(t).toContain("Modalité d'exécution");
    expect(t).toContain("Mixte (présentiel et à distance)");
  });

  it("F30 : un bilan de compétences n'est pas annoncé comme une formation", () => {
    const t = collectPdfTextNormalized(
      React.createElement(CertificatRealisationPdf, {
        data: { ...CERTIFICAT, natureAction: "bilan_competences" },
      }),
    );
    expect(t).toContain("Bilan de compétences");
    // Assertion en MIROIR plutôt qu'en négatif : « Action de formation » est
    // aussi le titre de la section (« Action de formation réalisée »), donc un
    // `not.toContain` échouerait sans rien prouver. Ce qui compte est que le
    // libellé n'apparaisse QUE lorsqu'il est la nature retenue.
    expect(text).not.toContain("Bilan de compétences");
  });

  // 🔴 F29 — la ligne Qualiopi était `required` : sans numéro, le certificat
  // imprimait « Non renseigné » dans le style des champs manquants, sur la pièce
  // même qui part chez l'OPCO. Un OF non encore certifié n'a pas de numéro à
  // porter — la ligne disparaît, elle ne s'excuse pas.
  it("F29 : n'annonce PAS l'absence de certification Qualiopi", () => {
    const t = collectPdfTextNormalized(
      React.createElement(CertificatRealisationPdf, {
        data: { ...CERTIFICAT, identite: { ...IDENTITE, qualiopi: "" } },
      }),
    );
    expect(t).not.toContain("Certification Qualiopi");
  });
});
