/**
 * Point (9) de l'étape 3 du C4 — la console DIT le refus d'activation après la
 * contresignature d'un contrat-cadre. `apresSignature` le rend (`activationRefusee`) ;
 * l'action de contresignature le transmet à l'écran, unitaire comme par lot. La
 * signature reste acquise : ce n'est pas un refus de signer.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: vi.fn(),
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", async (orig) => ({
  ...(await orig<typeof import("@/server/qualiopi/documents/signature/apres-signature")>()),
  apresSignature: vi.fn(),
}));
vi.mock("@/server/qualiopi/formateurs-independants/garde-contresignature-contrat-cadre", () => ({
  objectionContresignatureContratCadre: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/formateurs-independants/lettre-mission-perimee", () => ({
  objectionLettreMissionPerimee: vi.fn(async () => null),
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: vi.fn(async () => ({})),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ userId: "admin-1", role: "super_admin" })),
  logQualiopiActivity: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  apresSignature,
  PREFIXE_ACTIVATION_REFUSEE,
} from "@/server/qualiopi/documents/signature/apres-signature";
import { signerDocument } from "@/server/qualiopi/documents/signature/document-signature-service";

import { contresignerParLotAction, contresignerPieceAction } from "./piece-signature";

type Mock = ReturnType<typeof vi.fn>;
const DOC = "11111111-1111-4111-8111-111111111111";
const REFUS = {
  code: "garde_refuse",
  message: "Activation impossible : le contrôle du registre date de plus d'un mois.",
  manques: ["le contrôle du registre"],
};
const ATTENDU = `${PREFIXE_ACTIVATION_REFUSEE} ${REFUS.message}`;

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.documentGenere.findUnique as unknown as Mock).mockResolvedValue({
    type: "contrat_sous_traitance",
    numero: "AXI-DOC-2026-951",
    metadata: { renderData: { gabaritVersion: 4 } },
  });
  (prisma.documentSignature.findMany as unknown as Mock).mockResolvedValue([
    { partie: "sous_traitant" },
  ]);
  (signerDocument as unknown as Mock).mockResolvedValue({
    ok: true,
    signatureId: "sig-1",
    statutSignature: "signee",
  });
});

describe("contresignature d'un contrat-cadre : le refus d'activation arrive à l'écran", () => {
  it("unitaire : signée, ET le motif du refus d'activation est rendu", async () => {
    (apresSignature as unknown as Mock).mockResolvedValue({ activationRefusee: REFUS });
    const r = await contresignerPieceAction({
      documentGenereId: DOC,
      methode: "confirmation_accessible",
    });
    expect(r).toMatchObject({ ok: true, statutSignature: "signee" });
    expect("activationRefusee" in r && r.activationRefusee).toBe(ATTENDU);
  });

  it("activation faite : rien de plus", async () => {
    (apresSignature as unknown as Mock).mockResolvedValue({ activationRefusee: null });
    const r = await contresignerPieceAction({
      documentGenereId: DOC,
      methode: "confirmation_accessible",
    });
    expect(r.ok).toBe(true);
    expect("activationRefusee" in r ? r.activationRefusee : undefined).toBeUndefined();
  });

  it("par lot : la pièce est comptée signée, et le refus d'activation est dans le résultat", async () => {
    (apresSignature as unknown as Mock).mockResolvedValue({ activationRefusee: REFUS });
    const r = await contresignerParLotAction({ ids: [DOC], methode: "confirmation_accessible" });
    expect(r).toMatchObject({ ok: true, signees: 1, refusees: 0 });
    const ligne = r.ok ? r.resultats[0] : undefined;
    expect(ligne && "activationRefusee" in ligne && ligne.activationRefusee).toBe(ATTENDU);
  });
});
