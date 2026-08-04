/**
 * Tests CONTENU — Organisation de l'action (art. R.6351-5, indicateurs 9/12).
 *
 * Vérifie que la pièce porte le calendrier réel (dates + horaires), le rythme,
 * le lieu et l'encadrement — et que les états dégradés (calendrier absent,
 * horaires prévisionnels) sont DITS plutôt que masqués.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { OrganisationActionPdf } from "./organisation-action";
import type { OrganisationActionData } from "./organisation-action";
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
};

const DATA: OrganisationActionData = {
  numero: "AXI-DOC-2026-099",
  intitule: "IA appliquée — Acme (Lyon)",
  numeroSession: "AXI-SESS-2026-042",
  dateEdition: "02/08/2026",
  dureeHeures: 14,
  modalite: "Présentiel",
  lieu: "Sur site — 10 avenue du Client, 69001 Lyon",
  effectifPrevu: 5,
  jours: [
    {
      date: "01/06/2026",
      heureDebut: "09:00",
      heureFin: "17:00",
      formateur: "",
      horairesConfirmes: true,
    },
    {
      date: "02/06/2026",
      heureDebut: "09:00",
      heureFin: "17:00",
      formateur: "Paul Remplaçant",
      horairesConfirmes: false,
    },
  ],
  rythme: "2 journées consécutives, du 01/06/2026 au 02/06/2026.",
  formateurPrincipal: "Jeanne Formatrice",
};

describe("OrganisationActionPdf — contenu", () => {
  const text = collectPdfTextNormalized(
    React.createElement(OrganisationActionPdf, { data: DATA, identite: IDENTITE }),
  );

  it("porte l'identification complète de l'action", () => {
    expect(text).toContain("IA appliquée — Acme (Lyon)");
    expect(text).toContain("AXI-SESS-2026-042");
    expect(text).toContain("14 heures");
    expect(text).toContain("Sur site — 10 avenue du Client, 69001 Lyon");
    expect(text).toContain("5 stagiaires");
  });

  it("rend le calendrier réel : dates, horaires, formateur du jour", () => {
    expect(text).toContain("01/06/2026");
    expect(text).toContain("09:00 – 17:00");
    // Jour sans formateur propre → repli sur le formateur principal.
    expect(text).toContain("Jeanne Formatrice");
    // Jour avec remplaçant → c'est LUI qui figure, pas le principal.
    expect(text).toContain("Paul Remplaçant");
  });

  it("marque les horaires non confirmés comme prévisionnels au lieu de les taire", () => {
    expect(text).toContain("Horaires prévisionnels");
  });

  it("porte le rythme et le suivi de l'exécution par demi-journée", () => {
    expect(text).toContain("2 journées consécutives");
    expect(text).toContain("demi-journée");
  });

  it("calendrier absent : la lacune est dite, la pièce reste opposable", () => {
    const t = collectPdfTextNormalized(
      React.createElement(OrganisationActionPdf, {
        data: { ...DATA, jours: [], rythme: "Du 01/06/2026 au 02/06/2026." },
        identite: IDENTITE,
      }),
    );
    expect(t).toContain("calendrier détaillé n'est pas encore arrêté");
    expect(t).not.toContain("Horaires prévisionnels");
  });

  it("référence l'art. R.6351-5 et renvoie le contenu pédagogique au programme", () => {
    expect(text).toContain("R.6351-5");
    expect(text).toContain("programme");
  });
});
