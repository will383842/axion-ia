/**
 * « Relancer » sur une pièce de devis dont l'e-mail attend : l'action rend
 * l'erreur et rien n'est mis en file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
    enqueue: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: h.creerToken,
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {},
}));
vi.mock("@/server/qualiopi/devis/email-devis-en-attente", () => ({
  emailDevisEnAttente: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({
  prendreVerrouEnvoiDevis: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://axion-ia.com"),
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/qualiopi/recueil/garde-convention", () => ({
  garderEnvoiConvention: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "adm", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "adm", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

import { envoyerLienSignatureParEmailAction } from "./piece-lien-signature";

const DOC = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.p.documentGenere.findUnique.mockResolvedValue({
    id: DOC,
    type: "devis",
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
    session: null,
    client: { raisonSociale: "ACME" },
  });
  h.p.documentSignature.count.mockResolvedValue(0);
  h.p.documentSignatureToken.count.mockResolvedValue(1);
  h.p.client.findUnique.mockResolvedValue({
    raisonSociale: "ACME",
    contactNom: "Jeanne Martin",
    contactEmail: "jeanne@acme.test",
    contactFonction: "Directrice",
  });
  h.TX.devis.findMany.mockResolvedValue([{ id: "dv1" }]);
});

describe("envoyerLienSignatureParEmailAction — pièce de devis", () => {
  it("un devis ne se relance pas par l'e-mail de convention : refus, aucun jeton, rien en file", async () => {
    const r = await envoyerLienSignatureParEmailAction({ documentGenereId: DOC, partie: "client" });
    expect(r).toEqual({
      error:
        "Pour un devis, utilisez « Renvoyer par email » ou « Préparer une relance » sur la fiche du devis.",
    });
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.p.$transaction).not.toHaveBeenCalled();
  });
});
