/**
 * Fiche B6b-3 : les bandeaux SPÉCIMEN et ESSAI et le motif de conformité
 * n'impriment ni « financeur » ni « Qualiopi » sur une pièce non officielle.
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { QualiopiPage } from "./base-layout";
import { collectPdfTextNormalized } from "./collect-pdf-text";
import { evaluerIdentite } from "./conformite";
import type { OrganismeIdentite } from "./organisme";

const IDENTITE_INCOMPLETE: OrganismeIdentite = {
  raisonSociale: "Organisme de test",
  nda: "",
  qualiopi: "",
  siret: "",
  adresseSiege: "",
  adresseExercice: "",
  email: "",
  telephone: "",
  site: "",
};

const INTERDITS = /financeur|qualiopi/i;

describe("bandeaux des pièces non officielles", () => {
  it("SPÉCIMEN sans motif : texte par défaut sans « financeur » ni « Qualiopi »", () => {
    const texte = collectPdfTextNormalized(
      <QualiopiPage
        docTitle="Convention"
        docNumber="AXI-CONV-2026-001"
        identite={IDENTITE_INCOMPLETE}
        estSpecimen
      >
        <></>
      </QualiopiPage>,
    );
    expect(texte).toContain("SPÉCIMEN");
    expect(texte).toContain("un client ou un auditeur");
    expect(texte).not.toMatch(INTERDITS);
  });

  it("SPÉCIMEN avec le motif réel de conformité : aucun terme interdit", () => {
    const { motif } = evaluerIdentite(IDENTITE_INCOMPLETE, "facture");
    const texte = collectPdfTextNormalized(
      <QualiopiPage
        docTitle="Facture"
        docNumber="AXI-FAC-2026-001"
        identite={IDENTITE_INCOMPLETE}
        estSpecimen
        specimenMotif={motif ?? ""}
      >
        <></>
      </QualiopiPage>,
    );
    expect(texte).not.toMatch(INTERDITS);
  });

  it("ESSAI : bandeau sans « financeur » ni « Qualiopi »", () => {
    const texte = collectPdfTextNormalized(
      <QualiopiPage
        docTitle="Convention"
        docNumber="AXI-CONV-ESSAI-001"
        identite={IDENTITE_INCOMPLETE}
      >
        <></>
      </QualiopiPage>,
    );
    expect(texte).toContain("ESSAI");
    expect(texte).toContain("un client ou un auditeur");
    expect(texte).not.toMatch(INTERDITS);
  });
});

describe("motif de conformité", () => {
  it("renvoie à la configuration de l'organisme, sans nommer Qualiopi", () => {
    const { conforme, motif } = evaluerIdentite(IDENTITE_INCOMPLETE, "facture");
    expect(conforme).toBe(false);
    expect(motif).toContain(
      "Renseignez ces valeurs dans la configuration de l'organisme pour émettre un document officiel.",
    );
    expect(motif).not.toMatch(INTERDITS);
  });
});
