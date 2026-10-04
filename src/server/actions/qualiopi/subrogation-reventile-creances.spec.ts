/**
 * Lot A8c — cocher ou décocher la subrogation RECALCULE les créances du dossier.
 *
 * 🔴 Défaut constaté à l'audit : le dossier s'ouvre au choix du financement
 * OPCO, avec les créances de CE moment (subrogation pas encore cochée → une
 * créance « entreprise » du total). Cocher la subrogation ensuite ne touchait
 * à rien : la facture à l'OPCO était refusée (« ce dossier ne reconnaît pas ce
 * destinataire »), et en sens inverse une subrogation décochée laissait une
 * créance OPCO que plus aucune facture ne devait solder. Seules les
 * transitions `accord_recu` et `refuse` reventilaient.
 *
 * La reventilation est la VRAIE (`reventilerPayeurs`) : on lit ce qu'elle écrit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/sessions/verrou-dossier-garde")>()),
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
}));

const SESSION_ID = "33333333-3333-4333-8333-333333333333";
const DOSSIER_ID = "44444444-4444-4444-8444-444444444444";

const m = vi.hoisted(() => ({
  avant: { financementType: "opco", opcoSubrogation: false } as Record<string, unknown>,
  dossiers: [] as Array<{ id: string; statut: string; subrogation: boolean }>,
  sessionUpdate: vi.fn(),
  dossierUpdate: vi.fn(),
  createMany: vi.fn(),
  deleteMany: vi.fn(),
  log: vi.fn(),
  regime: vi.fn(),
  opcoSubrogationEcrite: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: vi.fn(async () => m.avant),
      update: vi.fn(async (a: { data: { opcoSubrogation?: boolean } }) => {
        if (a.data.opcoSubrogation !== undefined) m.opcoSubrogationEcrite = a.data.opcoSubrogation;
        m.sessionUpdate(a);
        return { id: SESSION_ID };
      }),
    },
    dossierFinancement: {
      findMany: vi.fn(async () => m.dossiers),
      update: vi.fn(async (a: unknown) => {
        m.dossierUpdate(a);
        return { id: DOSSIER_ID };
      }),
      // Lecture de `reventilerPayeurs` : la session telle qu'APRÈS l'écriture.
      findUnique: vi.fn(async () => ({
        montantDemandeCents: 150000,
        montantAccordeCents: 100000,
        trainingSession: {
          id: SESSION_ID,
          clientId: "c-1",
          montantHtCents: 150000,
          financementType: "opco",
          opcoSubrogation: m.opcoSubrogationEcrite,
          numeroDossierOpco: "ATL-1",
          priseEnChargeMontantCents: null,
          priseEnChargeUnite: null,
          priseEnChargePlafondFormationCents: null,
          priseEnChargePlafondAnnuelCents: null,
          nbParticipantsPrevus: 2,
          formation: { dureeHeures: 14 },
          edofVerifieAt: null,
          ftDispositif: null,
          client: { id: "c-1", raisonSociale: "Acme", opco: null, opcoIdentifie: "atlas" },
          enrollments: [],
        },
      })),
    },
    dossierPayeur: {
      findMany: vi.fn(async () => []),
      deleteMany: (a: unknown) => m.deleteMany(a),
      createMany: (a: unknown) => m.createMany(a),
    },
    $transaction: vi.fn(async (ops: unknown) => ops),
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: m.log,
}));

vi.mock("@/server/qualiopi/financements/regime-paiement-session", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/qualiopi/financements/regime-paiement-session")
  >()),
  regimePaiementDeSession: m.regime,
}));

import { setFinancementSessionAction } from "@/server/actions/qualiopi/financements";

function payeursEcrits(): Array<{ payeurType: string; montantAttenduCents: number }> {
  const appel = m.createMany.mock.calls.at(-1);
  return appel
    ? (appel[0] as { data: Array<{ payeurType: string; montantAttenduCents: number }> }).data
    : [];
}

describe("subrogation × créances du dossier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.avant = { financementType: "opco", opcoSubrogation: false };
    m.dossiers = [{ id: DOSSIER_ID, statut: "accord_recu", subrogation: false }];
    m.opcoSubrogationEcrite = false;
    m.regime.mockResolvedValue({
      regime: "subrogation_possible",
      motif: "test",
      source: "",
      dossierId: DOSSIER_ID,
      confirmeParAccord: false,
    });
  });

  it("🔴 cocher la subrogation → créance OPCO (part accordée) + reste à l'entreprise", async () => {
    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });
    expect("data" in r, JSON.stringify(r)).toBe(true);

    expect(payeursEcrits()).toEqual([
      expect.objectContaining({ payeurType: "opco_subroge", montantAttenduCents: 100000 }),
      expect.objectContaining({ payeurType: "entreprise", montantAttenduCents: 50000 }),
    ]);
    // Le dossier porte la même décision que la session (la relance la lit).
    expect(m.dossierUpdate).toHaveBeenCalledWith({
      where: { id: DOSSIER_ID },
      data: { subrogation: true },
    });
  });

  it("🔴 décocher la subrogation → une seule créance, du total, à l'entreprise", async () => {
    m.avant = { financementType: "opco", opcoSubrogation: true };
    m.dossiers = [{ id: DOSSIER_ID, statut: "accord_recu", subrogation: true }];
    m.opcoSubrogationEcrite = true;

    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: false });
    expect("data" in r, JSON.stringify(r)).toBe(true);

    expect(payeursEcrits()).toEqual([
      expect.objectContaining({ payeurType: "entreprise", montantAttenduCents: 150000 }),
    ]);
  });

  it("subrogation inchangée → aucune reventilation", async () => {
    m.avant = { financementType: "opco", opcoSubrogation: true };
    m.opcoSubrogationEcrite = true;
    await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });
    expect(m.createMany).not.toHaveBeenCalled();
  });

  it("dossier déjà facturé → rien n'est recalculé, et l'écran le dit", async () => {
    m.dossiers = [{ id: DOSSIER_ID, statut: "facture", subrogation: false }];
    const r = await setFinancementSessionAction({ sessionId: SESSION_ID, opcoSubrogation: true });
    expect(m.createMany).not.toHaveBeenCalled();
    expect((r as { data: { avertissement?: string } }).data.avertissement).toContain(
      "déjà facturé",
    );
  });
});
