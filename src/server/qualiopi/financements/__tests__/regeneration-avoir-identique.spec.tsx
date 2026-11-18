// @vitest-environment node

/**
 * 🔴 Audit argent — un AVOIR régénéré reste un AVOIR, identique à l'émission.
 *
 * Défaut : `genererPdfFactureFormation` rendait un avoir comme une facture (titre « Facture »,
 * ni « Avoir sur facture … » ni motif, échéance J+30, `estPersonnePhysique` calculé, type
 * `facture`, `refs: {}`, taux de TVA relu dans la configuration actuelle).
 *
 * Parcours réel : vrai `genererAvoirFacture` (émission) puis vrai `genererPdfFactureFormation`
 * (régénération) → vrai `generateDocument` → vrai rendu PDF. Seuls la base, le stockage, la
 * numérotation et l'horloge sont simulés.
 */

import { createHash } from "node:crypto";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const m = {
    facture: vi.fn(),
    origineFacture: vi.fn(),
    docParId: vi.fn(),
    docAvoirAncien: vi.fn(),
    cree: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: "doc-neuf", ...a.data })),
    avoirCree: vi.fn(async (a: { data: Record<string, unknown> }) => ({
      id: "avoir-1",
      numero: a.data["numero"] as string,
    })),
    majFacture: vi.fn(async () => ({})),
    pdfs: [] as Buffer[],
  };
  const prisma = {
    factureFormation: {
      findUnique: (...a: unknown[]) => m.facture(...a),
      findUniqueOrThrow: (...a: unknown[]) => m.origineFacture(...a),
      aggregate: vi.fn(async () => ({ _sum: { montantHtCents: 0 } })),
      findMany: vi.fn(async () => []),
      create: (a: { data: Record<string, unknown> }) => m.avoirCree(a),
      update: (...a: unknown[]) => (m.majFacture as (...x: unknown[]) => unknown)(...a),
    },
    trainingSession: { findUnique: vi.fn(async () => null) },
    documentGenere: {
      findUnique: (...a: unknown[]) => m.docParId(...a),
      findFirst: vi.fn((...a: unknown[]) => m.docAvoirAncien(...a)),
      create: (a: { data: Record<string, unknown> }) => m.cree(a),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  };
  return { m, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/render", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/server/qualiopi/documents/render")>();
  return {
    ...reel,
    renderPdfToBuffer: async (el: React.ReactElement) => {
      const r = await reel.renderPdfToBuffer(el);
      h.m.pdfs.push(r.buffer);
      return r;
    },
  };
});
vi.mock("@/server/qualiopi/numbering/allocate", () => ({
  nextNumero: vi.fn(async (type: string) =>
    type === "avoir" ? "AXI-AVO-2026-007" : "AXI-DOC-2026-0100",
  ),
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(async () => 20),
}));
vi.mock("@/lib/legal-identity", () => ({ resolveRibFacture: vi.fn(async () => null) }));
vi.mock("@/server/qualiopi/documents/conformite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/documents/conformite")>()),
  assertOrganismeComplet: vi.fn(),
}));
vi.mock("@/server/partners-sync/producteurs/facturation", () => ({
  transactionFaitFacturation: vi.fn(async (p: unknown, fn: (tx: unknown) => unknown) => fn(p)),
  emettreFaitFacture: vi.fn(async () => undefined),
  emettreFaitPaiement: vi.fn(async () => undefined),
}));
vi.mock("@/server/qualiopi/documents/organisme", async () => {
  const { IDENTITE_FACTURE } =
    await import("../../documents/templates/__tests__/facture-cas.spec-util");
  return { getOrganismeIdentite: vi.fn(async () => IDENTITE_FACTURE) };
});

import { registerPdfTestFontsFallback } from "../../documents/register-pdf-test-fonts";
import { FacturePdf } from "../../documents/templates/facture";
import { computeTotauxFacture } from "../../legal/tva";
import { genererAvoirFacture } from "../facture-libre";
import { genererPdfFactureFormation } from "../facture-formation-emission";

beforeAll(() => {
  registerPdfTestFontsFallback();
  vi.useFakeTimers({ toFake: ["Date"] });
});
beforeEach(() => {
  vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
  for (const f of [
    h.m.facture,
    h.m.origineFacture,
    h.m.docParId,
    h.m.docAvoirAncien,
    h.m.cree,
    h.m.avoirCree,
    h.m.majFacture,
    h.prisma.documentGenere.findFirst,
  ]) {
    f.mockClear();
  }
  h.m.docParId.mockReset();
  h.m.docAvoirAncien.mockReset();
  h.m.pdfs.length = 0;
});
afterAll(() => {
  vi.useRealTimers();
});

const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const EMISE = new Date("2026-11-05T10:00:00Z");
const MOTIF = "Erreur de facturation — séance annulée";

function origineFacture(over: Record<string, unknown> = {}) {
  return {
    id: "fac-origine",
    numero: "AXI-FACT-2026-014",
    statut: "emise",
    avoirDeId: null,
    activite: null,
    clientId: "client-1",
    refClient: "PO-42",
    destinataire: "client",
    destinataireNom: "SCI Invest Sun",
    destinataireSiret: "98765432100011",
    destinataireTvaIntracom: null,
    destinataireAdresse: "10 avenue du Client, 75008 Paris",
    montantHtCents: 280000,
    regimeTva: "assujetti",
    lignes: [
      { designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 200000 },
      { designation: "Support", quantite: 2, prixUnitaireHtCents: 40000 },
    ],
    ...over,
  };
}

type Capture = { metadata: { renderData: Record<string, unknown> } };

/** Émission réelle d'un avoir ; rend la ligne telle que la base la porterait + l'instantané. */
async function emettre(
  over: Record<string, unknown> = {},
  input: { montantPartielHtCents?: number } = {},
) {
  h.m.origineFacture.mockResolvedValue(origineFacture(over));
  const r = await genererAvoirFacture({
    factureId: "fac-origine",
    motif: MOTIF,
    ...input,
  } as never);
  const ligneCreee = h.m.avoirCree.mock.calls.at(-1)![0].data as LigneCreee;
  const doc = h.m.cree.mock.calls.at(-1)![0].data as unknown as Capture;
  return {
    r,
    ligneCreee,
    renderData: doc.metadata.renderData as { data: Record<string, unknown> },
    metadata: doc.metadata,
    pdf: h.m.pdfs.at(-1)!,
  };
}

type LigneCreee = Record<string, unknown> & {
  montantHtCents: number;
  montantTvaCents: number;
  montantTtcCents: number;
  lignes: unknown;
};

function ligneAvoirEnBase(ligneCreee: LigneCreee, over: Record<string, unknown> = {}) {
  return {
    id: "avoir-1",
    ...ligneCreee,
    documentId: "doc-neuf",
    echeanceAt: null,
    emiseAt: EMISE,
    sessionId: null,
    subrogation: false,
    numeroDossierOpco: null,
    avoirDe: { numero: "AXI-FACT-2026-014" },
    ...over,
  };
}

async function regenerer(ligne: Record<string, unknown>) {
  h.m.facture.mockResolvedValue(ligne);
  const r = await genererPdfFactureFormation("avoir-1");
  return r;
}

function derniereCreation() {
  const c = h.m.cree.mock.calls.at(-1)![0].data as unknown as {
    type: string;
    metadata: { renderData: { data: Record<string, unknown>; gabaritVersion: number } };
    [k: string]: unknown;
  };
  return c;
}

describe("🔴 un avoir régénéré reste un avoir, identique à l'émission", () => {
  it("T1 — mêmes données d'instantané et même PDF (sha256) qu'à l'émission", async () => {
    const em = await emettre();
    h.m.docParId.mockResolvedValue({ metadata: em.metadata });
    const r = await regenerer(ligneAvoirEnBase(em.ligneCreee));
    expect("error" in r).toBe(false);

    const regen = derniereCreation();
    expect(regen.metadata.renderData.data).toStrictEqual(em.renderData.data);
    expect(regen.type).toBe("avoir");
    expect(sha(h.m.pdfs.at(-1)!)).toBe(sha(em.pdf));
    expect(regen.metadata.renderData.data).toMatchObject({
      estAvoir: true,
      avoirSurNumero: "AXI-FACT-2026-014",
      motifAvoir: MOTIF,
      dateEcheance: "05/11/2026",
    });
    expect(regen.metadata.renderData.data["client"]).not.toHaveProperty("estPersonnePhysique");
    expect(regen.metadata.renderData.data).not.toHaveProperty("periodePrestation");
    expect(regen.metadata.renderData.data).not.toHaveProperty("subrogationOpco");
    expect(regen["clientId"]).toBe("client-1");
    // Le PDF n'est pas celui d'une facture.
    const commeFacture = await renderToBuffer(
      React.createElement(FacturePdf, {
        data: { ...(em.renderData.data as object), estAvoir: false } as never,
      }) as React.ReactElement<DocumentProps>,
    );
    expect(sha(commeFacture)).not.toBe(sha(em.pdf));
  });

  it("T2 — PDF courant défectueux (sans estAvoir) : le motif vient du plus ancien PDF d'avoir", async () => {
    const em = await emettre();
    // Un avoir déjà mal régénéré conserve la version de gabarit de la pièce d'origine.
    const defectueux = {
      metadata: {
        renderData: {
          gabaritVersion: (em.metadata.renderData as { gabaritVersion?: number }).gabaritVersion,
          data: { ...em.renderData.data, estAvoir: undefined, motifAvoir: undefined },
        },
      },
    };
    delete (defectueux.metadata.renderData.data as Record<string, unknown>)["avoirSurNumero"];
    h.m.docParId.mockResolvedValue(JSON.parse(JSON.stringify(defectueux)));
    h.m.docAvoirAncien.mockResolvedValue({ metadata: em.metadata });

    const r = await regenerer(ligneAvoirEnBase(em.ligneCreee, { documentId: "doc-defectueux" }));
    expect("error" in r).toBe(false);
    const regen = derniereCreation();
    expect(regen.type).toBe("avoir");
    expect(regen.metadata.renderData.data).toMatchObject({
      estAvoir: true,
      avoirSurNumero: "AXI-FACT-2026-014",
      motifAvoir: MOTIF,
    });
    expect(sha(h.m.pdfs.at(-1)!)).toBe(sha(em.pdf));
  });

  it("T3a — avoir partiel −1 234,56 € HT : totaux recalculés = ligne en base, TVA < 0", async () => {
    const em = await emettre({}, { montantPartielHtCents: 123456 });
    expect(em.ligneCreee["montantHtCents"]).toBe(-123456);
    h.m.docParId.mockResolvedValue({ metadata: em.metadata });
    const ligne = ligneAvoirEnBase(em.ligneCreee);
    const r = await regenerer(ligne);
    expect("error" in r).toBe(false);

    const data = derniereCreation().metadata.renderData.data as {
      lignes: never[];
      regimeTva: "assujetti";
      tauxTvaStandardPercent: number;
    };
    expect(data.lignes).toStrictEqual(ligne.lignes);
    const t = computeTotauxFacture(data.lignes, data.regimeTva, data.tauxTvaStandardPercent);
    expect(t.totalHtCents).toBe(ligne.montantHtCents);
    expect(t.totalTvaCents).toBe(ligne.montantTvaCents);
    expect(t.totalTtcCents).toBe(ligne.montantTtcCents);
    expect(t.totalHtCents).toBe(-123456);
    expect(t.totalTvaCents).toBeLessThan(0);
    expect(t.totalTtcCents).toBeLessThan(t.totalHtCents);
  });

  it("T3b — avoir exonéré : TVA = 0, totaux identiques", async () => {
    const em = await emettre({ regimeTva: "exoneration_261" }, { montantPartielHtCents: 123456 });
    h.m.docParId.mockResolvedValue({ metadata: em.metadata });
    const ligne = ligneAvoirEnBase(em.ligneCreee);
    const r = await regenerer(ligne);
    expect("error" in r).toBe(false);
    const data = derniereCreation().metadata.renderData.data as {
      lignes: never[];
      regimeTva: "exoneration_261";
      tauxTvaStandardPercent: number;
    };
    const t = computeTotauxFacture(data.lignes, data.regimeTva, data.tauxTvaStandardPercent);
    expect(t.totalTvaCents).toBe(0);
    expect(ligne.montantTvaCents).toBe(0);
    expect(t.totalHtCents).toBe(ligne.montantHtCents);
    expect(t.totalTtcCents).toBe(ligne.montantTtcCents);
  });

  it("T4 — aucun PDF d'origine : erreur, rien produit, aucun motif inventé", async () => {
    const em = await emettre();
    h.m.cree.mockClear();
    h.m.docParId.mockResolvedValue(null);
    h.m.docAvoirAncien.mockResolvedValue(null);
    const r = await regenerer(ligneAvoirEnBase(em.ligneCreee));
    expect(r).toStrictEqual({
      error:
        "PDF non régénéré : motif de l'avoir introuvable (aucun PDF d'origine). Aucun motif n'est inventé.",
    });
    expect(h.m.cree).not.toHaveBeenCalled();
    expect(h.m.majFacture).toHaveBeenCalledTimes(1); // celui de l'émission, pas de la régénération
  });

  it("T4b — sans documentId : seule la source 2 est consultée, puis erreur", async () => {
    const em = await emettre();
    h.m.cree.mockClear();
    h.m.majFacture.mockClear();
    h.m.docAvoirAncien.mockResolvedValue(null);
    const r = await regenerer(ligneAvoirEnBase(em.ligneCreee, { documentId: null }));
    expect("error" in r).toBe(true);
    expect(h.m.docParId).not.toHaveBeenCalled();
    expect(h.m.cree).not.toHaveBeenCalled();
    expect(h.m.majFacture).not.toHaveBeenCalled();
  });

  it("T5 — numéro d'origine incohérent : erreur, rien produit", async () => {
    const em = await emettre();
    h.m.cree.mockClear();
    h.m.majFacture.mockClear();
    h.m.docParId.mockResolvedValue({ metadata: em.metadata });
    const r = await regenerer(
      ligneAvoirEnBase(em.ligneCreee, { avoirDe: { numero: "AXI-FACT-2026-999" } }),
    );
    expect("error" in r).toBe(true);
    expect(h.m.cree).not.toHaveBeenCalled();
    expect(h.m.majFacture).not.toHaveBeenCalled();
  });

  it("T6 — facture normale (avoirDeId nul) : comportement inchangé (type facture, échéance J+30)", async () => {
    h.m.docParId.mockResolvedValue({ metadata: { renderData: { gabaritVersion: 2 } } });
    const r = await regenerer({
      id: "fac-1",
      numero: "AXI-FACT-2026-014",
      destinataireNom: "SCI Invest Sun",
      destinataireSiret: null,
      destinataireAdresse: null,
      destinataireTvaIntracom: null,
      refClient: null,
      montantHtCents: 280000,
      lignes: [{ designation: "Atelier IA", quantite: 1, prixUnitaireHtCents: 280000 }],
      regimeTva: "assujetti",
      subrogation: false,
      numeroDossierOpco: null,
      documentId: "doc-origine",
      emiseAt: EMISE,
      echeanceAt: null,
      sessionId: null,
      destinataire: null,
      session: null,
      avoirDeId: null,
      avoirDe: null,
      clientId: "client-1",
    });
    expect("error" in r).toBe(false);
    const c = derniereCreation();
    expect(c.type).toBe("facture");
    expect(c.metadata.renderData.data).toMatchObject({ dateEcheance: "05/12/2026" });
    expect(c.metadata.renderData.data).not.toHaveProperty("estAvoir");
    expect(c.metadata.renderData.data["client"]).toHaveProperty("estPersonnePhysique");
    expect(h.prisma.documentGenere.findFirst).not.toHaveBeenCalled();
  });

  it("T7 — la source 2 cible type avoir, le chemin JSON du numéro et le plus ancien d'abord", async () => {
    const em = await emettre();
    h.m.docParId.mockResolvedValue(null);
    h.m.docAvoirAncien.mockResolvedValue({ metadata: em.metadata });
    await regenerer(ligneAvoirEnBase(em.ligneCreee, { documentId: "doc-absent" }));
    expect(h.prisma.documentGenere.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: "avoir",
          metadata: { path: ["renderData", "data", "numero"], equals: "AXI-AVO-2026-007" },
        },
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});
