// @vitest-environment node

/**
 * Programme, convocation, attestation, attestation partielle, certificat de réalisation :
 * v2 (charte 2027) = MÊME TEXTE que la v1 archivée, seule la mise en page change.
 *
 * Le texte de chaque pièce est extrait de l'arbre du document (`collectPdfText`) ; l'en-tête et
 * le pied propres à chaque page (`QualiopiPage` pour la v1, `PageCharte` pour la v2) en sont
 * retirés, puis les deux textes sont comparés ESPACES IGNORÉS. Les en-têtes diffèrent par
 * construction : l'adresse et les identifiants passent dans le pied, aucune mention n'est perdue
 * (contrôlé séparément ci-dessous).
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfText } from "../../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { QualiopiPage } from "../../base-layout";
import { PageCharte } from "../../charte/v1";
import { gabaritArchiveFormation } from "../archives";
import { GABARIT_VERSIONS_FORMATION, type TypeGabaritFormation } from "../gabarit-versions";
import { ProgrammeFormationPdf } from "../programme-formation";
import { ConvocationPdf } from "../convocation";
import { AttestationPdf } from "../attestation";
import { AttestationPartiellePdf } from "../attestation-partielle";
import { CertificatRealisationPdf } from "../certificat-realisation";
import { CAS_DOCUMENTS, IDENTITE } from "./fixtures-documents-formation";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const COURANTS: Record<TypeGabaritFormation, React.ComponentType<never>> = {
  programme: ProgrammeFormationPdf as unknown as React.ComponentType<never>,
  convocation: ConvocationPdf as unknown as React.ComponentType<never>,
  attestation: AttestationPdf as unknown as React.ComponentType<never>,
  attestation_partielle: AttestationPartiellePdf as unknown as React.ComponentType<never>,
  certificat: CertificatRealisationPdf as unknown as React.ComponentType<never>,
};

/** Espaces ignorés ; la puce « • » (décor : la v2 la dessine, elle n'est plus un caractère) aussi. */
const sansEspace = (t: string) => t.replace(/[\s•]+/g, "");

const MARQUEUR = "§§CORPS§§";

const TITRES = [
  "Programme de l'action de formation",
  "Convocation à la formation",
  "Attestation de fin de formation",
  "Attestation de fin de formation — aucune heure suivie",
  "Attestation partielle de formation",
  "Certificat de réalisation",
];

/**
 * Texte de la pièce SANS l'en-tête et le pied propres à la page (`QualiopiPage` en v1,
 * `PageCharte` en v2) : on les mesure en rendant la page avec un marqueur pour corps, puis on
 * retire le texte d'avant le marqueur (en-tête) et d'après (pied).
 */
function texteCorps(doc: React.ReactElement, Page: React.ComponentType<never>, numero: string) {
  let texte = collectPdfText(doc);
  // La v1 des attestations et du certificat passait « N° … » dans le numéro lui-même.
  for (const [titre, num] of TITRES.flatMap((t) => [numero, `N° ${numero}`].map((n) => [t, n]))) {
    const page = collectPdfText(
      React.createElement(
        Page as unknown as React.ComponentType<Record<string, unknown>>,
        {
          docTitle: titre,
          docNumber: num,
          identite: IDENTITE,
        },
        MARQUEUR,
      ),
    );
    const [entete = "", pied = ""] = page.split(MARQUEUR);
    if (entete.trim() !== "" && texte.startsWith(entete)) {
      texte = texte.slice(entete.length);
      if (pied.trim() !== "" && texte.endsWith(pied)) texte = texte.slice(0, -pied.length);
      return texte;
    }
  }
  throw new Error("en-tête de page introuvable dans le texte de la pièce");
}

const numeroDe = (el: React.ReactElement): string =>
  (el.props as { data: { numero: string } }).data.numero;

describe("v2 (charte 2027) : le texte est celui de la v1 archivée, à l'espace près", () => {
  for (const cas of CAS_DOCUMENTS) {
    it(cas.nom, () => {
      const v1 = cas.rendre(gabaritArchiveFormation(cas.gabarit, 1) as never);
      const v2 = cas.rendre(COURANTS[cas.gabarit]);
      const numero = numeroDe(v2);
      const t1 = sansEspace(texteCorps(v1, QualiopiPage as never, numero));
      const t2 = sansEspace(texteCorps(v2, PageCharte as never, numero));
      expect(t1.length).toBeGreaterThan(200);
      expect(t2).toBe(t1);
    });
  }
});

describe("v2 : aucune mention perdue dans l'en-tête allégé", () => {
  it("l'adresse, le SIRET et le NDA restent imprimés sur chaque pièce", () => {
    for (const cas of CAS_DOCUMENTS) {
      const t = sansEspace(collectPdfText(cas.rendre(COURANTS[cas.gabarit])));
      for (const v of [IDENTITE.adresseSiege, IDENTITE.siret, IDENTITE.nda]) {
        expect(t, `${cas.nom} : ${v}`).toContain(sansEspace(v));
      }
    }
  });
});

describe("v2 : interdits", () => {
  const MOTS = [
    /\bOPCO\b/i,
    /financement/i,
    /prise en charge/i,
    /Claude|ChatGPT|GPT|Copilot|Gemini|Mistral/i,
  ];

  it("n'ajoute aucune mention de certification, d'OPCO, de financement ni de logiciel d'IA", () => {
    for (const cas of CAS_DOCUMENTS) {
      const t1 = collectPdfText(cas.rendre(gabaritArchiveFormation(cas.gabarit, 1) as never));
      const t2 = collectPdfText(cas.rendre(COURANTS[cas.gabarit]));
      for (const m of MOTS) {
        const n1 = (t1.match(new RegExp(m.source, "gi")) ?? []).length;
        const n2 = (t2.match(new RegExp(m.source, "gi")) ?? []).length;
        expect(n2, `${cas.nom} : ${m}`).toBeLessThanOrEqual(n1);
      }
      const q1 = (t1.match(/Qualiopi/g) ?? []).length;
      expect((t2.match(/Qualiopi/g) ?? []).length, `${cas.nom} : Qualiopi`).toBeLessThanOrEqual(q1);
    }
  });
});

describe("v2 : pièces d'essai, copie, spécimen et pages", () => {
  it("rend un PDF de 1 à 4 pages pour chaque cas, jamais plus de v1 + 1", async () => {
    for (const cas of CAS_DOCUMENTS) {
      const pages = async (C: React.ComponentType<never>) => {
        const b = await renderToBuffer(cas.rendre(C));
        return (b.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      };
      const p1 = await pages(gabaritArchiveFormation(cas.gabarit, 1) as never);
      const p2 = await pages(COURANTS[cas.gabarit]);
      expect(p2, cas.nom).toBeGreaterThanOrEqual(1);
      expect(p2, cas.nom).toBeLessThanOrEqual(p1 + 1);
      expect(p2, cas.nom).toBeLessThanOrEqual(4);
    }
  }, 120_000);

  it("COPIE et SPÉCIMEN sont posés par la page de la charte", () => {
    const rendu = (props: Record<string, unknown>) =>
      collectPdfText(
        React.createElement(
          PageCharte as never,
          {
            docTitle: "Test",
            docNumber: "AXI-DOC-2026-001",
            identite: IDENTITE,
            ...props,
          },
          null,
        ),
      );
    expect(rendu({ estCopie: true })).toContain("COPIE");
    expect(rendu({ estSpecimen: true })).toContain("SPÉCIMEN");
    expect(rendu({ docNumber: "AXI-ESSAI-2026-001" })).toContain("ESSAI");
  });
});

describe("registre des versions", () => {
  it("v2 courante, v1 archivée pour chacun des cinq gabarits", () => {
    for (const [type, version] of Object.entries(GABARIT_VERSIONS_FORMATION)) {
      expect(version, type).toBe(2);
      expect(gabaritArchiveFormation(type as TypeGabaritFormation, 1), type).not.toBeNull();
      expect(gabaritArchiveFormation(type as TypeGabaritFormation, 2), type).toBeNull();
    }
  });

  it("aucun des cinq n'entre dans la table des pièces SIGNABLES", async () => {
    const { GABARIT_VERSIONS } = await import("../gabarit-versions");
    for (const type of Object.keys(GABARIT_VERSIONS_FORMATION)) {
      expect(Object.keys(GABARIT_VERSIONS), type).not.toContain(type);
    }
  });
});
