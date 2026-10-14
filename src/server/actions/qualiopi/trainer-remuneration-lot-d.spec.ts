/**
 * Lot D (M6) — « Virement fait » d'un relevé de mission :
 *   · le formulaire TRANSMET l'empreinte de l'IBAN affiché (sans elle, chaque
 *     clic était refusé « le compte a changé ») ;
 *   · contrat-cadre signé et SIREN actif contrôlés côté serveur avant tout ;
 *   · un double clic ne paie pas deux fois (écriture conditionnelle).
 * Un relevé MENSUEL ne lit aucune de ces gardes : son chemin est inchangé.
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
const contexte = vi.fn();
const garanties = vi.fn();
// Comme Next : `redirect()` lève, rien ne s'exécute après.
const redirect = vi.fn((u: string) => {
  throw new Error(`NEXT_REDIRECT ${u}`);
});

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
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-mission-base", () => ({
  contexteVirementMission: (...a: unknown[]) => contexte(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/garanties-paiement-mission", () => ({
  garantiesPaiementMission: (...a: unknown[]) => garanties(...a),
  garantiesPaiementMissionSousVerrou: async () => [],
  LIBELLE_GARANTIE_PAIEMENT: {
    contrat_cadre_absent: "Aucun contrat-cadre signé",
    siren_non_confirme: "SIREN non confirmé",
  },
}));
const envoyerVirementsFaits = vi.fn().mockResolvedValue(undefined);
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi", () => ({
  envoyerVirementsFaits: (...a: unknown[]) => envoyerVirementsFaits(...a),
}));

import { transitionStatementAction, transitionStatementFormAction } from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const E = "a".repeat(64);

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    trainerId: TRAINER,
    periodeYear: 2031,
    periodeMonth: 12,
    statut: "facture_recue",
    totalTtcCents: 42_000,
    numeroFacture: "AXI-AUTOF-7",
    dateFacture: null,
    montantFactureTtcCents: 42_000,
    autofactureAt: new Date("2032-01-01T10:00:00Z"),
    contesteeAt: null,
    contestationMotif: null,
    origine: "passage_mission",
    echeanceAt: new Date("2032-01-30T12:00:00Z"),
    avoirDeId: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.trainer.findUnique.mockResolvedValue({ ibanEmpreinte: E });
  tx.demandeChangementFormateur.count.mockResolvedValue(0);
  tx.trainerStatement.updateMany.mockResolvedValue({ count: 1 });
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 0 });
  garanties.mockResolvedValue([]);
  contexte.mockImplementation(async (_db, _r, affichee: string | null) => ({
    verdict:
      affichee === E
        ? { autorise: true, motifs: [], retard: {} }
        : { autorise: false, motifs: ["iban_change_depuis_l_affichage"], retard: {} },
    preuve: affichee === E ? { ibanFin4: "1234", ibanEmpreinte: E } : null,
  }));
});

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

describe("M6 — le formulaire transmet l'empreinte de l'IBAN affiché", () => {
  it("avec l'empreinte affichée : le relevé de mission passe en « payé »", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    await expect(
      transitionStatementFormAction(
        formulaire({
          id: ID,
          to: "paye",
          retour: "/fr/admin/qualiopi/remuneration/x",
          moyenPaiement: "virement",
          ibanEmpreinteAffichee: E,
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(contexte.mock.calls[0]![2]).toBe(E);
    expect(tx.trainerStatement.updateMany).toHaveBeenCalledTimes(1);
    expect(String(redirect.mock.calls.at(-1)![0])).toMatch(/ok=/);
    // F37 demandé pour ce relevé (le module ne retient que les relevés de mission).
    expect(envoyerVirementsFaits).toHaveBeenCalledWith([ID]);
  });

  it("IBAN changé depuis l'affichage : refus, rien n'est écrit", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    await expect(
      transitionStatementFormAction(
        formulaire({
          id: ID,
          to: "paye",
          moyenPaiement: "virement",
          ibanEmpreinteAffichee: "b".repeat(64),
        }),
      ),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
    expect(envoyerVirementsFaits).not.toHaveBeenCalled();
    expect(decodeURIComponent(String(redirect.mock.calls[0]![0]))).toMatch(/erreur=/);
  });
});

describe("M6 — contrat-cadre signé et SIREN actif, contrôlés côté serveur", () => {
  const payer = {
    id: ID,
    to: "paye" as const,
    moyenPaiement: "virement",
    ibanEmpreinteAffichee: E,
  };

  it("sans contrat-cadre signé : refus, l'IBAN n'est même pas lu", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    garanties.mockResolvedValue(["contrat_cadre_absent"]);
    const r = await transitionStatementAction(payer);
    expect("error" in r && r.error).toMatch(/contrat-cadre/);
    expect(contexte).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("SIREN non confirmé : refus", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    garanties.mockResolvedValue(["siren_non_confirme"]);
    const r = await transitionStatementAction(payer);
    expect("error" in r && r.error).toMatch(/SIREN/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("double clic : le second trouve le relevé déjà payé, rien n'est réécrit", async () => {
    mockStatementFindUnique.mockResolvedValueOnce(releve());
    expect(await transitionStatementAction(payer)).toEqual({ data: { id: ID, statut: "paye" } });
    mockStatementFindUnique.mockResolvedValueOnce(releve({ statut: "paye" }));
    const r = await transitionStatementAction(payer);
    expect("error" in r).toBe(true);
    expect(tx.trainerStatement.updateMany).toHaveBeenCalledTimes(1);
  });

  it("témoin : un relevé MENSUEL ne lit ni les garanties ni l'IBAN", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ origine: "releve_mensuel", echeanceAt: null }),
    );
    const r = await transitionStatementAction({ id: ID, to: "paye", moyenPaiement: "virement" });
    expect(r).toEqual({ data: { id: ID, statut: "paye" } });
    expect(garanties).not.toHaveBeenCalled();
    expect(contexte).not.toHaveBeenCalled();
  });
});

describe("Lot D2 (M10) — le désaccord bloque le paiement de CE relevé, jusqu'à « non retenu »", () => {
  const payer = () =>
    transitionStatementAction({
      id: ID,
      to: "paye",
      moyenPaiement: "virement",
      ibanEmpreinteAffichee: E,
    });

  it("désaccord ouvert : refus, rien n'est écrit", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ contesteeAt: new Date("2032-01-02T10:00:00Z"), contestationMotif: "x" }),
    );
    const r = await payer();
    expect(r).toEqual({ error: expect.stringMatching(/CONTESTÉE/) });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("désaccord clos « accepté » (pièce annulée par avoir) : toujours refusé", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        contesteeAt: new Date("2032-01-02T10:00:00Z"),
        contestationCloseIssue: "acceptee",
      }),
    );
    expect(await payer()).toEqual({ error: expect.stringMatching(/CONTESTÉE/) });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("désaccord clos « non retenu » : le paiement passe, sous la même écriture conditionnelle", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        contesteeAt: new Date("2032-01-02T10:00:00Z"),
        contestationCloseIssue: "non_retenue",
      }),
    );
    const r = await payer();
    expect(r).not.toHaveProperty("error");
    expect(tx.trainerStatement.updateMany.mock.calls[0]![0].where).toMatchObject({
      OR: [{ contesteeAt: null }, { contestationCloseIssue: "non_retenue" }],
    });
  });
});
