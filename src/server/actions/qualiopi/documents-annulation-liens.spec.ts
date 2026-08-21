/**
 * Garde — annuler une pièce COUPE les liens de signature encore vivants.
 *
 * `annulerDocumentAction` écrivait `annuleeAt`, `annuleeMotif`, `annuleePar` —
 * et rien d'autre. Les `DocumentSignatureToken` déjà en circulation restaient
 * actifs : le tiers qui avait reçu son lien par e-mail pouvait encore signer,
 * plusieurs jours après que l'organisme eut déclaré la pièce sans valeur.
 *
 * Ce n'est pas une faille — le porteur du lien est légitime et le lien l'était
 * aussi. C'est un état métier faux, avec des conséquences AUTOMATIQUES :
 * `consequenceSignatureComplete` envoie les questionnaires de positionnement à
 * des stagiaires réels dès qu'une convention passe `signee`, et fait basculer un
 * devis en `accepte`. Aucun écran humain entre la signature et l'effet.
 *
 * Le refus dans `signerDocument` est la garde de fond ; celle-ci retire le lien
 * de la circulation, pour que le signataire n'aille pas au bout d'un geste qui
 * sera de toute façon refusé.
 *
 * ⚠️ Vit dans son PROPRE fichier : `documents.spec.ts` est un spec partagé de
 * plus de 1 500 lignes, et cette famille de défauts se répare en parallèle
 * d'autres chantiers sur le même fichier d'actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDocumentFindUnique = vi.fn();
const mockDocumentUpdate = vi.fn();
const mockAdminUserFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentGenere: {
      findUnique: (...args: unknown[]) => mockDocumentFindUnique(...args),
      update: (...args: unknown[]) => mockDocumentUpdate(...args),
    },
    adminUser: { findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));

const mockRevoquer = vi.fn(async (..._args: unknown[]) => 2);
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerTokensDocument: (...args: unknown[]) => mockRevoquer(...(args as [])),
}));

import { annulerDocumentAction } from "./documents";

const DOC = "d1234567-89ab-cdef-0123-456789abcdef";
const MOTIF = "Destinataire erroné : la convention est réémise au bon client.";

beforeEach(() => {
  vi.clearAllMocks();
  mockDocumentFindUnique.mockResolvedValue({
    id: DOC,
    numero: "AXI-DOC-2026-003",
    annuleeAt: null,
  });
  mockDocumentUpdate.mockResolvedValue({});
  mockAdminUserFindUnique.mockResolvedValue({ name: "Williams Jullin" });
  mockRevoquer.mockResolvedValue(2);
});

describe("🔴 annulerDocumentAction — les liens de signature ne survivent pas à l'annulation", () => {
  it("révoque les jetons actifs de la pièce, en NOMMANT l'annulation comme motif", async () => {
    await annulerDocumentAction({ documentId: DOC, motif: MOTIF });

    expect(mockRevoquer).toHaveBeenCalledTimes(1);
    const arg = mockRevoquer.mock.calls[0]![0] as {
      documentGenereId: string;
      motif: string;
      parAdminId?: string | null;
      partie?: string;
    };
    expect(arg.documentGenereId).toBe(DOC);
    // Le registre des jetons doit dire POURQUOI le lien est mort, sinon
    // « révoqué » se confond avec une réémission ordinaire.
    expect(arg.motif.toLowerCase()).toContain("annul");
    // Tous les liens, pas ceux d'une seule partie.
    expect(arg.partie).toBeUndefined();
    expect(arg.parAdminId).toBe("admin-uuid");
  });

  it("ne révoque RIEN quand l'annulation est refusée — motif trop court", async () => {
    // Une garde qui agit avant d'avoir décidé casserait des liens valides.
    const res = await annulerDocumentAction({ documentId: DOC, motif: "erreur" });
    expect(res).toMatchObject({ error: expect.stringContaining("Motif obligatoire") });
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("ne révoque RIEN sur une pièce déjà annulée", async () => {
    mockDocumentFindUnique.mockResolvedValue({
      id: DOC,
      numero: "AXI-DOC-2026-003",
      annuleeAt: new Date("2026-08-04T09:00:00Z"),
    });
    await annulerDocumentAction({ documentId: DOC, motif: MOTIF });
    expect(mockRevoquer).not.toHaveBeenCalled();
  });

  it("une panne de révocation n'ANNULE PAS l'annulation", async () => {
    // L'annulation est l'acte que l'auditeur lira ; la révocation des liens en
    // découle. Perdre la première parce que la seconde a échoué inverserait
    // l'ordre d'importance — et `signerDocument` refuse de toute façon.
    mockRevoquer.mockRejectedValue(new Error("base indisponible"));
    const res = await annulerDocumentAction({ documentId: DOC, motif: MOTIF });
    expect(res).toEqual({ data: { numero: "AXI-DOC-2026-003" } });
    expect(mockDocumentUpdate).toHaveBeenCalledTimes(1);
  });
});
