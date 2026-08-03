/**
 * Tests — procédure de sous-traitance (indicateur 27).
 *
 * Ces tests portent sur le CONTENU, pas sur « le buffer commence par %PDF ».
 * Une procédure qualité vaut par ce qu'elle dit : un article perdu à la
 * réécriture d'un gabarit ne se verrait sur aucun test de rendu.
 *
 * Le point le plus sensible est le § 4.2 : la RC pro est délibérément NON
 * impérative (décision du dirigeant, 2026-08-03). Si un jour quelqu'un
 * « durcit » ce paragraphe, la procédure écrite contredirait le comportement du
 * logiciel — les alertes, elles, resteront non bloquantes. Un auditeur qui
 * relève une règle écrite non appliquée ouvre une non-conformité.
 */

import { describe, it, expect } from "vitest";
import React from "react";

import { ProcedureSousTraitancePdf } from "./procedure-sous-traitance";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "AXION IA SAS",
  nda: "84691234567",
  qualiopi: "FR-2024-TEST-001",
  siret: "10801863100011",
  adresseSiege: "11 Avenue Paul Verlaine, 38100 Grenoble",
  adresseExercice: "11 Avenue Paul Verlaine, 38100 Grenoble",
  email: "contact@axion-ia.com",
  telephone: "+33 7 43 33 12 01",
  site: "https://axion-ia.com",
};

function rendre(): string {
  return collectPdfTextNormalized(
    React.createElement(ProcedureSousTraitancePdf, {
      data: {
        numero: "AXI-DOC-2026-099",
        version: "1.0",
        applicableLe: "03/08/2026",
        signataireNom: "Williams Jullin",
        signataireQualite: "Président",
      },
      identite: IDENTITE,
    }),
  );
}

describe("ProcedureSousTraitancePdf — les 9 articles sont là", () => {
  const texte = rendre();

  it("porte les articles que l'indicateur 27 attend", () => {
    // Perdre un article à la réécriture d'un gabarit ne se verrait sur aucun
    // test de rendu : la procédure sortirait amputée et personne ne le saurait.
    expect(texte).toContain("Situation de l'organisme");
    expect(texte).toContain("Champ d'application");
    expect(texte).toContain("Principe directeur");
    expect(texte).toContain("conditions impératives");
    expect(texte).toContain("Engagement contractuel");
    expect(texte).toContain("Information du bénéficiaire");
    expect(texte).toContain("Suivi et évaluation");
    expect(texte).toContain("Reconduction et retrait");
    expect(texte).toContain("Revue");
  });

  it("dit que la sous-traitance ne transfère AUCUNE obligation qualité", () => {
    // C'est le principe directeur : sans lui, la procédure décrirait un
    // transfert de responsabilité que l'article L.6316-3 n'autorise pas.
    expect(texte).toContain("ne transfère aucune obligation qualité");
  });

  it("couvre expressément les FORMATEURS OCCASIONNELS, pas seulement les organismes", () => {
    // Le critère 6 les vise nommément. Une procédure qui ne parlerait que de
    // « sous-traitants » laisserait croire qu'un vacataire y échappe.
    expect(texte).toContain("formateurs occasionnels");
  });
});

describe("ProcedureSousTraitancePdf — § 4.2, la RC pro reste NON impérative", () => {
  const texte = rendre();

  it("écrit noir sur blanc que son absence ne fait pas obstacle", () => {
    // 🔴 Décision du dirigeant (2026-08-03) : la rendre impérative réduirait le
    // vivier d'intervenants sans nécessité réglementaire. Le logiciel se comporte
    // ainsi (alerte « important », jamais « critique ») — la procédure écrite
    // doit dire la même chose, sinon l'écart est une non-conformité.
    expect(texte).toContain("ne fait pas obstacle");
  });

  it("ne range PAS la RC pro parmi les conditions impératives", () => {
    const debut = texte.indexOf("conditions impératives");
    const fin = texte.indexOf("responsabilité civile");
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);

    // Les trois conditions impératives sont l'existence légale, le NDA et les
    // compétences — et rien d'autre.
    const bloc = texte.slice(debut, fin);
    expect(bloc).toContain("Existence légale");
    expect(bloc).toContain("Déclaration d'activité");
    expect(bloc).toContain("Compétences");
    expect(bloc).not.toContain("responsabilité civile professionnelle");
  });
});

describe("ProcedureSousTraitancePdf — approbation", () => {
  it("nomme une PERSONNE PHYSIQUE et sa qualité", () => {
    const texte = rendre();
    // Une procédure approuvée par « l'organisme » sans signataire identifié
    // n'engage personne — défaut déjà relevé sur les attestations.
    expect(texte).toContain("Williams Jullin");
    expect(texte).toContain("Président");
  });

  it("porte la version et la date d'application", () => {
    const texte = rendre();
    // Deux tirages de versions différentes doivent être distinguables : c'est
    // ce qui permet de dire QUELLE règle s'appliquait à une date donnée.
    expect(texte).toContain("Version 1.0");
    expect(texte).toContain("03/08/2026");
  });
});

describe("ProcedureSousTraitancePdf — rendu réel", () => {
  it("produit un PDF valide", async () => {
    const { renderPdfToBuffer } = await import("../render");
    const { buffer } = await renderPdfToBuffer(
      React.createElement(ProcedureSousTraitancePdf, {
        data: {
          numero: "AXI-DOC-2026-099",
          version: "1.0",
          applicableLe: "03/08/2026",
          signataireNom: "Williams Jullin",
          signataireQualite: "Président",
        },
        identite: IDENTITE,
      }),
    );

    // Le test de contenu marche sur l'arbre React AVANT rendu : il ne dirait
    // rien d'un gabarit qui compile mais explose à la génération (glyphe absent,
    // style refusé par Yoga). D'où ce rendu complet, en plus.
    expect(buffer.slice(0, 4).toString("utf8")).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  }, 30_000);
});
