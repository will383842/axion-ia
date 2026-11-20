/**
 * Le bouton « Relancer » d'une pièce de devis ne met rien en file quand un e-mail du devis attend.
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
      $transaction: vi.fn(async (fn: (tx: typeof TX) => unknown) => fn(TX)),
    },
    creerToken: vi.fn(),
    enAttente: vi.fn(),
    enqueue: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/public-url", () => ({
  publicUrl: (p: string) => new URL(p, "https://axion-ia.com"),
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueue }));
vi.mock("@/server/qualiopi/recueil/garde-convention", () => ({
  garderEnvoiConvention: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/server/qualiopi/devis/email-devis-en-attente", () => ({
  emailDevisEnAttente: h.enAttente,
}));
vi.mock("@/server/qualiopi/devis/marquer-devis-envoye", () => ({
  prendreVerrouEnvoiDevis: vi.fn(async () => true),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: h.creerToken,
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class extends Error {},
}));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "adm-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "adm-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));

import { MSG_RELANCE_DEVIS_EMAIL_EN_ATTENTE } from "@/server/qualiopi/documents/signature/emettre-lien-signature";
import { envoyerLienSignatureParEmailAction } from "./piece-lien-signature";

const DOC = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.p.$transaction.mockImplementation(async (fn: (tx: typeof h.TX) => unknown) => fn(h.TX));
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
    suppressionPrevueAt: new Date("2031-01-01T00:00:00.000Z"),
    session: null,
    client: { raisonSociale: "ACME" },
  });
  h.p.documentSignature.count.mockResolvedValue(0);
  h.p.documentSignatureToken.count.mockResolvedValue(0);
  h.p.client.findUnique.mockResolvedValue({
    raisonSociale: "ACME",
    contactNom: "Jo",
    contactEmail: "jo@acme.test",
    contactFonction: "DRH",
  });
  h.TX.devis.findMany.mockResolvedValue([{ id: "dv1" }]);
  h.enAttente.mockResolvedValue(true);
  h.creerToken.mockResolvedValue({ token: "t", tokenId: "id", expiresAt: new Date("2026-12-01") });
});

describe("envoyerLienSignatureParEmailAction — pièce de devis", () => {
  it("rend l'erreur et ne met rien en file quand un e-mail du devis attend", async () => {
    const r = await envoyerLienSignatureParEmailAction({ documentGenereId: DOC, partie: "client" });
    expect(r).toEqual({ error: MSG_RELANCE_DEVIS_EMAIL_EN_ATTENTE });
    expect(h.enqueue).not.toHaveBeenCalled();
  });
});
