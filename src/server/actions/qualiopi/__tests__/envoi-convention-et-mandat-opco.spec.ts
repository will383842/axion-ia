/**
 * INT-T77-A — l'envoi du lien de signature d'une convention part en UN courriel
 * « convention + mandat OPCO » quand le client a un mandat vivant sur la session.
 *
 * Témoins :
 *   - avec un mandat non signé : un seul courriel, le gabarit dédié, DEUX liens ;
 *   - sans mandat : le courriel de la convention, inchangé ;
 *   - le mandat déjà signé ou annulé n'est pas rejoint (la requête l'exclut) ;
 *   - si le lien du mandat ne peut pas être émis, RIEN ne part ;
 *   - le journal ne porte jamais un lien.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { p, enqueueEmail, creerTokenDocument, guards } = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn(), findFirst: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { count: vi.fn() },
    client: { findUnique: vi.fn() },
  },
  enqueueEmail: vi.fn(),
  creerTokenDocument: vi.fn(),
  guards: {
    requireAdminWrite: vi.fn(),
    requireHabilitation: vi.fn(),
    logQualiopiActivity: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: p }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument,
  revoquerTokensDocument: vi.fn(),
  TokenDocumentError: class TokenDocumentError extends Error {},
}));
vi.mock("../_guards", () => guards);

import { envoyerLienSignatureParEmailAction } from "../piece-lien-signature";

const CONVENTION = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";
const MANDAT = "7c1f9a3e-2b44-4d6a-8e10-5a9d3c2b1f00";
const SESSION = "5f1d7d4a-0a8e-4c55-9a43-6a4c6e2f9b11";
const CLIENT = "9d2f1c80-3b55-4e7a-a1b2-6c7d8e9f0a11";

function piece(id: string, type: string, numero: string) {
  return {
    id,
    type,
    numero,
    hashSha256: "a".repeat(64),
    metadata: {},
    annuleeAt: null,
    clientId: CLIENT,
    traineeId: null,
    sousTraitantId: null,
    sessionId: SESSION,
    suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
    session: { titreSession: "IA pour l'immobilier" },
    client: { raisonSociale: "INVEST SUN" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  guards.requireAdminWrite.mockResolvedValue({ userId: "adm-1", role: "admin" });
  guards.requireHabilitation.mockResolvedValue({ userId: "adm-1", role: "admin" });
  guards.logQualiopiActivity.mockResolvedValue(undefined);
  p.documentGenere.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === CONVENTION
      ? piece(CONVENTION, "convention", "AXI-DOC-2026-009")
      : where.id === MANDAT
        ? piece(MANDAT, "mandat_opco", "AXI-DOC-2026-010")
        : null,
  );
  p.documentSignature.count.mockResolvedValue(0);
  p.documentSignatureToken.count.mockResolvedValue(0);
  p.client.findUnique.mockResolvedValue({
    raisonSociale: "INVEST SUN",
    contactNom: "Simone Blanc",
    contactEmail: "simone@invest-sun.example",
    contactFonction: "DRH",
  });
  let n = 0;
  creerTokenDocument.mockImplementation(async () => ({
    token: `JETON${++n}`,
    expiresAt: new Date("2026-12-01T00:00:00Z"),
  }));
  enqueueEmail.mockResolvedValue({ garePourValidation: true });
});

describe("envoyerLienSignatureParEmailAction — INT-T77-A", () => {
  it("avec un mandat vivant : UN courriel, le gabarit dédié, les DEUX liens", async () => {
    p.documentGenere.findFirst.mockResolvedValue({ id: MANDAT, numero: "AXI-DOC-2026-010" });
    const r = await envoyerLienSignatureParEmailAction({
      documentGenereId: CONVENTION,
      partie: "client",
    });
    expect(r).toHaveProperty("data");
    expect(enqueueEmail).toHaveBeenCalledOnce();
    const [nom, dest, , payload] = enqueueEmail.mock.calls[0]!;
    expect(nom).toBe("convention-et-mandat-opco");
    expect(dest).toBe("simone@invest-sun.example");
    expect(payload).toMatchObject({
      signataireNom: "Simone Blanc",
      clientNom: "INVEST SUN",
      numeroConvention: "AXI-DOC-2026-009",
      numeroMandat: "AXI-DOC-2026-010",
    });
    expect(payload.conventionUrl).toContain("/fr/portail/signer/JETON1");
    expect(payload.mandatUrl).toContain("/fr/portail/signer/JETON2");
  });

  it("ne rejoint que le mandat VIVANT : non annulé, non signé par le client, de la même session et du même client", async () => {
    p.documentGenere.findFirst.mockResolvedValue(null);
    await envoyerLienSignatureParEmailAction({ documentGenereId: CONVENTION, partie: "client" });
    expect(p.documentGenere.findFirst.mock.calls[0]![0].where).toEqual({
      sessionId: SESSION,
      clientId: CLIENT,
      type: "mandat_opco",
      annuleeAt: null,
      signatures: { none: { partie: "client", revokedAt: null } },
    });
  });

  it("sans mandat : le courriel de la convention part seul, comme avant", async () => {
    p.documentGenere.findFirst.mockResolvedValue(null);
    await envoyerLienSignatureParEmailAction({ documentGenereId: CONVENTION, partie: "client" });
    expect(enqueueEmail).toHaveBeenCalledOnce();
    const [nom, , , payload] = enqueueEmail.mock.calls[0]!;
    expect(nom).toBe("convention-envoi");
    expect(payload).toMatchObject({ numero: "AXI-DOC-2026-009" });
    expect(payload).not.toHaveProperty("mandatUrl");
    expect(creerTokenDocument).toHaveBeenCalledOnce();
  });

  it("si le lien du mandat ne peut pas être émis, RIEN ne part", async () => {
    p.documentGenere.findFirst.mockResolvedValue({ id: MANDAT, numero: "AXI-DOC-2026-010" });
    // Le mandat est annulé entre-temps : son émission est refusée.
    p.documentGenere.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === MANDAT
        ? { ...piece(MANDAT, "mandat_opco", "AXI-DOC-2026-010"), annuleeAt: new Date() }
        : piece(CONVENTION, "convention", "AXI-DOC-2026-009"),
    );
    const r = await envoyerLienSignatureParEmailAction({
      documentGenereId: CONVENTION,
      partie: "client",
    });
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toContain("mandat OPCO");
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("le journal ne porte JAMAIS un lien, seulement les numéros et le destinataire", async () => {
    p.documentGenere.findFirst.mockResolvedValue({ id: MANDAT, numero: "AXI-DOC-2026-010" });
    await envoyerLienSignatureParEmailAction({ documentGenereId: CONVENTION, partie: "client" });
    const journaux = JSON.stringify(guards.logQualiopiActivity.mock.calls);
    expect(journaux).not.toContain("JETON");
    expect(journaux).not.toContain("/portail/signer/");
    expect(journaux).toContain("AXI-DOC-2026-010");
  });

  it("un autre destinataire que le client (partie ≠ client) n'a pas de mandat", async () => {
    await envoyerLienSignatureParEmailAction({
      documentGenereId: CONVENTION,
      partie: "financeur",
    }).catch(() => undefined);
    expect(p.documentGenere.findFirst).not.toHaveBeenCalled();
  });
});
