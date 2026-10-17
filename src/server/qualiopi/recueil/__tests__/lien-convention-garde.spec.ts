/**
 * Chantier QNC, L03 — la garde est BRANCHÉE sur le seul point d'émission du
 * lien de signature d'une convention (lien copié ou envoyé par e-mail).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { count: vi.fn() },
    client: { findUnique: vi.fn() },
    setting: { findUnique: vi.fn() },
    trainingSession: { findUnique: vi.fn() },
    questionnaireCadrage: { findMany: vi.fn() },
    activityLog: { findFirst: vi.fn(), create: vi.fn() },
  },
  creerToken: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));
vi.mock("../../documents/signature/token-document", () => ({
  creerTokenDocument: h.creerToken,
  TokenDocumentError: class TokenDocumentError extends Error {},
}));

import { emettreLienSignature } from "../../documents/signature/emettre-lien-signature";

const DOC = "33333333-3333-4333-8333-333333333333";
const SESSION = "22222222-2222-4222-8222-222222222222";
const ADMIN = { userId: "55555555-5555-4555-8555-555555555555", role: "admin" } as never;

function piece(type: string) {
  return {
    id: DOC,
    type,
    numero: "AXI-DOC-2026-300",
    hashSha256: "c".repeat(64),
    metadata: {},
    annuleeAt: null,
    clientId: "client-1",
    traineeId: null,
    sousTraitantId: null,
    sessionId: SESSION,
    trainerId: null,
    suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
  };
}

function etat(opts: {
  interrupteur?: "eteint" | "actif";
  devis?: string | null;
  cadrageValide?: boolean;
  derogation?: boolean;
}) {
  h.p.setting.findUnique.mockResolvedValue(
    opts.interrupteur === undefined ? null : { value: { etat: opts.interrupteur } },
  );
  h.p.trainingSession.findUnique.mockResolvedValue({
    estTestInterne: false,
    projetId: "p1",
    devis: opts.devis === undefined || opts.devis === null ? null : { statut: opts.devis },
  });
  h.p.questionnaireCadrage.findMany.mockResolvedValue([{ id: "q1" }]);
  h.p.activityLog.findFirst.mockImplementation(async ({ where }: { where: { action: string } }) => {
    if (where.action === "qualiopi.recueil.analyse_validee") {
      return opts.cadrageValide ? { targetId: "q1", createdAt: new Date() } : null;
    }
    if (where.action === "qualiopi.recueil.derogation_accordee") {
      return opts.derogation
        ? { changes: { motif: "Urgence de rentrée, client connu" }, createdAt: new Date() }
        : null;
    }
    return null;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["DATABASE_URL"] = "postgresql://u:p@db.example:5432/x";
  h.p.documentGenere.findUnique.mockResolvedValue(piece("convention"));
  h.p.documentSignature.count.mockResolvedValue(0);
  h.p.documentSignatureToken.count.mockResolvedValue(0);
  h.p.client.findUnique.mockResolvedValue({
    raisonSociale: "ACME",
    contactNom: "Jeanne",
    contactEmail: "jeanne@acme.test",
    contactFonction: "DRH",
  });
  h.creerToken.mockResolvedValue({ token: "JETON", expiresAt: new Date() });
});

const emettre = () =>
  emettreLienSignature({ documentGenereId: DOC, partie: "client", acteur: { session: ADMIN } });

describe("émission du lien d'une convention — garde du recueil", () => {
  it("ÉTEINT : le lien est émis, rien d'autre n'est lu (inchangé)", async () => {
    etat({});
    const r = await emettre();
    expect(r).toHaveProperty("data");
    expect(h.creerToken).toHaveBeenCalledTimes(1);
    expect(h.p.trainingSession.findUnique).not.toHaveBeenCalled();
    expect(h.p.activityLog.findFirst).not.toHaveBeenCalled();
  });

  it("ALLUMÉ, sans cadrage validé : REFUSÉ, aucun jeton créé", async () => {
    etat({ interrupteur: "actif", devis: "accepte", cadrageValide: false });
    const r = await emettre();
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/cadrage/i);
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("ALLUMÉ, devis non accepté : REFUSÉ", async () => {
    etat({ interrupteur: "actif", devis: "envoye", cadrageValide: true });
    const r = await emettre();
    expect((r as { error: string }).error).toMatch(/devis/i);
    expect(h.creerToken).not.toHaveBeenCalled();
  });

  it("ALLUMÉ, cadrage validé + devis accepté : émis", async () => {
    etat({ interrupteur: "actif", devis: "accepte", cadrageValide: true });
    expect(await emettre()).toHaveProperty("data");
    expect(h.creerToken).toHaveBeenCalledTimes(1);
  });

  it("ALLUMÉ, par dérogation : émis ET l'usage est journalisé", async () => {
    etat({ interrupteur: "actif", devis: null, cadrageValide: false, derogation: true });
    expect(await emettre()).toHaveProperty("data");
    const actions = h.p.activityLog.create.mock.calls.map(
      (c: unknown[]) => (c[0] as { data: { action: string } }).data.action,
    );
    expect(actions).toContain("qualiopi.recueil.derogation_utilisee");
  });

  it("une pièce qui n'est PAS une convention n'est jamais gardée", async () => {
    h.p.documentGenere.findUnique.mockResolvedValue(piece("devis"));
    etat({ interrupteur: "actif", devis: null, cadrageValide: false });
    await emettre();
    expect(h.p.trainingSession.findUnique).not.toHaveBeenCalled();
  });
});
