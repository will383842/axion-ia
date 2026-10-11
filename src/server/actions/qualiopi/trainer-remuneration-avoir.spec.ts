/**
 * Relecture argent L12d…m — deux gardes de `transitionStatementAction` :
 *   · un AVOIR (L12g) ne change jamais de statut (ni annulé, ni payé, ni rouvert) ;
 *   · « Virement fait » d'un relevé de mission : une demande de changement d'IBAN
 *     déposée entre la garde et le verrou suspend le paiement, rien n'est écrit.
 * Un relevé ordinaire (sans avoir, mensuel) passe comme avant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  $executeRawUnsafe: vi.fn(),
  trainer: { findUnique: vi.fn() },
  demandeChangementFormateur: { count: vi.fn() },
  trainerStatement: { update: vi.fn(), updateMany: vi.fn() },
  trainerFeeLine: { updateMany: vi.fn() },
};
const mockStatementFindUnique = vi.fn();
const mockTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: { findUnique: (...a: unknown[]) => mockStatementFindUnique(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/qualiopi/remuneration/statements", () => ({ runRemunerationMensuelle: vi.fn() }));
vi.mock("@/server/actions/qualiopi/autofacture", () => ({
  emettreAutofactureAction: vi.fn().mockResolvedValue({ error: "neutralisée" }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-mission-base", () => ({
  contexteVirementMission: vi.fn().mockResolvedValue({
    verdict: { autorise: true, motifs: [], retard: {} },
    preuve: { ibanFin4: "1234", ibanEmpreinte: "a".repeat(64) },
  }),
}));

import { transitionStatementAction } from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    trainerId: TRAINER,
    periodeYear: 2031,
    periodeMonth: 12,
    statut: "valide",
    totalTtcCents: 35_000,
    numeroFacture: "AXI-AUTOF-1",
    dateFacture: null,
    montantFactureTtcCents: 35_000,
    autofactureAt: null,
    contesteeAt: null,
    contestationMotif: null,
    origine: "releve_mensuel",
    echeanceAt: null,
    avoirDeId: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.trainer.findUnique.mockResolvedValue({ ibanEmpreinte: "a".repeat(64) });
  tx.demandeChangementFormateur.count.mockResolvedValue(0);
  tx.trainerStatement.updateMany.mockResolvedValue({ count: 1 });
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 0 });
});

describe("un avoir ne change pas de statut", () => {
  it.each(["annule", "a_valider", "facture_recue"])("valide → %s refusé, rien n'est écrit", async (to) => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ avoirDeId: "33333333-3333-4333-8333-333333333333", totalTtcCents: -35_000 }),
    );
    const r = await transitionStatementAction({ id: ID, to: to as never });
    expect("error" in r && r.error).toMatch(/avoir/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("témoin : un relevé ordinaire s'annule comme avant", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    expect(await transitionStatementAction({ id: ID, to: "annule" })).toEqual({
      data: { id: ID, statut: "annule" },
    });
  });
});

describe("« Virement fait » d'un relevé de mission : IBAN relu sous verrou", () => {
  const mission = releve({
    statut: "facture_recue",
    origine: "passage_mission",
    echeanceAt: new Date("2032-01-03T12:00:00Z"),
  });
  const payer = {
    id: ID,
    to: "paye" as const,
    moyenPaiement: "virement",
    ibanEmpreinteAffichee: "a".repeat(64),
  };

  it("demande d'IBAN déposée entre la garde et le verrou : refus, rien n'est écrit", async () => {
    mockStatementFindUnique.mockResolvedValue(mission);
    tx.demandeChangementFormateur.count.mockResolvedValue(1);
    const r = await transitionStatementAction(payer);
    expect("error" in r && r.error).toMatch(/compte bancaire/);
    expect(tx.demandeChangementFormateur.count).toHaveBeenCalled();
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("témoin : sans demande, le paiement passe", async () => {
    mockStatementFindUnique.mockResolvedValue(mission);
    const r = await transitionStatementAction(payer);
    expect(r).toEqual({ data: { id: ID, statut: "paye" } });
    expect(tx.demandeChangementFormateur.count).toHaveBeenCalledWith({
      where: { trainerId: TRAINER, nature: "iban", statut: "en_attente" },
    });
  });
});
