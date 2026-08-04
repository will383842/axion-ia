/**
 * Tests CONTENU — Liste des formateurs et qualifications.
 *
 * Cette pièce répond à quatre questions que pose l'article R.6351-5 : qui
 * intervient, à quel titre, en lien avec quelles prestations, sous quel lien
 * contractuel. Chacune est testée — en retirer une, c'est retirer une réponse.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { ListeFormateursPdf, type ListeFormateursData } from "./liste-formateurs";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

const BASE: ListeFormateursData = {
  numero: "AXI-DOC-2026-050",
  dateEdition: "02/08/2026",
  formateurs: [
    {
      nomPrenom: "Williams Jullin",
      statut: "dirigeant",
      domaines: ["IA générative", "Conformité & AI Act"],
      nbHabilitations: 57,
      exemplesHabilitations: ["IA pour l'immobilier", "IA pour bien commencer"],
      cvAuDossier: true,
      depuis: "18/07/2026",
    },
  ],
};

function rendre(patch: Partial<ListeFormateursData> = {}): string {
  return collectPdfTextNormalized(
    React.createElement(ListeFormateursPdf, {
      data: { ...BASE, ...patch },
      identite: IDENTITE,
    }),
  );
}

describe("ListeFormateursPdf — les 4 réponses exigées par R.6351-5", () => {
  const text = rendre();

  it("QUI : nomme l'intervenant et depuis quand il collabore", () => {
    expect(text).toContain("Williams Jullin");
    expect(text).toContain("18/07/2026");
  });

  it("À QUEL TITRE : la qualité, pas seulement le nom", () => {
    expect(text).toContain("Dirigeant-formateur");
  });

  it("LIEN AVEC LES PRESTATIONS : compétences et habilitations", () => {
    expect(text).toContain("IA générative");
    expect(text).toContain("57 formations habilitées");
    expect(text).toContain("IA pour l'immobilier");
  });

  it("LIEN CONTRACTUEL : le mandat social, jamais un contrat de travail", () => {
    expect(text).toContain("mandat social");
    expect(text).toContain("sans contrat de travail");
  });

  it("cite R.6351-5 et l'indicateur 21", () => {
    expect(text).toContain("R.6351-5");
    expect(text).toContain("21");
  });
});

describe("ListeFormateursPdf — effectif", () => {
  it("sépare internes et externes, et donne le total", () => {
    const t = rendre({
      formateurs: [
        BASE.formateurs[0]!,
        {
          nomPrenom: "Paul Externe",
          statut: "sous_traitant",
          domaines: ["Data"],
          nbHabilitations: 2,
          exemplesHabilitations: ["Data pour dirigeants"],
          cvAuDossier: false,
          sousTraitantNda: "11223344556",
          depuis: "",
        },
      ],
    });
    expect(t).toContain("1 (dirigeants et salariés)");
    expect(t).toContain("1 (sous-traitance)");
    expect(t).toContain("2 personnes dispensant des heures de formation");
  });

  it("sous-traitant : le NDA figure au lien contractuel (indicateur 27)", () => {
    const t = rendre({
      formateurs: [
        {
          nomPrenom: "Paul Externe",
          statut: "sous_traitant",
          domaines: [],
          nbHabilitations: 0,
          exemplesHabilitations: [],
          cvAuDossier: false,
          sousTraitantNda: "11223344556",
          depuis: "",
        },
      ],
    });
    expect(t).toContain("contrat de sous-traitance");
    expect(t).toContain("11223344556");
  });
});

describe("ListeFormateursPdf — les lacunes sont DITES, jamais masquées", () => {
  it("aucune compétence saisie : la pièce le dit", () => {
    const t = rendre({
      formateurs: [
        {
          nomPrenom: "Anne Nouvelle",
          statut: "salarie",
          domaines: [],
          nbHabilitations: 0,
          exemplesHabilitations: [],
          cvAuDossier: false,
          depuis: "",
        },
      ],
    });
    expect(t).toContain("Compétences non renseignées");
  });

  it("CV absent : « CV non versé », pas un blanc", () => {
    const t = rendre({
      formateurs: [{ ...BASE.formateurs[0]!, cvAuDossier: false }],
    });
    expect(t).toContain("CV non versé");
    expect(t).not.toContain("CV au dossier");
  });

  it("CV présent : le dit aussi", () => {
    expect(rendre()).toContain("CV au dossier");
  });

  it("rappelle qu'aucun diplôme n'est légalement exigé", () => {
    expect(rendre()).toContain("Aucun diplôme n'est légalement exigé");
  });

  it("rend un PDF valide (%PDF)", async () => {
    const { renderPdfToBuffer } = await import("../render");
    const { buffer } = await renderPdfToBuffer(
      React.createElement(ListeFormateursPdf, { data: BASE, identite: IDENTITE }),
    );
    expect(buffer.subarray(0, 5).toString()).toContain("%PDF");
  }, 30_000);
});
