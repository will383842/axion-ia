/**
 * Tests — transformDevisToConventionAction (constat F7).
 *
 * 🔴 Audit de certification 2026-07-26. Cette action ne « transformait » rien :
 * elle basculait le statut du devis à `transforme_convention` et s'arrêtait là.
 * AUCUNE convention n'était générée. Le devis affichait donc « transformé en
 * convention » alors qu'aucune pièce n'existait — et c'est exactement la pièce
 * que l'auditrice réclame ensuite (L6353-1, indicateur 9).
 *
 * Un état faux dans la piste d'audit est pire qu'un état manquant : il fait
 * croire que l'obligation est remplie et envoie chercher un document qui
 * n'existe pas.
 *
 * L'invariant que ces tests verrouillent : **le statut ne bascule que si la
 * convention a réellement été produite.**
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDevisFindUnique = vi.fn();
const mockDevisUpdate = vi.fn();
const mockSessionFindFirst = vi.fn();
const mockGenererConvention = vi.fn();
const mockLog = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => mockDevisFindUnique(...a),
      update: (...a: unknown[]) => mockDevisUpdate(...a),
    },
    trainingSession: {
      findFirst: (...a: unknown[]) => mockSessionFindFirst(...a),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

vi.mock("@/server/actions/qualiopi/documents", () => ({
  genererConventionAction: (...a: unknown[]) => mockGenererConvention(...a),
}));

import { transformDevisToConventionAction } from "./devis";

const DEVIS_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockDevisFindUnique.mockResolvedValue({ id: DEVIS_ID, statut: "accepte" });
  mockDevisUpdate.mockResolvedValue({ id: DEVIS_ID });
  mockSessionFindFirst.mockResolvedValue({ id: SESSION_ID, numero: "AXI-SESS-2026-002" });
  mockGenererConvention.mockResolvedValue({
    data: { documentId: "doc-1", numero: "AXI-CONV-2026-001" },
  });
  mockLog.mockResolvedValue(undefined);
});

describe("transformDevisToConventionAction", () => {
  it("génère réellement la convention de la session rattachée", async () => {
    const r = await transformDevisToConventionAction(DEVIS_ID);
    expect(r).toEqual({ data: { id: DEVIS_ID } });
    expect(mockGenererConvention).toHaveBeenCalledWith({ sessionId: SESSION_ID });
  });

  // Une convention porte des dates, une modalité, un effectif : un devis seul ne
  // les fournit pas. Refuser est la seule réponse honnête.
  it("refuse si aucune session n'est rattachée au devis", async () => {
    mockSessionFindFirst.mockResolvedValue(null);
    const r = await transformDevisToConventionAction(DEVIS_ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("Aucune session");
    expect(mockDevisUpdate).not.toHaveBeenCalled();
  });

  // 🔴 L'invariant central du correctif.
  it("ne bascule PAS le statut si la génération échoue", async () => {
    mockGenererConvention.mockResolvedValue({ error: "Identité OF incomplète" });
    const r = await transformDevisToConventionAction(DEVIS_ID);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("Identité OF incomplète");
    expect(mockDevisUpdate).not.toHaveBeenCalled();
  });

  it("laisse le devis réessayable après un échec", async () => {
    mockGenererConvention.mockResolvedValue({ error: "R2 indisponible" });
    const r = await transformDevisToConventionAction(DEVIS_ID);
    if ("error" in r) expect(r.error).toContain("reste « accepté »");
  });

  it("trace le numéro de convention et la session au journal d'audit", async () => {
    await transformDevisToConventionAction(DEVIS_ID);
    const changes = mockLog.mock.calls[0]![0].changes as Record<string, unknown>;
    expect(changes["conventionNumero"]).toBe("AXI-CONV-2026-001");
    expect(changes["sessionId"]).toBe(SESSION_ID);
  });

  it("n'accepte que les devis au statut « accepté »", async () => {
    mockDevisFindUnique.mockResolvedValue({ id: DEVIS_ID, statut: "envoye" });
    const r = await transformDevisToConventionAction(DEVIS_ID);
    expect("error" in r).toBe(true);
    expect(mockGenererConvention).not.toHaveBeenCalled();
  });

  // Idempotence : rejouer ne doit ni régénérer une seconde convention, ni échouer.
  it("est idempotente sur un devis déjà transformé", async () => {
    mockDevisFindUnique.mockResolvedValue({ id: DEVIS_ID, statut: "transforme_convention" });
    const r = await transformDevisToConventionAction(DEVIS_ID);
    expect(r).toEqual({ data: { id: DEVIS_ID } });
    expect(mockGenererConvention).not.toHaveBeenCalled();
  });

  it("refuse un identifiant qui n'est pas un UUID", async () => {
    const r = await transformDevisToConventionAction("pas-un-uuid");
    expect(r).toEqual({ error: "Identifiant invalide" });
  });
});
