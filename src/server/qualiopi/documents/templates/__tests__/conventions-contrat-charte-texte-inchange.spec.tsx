// @vitest-environment node

/**
 * Convention (v7), convention tripartite (v7) et contrat de formation (v3) au style de la
 * charte 2027 : SEULE la mise en page change. Ce fichier compare chaque nouvelle version à
 * l'ancienne, archivée (`archives/*.v6.tsx`, `archives/contrat-formation.v2.tsx`) :
 *
 *  - le texte du CORPS de la pièce (mentions légales, clauses, intitulés, montants) est
 *    identique, à l'espace près et dans le même ordre ;
 *  - la zone de signature est la dernière du corps, avec les mêmes parties et le même texte ;
 *  - les taux décimaux s'écrivent à la française (seule différence de texte voulue) ;
 *  - aucune mention de certification, d'OPCO, de financement ni de logiciel d'IA n'est ajoutée ;
 *  - le rendu PDF aboutit, sans dépasser l'ancien de plus d'une page.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import type { OrganismeIdentite } from "../../organisme";
import { ConventionPdf } from "../convention";
import { ConventionTripartitePdf } from "../convention-tripartite";
import { ContratFormationPdf } from "../contrat-formation";
import { ConventionPdf as ConventionV6 } from "../archives/convention.v6";
import { ConventionTripartitePdf as TripartiteV6 } from "../archives/convention-tripartite.v6";
import { ContratFormationPdf as ContratV2 } from "../archives/contrat-formation.v2";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};
const IDENTITE_SANS_NDA: OrganismeIdentite = { ...IDENTITE, nda: "", mentionTvaRegime: null };
const IDENTITE_TVA = {
  ...IDENTITE,
  mentionTvaRegime: "TVA non applicable, article 293 B du CGI.",
} as OrganismeIdentite;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Donnees = any;

const CONVENTION: Donnees = {
  numero: "AXI-DOC-2026-060",
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client, 42000 Saint-Étienne",
    contact: "Gérante",
  },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien", "Automatiser des tâches"],
  publicVise: "Dirigeants et collaborateurs",
  dureeHeures: 7,
  dateDebut: "15/11/2026",
  dateFin: "15/11/2026",
  modalite: "Présentiel",
  lieu: "Saint-Étienne",
  effectif: 2,
  prixHt: 1400,
  acomptePercent: 30,
  dateConvention: "05/11/2026",
};
const CLAUSE_OPCO = {
  opco: "OPCO Atlas",
  dateLimite: "30/11/2026",
  seuil: { type: "pourcentage", bps: 5000 },
};
const TRIPARTITE: Donnees = {
  ...CONVENTION,
  numero: "AXI-DOC-2026-061",
  opco: {
    nom: "OPCO Atlas",
    numeroPriseEnCharge: "ATLAS-123",
    adresse: "3 rue des Fonds",
    contact: "gestion@atlas.example",
  },
  montantPrisEnCharge: 1000,
  resteAChargeClient: 400,
};
const CONTRAT: Donnees = {
  numero: "AXI-DOC-2026-062",
  stagiaire: {
    nomPrenom: "Camille Durand",
    email: "camille@example.fr",
    adresse: "4 impasse des Lilas",
  },
  intitule: "IA pour l'immobilier",
  objectifs: ["Utiliser l'IA générative au quotidien", "Rédiger avec l'IA"],
  dureeHeures: 14,
  dateDebut: "01/12/2026",
  dateFin: "02/12/2026",
  modalite: "Distanciel",
  lieu: "Distanciel",
  prixNet: 1490,
  dateContrat: "05/11/2026",
};

interface Cas {
  readonly nom: string;
  readonly Nouveau: (p: { data: Donnees; identite: OrganismeIdentite }) => React.ReactElement;
  readonly Ancien: (p: { data: Donnees; identite: OrganismeIdentite }) => React.ReactElement;
  readonly data: Donnees;
  readonly identite: OrganismeIdentite;
  /** Dernier intitulé de section (la zone de signature) du corps. */
  readonly signature: string;
}

const CAS: readonly Cas[] = [
  {
    nom: "convention",
    Nouveau: ConventionPdf,
    Ancien: ConventionV6,
    // v8 : clause financeur, 5 bis et ligne Qualiopi seulement si la certification est obtenue.
    data: { ...CONVENTION, certificationObtenue: true },
    identite: IDENTITE,
    signature: "11. Signatures",
  },
  {
    nom: "convention, effectifs nommés, écart, sans acompte, condition suspensive OPCO",
    Nouveau: ConventionPdf,
    Ancien: ConventionV6,
    data: {
      ...CONVENTION,
      certificationObtenue: true,
      acomptePercent: 0,
      stagiairesNommes: ["Camille Durand", "Alex Martin"],
      ecartEffectif: "3 inscrits pour 2 places prévues.",
      moyensPedagogiques: "Ateliers pratiques.",
      conditionSuspensiveOpco: CLAUSE_OPCO,
    },
    identite: IDENTITE_SANS_NDA,
    signature: "11. Signatures",
  },
  {
    nom: "convention, régime de TVA et numéro Qualiopi saisis",
    Nouveau: ConventionPdf,
    Ancien: ConventionV6,
    // v8 : clause financeur, 5 bis et ligne Qualiopi seulement si la certification est obtenue.
    data: { ...CONVENTION, certificationObtenue: true },
    identite: { ...IDENTITE_TVA, qualiopi: "FR-2026-001" },
    signature: "11. Signatures",
  },
  {
    nom: "convention tripartite",
    Nouveau: ConventionTripartitePdf,
    Ancien: TripartiteV6,
    data: TRIPARTITE,
    identite: IDENTITE,
    signature: "11. Signatures",
  },
  {
    nom: "convention tripartite avec condition suspensive OPCO",
    Nouveau: ConventionTripartitePdf,
    Ancien: TripartiteV6,
    data: { ...TRIPARTITE, conditionSuspensiveOpco: CLAUSE_OPCO, montantPrisEnCharge: null },
    identite: IDENTITE_SANS_NDA,
    signature: "11. Signatures",
  },
  {
    nom: "contrat de formation",
    Nouveau: ContratFormationPdf,
    Ancien: ContratV2,
    data: CONTRAT,
    identite: IDENTITE,
    signature: "7. Signatures",
  },
  {
    nom: "contrat de formation avec médiation, acompte et échéancier",
    Nouveau: ContratFormationPdf,
    Ancien: ContratV2,
    data: {
      ...CONTRAT,
      acomptePercent: 20,
      mediation: { nom: "Médiateur Exemple", url: "https://mediation.example" },
      echeancierSolde: [
        { libelle: "1re échéance", montantEuros: 600, dueLeLisible: "15/12/2026" },
        { libelle: "2e échéance", montantEuros: 592, dueLeLisible: null },
      ],
    },
    identite: IDENTITE_TVA,
    signature: "8. Signatures",
  },
];

/** Texte du CORPS d'une pièce : les enfants de la page, hors en-tête et pied de page. */
function corps(
  Composant: (p: { data: Donnees; identite: OrganismeIdentite }) => React.ReactElement,
  data: Donnees,
  identite: OrganismeIdentite,
): string {
  const document = Composant({ data, identite });
  const page = React.Children.toArray(
    (document.props as { children: React.ReactNode }).children,
  )[0] as React.ReactElement<{ children: React.ReactNode }>;
  return neutraliserAnnulation(collectPdfTextNormalized(page.props.children));
}

/**
 * 26/11/2026 — la section « 4. Conditions d'annulation » a changé de FOND (l'acompte versé reste
 * acquis, sans condition de délai : convention v10, tripartite v8). Elle est exclue de la
 * comparaison avec l'ancienne version ; son texte est verrouillé plus bas.
 */
function neutraliserAnnulation(texte: string): string {
  return texte.replace(/4\. Conditions d'annulation.*?(?=5\. [A-ZÉ])/su, "");
}

/** Section 4 du texte NON neutralisé, pour en verrouiller le contenu. */
function sectionAnnulation(
  Composant: (p: { data: Donnees; identite: OrganismeIdentite }) => React.ReactElement,
  data: Donnees,
  identite: OrganismeIdentite,
): string {
  const document = Composant({ data, identite });
  const page = React.Children.toArray(
    (document.props as { children: React.ReactNode }).children,
  )[0] as React.ReactElement<{ children: React.ReactNode }>;
  const texte = collectPdfTextNormalized(page.props.children);
  return /4\. Conditions d'annulation.*?(?=5\. [A-ZÉ])/su.exec(texte)?.[0] ?? "";
}

describe("conventions et contrat — le texte du corps ne change pas d'un caractère", () => {
  for (const cas of CAS) {
    it(`${cas.nom} : corps identique à l'ancienne version`, () => {
      const nouveau = corps(cas.Nouveau, cas.data, cas.identite);
      const ancien = corps(cas.Ancien, cas.data, cas.identite);
      expect(ancien.length).toBeGreaterThan(1500);
      expect(nouveau).toBe(ancien);
    });

    it(`${cas.nom} : la signature reste en dernier, avec les mêmes parties`, () => {
      const nouveau = corps(cas.Nouveau, cas.data, cas.identite);
      const ancien = corps(cas.Ancien, cas.data, cas.identite);
      const fin = (t: string) => t.slice(t.lastIndexOf(cas.signature));
      expect(nouveau.includes(cas.signature)).toBe(true);
      expect(fin(nouveau)).toBe(fin(ancien));
      expect(fin(nouveau)).toContain("Pour l'organisme de formation");
      // Aucune section n'est numérotée APRÈS la signature.
      expect(fin(nouveau).slice(cas.signature.length)).not.toMatch(/\d\. [A-ZÉ]/);
    });

    it(`${cas.nom} : aucun mot nouveau (certification, OPCO, financement, logiciel d'IA)`, () => {
      const mots = (t: string) => new Set(t.toLowerCase().match(/[\p{L}\d'-]+/gu) ?? []);
      const ancien = mots(corps(cas.Ancien, cas.data, cas.identite));
      const ajoutes = [...mots(corps(cas.Nouveau, cas.data, cas.identite))].filter(
        (m) => !ancien.has(m),
      );
      expect(ajoutes).toEqual([]);
    });
  }
});

describe("section 4 : l'acompte versé reste acquis, sans condition de délai", () => {
  const pieces = [
    ["convention", ConventionPdf, CONVENTION],
    ["convention tripartite", ConventionTripartitePdf, TRIPARTITE],
  ] as const;
  for (const [nom, Composant, data] of pieces) {
    it(`${nom} : l'acompte est acquis, le barème au-delà est gardé, la TVA n'est pas exonérée`, () => {
      const s = sectionAnnulation(Composant as never, data, IDENTITE).replace(/\s+/g, " ");
      expect(s).toContain("reste acquis à l'organisme, quel que soit le délai d'annulation");
      expect(s).toContain("aucune somme en plus de l'acompte versé");
      expect(s).toContain("entre 8 et 15 jours ouvrés avant le début : 50 % du prix HT");
      expect(s).toContain("à moins de 8 jours ouvrés avant le début : 100 % du prix HT");
      expect(s).toContain("n'est jamais inférieure au montant hors taxes de l'acompte versé");
      expect(s).toContain("article 1231-5 du Code civil");
      expect(s).toContain("L.6354-1");
      expect(s).toContain("sans exonération");
      expect(s).not.toMatch(/ : 0 %/);
      expect(s).not.toMatch(/acompte[^.]{0,40}(est|sera|sont) rembours/i);
    });
  }
  it("convention : l'opérateur de compétences n'est cité qu'une fois la certification obtenue", () => {
    const avant = sectionAnnulation(ConventionPdf as never, CONVENTION, IDENTITE);
    const apres = sectionAnnulation(
      ConventionPdf as never,
      { ...CONVENTION, certificationObtenue: true },
      IDENTITE,
    );
    expect(avant).not.toMatch(/opérateur de compétences/i);
    expect(apres).toMatch(/opérateur de compétences/i);
  });
});

describe("taux à la française", () => {
  // L'extracteur sépare les nœuds de texte par une espace : « ( 12,5 %) ».
  const net = (t: string) => t.replace("( ", "(");

  it("convention : un acompte de 12,5 % s'écrit avec une virgule ; un entier est inchangé", () => {
    const data = { ...CONVENTION, acomptePercent: 12.5 };
    expect(net(corps(ConventionPdf, data, IDENTITE))).toContain("Acompte à la signature (12,5 %)");
    expect(corps(ConventionPdf, data, IDENTITE)).not.toContain("12.5");
    expect(net(corps(ConventionPdf, CONVENTION, IDENTITE))).toContain(
      "Acompte à la signature (30 %)",
    );
  });

  it("contrat : même règle", () => {
    const data = { ...CONTRAT, acomptePercent: 12.5 };
    expect(net(corps(ContratFormationPdf, data, IDENTITE))).toContain("(12,5 % maximum)");
    expect(corps(ContratFormationPdf, data, IDENTITE)).not.toContain("12.5");
  });
});

describe("rendu PDF", () => {
  const pages = (buf: Buffer) =>
    (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  for (const cas of CAS) {
    it(`${cas.nom} : se rend, et pas plus d'une page de plus que l'ancienne version`, async () => {
      const nouveau = pages(
        await renderToBuffer(<cas.Nouveau data={cas.data} identite={cas.identite} />),
      );
      const ancien = pages(
        await renderToBuffer(<cas.Ancien data={cas.data} identite={cas.identite} />),
      );
      expect(nouveau).toBeGreaterThan(0);
      expect(nouveau).toBeLessThanOrEqual(ancien + 1);
    }, 60_000);
  }
});
