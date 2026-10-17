// @vitest-environment node
/**
 * 🔴 QNC L02 — UNE PIÈCE D'ESSAI NE PREND AUCUN NUMÉRO LÉGAL, ET LE DIT SUR
 * CHAQUE PAGE.
 *
 * - le numéro d'essai (`AXI-<TYPE>-ESSAI-AAAA-XXXXXX`) n'appartient à AUCUNE
 *   série légale : `nextNumero` ne le lit jamais, et la suite légale reprend là
 *   où elle était, essai ou pas ;
 * - `generateDocument` donne à la pièce d'une session d'essai un numéro d'essai
 *   SANS lire la série, et enveloppe son rendu dans le contexte du filigrane ;
 * - `QualiopiPage` imprime « ESSAI » dès que le contexte le demande — un
 *   gabarit n'a rien à transmettre ;
 * - l'interrupteur `qualiopi.essai.actif`, éteint par défaut, ferme la création ;
 * - la liste blanche se lit et se saisit sans surprise.
 */

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({
  sessionEssai: true,
  findManySerie: vi.fn(),
  rendu: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => ({ estTestInterne: doubles.sessionEssai })),
    },
    documentGenere: {
      count: vi.fn(async () => 0),
      findMany: (...a: unknown[]) => doubles.findManySerie(...a),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
      create: (...a: unknown[]) => doubles.create(...a),
    },
    numeroEmis: { findMany: vi.fn(async () => []) },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: (...a: unknown[]) => doubles.rendu(...a),
  storeAndSignPdf: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn(async () => IDENTITE),
}));

import { generateDocument } from "@/server/qualiopi/documents/documents-service";
import { QualiopiPage } from "@/server/qualiopi/documents/base-layout";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { isValidDocumentNumber, parseSequence } from "@/server/qualiopi/numbering/formats";
import { estNumeroEssai, numeroEssai, anneeParis } from "@/server/qualiopi/essai/numerotation";
import { refusSessionDEssai, creationEssaiOuverte } from "@/server/qualiopi/essai/creation";
import {
  adressesDepuisValeur,
  analyserSaisieAdresses,
  destinatairesAutorises,
} from "@/server/qualiopi/essai/liste-blanche";
import {
  estFactureReelle,
  estInscriptionReelle,
  estSessionReelle,
} from "@/server/qualiopi/essai/perimetre";
import { etatDepuisValeur } from "@/server/qualiopi/socle/interrupteurs";

const IDENTITE = {
  raisonSociale: "Axion-IA SAS",
  nda: "84380000000",
  qualiopi: "Q-1",
  siret: "93800000000011",
  adresseSiege: "1 place de la République, 75003 Paris",
  adresseExercice: "1 place de la République",
  email: "contact@axion-ia.test",
  telephone: "0100000000",
  site: "https://axion-ia.test",
};

const SESSION = "5e000000-0000-4000-8000-0000000000e1";
/** Millésime de la série documentaire, tel que `generateDocument` le lit. */
const AN = new Date().getFullYear();

function Gabarit(props: { data: { numero: string } }): React.ReactElement {
  return React.createElement("DOCUMENT", null, props.data.numero);
}

beforeEach(() => {
  process.env["DATABASE_URL"] = "postgresql://essai@localhost:5432/essai";
  doubles.sessionEssai = true;
  doubles.findManySerie.mockReset().mockResolvedValue([{ numero: `AXI-DOC-${AN}-007` }]);
  doubles.rendu.mockReset().mockResolvedValue({
    buffer: Buffer.from("%PDF-"),
    hashSha256: "a".repeat(64),
    sizeBytes: 5,
  });
  doubles.create.mockReset().mockImplementation(async (args: { data: { numero: string } }) => ({
    id: "doc-1",
    numero: args.data.numero,
    pdfUrl: null,
    hashSha256: "a".repeat(64),
  }));
});

describe("le numéro d'essai est hors de toute série légale", () => {
  const n = numeroEssai("facture", new Date("2026-12-31T23:30:00.000Z"), () => "3F9A0C");

  it("forme `AXI-FACT-ESSAI-<année de Paris>-XXXXXX` (31/12 23 h 30 UTC = 2027 à Paris)", () => {
    expect(n).toBe("AXI-FACT-ESSAI-2027-3F9A0C");
    expect(anneeParis(new Date("2026-12-31T22:30:00.000Z"))).toBe(2026);
    expect(estNumeroEssai(n)).toBe(true);
    expect(estNumeroEssai("AXI-FACT-2027-001")).toBe(false);
    expect(n.length).toBeLessThanOrEqual(40);
  });

  it("🔴 ce n'est pas une pièce officielle, et aucune série légale ne le lit", () => {
    expect(isValidDocumentNumber(n)).toBe(false);
    expect(parseSequence(n, "AXI-FACT-2027-")).toBeNull();
  });

  it("🔴 la suite légale continue là où elle était : les numéros d'essai n'y laissent ni trou ni saut", async () => {
    const suivant = await nextNumero("facture", 2027, async () => [
      { numero: "AXI-FACT-2027-003" },
      { numero: "AXI-FACT-ESSAI-2027-999999" },
      { numero: "AXI-FACT-ESSAI-2027-000004" },
    ]);
    expect(suivant).toBe("AXI-FACT-2027-004");
  });

  it("le plus long des numéros d'essai tient dans les colonnes `numero` (VarChar 40)", () => {
    for (const type of ["autofacture", "attestation", "certificat", "session", "avoir"] as const) {
      expect(numeroEssai(type).length).toBeLessThanOrEqual(40);
    }
  });
});

describe("generateDocument — pièce d'une session d'essai", () => {
  it("🔴 numéro d'essai, sans même lire la série documentaire", async () => {
    const r = await generateDocument({
      type: "convocation",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: SESSION },
    });
    expect(estNumeroEssai(r.numero)).toBe(true);
    expect(r.numero.startsWith("AXI-DOC-ESSAI-")).toBe(true);
    expect(doubles.findManySerie).not.toHaveBeenCalled();
  });

  it("🔴 le gabarit reçoit ce numéro d'essai — c'est lui qui fait poser le filigrane", async () => {
    await generateDocument({
      type: "convocation",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: SESSION },
    });
    const rendu = doubles.rendu.mock.calls[0]![0] as React.ReactElement<{
      data: { numero: string };
    }>;
    expect(estNumeroEssai(rendu.props.data.numero)).toBe(true);
  });

  it("témoin — une session réelle prend le numéro suivant de la série, sans filigrane", async () => {
    doubles.sessionEssai = false;
    const r = await generateDocument({
      type: "convocation",
      buildElement: (numero) => React.createElement(Gabarit, { data: { numero } }),
      refs: { sessionId: SESSION },
    });
    expect(r.numero).toBe(`AXI-DOC-${AN}-008`);
  });
});

describe("QualiopiPage — le filigrane ESSAI sur chaque page", () => {
  /**
   * La marque est le NUMÉRO : aucun gabarit n'a de drapeau à transmettre, et
   * la copie signée ou la réimpression d'une pièce d'essai, qui rejouent ce
   * numéro, gardent le filigrane. (Un contexte React est exclu : la version
   * serveur de React, celle des composants serveur, n'a pas `createContext`.)
   */
  type Noeud = React.ReactElement<{ children?: React.ReactNode; fixed?: boolean }>;

  /** Les nœuds `Text` de la page, rendue comme les specs de gabarits la rendent. */
  function textes(docNumber: string): Array<{ texte: string; fixed: boolean }> {
    const out: Array<{ texte: string; fixed: boolean }> = [];
    const visiter = (n: React.ReactNode): void => {
      if (Array.isArray(n)) return n.forEach(visiter);
      if (!React.isValidElement(n)) return;
      const e = n as Noeud;
      const enfants = e.props.children;
      if (typeof enfants === "string") out.push({ texte: enfants, fixed: e.props.fixed === true });
      else visiter(enfants);
    };
    visiter(
      QualiopiPage({ docTitle: "Convocation", docNumber, identite: IDENTITE, children: "x" }),
    );
    return out;
  }

  it("🔴 une pièce numérotée `-ESSAI-` porte le filigrane ESSAI, RÉPÉTÉ sur chaque page", () => {
    for (const numero of ["AXI-DOC-ESSAI-2026-0D0D0D", "EVA-ESSAI-0a0b0c0d"]) {
      const t = textes(numero);
      expect(t, numero).toContainEqual({ texte: "ESSAI", fixed: true });
      expect(
        t.map((x) => x.texte),
        numero,
      ).toContain("ESSAI — pièce sans valeur");
    }
  });

  it("témoin — une pièce au numéro légal ne porte aucune mention d'essai", () => {
    const t = textes("AXI-DOC-2026-008").map((x) => x.texte);
    expect(t.some((x) => x.includes("ESSAI"))).toBe(false);
  });
});

describe("l'interrupteur `qualiopi.essai.actif` gouverne la création", () => {
  it("🔴 clé absente = éteint = aucune session d'essai", () => {
    const etat = etatDepuisValeur(undefined);
    expect(creationEssaiOuverte(etat)).toBe(false);
    expect(refusSessionDEssai({ etat, devisId: null, recurrence: null })).toMatch(/éteint/);
  });

  it("`essai` ou `actif` ouvrent la création d'une session d'essai seule", () => {
    for (const etat of ["essai", "actif"] as const) {
      expect(refusSessionDEssai({ etat, devisId: null, recurrence: null })).toBeNull();
    }
  });

  it("un essai ne se rattache à aucun devis réel et ne se crée pas en série", () => {
    expect(refusSessionDEssai({ etat: "actif", devisId: "d", recurrence: null })).toMatch(/devis/);
    expect(refusSessionDEssai({ etat: "actif", devisId: null, recurrence: 3 })).toMatch(/série/);
  });
});

describe("ce qui est réel, ce qui ne l'est pas", () => {
  it("une inscription est d'essai si ELLE ou SA SESSION l'est", () => {
    expect(
      estInscriptionReelle({ estTestInterne: false, session: { estTestInterne: false } }),
    ).toBe(true);
    expect(estInscriptionReelle({ estTestInterne: false, session: { estTestInterne: true } })).toBe(
      false,
    );
    expect(estInscriptionReelle({ estTestInterne: true, session: { estTestInterne: false } })).toBe(
      false,
    );
    expect(estSessionReelle(null)).toBe(true);
  });

  it("une facture est d'essai par sa session, son inscription OU son numéro (avoir sans session)", () => {
    expect(estFactureReelle({ numero: "AXI-FACT-2026-001", session: null })).toBe(true);
    expect(estFactureReelle({ numero: "AXI-AVO-ESSAI-2026-0A0A0A", session: null })).toBe(false);
    expect(
      estFactureReelle({ numero: "AXI-FACT-2026-001", session: { estTestInterne: true } }),
    ).toBe(false);
  });
});

describe("la liste blanche des adresses d'essai", () => {
  it("une valeur absente ou mal formée donne une liste VIDE (tout est bloqué)", () => {
    for (const v of [undefined, null, "x", [], {}, { adresses: "a@b.fr" }]) {
      expect(adressesDepuisValeur(v)).toEqual([]);
    }
    expect(adressesDepuisValeur({ adresses: [" A@B.fr ", 3, "pas-une-adresse"] })).toEqual([
      "a@b.fr",
    ]);
  });

  it("tous les destinataires doivent y être ; aucun destinataire = refus", () => {
    expect(destinatairesAutorises(["A@b.fr"], ["a@b.fr"])).toBe(true);
    expect(destinatairesAutorises(["a@b.fr", "c@d.fr"], ["a@b.fr"])).toBe(false);
    expect(destinatairesAutorises([], ["a@b.fr"])).toBe(false);
  });

  it("la saisie refuse une adresse invalide et dédoublonne", () => {
    expect(analyserSaisieAdresses("a@b.fr\nA@B.fr; c@d.fr")).toEqual(["a@b.fr", "c@d.fr"]);
    expect(() => analyserSaisieAdresses("a@b.fr, nimporte")).toThrow(/invalide/);
  });
});
