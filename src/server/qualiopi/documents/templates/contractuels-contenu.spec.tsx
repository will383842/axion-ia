/**
 * Tests CONTENU — documents contractuels (convention, contrat, tripartite).
 *
 * Vérifie la présence des mentions légales obligatoires + des identifiants OF,
 * et que l'absence d'un identifiant obligatoire est SIGNALÉE (« Non renseigné »)
 * au lieu d'être masquée. Extraction via collect-pdf-text (arbre React).
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { ConventionPdf } from "./convention";
import type { ConventionData } from "./convention";
import { ContratFormationPdf } from "./contrat-formation";
import type { ContratFormationData } from "./contrat-formation";
import { ConventionTripartitePdf } from "./convention-tripartite";
import type { ConventionTripartiteData } from "./convention-tripartite";
import { ReglementInterieurPdf } from "./reglement-interieur";
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

const CONVENTION: ConventionData = {
  numero: "AXI-CONV-2026-001",
  client: {
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: "10 av.",
    contact: "Jean",
  },
  intitule: "IA appliquée",
  objectifs: ["Objectif A", "Objectif B"],
  publicVise: "Dirigeants",
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Présentiel",
  lieu: "Paris",
  effectif: 5,
  prixHt: 2800,
  dateConvention: "01/06/2026",
};

const CONTRAT: ContratFormationData = {
  numero: "AXI-CONV-2026-002",
  stagiaire: { nomPrenom: "Marie Durand" },
  intitule: "IA appliquée",
  objectifs: ["Objectif A"],
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Distanciel",
  lieu: "Distanciel",
  prixNet: 1500,
  dateContrat: "01/06/2026",
};

const TRIPARTITE: ConventionTripartiteData = {
  numero: "AXI-CONV-2026-003",
  client: {
    raisonSociale: "Acme SAS",
    siret: "98765432100011",
    adresse: "10 av.",
    contact: "Jean",
  },
  opco: { nom: "OPCO Atlas", numeroPriseEnCharge: "ATLAS-123" },
  intitule: "IA appliquée",
  objectifs: ["Objectif A"],
  publicVise: "Salariés",
  dureeHeures: 14,
  dateDebut: "01/06/2026",
  dateFin: "02/06/2026",
  modalite: "Mixte",
  lieu: "Paris",
  effectif: 5,
  prixHt: 2800,
  montantPrisEnCharge: 2000,
  resteAChargeClient: 800,
  dateConvention: "01/06/2026",
};

describe("ConventionPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ConventionPdf, { data: CONVENTION, identite: IDENTITE }),
  );
  it("porte la mention L.6353-1/2", () => {
    expect(text).toContain(LEGAL_MENTIONS.convention);
  });
  it("affiche les identifiants OF + l'adresse du siège", () => {
    expect(text).toContain("12345678901234");
    expect(text).toContain("84691234567");
    expect(text).toContain("1 rue de la Paix, 75001 Paris");
  });
  it("acompte par défaut : 30 % — comportement historique inchangé", () => {
    // 2800 × 30 % = 840. Le défaut ne doit JAMAIS bouger silencieusement :
    // c'est la clause de toutes les conventions émises sans choix explicite.
    // `collectPdfText` joint les enfants JSX par des espaces → « ( 30 %) ».
    expect(text).toMatch(/Acompte à la signature \( ?30 ?%\)/);
  });
  it("acomptePercent personnalisé : le pourcentage ET le montant suivent", () => {
    const t = collectPdfTextNormalized(
      React.createElement(ConventionPdf, {
        data: { ...CONVENTION, acomptePercent: 50 },
        identite: IDENTITE,
      }),
    );
    expect(t).toMatch(/Acompte à la signature \( ?50 ?%\)/);
  });
  it("acompte 0 : mention « totalité à réception de facture », jamais « (0 %) : 0,00 € »", () => {
    // Convention régularisée APRÈS la tenue de l'action : un acompte « à la
    // signature » n'a plus d'objet. Une ligne à 0,00 € se lirait comme une
    // erreur de génération sur la pièce que le client signe.
    const t = collectPdfTextNormalized(
      React.createElement(ConventionPdf, {
        data: { ...CONVENTION, acomptePercent: 0 },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("Payable en totalité à réception de facture");
    expect(t).not.toContain("Acompte à la signature");
  });
  it("signale un SIRET OF manquant au lieu de le masquer", () => {
    expect(
      collectPdfTextNormalized(
        React.createElement(ConventionPdf, {
          data: CONVENTION,
          identite: { ...IDENTITE, siret: "" },
        }),
      ),
    ).toContain("Non renseigné");
  });
  it("« Fait à » porte la ville du siège quand elle est configurée", () => {
    // La pièce est signée électroniquement : personne ne complète jamais le
    // blanc à la main. Sans ville configurée, on garde le blanc plutôt que
    // d'inventer un lieu.
    const t = collectPdfTextNormalized(
      React.createElement(ConventionPdf, {
        data: CONVENTION,
        identite: { ...IDENTITE, rcsVille: "Grenoble" },
      }),
    );
    expect(t).toContain("Fait à Grenoble, le 01/06/2026");
  });
  it("« Fait à » retombe sur le blanc quand la ville du siège est absente", () => {
    expect(text).toContain("Fait à _________________________, le 01/06/2026");
  });

  // ── Mentions EXIGÉES par L.6353-1, absentes jusqu'au 2026-08-02 ──────────
  it("porte les moyens pédagogiques, le suivi de l'exécution et la sanction", () => {
    expect(text).toContain("Moyens pédagogiques et techniques");
    expect(text).toContain("Suivi de l'exécution et évaluation");
    expect(text).toContain("Sanction de la formation");
    // Le repli décrit le dispositif RÉEL de la plateforme.
    expect(text).toContain("émargement");
    expect(text).toContain("Attestation de fin de formation");
  });

  it("les mentions L.6353-1 fournies priment sur les replis", () => {
    const t = collectPdfTextNormalized(
      React.createElement(ConventionPdf, {
        data: { ...CONVENTION, sanction: "Certificat de réalisation." },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("Certificat de réalisation.");
  });

  // ── Clauses de protection de l'organisme ────────────────────────────────
  it("porte les clauses qui protègent l'organisme (PI, confidentialité, responsabilité)", () => {
    expect(text).toContain("propriété exclusive de l'organisme");
    expect(text).toContain("obligation de moyens");
    expect(text).toContain("limitée au montant hors taxes");
    expect(text).toContain("force majeure");
    expect(text).toContain("droit français");
  });

  it("porte la clause RGPD avec un contact d'exercice des droits", () => {
    expect(text).toContain("2016/679");
    expect(text).toContain("cinq (5) ans");
    expect(text).toContain("CNIL");
    // L'adresse d'exercice des droits ne doit jamais être un trou.
    expect(text).toContain("contact@axion-ia.fr");
  });

  it("annonce que les prix sont HT et le délai de règlement", () => {
    expect(text).toContain("hors taxes");
    expect(text).toContain("trente (30) jours");
    expect(text).toContain("L.441-10");
  });
});

describe("ContratFormationPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ContratFormationPdf, { data: CONTRAT, identite: IDENTITE }),
  );
  it("porte la mention L.6353-3 à -7 (rétractation particuliers)", () => {
    expect(text).toContain(LEGAL_MENTIONS.contratParticulier);
  });
  it("mentionne le délai de rétractation de 10 jours", () => {
    expect(text).toContain("dix (10) jours");
  });
  it("affiche le stagiaire et les identifiants OF", () => {
    expect(text).toContain("Marie Durand");
    expect(text).toContain("12345678901234");
  });
  it("« Fait à » porte la ville du siège quand elle est configurée", () => {
    const t = collectPdfTextNormalized(
      React.createElement(ContratFormationPdf, {
        data: CONTRAT,
        identite: { ...IDENTITE, rcsVille: "Grenoble" },
      }),
    );
    expect(t).toContain("Fait à Grenoble, le 01/06/2026");
  });
});

describe("ConventionTripartitePdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ConventionTripartitePdf, { data: TRIPARTITE, identite: IDENTITE }),
  );
  it("porte la mention de convention + les 3 parties", () => {
    expect(text).toContain(LEGAL_MENTIONS.convention);
    expect(text).toContain("Pour l'organisme de formation");
    expect(text).toContain("Pour le client");
    expect(text).toContain("Pour l'OPCO");
  });
  it("affiche l'OPCO et la ventilation financière", () => {
    expect(text).toContain("OPCO Atlas");
    expect(text).toContain("ATLAS-123");
  });
  it("« Fait à » porte la ville du siège quand elle est configurée", () => {
    const t = collectPdfTextNormalized(
      React.createElement(ConventionTripartitePdf, {
        data: TRIPARTITE,
        identite: { ...IDENTITE, rcsVille: "Grenoble" },
      }),
    );
    expect(t).toContain("Fait à Grenoble, le 01/06/2026");
  });

  // ── Sous-lot 8B — la pièce que lit l'OPCO doit valoir la bipartite ───────
  //
  // 🔴 Le test qui doit rougir : cette convention invoque L.6353-1 en tête de
  // page et n'en portait AUCUNE des trois mentions, ni les cinq sections de
  // fond que la bipartite a reçues le 02/08. C'était la plus exposée des deux
  // pièces — celle transmise au financeur — et la moins complète.
  it("🔴 porte les TROIS mentions de l'article L.6353-1", () => {
    expect(text).toContain("Moyens pédagogiques et techniques");
    expect(text).toContain("Suivi de l'exécution et évaluation");
    expect(text).toContain("Sanction de la formation");
    // Et les replis décrivent le dispositif RÉEL, pas une formule creuse.
    expect(text).toContain("émargement");
    expect(text).toContain("positionnement");
    expect(text).toContain("Attestation de fin de formation");
  });

  it("🔴 porte les cinq sections de fond alignées sur la bipartite", () => {
    expect(text).toContain("Obligations des parties");
    expect(text).toContain("Données à caractère personnel");
    expect(text).toContain("Propriété intellectuelle et confidentialité");
    expect(text).toContain("Responsabilité et force majeure");
    expect(text).toContain("Droit applicable et différends");
  });

  it("🔴 dit ce qui se passe quand l'OPCO refuse, réduit ou ne paie pas", () => {
    // Le trou de l'audit (Q3) : le système sait facturer N payeurs, mais aucun
    // texte ne permettait de réémettre au client. Sans cette clause, un refus
    // d'OPCO laisse l'organisme sans fondement pour réclamer la somme.
    expect(text).toContain("refus");
    expect(text).toContain("demeure le débiteur du prix");
  });

  it("annonce la transmission des pièces au financeur — c'est LUI qui lit cette page", () => {
    expect(text).toContain("transmises à l'OPCO");
  });

  it("est établie en TROIS exemplaires, pas deux", () => {
    expect(text).toContain("trois exemplaires originaux");
  });

  it("garde une numérotation continue après l'ajout des sections", () => {
    // Renuméroter une liste référencée par rang casse ses renvois. Ici aucun
    // renvoi n'existe, mais la numérotation doit rester lisible bout en bout.
    expect(text).toContain("10. Documents annexés");
    expect(text).toContain("11. Signatures");
  });
});

// ============================================================
// Règlement intérieur — contenu imposé par le code du travail
// ============================================================
//
// 🔴 F31 — le règlement annonçait l'exclusion définitive sans énoncer ni
// l'échelle des sanctions (art. R6352-3) ni les droits de la défense
// (art. R6352-4 à R6352-8). Or ces deux contenus sont le cœur de ce que la loi
// exige d'un règlement intérieur d'organisme de formation : prévoir la sanction
// sans la procédure la rend inopposable au stagiaire. C'est aussi l'une des
// premières pièces que lit un auditeur.

describe("ReglementInterieurPdf — contenu légal", () => {
  const text = collectPdfTextNormalized(
    React.createElement(ReglementInterieurPdf, {
      data: { numero: "AXI-RI-2026-001", dateVersion: "01/01/2026" },
      identite: IDENTITE,
    }),
  );

  it("F31 : énonce l'échelle des sanctions (art. R6352-3)", () => {
    expect(text).toContain("Échelle des sanctions");
    expect(text).toContain("avertissement");
    expect(text).toContain("blâme");
    expect(text).toContain("exclusion temporaire");
    expect(text).toContain("exclusion définitive");
  });

  it("F31 : rappelle que les sanctions pécuniaires sont interdites", () => {
    expect(text).toContain("sanctions pécuniaires sont interdites");
  });

  it("F31 : décrit les droits de la défense (art. R6352-4 à R6352-8)", () => {
    expect(text).toContain("informé au préalable des griefs");
    expect(text).toContain("se faire assister");
    expect(text).toContain("quinze jours après l'entretien");
    expect(text).toContain("notifiée par écrit et motivée");
  });

  it("F31 : prévoit l'information de l'employeur et du financeur", () => {
    expect(text).toContain("R6352-8");
  });

  it("conserve les mesures d'hygiène et de sécurité (art. L6352-3)", () => {
    expect(text).toContain("consignes de sécurité");
  });
});

describe("🔴 contrat particulier — l'échéancier DATÉ figure au contrat (L.6353-6 pt 3)", () => {
  // La doctrine administrative impose que « les modalités de règlement,
  // notamment l'échéancier, figurent dans le contrat de formation ». Jusqu'au
  // 2026-07-30, ce contrat citait L.6353-6 sans donner UNE SEULE date : l'article
  // était mentionné, l'obligation pas remplie.
  //
  // ⚠️ Ce test vérifie que le paramètre est CONSOMMÉ — la sortie doit DIFFÉRER
  // selon qu'on fournit un échéancier. C'est la leçon du défaut F1 : un gabarit
  // câblé qu'aucun producteur n'alimente passe tous les tests naïfs.
  const ECHEANCIER = [
    {
      libelle: "Solde — échéance 1/3 (art. L6353-6)",
      montantEuros: 350,
      dueLeLisible: "15/09/2026",
    },
    {
      libelle: "Solde — échéance 2/3 (art. L6353-6)",
      montantEuros: 350,
      dueLeLisible: "15/10/2026",
    },
    {
      libelle: "Solde — échéance 3/3 (art. L6353-6)",
      montantEuros: 350,
      dueLeLisible: "15/11/2026",
    },
  ];

  it("imprime chaque échéance avec sa DATE et son montant", () => {
    const sans = collectPdfTextNormalized(
      <ContratFormationPdf data={CONTRAT} identite={IDENTITE} />,
    );
    const avec = collectPdfTextNormalized(
      <ContratFormationPdf
        data={{ ...CONTRAT, echeancierSolde: ECHEANCIER }}
        identite={IDENTITE}
      />,
    );
    expect(avec).not.toStrictEqual(sans);
    expect(avec).toContain("Échéancier du solde");
    expect(avec).toContain("15/09/2026");
    expect(avec).toContain("15/11/2026");
    expect(sans).not.toContain("Échéancier du solde");
  });

  it("⚠️ sans échéancier, garde la ligne « solde échelonné » — ne fabrique aucune date", () => {
    const sans = collectPdfTextNormalized(
      <ContratFormationPdf data={CONTRAT} identite={IDENTITE} />,
    );
    expect(sans).toContain("Solde échelonné au fur et à mesure");
    expect(sans).not.toMatch(/\d{2}\/\d{2}\/2026 — Solde/);
  });
});
