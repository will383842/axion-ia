/**
 * INT-T81-A — l'action admin qui LÈVE le blocage de la convocation et de
 * l'émargement. Lentille sécurité :
 *   - le rôle est rejugé côté serveur, par `requireAdminPublish` (admin /
 *     super_admin) appelé AVANT toute lecture ; son refus arrête l'action ;
 *   - le motif est FERMÉ et la référence est validée : aucun texte libre ;
 *   - le journal porte qui, quand, quelle convention, quelle référence — et
 *     aucune donnée de stagiaire ;
 *   - une levée ne se réécrit pas.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const requireAdminPublish = vi.fn();
const requireAdminWrite = vi.fn();
const donneesJournalQualiopi = vi.fn();
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => requireAdminWrite(),
  requireAdminPublish: () => requireAdminPublish(),
  requireHabilitation: vi.fn(),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
  donneesJournalQualiopi: (...a: unknown[]) => donneesJournalQualiopi(...a),
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
}));

const lireConditionSuspensive = vi.fn();
const leverBlocage = vi.fn();
vi.mock("@/server/qualiopi/financements/condition-suspensive-service", async (importOriginal) => {
  const reel = await importOriginal<Record<string, unknown>>();
  return {
    ...reel,
    lireConditionSuspensive: (...a: unknown[]) => lireConditionSuspensive(...a),
    leverBlocage: (...a: unknown[]) => leverBlocage(...a),
  };
});

import { leverBlocageConditionSuspensiveAction } from "../documents";

const DOC = "0b6f0d55-6c1d-4d0e-9f73-0d2a1b7c3e44";
const ENTREE = {
  documentId: DOC,
  motif: "renonciation_ecrite_client" as const,
  referenceRenonciation: "RENONC-2026-0007",
};

beforeEach(() => {
  requireAdminPublish.mockReset().mockResolvedValue({ userId: "admin-1", role: "admin" });
  requireAdminWrite.mockReset().mockResolvedValue({ userId: "ed-1", role: "editor" });
  donneesJournalQualiopi.mockReset().mockImplementation(async (i: Record<string, unknown>) => i);
  lireConditionSuspensive
    .mockReset()
    .mockResolvedValue({ document: { id: DOC, numero: "CONV-2026-0001" } });
  leverBlocage.mockReset().mockResolvedValue({ ok: true });
});

describe("leverBlocageConditionSuspensiveAction", () => {
  it("un non-administrateur est refusé AVANT toute lecture ni écriture", async () => {
    requireAdminPublish.mockRejectedValue(new Error("forbidden"));
    await expect(leverBlocageConditionSuspensiveAction(ENTREE)).rejects.toThrow("forbidden");
    expect(lireConditionSuspensive).not.toHaveBeenCalled();
    expect(leverBlocage).not.toHaveBeenCalled();
  });

  it("n'emprunte PAS la garde d'écriture, qui admet `editor`", async () => {
    await leverBlocageConditionSuspensiveAction(ENTREE);
    expect(requireAdminWrite).not.toHaveBeenCalled();
    expect(requireAdminPublish).toHaveBeenCalledOnce();
  });

  it("lève et journalise : qui, quelle convention, quelle référence, motif fermé", async () => {
    const r = await leverBlocageConditionSuspensiveAction(ENTREE);
    expect(r).toHaveProperty("data");
    const j = donneesJournalQualiopi.mock.calls[0]![0];
    expect(j).toMatchObject({
      action: "qualiopi.convention.condition_suspensive.levee_blocage",
      targetType: "DocumentGenere",
      targetId: DOC,
      session: { userId: "admin-1" },
    });
    expect(j.changes).toMatchObject({
      numero: "CONV-2026-0001",
      motif: "renonciation_ecrite_client",
      referenceRenonciation: "RENONC-2026-0007",
    });
    expect(Object.keys(j.changes).sort()).toEqual(
      ["leveeLe", "motif", "numero", "referenceRenonciation"].sort(),
    );
    expect(leverBlocage).toHaveBeenCalledWith(expect.objectContaining({ documentId: DOC }));
  });

  it("refuse un motif libre, une référence vide ou piégée, une clé inattendue", async () => {
    const mauvaises = [
      { ...ENTREE, motif: "parce que" },
      { ...ENTREE, referenceRenonciation: "" },
      { ...ENTREE, referenceRenonciation: "ab" },
      { ...ENTREE, referenceRenonciation: "x".repeat(81) },
      { ...ENTREE, referenceRenonciation: "<script>alert(1)</script>" },
      { ...ENTREE, extra: 1 },
      { ...ENTREE, documentId: "pas-un-uuid" },
    ];
    for (const m of mauvaises) {
      const r = await leverBlocageConditionSuspensiveAction(m as never);
      expect(r).toEqual({ error: "Données invalides" });
    }
    expect(leverBlocage).not.toHaveBeenCalled();
  });

  it("une seconde levée est refusée avec son motif, rien ne se réécrit", async () => {
    leverBlocage.mockResolvedValue({ ok: false, raison: "deja_levee" });
    const r = await leverBlocageConditionSuspensiveAction(ENTREE);
    expect(r).toEqual({ error: expect.stringContaining("déjà été levé") });
  });

  it("refuse une pièce sans condition suspensive", async () => {
    lireConditionSuspensive.mockResolvedValue(null);
    const r = await leverBlocageConditionSuspensiveAction(ENTREE);
    expect(r).toEqual({ error: expect.stringContaining("ne porte pas de condition") });
    expect(leverBlocage).not.toHaveBeenCalled();
  });
});
