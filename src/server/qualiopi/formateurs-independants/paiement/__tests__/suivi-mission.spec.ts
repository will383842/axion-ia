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
const candidats = vi.fn();
const emailLogs = vi.fn();
const formateurs = vi.fn();
const corbeille = vi.fn();
/** Journal d'activité en mémoire : la trace « alerte partie » s'y lit et s'y écrit. */
const journal: Array<{ action: string; targetId: string | null; changes: { cle?: string } }> = [];
const journalEnPanne = { oui: false };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findMany: (...a: unknown[]) => findMany(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
    trainer: { findMany: (...a: unknown[]) => formateurs(...a) },
    trainingSession: { findMany: async () => [{ id: "s1", numero: "AXI-SESS-2026-042" }] },
    emailLog: { count: (...a: unknown[]) => emailLogs(...a) },
    emailOutbox: { count: (...a: unknown[]) => corbeille(...a) },
    activityLog: {
      count: async (a: {
        where: { action: string; targetId: string; changes: { path: string[]; equals: string } };
      }) =>
        journal.filter(
          (j) =>
            j.action === a.where.action &&
            j.targetId === a.where.targetId &&
            j.changes.cle === a.where.changes.equals,
        ).length,
      create: async (a: { data: (typeof journal)[number] }) => {
        if (journalEnPanne.oui) throw new Error("journal indisponible");
        journal.push(a.data);
        return a.data;
      },
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
vi.mock("../passage-mission-base", () => ({ lireCandidats: (...a: unknown[]) => candidats(...a) }));

import { passerSuiviMission } from "../suivi-mission";

const T = "22222222-2222-4222-8222-222222222222";
const AV = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Répond selon la requête : statuts du mois, avoirs ouverts, avoirs à rembourser. */
function base(
  over: { statuts?: string[]; ouverts?: string[]; regime?: string; aRembourser?: boolean } = {},
) {
  findMany.mockImplementation(async (a: { where: Record<string, unknown> }) => {
    if ("periodeYear" in a.where) return (over.statuts ?? []).map((statut) => ({ statut }));
    if ("remboursementDemandeAt" in a.where)
      return over.aRembourser === false
        ? []
        : [
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
  journal.length = 0;
  journalEnPanne.oui = false;
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
  candidats.mockResolvedValue([]);
  emailLogs.mockResolvedValue(0);
  corbeille.mockResolvedValue(0);
  formateurs.mockResolvedValue([
    { id: T, email: "f@exemple.test", prenom: "Paule", statut: "sous_traitant" },
  ]);
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

  it("🔴 C4 — F54 échoué hier : REPRIS au passage suivant, même sans nouvelle demande", async () => {
    // Hier : demande posée, F54 parti en échec (journal `failed` ou rien). Aujourd'hui,
    // `traiterTropPercu` ne pose plus de demande (déjà demandée) : le F54 doit repartir.
    base({ ouverts: [T] });
    traiter.mockResolvedValue({ imputeHtCents: 0, demandesRemboursement: 0 });
    emailLogs.mockResolvedValue(0);
    const b = await passerSuiviMission(new Date("2027-02-03T08:00:00Z"));
    expect(b.f54).toBe(1);
    expect(envoyer.mock.calls[0]![0].jobId).toBe(`formateur-trop-percu-${AV}`);
    // Toutes les demandes posées (pas seulement celles de CE passage).
    const where = findMany.mock.calls
      .map((c) => c[0].where as Record<string, unknown>)
      .find((w) => "remboursementDemandeAt" in w);
    expect(where!.remboursementDemandeAt).toEqual({ not: null });
    // Le journal des envois fait foi (un échec ne compte pas).
    expect(emailLogs).toHaveBeenCalledWith({
      where: { jobId: `formateur-trop-percu-${AV}`, status: { not: "failed" } },
    });
  });

  it("C4 — F54 déjà parti (journal non en échec) : pas de second envoi", async () => {
    base({ ouverts: [T] });
    traiter.mockResolvedValue({ imputeHtCents: 0, demandesRemboursement: 0 });
    emailLogs.mockResolvedValue(1);
    expect((await passerSuiviMission(new Date("2027-02-03T08:00:00Z"))).f54).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("C4 — F54 garé en corbeille de validation : jamais regaré chaque jour", async () => {
    base({ ouverts: [T] });
    corbeille.mockResolvedValue(1);
    expect((await passerSuiviMission(new Date("2027-02-03T08:00:00Z"))).f54).toBe(0);
    expect(corbeille).toHaveBeenCalledWith({ where: { jobId: `formateur-trop-percu-${AV}` } });
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("relevé suivant recalculable : imputé sous les verrous de SA période, aucun F54", async () => {
    // Imputé, donc jamais demandé : aucun avoir « à rembourser ».
    base({ ouverts: [T], aRembourser: false });
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

describe("feuilles manquantes (M8) — F35, alertes J+10 et J+20", () => {
  /** Deux journées prévues les 16 et 17/11 ; seule la matinée du 16 est contresignée. */
  const mission = {
    trainerId: T,
    sessionId: "s1",
    premiereJournee: "2026-11-16",
    conditions: null,
    contresignatures: [{ jour: "2026-11-16", demiJournee: "matin" }],
    journeesPrevues: [
      { jour: "2026-11-16", heureDebut: "09:00", heureFin: "17:00" },
      { jour: "2026-11-17", heureDebut: "09:00", heureFin: "17:00" },
    ],
    conditionFinanceurEnAttente: false,
  };

  it("J+2 : rien ; J+3 : F35 une fois (3 demi-journées), clé par mission et par mois", async () => {
    candidats.mockResolvedValue([mission]);
    await passerSuiviMission(new Date("2026-11-19T08:00:00Z"));
    expect(envoyer).not.toHaveBeenCalled();
    const b = await passerSuiviMission(new Date("2026-11-20T08:00:00Z"));
    expect(b.f35).toBe(1);
    const e = envoyer.mock.calls[0]![0];
    expect(e).toMatchObject({
      gabarit: "formateur-feuilles-manquantes",
      jobId: `fi-feuilles-${T}-s1-2026-11`,
      payload: { valeurs: { N: "3" } },
    });
    expect(e.payload.valeurs.jour).toMatch(/16 novembre, mardi 17 novembre/);
    // Déjà parti : le journal des envois le dit, rien ne repart.
    emailLogs.mockResolvedValue(1);
    await passerSuiviMission(new Date("2026-11-21T08:00:00Z"));
    expect(envoyer).toHaveBeenCalledTimes(1);
  });

  it("J+10 puis J+20 : une alerte interne chaque fois, sans nom ; J+11 : rien de plus", async () => {
    candidats.mockResolvedValue([mission]);
    emailLogs.mockResolvedValue(1);
    expect((await passerSuiviMission(new Date("2026-11-27T08:00:00Z"))).alertesFeuilles).toBe(1);
    expect((await passerSuiviMission(new Date("2026-11-28T08:00:00Z"))).alertesFeuilles).toBe(0);
    expect((await passerSuiviMission(new Date("2026-12-07T08:00:00Z"))).alertesFeuilles).toBe(1);
    const corps = telegram.mock.calls.map((c) => c[0].body).join("\n");
    expect(corps).toMatch(/AXI-SESS-2026-042/);
    expect(corps).toMatch(/Payer sur constat/);
    expect(corps).not.toContain("Paule");
  });

  it("🔴 8B — le passage de J+10 manqué : l'alerte part à J+12, puis plus jamais", async () => {
    candidats.mockResolvedValue([mission]);
    emailLogs.mockResolvedValue(1);
    // Aucun passage le 27/11 (J+10) : avant, l'alerte ne partait jamais (`===`).
    expect((await passerSuiviMission(new Date("2026-11-29T08:00:00Z"))).alertesFeuilles).toBe(1);
    expect((await passerSuiviMission(new Date("2026-11-30T08:00:00Z"))).alertesFeuilles).toBe(0);
    expect((await passerSuiviMission(new Date("2026-12-01T08:00:00Z"))).alertesFeuilles).toBe(0);
    // La trace porte la mission et le mois, jamais un nom.
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      action: "qualiopi.formateur.feuilles_alerte_j10",
      targetId: T,
      changes: { cle: "s1:2026-11" },
    });
    expect(JSON.stringify(journal)).not.toContain("Paule");
  });

  it("🔴 8B — premier passage à J+25 : J+10 et J+20 partent chacune une fois, sans doublon", async () => {
    candidats.mockResolvedValue([mission]);
    emailLogs.mockResolvedValue(1);
    expect((await passerSuiviMission(new Date("2026-12-12T08:00:00Z"))).alertesFeuilles).toBe(2);
    expect((await passerSuiviMission(new Date("2026-12-13T08:00:00Z"))).alertesFeuilles).toBe(0);
    expect(telegram).toHaveBeenCalledTimes(2);
  });

  it("8B — trace impossible à écrire : pas d'alerte (sinon elle se répéterait chaque jour)", async () => {
    candidats.mockResolvedValue([mission]);
    emailLogs.mockResolvedValue(1);
    journalEnPanne.oui = true;
    expect((await passerSuiviMission(new Date("2026-11-29T08:00:00Z"))).alertesFeuilles).toBe(0);
    expect(telegram).not.toHaveBeenCalled();
  });

  it("feuilles complètes, ou formateur salarié : rien", async () => {
    candidats.mockResolvedValue([
      {
        ...mission,
        contresignatures: [
          { jour: "2026-11-16", demiJournee: "journee" },
          { jour: "2026-11-17", demiJournee: "journee" },
        ],
      },
    ]);
    expect((await passerSuiviMission(new Date("2026-11-27T08:00:00Z"))).alertesFeuilles).toBe(0);
    candidats.mockResolvedValue([mission]);
    formateurs.mockResolvedValue([{ id: T, email: "x", prenom: "P", statut: "salarie" }]);
    const b = await passerSuiviMission(new Date("2026-11-27T08:00:00Z"));
    expect(b.f35 + b.alertesFeuilles).toBe(0);
    expect(envoyer).not.toHaveBeenCalled();
  });
});
