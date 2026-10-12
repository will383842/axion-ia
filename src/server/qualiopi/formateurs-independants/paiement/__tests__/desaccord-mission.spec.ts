// @vitest-environment node

/**
 * Lot D2 (M10) — le désaccord sur un relevé de MISSION.
 *
 *   · le formateur ne signale que sur SA facture de mission, dans la fenêtre, une fois ;
 *     F58 part, l'administrateur est prévenu (sans nom) ;
 *   · « accepté » : recalcul par le passage (aucun montant saisi), avoir TOTAL puis
 *     réémission dans UNE transaction sous verrous ; n'écrit que le HT vu ; rejeu = rien ;
 *   · « non retenu » : motif obligatoire, F59, seule sortie qui débloque le paiement ;
 *   · contre-calcul chiffré (HT, TVA, TTC) : avoir et relevé réémis, assujetti et franchise.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CandidatMission } from "../passage-mission";

const findUnique = vi.fn();
const updateMany = vi.fn();
const activityLog = vi.fn();
const lireBascule = vi.fn();
const unique = vi.fn();
const candidats = vi.fn();
const envoyer = vi.fn();
const telegram = vi.fn();
const verrous = vi.fn();

/** Un faux client de transaction : il garde ce qui est écrit, pour le contre-calcul. */
function fauxTx(piece: Record<string, unknown>) {
  const crees: Array<Record<string, unknown>> = [];
  const lignes: Array<Record<string, unknown>> = [];
  let n = 0;
  const tx = {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ n: 0 }]),
    activityLog: { create: vi.fn() },
    trainerStatement: {
      findUnique: vi.fn(async () => piece),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        n += 1;
        crees.push(a.data);
        return { id: `0000000${n}-0000-4000-8000-000000000000` };
      }),
      // L'annulation de la pièce par l'avoir est relue par la réémission.
      update: vi.fn(async (a: { data: Record<string, unknown> }) => Object.assign(piece, a.data)),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    trainerFeeLine: {
      createMany: vi.fn(async (a: { data: Array<Record<string, unknown>> }) => {
        lignes.push(...a.data);
      }),
      updateMany: vi.fn(),
    },
  };
  return { tx, crees, lignes };
}

let courant: ReturnType<typeof fauxTx>;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerStatement: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
    },
    activityLog: { create: (...a: unknown[]) => activityLog(...a) },
    $transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(courant.tx),
  },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => telegram(...a) }));
vi.mock("../../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
vi.mock("../lecture-passage", () => ({
  lireDateBascule: (...a: unknown[]) => lireBascule(...a),
  uniqueHistoriqueRetire: (...a: unknown[]) => unique(...a),
}));
vi.mock("../passage-mission-base", () => ({
  lireCandidats: (...a: unknown[]) => candidats(...a),
  instantDuJour: (jour: string) => new Date(`${jour}T12:00:00Z`),
}));
vi.mock("@/server/qualiopi/remuneration/verrou-remuneration", () => ({
  prendreVerrousRemuneration: (...a: unknown[]) => verrous(...a),
  DELAIS_TRANSACTION_SOUS_VERROU_REMUNERATION: {},
}));

import {
  accepterDesaccord,
  apercuDesaccordAccepte,
  refuserDesaccord,
  signalerDesaccord,
} from "../desaccord-mission";
import { desaccordBloquant } from "../desaccord-regle";

const R = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T = "22222222-2222-4222-8222-222222222222";
const AUTRE = "99999999-9999-4999-8999-999999999999";
const S = "33333333-3333-4333-8333-333333333333";
const ADMIN = "44444444-4444-4444-8444-444444444444";
const MAINTENANT = new Date("2026-12-01T10:00:00Z");

/** La facture contestée : UNE journée payée (2 demi-journées + 1 jour de déplacement). */
function piece(over: Record<string, unknown> = {}) {
  return {
    id: R,
    trainerId: T,
    sessionId: S,
    periodeYear: 2026,
    periodeMonth: 11,
    statut: "facture_recue",
    origine: "passage_mission",
    avoirDeId: null,
    autofactureAt: new Date("2026-11-25T10:00:00Z"),
    numeroFacture: "AXI-AUTOF-2026-0007",
    payeAt: null,
    contestationAvantAt: new Date("2026-12-03T10:00:00Z"),
    contesteeAt: new Date("2026-11-28T10:00:00Z"),
    contestationCloseAt: null,
    tvaRegime: "assujetti_20",
    // 2 × 30 000 + 5 000 = 65 000 HT ; TVA 13 000 ; TTC 78 000.
    totalHtCents: 65_000,
    tvaCents: 13_000,
    totalTtcCents: 78_000,
    echeanceAt: new Date("2026-12-16T12:00:00Z"),
    feeLines: [
      { id: "l1", objet: "animation", montantHtCents: 60_000, demiJournees: 2 },
      { id: "l2", objet: "deplacement", montantHtCents: 5_000, demiJournees: null },
    ],
    trainer: { email: "f@exemple.test", prenom: "Paule" },
    ...over,
  };
}

/** La donnée d'origine CORRIGÉE : deux journées pleines, toutes signées. */
function candidat(regimeTva = "assujetti_20"): CandidatMission {
  return {
    trainerId: T,
    sessionId: S,
    premiereJournee: "2026-11-16",
    conditions: {
      tarifJourneeHtCents: 60_000,
      forfaitDeplacementParJourHtCents: 5_000,
      regimeTva: regimeTva as "assujetti_20",
    },
    contresignatures: [
      { jour: "2026-11-16", demiJournee: "journee" },
      { jour: "2026-11-17", demiJournee: "journee" },
    ],
    journeesPrevues: [
      { jour: "2026-11-16", heureDebut: "09:00", heureFin: "17:00" },
      { jour: "2026-11-17", heureDebut: "09:00", heureFin: "17:00" },
    ],
    conditionFinanceurEnAttente: false,
    revendiqueParMission: true,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  lireBascule.mockResolvedValue("2026-11-01");
  unique.mockResolvedValue(true);
  candidats.mockResolvedValue([candidat()]);
  findUnique.mockResolvedValue(piece());
  updateMany.mockResolvedValue({ count: 1 });
  envoyer.mockResolvedValue("envoye");
  courant = fauxTx(piece());
});

describe("signalerDesaccord (formateur)", () => {
  const ouverte = () =>
    piece({ contesteeAt: null, contestationAvantAt: new Date("2026-12-03T10:00:00Z") });

  it("sa facture de mission, dans la fenêtre : bloque, F58, alerte sans nom, journal sans le texte", async () => {
    findUnique.mockResolvedValue(ouverte());
    const issue = await signalerDesaccord({
      trainerId: T,
      statementId: R,
      texte: "  Il manque la journée du 17.  ",
      maintenant: MAINTENANT,
    });
    expect(issue).toBe("enregistre");
    expect(updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: R, trainerId: T, contesteeAt: null, payeAt: null },
      data: { contesteeAt: MAINTENANT, contestationMotif: "Il manque la journée du 17." },
    });
    expect(envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-desaccord-recu",
      jobId: `fi-contestation-${R}-recue`,
      payload: { valeurs: { numéro: "AXI-AUTOF-2026-0007", date: "1 décembre 2026" } },
    });
    expect(telegram.mock.calls[0]![0].body).not.toContain("Paule");
    const journal = JSON.stringify(activityLog.mock.calls[0]![0]);
    expect(journal).toContain(R);
    expect(journal).not.toContain("journée du 17");
  });

  it("le relevé d'un AUTRE formateur : « introuvable », rien n'est écrit", async () => {
    findUnique.mockResolvedValue(ouverte());
    expect(
      await signalerDesaccord({
        trainerId: AUTRE,
        statementId: R,
        texte: "x",
        maintenant: MAINTENANT,
      }),
    ).toBe("introuvable");
    expect(updateMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("un relevé MENSUEL, une facture payée ou un avoir : refusés", async () => {
    for (const over of [
      { origine: "releve_mensuel" },
      { statut: "paye", payeAt: MAINTENANT },
      { avoirDeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    ]) {
      findUnique.mockResolvedValue(piece({ contesteeAt: null, ...over }));
      expect(
        await signalerDesaccord({
          trainerId: T,
          statementId: R,
          texte: "x",
          maintenant: MAINTENANT,
        }),
      ).toBe("non_contestable");
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("hors délai, texte vide ou trop long, interrupteur sans date : rien n'est écrit", async () => {
    findUnique.mockResolvedValue(piece({ contesteeAt: null }));
    expect(
      await signalerDesaccord({
        trainerId: T,
        statementId: R,
        texte: "x",
        maintenant: new Date("2026-12-04T10:00:00Z"),
      }),
    ).toBe("hors_delai");
    expect(
      await signalerDesaccord({
        trainerId: T,
        statementId: R,
        texte: "  ",
        maintenant: MAINTENANT,
      }),
    ).toBe("texte_invalide");
    expect(
      await signalerDesaccord({
        trainerId: T,
        statementId: R,
        texte: "x".repeat(1001),
        maintenant: MAINTENANT,
      }),
    ).toBe("texte_invalide");
    lireBascule.mockResolvedValue(null);
    expect(
      await signalerDesaccord({ trainerId: T, statementId: R, texte: "x", maintenant: MAINTENANT }),
    ).toBe("coupe");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("double clic : la seconde écriture conditionnelle ne trouve rien, aucun second F58", async () => {
    findUnique.mockResolvedValue(ouverte());
    updateMany.mockResolvedValue({ count: 0 });
    expect(
      await signalerDesaccord({ trainerId: T, statementId: R, texte: "x", maintenant: MAINTENANT }),
    ).toBe("deja_signale");
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("apercuDesaccordAccepte — recalcul par le passage, jamais saisi", () => {
  it("contre-calcul assujetti : 4 × 30 000 + 2 × 5 000 = 130 000 HT, 26 000 TVA, 156 000 TTC", async () => {
    const a = await apercuDesaccordAccepte(R);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.ancien).toEqual({
      numero: "AXI-AUTOF-2026-0007",
      totalHtCents: 65_000,
      tvaCents: 13_000,
      totalTtcCents: 78_000,
    });
    expect(a.nouveau.releve.totalHtCents).toBe(130_000);
    expect(a.nouveau.releve.tvaCents).toBe(26_000);
    expect(a.nouveau.releve.totalTtcCents).toBe(156_000);
  });

  it("contre-calcul franchise en base : 130 000 / 0 / 130 000", async () => {
    candidats.mockResolvedValue([candidat("franchise_293b")]);
    const a = await apercuDesaccordAccepte(R);
    if (!a.ok) throw new Error(a.motif);
    expect([
      a.nouveau.releve.totalHtCents,
      a.nouveau.releve.tvaCents,
      a.nouveau.releve.totalTtcCents,
    ]).toEqual([130_000, 0, 130_000]);
  });

  it("la donnée n'a pas été corrigée : « rien n'a changé »", async () => {
    findUnique.mockResolvedValue(
      piece({
        totalHtCents: 130_000,
        feeLines: [
          { objet: "animation", montantHtCents: 120_000, demiJournees: 4 },
          { objet: "deplacement", montantHtCents: 10_000, demiJournees: null },
        ],
      }),
    );
    expect(await apercuDesaccordAccepte(R)).toEqual({ ok: false, motif: "rien_n_a_change" });
  });

  it("indemnité sur le relevé, désaccord déjà clos, mois incomplet : refus", async () => {
    findUnique.mockResolvedValue(
      piece({
        feeLines: [{ objet: "indemnite_annulation", montantHtCents: 1, demiJournees: null }],
      }),
    );
    expect((await apercuDesaccordAccepte(R)).ok).toBe(false);
    findUnique.mockResolvedValue(piece({ contestationCloseAt: MAINTENANT }));
    expect(await apercuDesaccordAccepte(R)).toEqual({
      ok: false,
      motif: "pas_de_desaccord_ouvert",
    });
    findUnique.mockResolvedValue(piece());
    candidats.mockResolvedValue([
      { ...candidat(), contresignatures: [{ jour: "2026-11-16", demiJournee: "journee" }] },
    ]);
    expect(await apercuDesaccordAccepte(R)).toEqual({ ok: false, motif: "mois_non_payable" });
  });
});

describe("accepterDesaccord — avoir TOTAL puis réémission, une seule fois", () => {
  it("écrit l'avoir (montants niés) et le relevé recalculé, sous verrous ; échéance d'origine gardée", async () => {
    const r = await accepterDesaccord({
      statementId: R,
      htVuCents: 130_000,
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ issue: "acceptee" });
    expect(verrous).toHaveBeenCalledWith(courant.tx, {
      periodes: [{ year: 2026, month: 11 }],
      trainerIds: [T],
    });
    const [avoir, reemis] = courant.crees;
    // Contre-calcul de l'avoir : −65 000 HT, −13 000 TVA, −78 000 TTC.
    expect(avoir).toMatchObject({
      avoirDeId: R,
      totalHtCents: -65_000,
      tvaCents: -13_000,
      totalTtcCents: -78_000,
    });
    // Contre-calcul de la réémission : 130 000 / 26 000 / 156 000, « à valider ».
    expect(reemis).toMatchObject({
      remplaceId: R,
      statut: "a_valider",
      totalHtCents: 130_000,
      tvaCents: 26_000,
      totalTtcCents: 156_000,
      echeanceAt: new Date("2026-12-16T12:00:00Z"),
    });
    // Clôture tracée : qui, quand, issue.
    const cloture = courant.tx.trainerStatement.updateMany.mock.calls.at(-1)![0];
    expect(cloture).toMatchObject({
      where: { id: R, contestationCloseAt: null },
      data: {
        contestationCloseAt: MAINTENANT,
        contestationCloseParId: ADMIN,
        contestationCloseIssue: "acceptee",
      },
    });
  });

  it("le HT recalculé n'est plus celui de l'aperçu : rien n'est écrit", async () => {
    const r = await accepterDesaccord({
      statementId: R,
      htVuCents: 120_000,
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ issue: "refusee", motif: "apercu_perime" });
    expect(courant.crees).toHaveLength(0);
  });

  it("rejeu ou second administrateur : le désaccord est clos, rien de plus", async () => {
    findUnique.mockResolvedValue(piece({ contestationCloseAt: MAINTENANT, statut: "annule" }));
    const r = await accepterDesaccord({
      statementId: R,
      htVuCents: 130_000,
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ issue: "refusee", motif: "deja_traite" });
    expect(courant.crees).toHaveLength(0);
  });

  it("relu sous verrou déjà clos (course perdue) : rien n'est écrit", async () => {
    courant = fauxTx(piece({ contestationCloseAt: MAINTENANT }));
    const r = await accepterDesaccord({
      statementId: R,
      htVuCents: 130_000,
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ issue: "refusee", motif: "deja_traite" });
    expect(courant.crees).toHaveLength(0);
  });

  it("M-D non fait : refus net, aucune transaction", async () => {
    unique.mockResolvedValue(false);
    const r = await accepterDesaccord({
      statementId: R,
      htVuCents: 130_000,
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ issue: "refusee", motif: "contract_non_fait" });
    expect(verrous).not.toHaveBeenCalled();
  });
});

describe("refuserDesaccord — le seul déblocage, tracé", () => {
  it("motif écrit : clôture conditionnelle (qui, quand, motif), puis F59 avec ce motif", async () => {
    const r = await refuserDesaccord({
      statementId: R,
      motif: "  La journée du 17 a été annulée par le client.  ",
      parId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ issue: "non_retenu", envoi: "envoye" });
    expect(updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: R, origine: "passage_mission", contestationCloseAt: null, payeAt: null },
      data: {
        contestationCloseAt: MAINTENANT,
        contestationCloseParId: ADMIN,
        contestationCloseIssue: "non_retenue",
        contestationCloseMotif: "La journée du 17 a été annulée par le client.",
      },
    });
    expect(envoyer.mock.calls[0]![0]).toMatchObject({
      gabarit: "formateur-desaccord-non-retenu",
      jobId: `fi-contestation-${R}-close`,
      payload: {
        valeurs: {
          numéro: "AXI-AUTOF-2026-0007",
          "motif écrit par vous": "La journée du 17 a été annulée par le client.",
        },
      },
    });
  });

  it("sans motif : rien n'est écrit ; déjà clos : aucun second F59", async () => {
    expect(
      (
        await refuserDesaccord({
          statementId: R,
          motif: "non",
          parId: ADMIN,
          maintenant: MAINTENANT,
        })
      ).issue,
    ).toBe("motif_requis");
    expect(updateMany).not.toHaveBeenCalled();
    updateMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await refuserDesaccord({
          statementId: R,
          motif: "Motif suffisant ici.",
          parId: ADMIN,
          maintenant: MAINTENANT,
        })
      ).issue,
    ).toBe("deja_traite");
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("desaccordBloquant — une règle, lue par la transition et par la vue", () => {
  it("contesté : bloque ; clos « non retenu » : débloque ; jamais contesté : libre", () => {
    expect(desaccordBloquant({ contesteeAt: MAINTENANT })).toBe(true);
    expect(desaccordBloquant({ contesteeAt: MAINTENANT, contestationCloseIssue: "acceptee" })).toBe(
      true,
    );
    expect(
      desaccordBloquant({ contesteeAt: MAINTENANT, contestationCloseIssue: "non_retenue" }),
    ).toBe(false);
    expect(desaccordBloquant({ contesteeAt: null })).toBe(false);
  });
});

describe("la vue des virements écrit la valeur en clair (module neutre)", () => {
  it("reste égale à ISSUE_DESACCORD_NON_RETENU", async () => {
    const { ISSUE_DESACCORD_NON_RETENU } = await import("../desaccord-regle");
    const src = readFileSync(
      path.join(process.cwd(), "src/server/paiements-sortants/virements.ts"),
      "utf8",
    );
    expect(src).toContain(`contestationCloseIssue: "${ISSUE_DESACCORD_NON_RETENU}"`);
  });
});
