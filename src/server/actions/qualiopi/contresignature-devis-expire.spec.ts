/**
 * Contresignature d'un devis EXPIRÉ déjà signé par le client (F1).
 *
 * `objectionMetier` refusait tout devis non `envoye`, alors que l'écran propose de contresigner un
 * devis `expire` signé du client. Règle : pour la partie `axionia` seulement, un devis `expire` est
 * contresignable s'il est signé du client ET qu'aucune version suivante n'est émise.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
    devis: { findFirst: vi.fn(), count: vi.fn() },
  },
}));
const signer = vi.hoisted(() => vi.fn());
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: signer,
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: vi.fn(async () => null),
  PREFIXE_ACTIVATION_REFUSEE: "x",
  messageConfirmationSelonRaisons: vi.fn(),
  reprendreAcceptationDevisFormules: vi.fn(),
  reprendreConfirmationDevisClassiques: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: vi.fn(async () => ({})),
}));
const jeton = vi.hoisted(() => ({ verifierTokenDocument: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => jeton);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (_: string): string | null => null })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  contresignerParLotAction,
  contresignerPieceAction,
  demanderCodeDevisAction,
} from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const p = prisma as unknown as {
  documentGenere: { findUnique: Mock };
  documentSignature: { findMany: Mock };
  devis: { findFirst: Mock; count: Mock };
};
const DOC = "11111111-1111-4111-8111-111111111111";
const DEVIS_ID = "33333333-3333-4333-8333-333333333333";
const REFUS = "n'est plus en cours";

/** `count` est appelé deux fois : signé du client (where.documentGenere), puis versions suivantes. */
function etat(opts: { statut: string; signeClient: number; successeurs: number }) {
  p.devis.findFirst.mockResolvedValue({ id: DEVIS_ID, statut: opts.statut });
  p.devis.count.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    "replacesDevisId" in args.where ? opts.successeurs : opts.signeClient,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  p.documentGenere.findUnique.mockResolvedValue({
    type: "devis",
    numero: "AXI-DEV-1",
    metadata: {},
  });
  p.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  signer.mockResolvedValue({ ok: true, signatureId: "sig-1", statutSignature: "complete" });
});

const contresigner = () =>
  contresignerPieceAction({ documentGenereId: DOC, methode: "confirmation_accessible" });

describe("contresignature d'un devis expiré", () => {
  it("contresigne_expire_signe_client_sans_successeur", async () => {
    etat({ statut: "expire", signeClient: 1, successeurs: 0 });
    const r = await contresigner();
    expect(r.ok).toBe(true);
    expect(signer).toHaveBeenCalledTimes(1);
    // La version suivante se compte hors brouillon, sur CE devis.
    const calls = p.devis.count.mock.calls.map((c) => c[0].where);
    expect(calls).toContainEqual({ replacesDevisId: DEVIS_ID, statut: { not: "brouillon" } });
  });

  it("refuse_expire_non_signe_client", async () => {
    etat({ statut: "expire", signeClient: 0, successeurs: 0 });
    const r = await contresigner();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain(REFUS);
    expect(signer).not.toHaveBeenCalled();
  });

  it("refuse_expire_successeur_emis", async () => {
    etat({ statut: "expire", signeClient: 1, successeurs: 1 });
    const r = await contresigner();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain(REFUS);
    expect(signer).not.toHaveBeenCalled();
  });

  it("client_jeton_toujours_refuse_sur_expire", async () => {
    // Le client ne signe jamais un devis expiré : la demande de code (partie client) reste refusée,
    // même si le devis est (par ailleurs) signé du client et sans successeur.
    jeton.verifierTokenDocument.mockResolvedValue({
      ok: true,
      tokenId: "t",
      documentGenereId: DOC,
      partie: "client",
      signataireNom: "C",
      signataireEmail: "c@x.test",
      signataireQualite: "G",
    });
    etat({ statut: "expire", signeClient: 1, successeurs: 0 });
    const r = await demanderCodeDevisAction({ token: "tok" } as never);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain(REFUS);
    // Aucune lecture de « signé du client » : la règle ne s'applique qu'à `axionia`.
    expect(p.devis.count).not.toHaveBeenCalled();
  });

  it("lot_contresignerParLot_meme_regle", async () => {
    etat({ statut: "expire", signeClient: 1, successeurs: 1 });
    const refus = await contresignerParLotAction({
      ids: [DOC],
      methode: "confirmation_accessible",
    });
    expect(refus.ok && refus.refusees).toBe(1);
    expect(signer).not.toHaveBeenCalled();

    etat({ statut: "expire", signeClient: 1, successeurs: 0 });
    const ok = await contresignerParLotAction({ ids: [DOC], methode: "confirmation_accessible" });
    expect(ok.ok && ok.signees).toBe(1);
  });

  it.each(["refuse", "brouillon"])("refuse_%s_inchange", async (statut) => {
    etat({ statut, signeClient: 1, successeurs: 0 });
    const r = await contresigner();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain(REFUS);
    expect(signer).not.toHaveBeenCalled();
  });
});
