/**
 * Chantier C4 — annuler un relevé de MISSION, et payer sous verrou.
 *
 *   · 🔴 Défaut 1 : « annulé » par la transition laissait les lignes du relevé
 *     vivantes (`calcule`/`valide`). Le passage suivant réécrivait le mois et
 *     heurtait `trainer_fee_lines_mission_unique` (statut ≠ annule) : la
 *     transaction levait chaque jour et le mois n'était plus jamais payé. Les
 *     lignes s'annulent désormais dans la MÊME transaction, derrière la même
 *     écriture conditionnelle.
 *   · Une pièce de mission ÉMISE (autofacture numérotée) ne s'annule pas d'un
 *     clic : elle passe par un avoir (`emettreAvoirMission`).
 *   · Défaut 5 : contrat-cadre, SIREN et attestation URSSAF sont RELUS dans la
 *     transaction, sous verrou, comme l'IBAN.
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
const garantiesSousVerrou = vi.fn();

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
  contexteVirementMission: (...a: unknown[]) => contexte(...a),
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/garanties-paiement-mission", () => ({
  garantiesPaiementMission: (...a: unknown[]) => garanties(...a),
  garantiesPaiementMissionSousVerrou: (...a: unknown[]) => garantiesSousVerrou(...a),
  LIBELLE_GARANTIE_PAIEMENT: {
    contrat_cadre_absent: "Aucun contrat-cadre signé",
    siren_non_confirme: "SIREN non confirmé",
  },
}));
vi.mock("@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi", () => ({
  envoyerVirementsFaits: vi.fn().mockResolvedValue(undefined),
}));

import { transitionStatementAction } from "./trainer-remuneration";

const ID = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const E = "a".repeat(64);

function releve(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ID,
    trainerId: TRAINER,
    periodeYear: 2031,
    periodeMonth: 12,
    statut: "a_valider",
    totalTtcCents: 42_000,
    numeroFacture: null,
    dateFacture: null,
    montantFactureTtcCents: null,
    autofactureAt: null,
    contesteeAt: null,
    contestationMotif: null,
    origine: "passage_mission",
    echeanceAt: new Date("2032-01-30T12:00:00Z"),
    avoirDeId: null,
    ...over,
  };
}

const AUTORISE = { autorise: true, motifs: [], retard: {} };

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  tx.$executeRawUnsafe.mockResolvedValue(0);
  tx.trainer.findUnique.mockResolvedValue({ ibanEmpreinte: E });
  tx.demandeChangementFormateur.count.mockResolvedValue(0);
  tx.trainerStatement.updateMany.mockResolvedValue({ count: 1 });
  tx.trainerFeeLine.updateMany.mockResolvedValue({ count: 2 });
  garanties.mockResolvedValue([]);
  garantiesSousVerrou.mockResolvedValue([]);
  contexte.mockResolvedValue({
    verdict: AUTORISE,
    preuve: { ibanFin4: "1234", ibanEmpreinte: E },
  });
});

describe("Défaut 1 — annuler un relevé de mission annule ses lignes, dans la même écriture", () => {
  it("non émis : relevé `annule` ET lignes `annule`, sous la même transaction conditionnelle", async () => {
    mockStatementFindUnique.mockResolvedValue(releve());
    const r = await transitionStatementAction({ id: ID, to: "annule" });
    expect(r).toEqual({ data: { id: ID, statut: "annule" } });
    // Écriture conditionnelle : encore non émise au moment du verrou.
    expect(tx.trainerStatement.updateMany.mock.calls[0]![0].where).toMatchObject({
      id: ID,
      statut: "a_valider",
      autofactureAt: null,
      numeroFacture: null,
    });
    // Les lignes vivantes (calcule ET valide) s'annulent : un statut, jamais un DELETE.
    expect(tx.trainerFeeLine.updateMany).toHaveBeenCalledWith({
      where: { statementId: ID, statut: { not: "annule" } },
      data: { statut: "annule", annuleMotif: "autre" },
    });
  });

  it("validé (lignes gelées) : les lignes `valide` sont annulées aussi", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    expect(await transitionStatementAction({ id: ID, to: "annule" })).toEqual({
      data: { id: ID, statut: "annule" },
    });
    expect(tx.trainerFeeLine.updateMany.mock.calls[0]![0].where).toEqual({
      statementId: ID,
      statut: { not: "annule" },
    });
  });

  it("écriture conditionnelle perdue (autofacture émise entre-temps) : AUCUNE ligne touchée", async () => {
    mockStatementFindUnique.mockResolvedValue(releve({ statut: "valide" }));
    tx.trainerStatement.updateMany.mockResolvedValue({ count: 0 });
    const r = await transitionStatementAction({ id: ID, to: "annule" });
    expect("error" in r).toBe(true);
    expect(tx.trainerFeeLine.updateMany).not.toHaveBeenCalled();
  });

  it("🔴 pièce ÉMISE (autofacture numérotée) : `annule` refusé, la correction passe par un avoir", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({
        statut: "valide",
        numeroFacture: "AXI-AUTOF-2032-0007",
        autofactureAt: new Date("2032-01-01T10:00:00Z"),
      }),
    );
    const r = await transitionStatementAction({ id: ID, to: "annule" });
    expect(r).toEqual({ error: expect.stringMatching(/avoir/) });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
    expect(tx.trainerFeeLine.updateMany).not.toHaveBeenCalled();
  });

  it("témoin : un relevé MENSUEL annulé garde son chemin (lignes non touchées ici)", async () => {
    mockStatementFindUnique.mockResolvedValue(
      releve({ origine: "releve_mensuel", echeanceAt: null }),
    );
    expect(await transitionStatementAction({ id: ID, to: "annule" })).toEqual({
      data: { id: ID, statut: "annule" },
    });
    expect(tx.trainerFeeLine.updateMany).not.toHaveBeenCalled();
    expect(tx.trainerStatement.updateMany.mock.calls[0]![0].where).not.toHaveProperty(
      "numeroFacture",
    );
  });
});

describe("Défaut 5 — « Virement fait » relit les trois garanties DANS la transaction", () => {
  const payer = () =>
    transitionStatementAction({
      id: ID,
      to: "paye",
      moyenPaiement: "virement",
      ibanEmpreinteAffichee: E,
    });
  const aPayer = () =>
    releve({
      statut: "facture_recue",
      numeroFacture: "AXI-AUTOF-2032-0007",
      autofactureAt: new Date("2032-01-01T10:00:00Z"),
      montantFactureTtcCents: 42_000,
    });

  it("tout tient sous verrou : payé, et les garanties sont relues avec le client de la transaction", async () => {
    mockStatementFindUnique.mockResolvedValue(aPayer());
    expect(await payer()).toEqual({ data: { id: ID, statut: "paye" } });
    expect(garantiesSousVerrou).toHaveBeenCalledWith(tx, TRAINER, expect.any(Date));
    // Deux lectures du contexte : avant (affichage des motifs), puis sous verrou.
    expect(contexte).toHaveBeenCalledTimes(2);
    expect(contexte.mock.calls[1]![0]).toBe(tx);
  });

  it("contrat-cadre annulé entre la garde et le verrou : rien n'est payé", async () => {
    mockStatementFindUnique.mockResolvedValue(aPayer());
    garantiesSousVerrou.mockResolvedValue(["contrat_cadre_absent"]);
    const r = await payer();
    expect(r).toEqual({ error: expect.stringMatching(/contrat-cadre/) });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("SIREN devenu rouge entre la garde et le verrou : rien n'est payé", async () => {
    mockStatementFindUnique.mockResolvedValue(aPayer());
    garantiesSousVerrou.mockResolvedValue(["siren_non_confirme"]);
    expect(await payer()).toEqual({ error: expect.stringMatching(/SIREN/) });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });

  it("attestation URSSAF archivée entre la garde et le verrou : rien n'est payé", async () => {
    mockStatementFindUnique.mockResolvedValue(aPayer());
    contexte.mockImplementation(async (db: unknown) =>
      db === tx
        ? {
            verdict: {
              autorise: false,
              motifs: ["attestation_urssaf_echue_a_la_mission"],
              retard: {},
            },
            preuve: null,
          }
        : { verdict: AUTORISE, preuve: { ibanFin4: "1234", ibanEmpreinte: E } },
    );
    const r = await payer();
    expect(r).toEqual({ error: expect.stringMatching(/attestation URSSAF/) });
    expect(tx.trainerStatement.updateMany).not.toHaveBeenCalled();
  });
});
