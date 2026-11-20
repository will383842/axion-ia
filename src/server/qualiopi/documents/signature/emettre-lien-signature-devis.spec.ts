/**
 * Relance d'une pièce de devis — le lien est à jeton unique : un jeton neuf
 * révoque le précédent. On ne le forge donc jamais pendant qu'un e-mail du devis
 * attend (il partirait avec un lien mort), ni sans le verrou d'envoi du devis.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const TX = { devis: { findMany: vi.fn() } };
  return {
    TX,
    p: {
      documentGenere: { findUnique: vi.fn() },
      documentSignature: { count: vi.fn() },
      documentSignatureToken: { count: vi.fn() },
      client: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(TX)),
    },
    creerToken: vi.fn(),
    verrou: vi.fn(),
    enAttente: vi.fn(),
    log: vi.fn(),
  };
});

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://axion-ia.com"),
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: h.log }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/qualiopi/recueil/garde-convention", () => ({
  garderEnvoiConvention: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("@/server/qualiopi/devis/email-devis-en-attente", () => ({
  emailDevisEnAttente: h.enAttente,
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({
  prendreVerrouEnvoiDevis: h.verrou,
}));
vi.mock("./token-document", () => ({
  creerTokenDocument: h.creerToken,
  TokenDocumentError: class TokenDocumentError extends Error {
    readonly motif: string;
    constructor(motif: string, message: string) {
      super(message);
      this.motif = motif;
    }
  },
}));

import {
  MSG_RELANCE_DEVIS_EMAIL_EN_ATTENTE,
  MSG_RELANCE_DEVIS_ENVOI_EN_COURS,
  MSG_RELANCE_DEVIS_SANS_DEVIS,
  MSG_RELANCE_DEVIS_PAS_ENVOYE,
  MSG_RELANCE_DEVIS_VALIDITE_DEPASSEE,
  emettreLienSignature,
  emettreLienSignatureSystem,
} from "./emettre-lien-signature";
import { TokenDocumentError } from "./token-document";

const DOC = "33333333-3333-4333-8333-333333333333";
const DANS_LE_FUTUR = new Date(Date.now() + 30 * 86_400_000);
const ADMIN = { userId: "adm-1", role: "admin" } as never;

function piece(type = "devis") {
  return {
    id: DOC,
    type,
    numero: "AXI-DEV-2026-001",
    hashSha256: "h",
    metadata: null,
    annuleeAt: null,
    clientId: "c1",
    traineeId: null,
    sousTraitantId: null,
    sessionId: null,
    trainerId: null,
    suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
  };
}

const relancer = () =>
  emettreLienSignature({ documentGenereId: DOC, partie: "client", acteur: { session: ADMIN } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.p.documentGenere.findUnique.mockResolvedValue(piece());
  h.p.documentSignature.count.mockResolvedValue(0);
  h.p.documentSignatureToken.count.mockResolvedValue(1);
  h.p.client.findUnique.mockResolvedValue({
    raisonSociale: "ACME",
    contactNom: "Jeanne Martin",
    contactEmail: "jeanne@acme.test",
    contactFonction: "Directrice",
  });
  h.creerToken.mockResolvedValue({
    token: "t",
    tokenId: "id",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
  });
  h.TX.devis.findMany.mockResolvedValue([
    { id: "dv1", statut: "envoye", dateValidite: DANS_LE_FUTUR },
  ]);
  h.verrou.mockResolvedValue(true);
  h.enAttente.mockResolvedValue(false);
});

describe("relance d'une pièce de devis", () => {
  it("(a) refuse si un e-mail du devis attend", async () => {
    h.enAttente.mockResolvedValue(true);
    expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_EMAIL_EN_ATTENTE });
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
    expect(h.enAttente).toHaveBeenCalledWith(h.TX, "dv1");
  });

  it("(b) accepte sinon, dans l'ordre verrou → e-mail en attente → jeton", async () => {
    const r = await relancer();
    expect(r).toHaveProperty("data.url");
    expect(h.creerToken).toHaveBeenCalledTimes(1);
    const ordre = (m: { mock: { invocationCallOrder: number[] } }) =>
      m.mock.invocationCallOrder[0]!;
    expect(ordre(h.verrou)).toBeLessThan(ordre(h.enAttente));
    expect(ordre(h.enAttente)).toBeLessThan(ordre(h.creerToken));
  });

  it("(c) deux appels concurrents : un succès, l'autre « envoi en cours », un seul jeton", async () => {
    h.verrou.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const [r1, r2] = await Promise.all([relancer(), relancer()]);
    const resultats = [r1, r2];
    expect(resultats.filter((r) => "data" in r)).toHaveLength(1);
    expect(resultats).toContainEqual({ error: MSG_RELANCE_DEVIS_ENVOI_EN_COURS });
    expect(h.creerToken).toHaveBeenCalledTimes(1);
  });

  it("(c bis) verrou refusé d'emblée : « envoi en cours », ni e-mail testé ni jeton", async () => {
    h.verrou.mockResolvedValue(false);
    expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_ENVOI_EN_COURS });
    expect(h.enAttente).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("(c ter) pièce sans devis, ou avec plusieurs : refus, aucun jeton", async () => {
    h.TX.devis.findMany.mockResolvedValueOnce([]);
    expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_SANS_DEVIS });
    h.TX.devis.findMany.mockResolvedValueOnce([
      { id: "a", statut: "envoye", dateValidite: DANS_LE_FUTUR },
      { id: "b", statut: "envoye", dateValidite: DANS_LE_FUTUR },
    ]);
    expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_SANS_DEVIS });
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("(d) un autre type de pièce est inchangé : ni transaction, ni verrou, ni contrôle", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue(piece("convention"));
    const r = await relancer();
    expect(r).toHaveProperty("data");
    expect(h.p.$transaction).not.toHaveBeenCalled();
    expect(h.verrou).not.toHaveBeenCalled();
    expect(h.enAttente).not.toHaveBeenCalled();
    expect(h.creerToken).toHaveBeenCalledTimes(1);
  });

  it("(e) un refus du jeton dans la transaction est rendu tel quel", async () => {
    h.creerToken.mockRejectedValue(new TokenDocumentError("lien_non_vivant", "x"));
    expect(await relancer()).toEqual({ error: "x" });
  });
});

describe("relance d'une pièce de devis — état du devis", () => {
  it.each(["brouillon", "accepte", "refuse", "expire", "transforme_convention"])(
    "(f) devis au statut %s : refus, ni verrou ni jeton",
    async (statut) => {
      h.TX.devis.findMany.mockResolvedValue([{ id: "dv1", statut, dateValidite: DANS_LE_FUTUR }]);
      expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_PAS_ENVOYE });
      expect(h.creerToken).not.toHaveBeenCalled();
      expect(h.verrou).not.toHaveBeenCalled();
      expect(h.log).not.toHaveBeenCalled();
    },
  );

  it("(g) validité dépassée : refus, aucun jeton", async () => {
    h.TX.devis.findMany.mockResolvedValue([
      { id: "dv1", statut: "envoye", dateValidite: new Date(Date.now() - 86_400_000) },
    ]);
    expect(await relancer()).toEqual({ error: MSG_RELANCE_DEVIS_VALIDITE_DEPASSEE });
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("(h) le jeton est borné à la date de validité du devis", async () => {
    await relancer();
    expect(h.creerToken).toHaveBeenCalledWith(
      expect.objectContaining({ borneMetier: DANS_LE_FUTUR }),
    );
  });

  it("(i) la transaction du devis porte un timeout de 60 s", async () => {
    await relancer();
    expect(h.p.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 60_000,
    });
  });
});

describe("emettreLienSignatureSystem — devis", () => {
  it("refuse une pièce de type devis, aucun jeton", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue(piece());
    expect(await emettreLienSignatureSystem(DOC, "client")).toEqual({
      error: "Un lien de devis ne s'émet pas par ce chemin.",
    });
    expect(h.creerToken).not.toHaveBeenCalled();
  });
});
