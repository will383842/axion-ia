// @vitest-environment node

/**
 * Convention bipartite v9 — le paragraphe de la garantie de remboursement de la Journée IA
 * (CGV art. 47.10) ne s'imprime que si `data.journeeIa === true` (photo de `Devis.journeeIa`).
 * Absent ou faux : le texte est celui de la v8, mot pour mot.
 */
import React from "react";
import { beforeAll, describe, expect, it } from "vitest";

import { collectPdfTextNormalized } from "@/server/qualiopi/documents/collect-pdf-text";
import type { OrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { TEXTE_GARANTIE_JOURNEE_IA } from "@/server/qualiopi/devis/assistant/textes-rubriques";
import { GARANTIE_PHRASE } from "@/content/journee-ia-commun";
import { GABARIT_VERSIONS } from "../gabarit-versions";
import { gabaritArchive } from "../archives";

import { ConventionPdf, type ConventionData } from "../convention";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const identite: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "XX00000000000",
  qualiopi: "",
  siret: "12345678900000",
  adresseSiege: "1 rue de la Formation, 75001 Paris",
  adresseExercice: "1 rue de la Formation, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://axion-ia.fr",
};

const base: ConventionData = {
  numero: "AXI-DOC-2026-920",
  estCopie: false,
  client: {
    raisonSociale: "ACME SAS",
    siret: "98765432100000",
    adresse: "10 avenue du Client, 69001 Lyon",
    contact: "Alice Martin",
  },
  intitule: "La Journée IA",
  objectifs: ["Identifier les tâches à automatiser"],
  publicVise: "Dirigeants",
  dureeHeures: 7,
  dateDebut: "15/01/2027",
  dateFin: "15/01/2027",
  modalite: "Présentiel",
  lieu: "Lyon",
  effectif: 4,
  prixHt: 1000,
  dateConvention: "25/11/2026",
};

const rendu = (
  data: ConventionData,
  Composant: React.ComponentType<never> = ConventionPdf as never,
) => collectPdfTextNormalized(React.createElement(Composant as never, { data, identite }));

describe("convention v9 — garantie de remboursement de la Journée IA", () => {
  it("la garantie est apparue en v9 (archivée) et reste dans la version courante (≥ 10)", () => {
    expect(GABARIT_VERSIONS.convention).toBeGreaterThanOrEqual(10);
    expect(gabaritArchive("convention", 8)).toBeDefined();
    expect(gabaritArchive("convention", 9)).toBeDefined();
  });

  it("⛔ texte imprimé verrouillé : si ceci rougit, la clause d'une convention signée changerait — monter la version du gabarit convention et archiver", () => {
    expect(TEXTE_GARANTIE_JOURNEE_IA).toBe(
      "Garantie de remboursement de la Journée IA (article 47.10 des conditions générales). Le rapport vous est remis sous 10 jours ouvrés après la journée. Si les gains identifiés dans votre rapport n’atteignent pas 3 fois le prix HT de la journée, vous êtes remboursé sur demande écrite. Condition : le décideur et les personnes prévues sont présents pendant l’audit. La demande se fait par écrit dans les 30 jours suivant la remise du rapport. La garantie s’applique une seule fois par entreprise et ne se cumule pas avec la déduction du prix de la journée prévue à l’article 47.7. Elle s’applique dans les conditions et limites de l’article 47.10 des conditions générales de vente.",
    );
  });

  it("journeeIa vrai : le paragraphe (constante partagée avec le devis) est imprimé", () => {
    const t = rendu({ ...base, journeeIa: true });
    expect(t).toContain("Garantie de remboursement de la Journée IA");
    expect(t).toContain("article 47.10");
    expect(t).toContain(GARANTIE_PHRASE.replace(/\s+/g, " ").slice(0, 60));
    expect(TEXTE_GARANTIE_JOURNEE_IA).toContain(GARANTIE_PHRASE);
  });

  it.each([
    ["absent", base],
    ["faux", { ...base, journeeIa: false }],
  ])("journeeIa %s : rien n'est imprimé", (_nom, data) => {
    const t = rendu(data as ConventionData);
    expect(t).not.toContain("Garantie de remboursement");
    expect(t).not.toContain("47.10");
  });

  it("la v8 archivée n'imprime jamais le paragraphe, même si le champ est présent", () => {
    const v8 = gabaritArchive("convention", 8);
    if (!v8) throw new Error("v8 absente");
    const t = rendu({ ...base, journeeIa: true }, v8 as never);
    expect(t).not.toContain("Garantie de remboursement");
  });
});
