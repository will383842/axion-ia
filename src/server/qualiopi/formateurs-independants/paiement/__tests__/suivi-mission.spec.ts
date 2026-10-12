// @vitest-environment node

/**
 * Lot D2 (M22) — le suivi quotidien du paiement par mission :
 *   · sans date de bascule : rien n'est lu ni envoyé ;
 *   · le 1er du mois : un rappel interne (aucun calcul automatique) ;
 *   · à partir du 1er + 5 jours : une alerte interne s'il reste un relevé à valider ;
 *   · trop-perçu : `traiterTropPercu` sous verrous ; F54 une fois par avoir, avec le
 *     reste TTC (contre-calcul 10 000 HT → 12 000 TTC assujetti ; 10 000 en franchise).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const bascule = vi.fn();
const findMany = vi.fn();
const findFirst = vi.fn();
const traiter = vi.fn();
const verrous = vi.fn();
const telegram = vi.fn();
const envoyer = vi.fn();
const rib = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn({ tx: true }),
  },
}));
vi.mock("@/lib/legal-identity", () => ({ resolveRibFacture: () => rib() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => telegram(...a) }));
vi.mock("@/server/qualiopi/remuneration/verrou-remuneration", () => ({
  prendreVerrousRemuneration: (...a: unknown[]) => verrous(...a),
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION: {},
}));
vi.mock("../../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
vi.mock("../corrections-mission", () => ({ traiterTropPercu: (...a: unknown[]) => traiter(...a) }));
vi.mock("../lecture-passage", () => ({ lireDateBascule: (...a: unknown[]) => bascule(...a) }));

import { passerSuiviMission } from "../suivi-mission";

const T = "22222222-2222-4222-8222-222222222222";
const AV = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Répond selon la requête : statuts du mois, avoirs ouverts, avoirs à rembourser. */
function base(over: { statuts?: string[]; ouverts?: string[]; regime?: string } = {}) {
  findMany.mockImplementation(async (a: { where: Record<string, unknown> }) => {
    if ("periodeYear" in a.where) return (over.statuts ?? []).map((statut) => ({ statut }));
    if ("remboursementDemandeAt" in a.where)
      return [
        {
          id: AV,
          numeroFacture: "AXI-AUTOF-2026-0010",
          totalHtCents: -10_000,
          tvaRegime: over.regime ?? "assujetti_20",
          avoirDe: { numeroFacture: "AXI-AUTOF-2026-0007" },
          imputations: [],
          trainer: { email: "f@exemple.test", prenom: "Paule" },
        },
      ];
    return (over.ouverts ?? []).map((trainerId) => ({ trainerId }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  bascule.mockResolvedValue("2026-11-01");
  findFirst.mockResolvedValue(null);
  traiter.mockResolvedValue({ imputeHtCents: 0, demandesRemboursement: 0 });
  envoyer.mockResolvedValue("envoye");
  rib.mockResolvedValue({
    titulaire: "Axion-IA SAS",
    iban: "FR7600000000000000000000000",
    bic: "AXIOFRPP",
  });
  base();
});

describe("passerSuiviMission", () => {
  it("sans date de bascule : coupé, rien n'est lu", async () => {
    bascule.mockResolvedValue(null);
    expect((await passerSuiviMission(new Date("2026-12-01T08:00:00Z"))).etat).toBe("coupe");
    expect(findMany).not.toHaveBeenCalled();
    expect(telegram).not.toHaveBeenCalled();
  });

  it("le 1er du mois : un rappel interne, aucun calcul", async () => {
    const b = await passerSuiviMission(new Date("2026-12-01T08:00:00Z"));
    expect(b.rappelBrouillon).toBe(true);
    expect(telegram.mock.calls[0]![0].body).toMatch(/novembre 2026/);
  });

  it("le 6 : alerte s'il reste un relevé du mois écoulé à valider ; pas le 5", async () => {
    base({ statuts: ["a_valider", "valide"] });
    expect((await passerSuiviMission(new Date("2026-12-05T08:00:00Z"))).alerteNonValides).toBe(0);
    const b = await passerSuiviMission(new Date("2026-12-06T08:00:00Z"));
    expect(b.alerteNonValides).toBe(1);
    expect(telegram.mock.calls.at(-1)![0].body).toMatch(/1 relevé/);
  });

  it("trop-perçu sans relevé suivant : demande marquée, F54 avec le reste TTC (10 000 HT → 120,00 €)", async () => {
    const maintenant = new Date("2027-02-01T08:00:00Z");
    base({ ouverts: [T] });
    traiter.mockResolvedValue({ imputeHtCents: 0, demandesRemboursement: 1 });
    const b = await passerSuiviMission(maintenant);
    expect(verrous).toHaveBeenCalledWith({ tx: true }, { periodes: [], trainerIds: [T] });
    expect(traiter.mock.calls[0]!.slice(1, 4)).toEqual([T, null, "2027-02-01"]);
    expect(b.f54).toBe(1);
    const e = envoyer.mock.calls[0]![0];
    expect(e.jobId).toBe(`formateur-trop-percu-${AV}`);
    expect(e.payload.valeurs).toMatchObject({
      numéro: "AXI-AUTOF-2026-0007",
      "numéro de l'avoir": "AXI-AUTOF-2026-0010",
      montant: "120,00",
    });
  });

  it("franchise : le reste TTC égale le HT (100,00 €)", async () => {
    base({ ouverts: [T], regime: "franchise_293b" });
    traiter.mockResolvedValue({ imputeHtCents: 0, demandesRemboursement: 1 });
    await passerSuiviMission(new Date("2027-02-02T08:00:00Z"));
    expect(envoyer.mock.calls[0]![0].payload.valeurs.montant).toBe("100,00");
  });

  it("relevé suivant recalculable : imputé sous les verrous de SA période, aucun F54", async () => {
    base({ ouverts: [T] });
    findFirst.mockResolvedValue({ id: "r2", periodeYear: 2027, periodeMonth: 1 });
    traiter.mockResolvedValue({ imputeHtCents: 10_000, demandesRemboursement: 0 });
    const b = await passerSuiviMission(new Date("2027-02-02T08:00:00Z"));
    expect(verrous.mock.calls[0]![1]).toEqual({
      periodes: [{ year: 2027, month: 1 }],
      trainerIds: [T],
    });
    expect(b.tropPercuImputeHtCents).toBe(10_000);
    expect(envoyer).not.toHaveBeenCalled();
  });
});
