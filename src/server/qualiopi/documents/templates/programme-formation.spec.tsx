/**
 * Tests CONTENU — Programme de l'action de formation.
 *
 * C'est l'annexe que la convention déclare en section « Documents annexés ».
 * Ce qu'elle affirme engage donc au même titre que la convention.
 */

import { describe, it, expect } from "vitest";
import React from "react";

import { ProgrammeFormationPdf, type ProgrammeFormationData } from "./programme-formation";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const BASE: ProgrammeFormationData = {
  numero: "AXI-DOC-2026-042",
  intitule: "IA pour bien commencer",
  versionProgramme: "v3",
  dateEdition: "31/07/2026",
  dureeHeures: 4,
  modalite: "Présentiel",
  lieu: "Sur site — 5 rue des Docks, 42000 Saint-Étienne",
  publicVise: "Tout collaborateur, toutes fonctions",
  prerequis: "",
  niveau: "Tous niveaux",
  accessibleHandicap: true,
  objectifs: ["Identifier les cas d'usage de l'IA générative", "Rédiger un prompt efficace"],
  modules: [
    {
      titre: "Comprendre l'IA générative",
      dureeMin: 120,
      sequences: [
        { titre: "Ce que l'IA sait faire", dureeMin: 45 },
        { titre: "Ce qu'elle ne sait pas faire", dureeMin: null },
      ],
    },
    { titre: "Passer à la pratique", dureeMin: null, sequences: [] },
  ],
  methodesPedagogiques: "Alternance d'apports et de mises en situation.",
  modalitesEvaluation: "Positionnement en amont, évaluation des acquis en fin d'action.",
  sanction: "Attestation de fin de formation.",
  referentHandicapEmail: "handicap@axion-ia.fr",
};

function rendre(patch: Partial<ProgrammeFormationData> = {}): string {
  return collectPdfTextNormalized(
    React.createElement(ProgrammeFormationPdf, {
      data: { ...BASE, ...patch },
      identite: IDENTITE,
    }),
  );
}

describe("ProgrammeFormationPdf — mentions de l'action", () => {
  const text = rendre();

  it("porte l'intitulé, la durée contractuelle et la modalité", () => {
    expect(text).toContain("IA pour bien commencer");
    expect(text).toContain("4 heures");
    expect(text).toContain("Présentiel");
  });

  // Le lieu réel : c'est tout l'objet du chantier qui précède cette pièce.
  it("porte le lieu réel de déroulement", () => {
    expect(text).toContain("Saint-Étienne");
  });

  // La version figée au snapshot est ce qu'un auditeur recoupe entre l'annexe
  // et la convention.
  it("porte la version du programme", () => {
    expect(text).toContain("v3");
  });

  it("liste les objectifs pédagogiques", () => {
    expect(text).toContain("Rédiger un prompt efficace");
  });
});

describe("ProgrammeFormationPdf — contenu", () => {
  const text = rendre();

  it("numérote les modules et rend leurs séquences", () => {
    expect(text).toContain("Module 1 — Comprendre l'IA générative");
    expect(text).toContain("Module 2 — Passer à la pratique");
    expect(text).toContain("Ce que l'IA sait faire");
  });

  it("ne double pas le préfixe quand le titre stocké porte déjà « Module N — »", () => {
    // Constaté sur AXI-DOC-2026-002 : « Module 1 — Module 1 — L'IA dans le
    // métier immobilier » — le contenu généré préfixe déjà ses titres.
    const t = rendre({
      modules: [
        { titre: "Module 1 — L'IA dans le métier immobilier", dureeMin: null, sequences: [] },
      ],
    });
    expect(t).toContain("Module 1 — L'IA dans le métier immobilier");
    expect(t).not.toContain("Module 1 — Module 1");
  });

  it("affiche les durées connues et tait celles qui manquent", () => {
    expect(text).toContain("2 h");
    expect(text).toContain("(45 min)");
    // La séquence sans durée n'invente pas « 0 min ».
    expect(text).not.toContain("0 min");
  });

  // 🔴 Une annexe muette se lit comme un défaut d'impression. Elle doit nommer
  // sa lacune, et rappeler ce qui reste opposable.
  it("sans module structuré : le dit explicitement au lieu d'une section vide", () => {
    const t = rendre({ modules: [] });
    expect(t).toContain("n'est pas structuré");
    expect(t).toContain("IA pour bien commencer");
    expect(t).toContain("4 heures");
  });
});

describe("ProgrammeFormationPdf — mentions réglementaires", () => {
  it("cite l'article L.6353-1 et se déclare annexe de la convention", () => {
    const text = rendre();
    expect(text).toContain("L.6353-1");
    expect(text).toContain("annexe pédagogique de la convention");
  });

  // « Aucun prérequis » est une information pour le stagiaire, pas un vide.
  it("prérequis vide → « Aucun prérequis », jamais une ligne muette", () => {
    expect(rendre({ prerequis: "" })).toContain("Aucun prérequis");
  });

  it("porte le contact du référent handicap quand l'action est accessible", () => {
    expect(rendre()).toContain("handicap@axion-ia.fr");
  });

  it("action non accessible : invite à nous contacter, sans promettre l'adaptation", () => {
    const t = rendre({ accessibleHandicap: false });
    expect(t).toContain("Nous contacter");
  });

  it("rend un PDF valide (%PDF)", async () => {
    const { renderPdfToBuffer } = await import("../render");
    const { buffer } = await renderPdfToBuffer(
      React.createElement(ProgrammeFormationPdf, { data: BASE, identite: IDENTITE }),
    );
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.byteLength).toBeGreaterThan(100);
    expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
  });
});
