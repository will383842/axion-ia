// @vitest-environment node

/**
 * L12c — le passage du paiement par mission (moteur pur) et le run mensuel
 * après la bascule.
 *
 *   · ÉTEINT : sans date de bascule, ou avant elle, rien ; tant que l'unique
 *     historique (M-D) est en base, rien ne s'écrit ;
 *   · une session commencée AVANT la bascule n'est jamais touchée (S19) ;
 *   · un mois n'est écrit que si TOUTES ses demi-journées prévues sont signées ;
 *   · une session sur trois mois donne trois relevés, chacun à son échéance (S07) ;
 *   · sans conditions figées sur la mission, rien n'est payé : une anomalie ;
 *   · le run mensuel, après la bascule, n'écarte que les indépendants des
 *     sessions non revendiquées par lui ; sans bascule, il est inchangé.
 */

import { describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => captureException(...a),
}));

import { filtrerPrestationsApresBascule } from "../apres-bascule";
import {
  passerPaiementsMission,
  planifierPassage,
  type CandidatMission,
  type DepsPassage,
} from "../passage-mission";

const CONDITIONS = {
  tarifJourneeHtCents: 35_000,
  forfaitDeplacementParJourHtCents: null,
  regimeTva: "franchise_293b" as const,
};

const JOUR = (jour: string) => ({ jour, heureDebut: "09:00", heureFin: "17:00" });
const SIG = (jour: string) => ({ jour, demiJournee: "journee" as const });

function candidat(over: Partial<CandidatMission> = {}): CandidatMission {
  return {
    trainerId: "t1",
    sessionId: "s1",
    premiereJournee: "2026-12-03",
    conditions: CONDITIONS,
    contresignatures: [SIG("2026-12-03")],
    journeesPrevues: [JOUR("2026-12-03")],
    conditionFinanceurEnAttente: false,
    ...over,
  };
}

describe("planifierPassage (pur)", () => {
  it("S19 : une session commencée avant la bascule appartient au relevé mensuel", () => {
    const p = planifierPassage(
      [
        candidat({
          premiereJournee: "2026-11-28",
          contresignatures: [SIG("2026-11-28"), SIG("2026-12-05")],
          journeesPrevues: [JOUR("2026-11-28"), JOUR("2026-12-05")],
        }),
      ],
      "2026-12-01",
    );
    expect(p).toEqual({ aEcrire: [], enAttente: [], anomalies: [] });
  });

  it("S07 après la bascule : trois mois, trois relevés, chacun à son échéance", () => {
    const jours = ["2027-01-25", "2027-02-08", "2027-02-22", "2027-03-08", "2027-03-15"];
    const p = planifierPassage(
      [
        candidat({
          premiereJournee: jours[0]!,
          contresignatures: jours.map(SIG),
          journeesPrevues: jours.map(JOUR),
        }),
      ],
      "2027-01-01",
    );
    expect(
      p.aEcrire.map((m) => [m.releve.mois, m.releve.totalHtCents, m.releve.echeance, m.sansEcart]),
    ).toEqual([
      ["2027-01", 35_000, "2027-02-24", true],
      ["2027-02", 70_000, "2027-03-24", true],
      ["2027-03", 70_000, "2027-04-14", true],
    ]);
  });

  it("un mois dont une demi-journée prévue n'est pas signée attend (relance J+3) ; les autres partent", () => {
    const p = planifierPassage(
      [
        candidat({
          premiereJournee: "2026-12-03",
          contresignatures: [SIG("2026-12-03"), { jour: "2027-01-07", demiJournee: "matin" }],
          journeesPrevues: [JOUR("2026-12-03"), JOUR("2027-01-07")],
        }),
      ],
      "2026-12-01",
    );
    expect(p.aEcrire.map((m) => m.releve.mois)).toEqual(["2026-12"]);
    expect(p.enAttente).toEqual([
      {
        trainerId: "t1",
        sessionId: "s1",
        mois: "2027-01",
        raison: "feuilles_incompletes",
        manquantes: 1,
      },
    ]);
  });

  it("sans conditions figées sur la mission : rien n'est payé, une anomalie", () => {
    const p = planifierPassage([candidat({ conditions: null })], "2026-12-01");
    expect(p.aEcrire).toEqual([]);
    expect(p.anomalies).toEqual([
      { trainerId: "t1", sessionId: "s1", motif: "conditions_absentes" },
    ]);
  });

  it("un forfait au-dessus du plafond n'est jamais payé : une anomalie", () => {
    const p = planifierPassage(
      [candidat({ conditions: { ...CONDITIONS, forfaitDeplacementParJourHtCents: 20_000 } })],
      "2026-12-01",
    );
    expect(p.anomalies.map((a) => a.motif)).toEqual(["conditions_hors_plafond"]);
  });

  it("une condition du financeur en attente : rien n'est payable", () => {
    const p = planifierPassage([candidat({ conditionFinanceurEnAttente: true })], "2026-12-01");
    expect(p.enAttente.map((e) => e.raison)).toEqual(["condition_financeur_en_attente"]);
  });

  it("signatures sur un mois SANS journée prévue pour lui : jamais payé seul (le reste du mois serait perdu)", () => {
    const p = planifierPassage([candidat({ journeesPrevues: [] })], "2026-12-01");
    expect(p.aEcrire).toEqual([]);
    expect(p.anomalies).toEqual([{ trainerId: "t1", sessionId: "s1", motif: "prevu_absent" }]);
  });

  it("une demi-journée signée sur quatre prévues : le mois attend, rien n'est écrit", () => {
    const p = planifierPassage(
      [
        candidat({
          contresignatures: [{ jour: "2026-12-03", demiJournee: "matin" }],
          journeesPrevues: [JOUR("2026-12-03"), JOUR("2026-12-04")],
        }),
      ],
      "2026-12-01",
    );
    expect(p.aEcrire).toEqual([]);
    expect(p.enAttente.map((e) => e.manquantes)).toEqual([3]);
  });

  it("un mois prévu, passé, sans AUCUNE signature est signalé (relances)", () => {
    const p = planifierPassage(
      [candidat({ journeesPrevues: [JOUR("2026-12-03"), JOUR("2027-01-07")] })],
      "2026-12-01",
      undefined,
      "2027-01-10",
    );
    expect(p.enAttente).toEqual([
      {
        trainerId: "t1",
        sessionId: "s1",
        mois: "2027-01",
        raison: "aucune_signature_mois_passe",
        manquantes: 2,
      },
    ]);
  });
});

describe("passerPaiementsMission (éteint par défaut)", () => {
  function deps(over: Partial<DepsPassage> = {}): DepsPassage {
    return {
      dateBascule: vi.fn(async () => "2026-12-01"),
      uniqueHistoriqueRetire: vi.fn(async () => true),
      candidats: vi.fn(async () => [candidat()]),
      ecrireMois: vi.fn(async () => "ecrit" as const),
      ...over,
    };
  }
  const MAINTENANT = new Date("2026-12-04T09:00:00Z");

  it("sans date de bascule : coupé, aucune lecture ni écriture", async () => {
    const d = deps({ dateBascule: vi.fn(async () => null) });
    expect(await passerPaiementsMission(MAINTENANT, d)).toEqual({ etat: "coupe" });
    expect(d.candidats).not.toHaveBeenCalled();
    expect(d.ecrireMois).not.toHaveBeenCalled();
  });

  it("avant la date de bascule : coupé", async () => {
    const d = deps({ dateBascule: vi.fn(async () => "2027-01-01") });
    expect(await passerPaiementsMission(MAINTENANT, d)).toEqual({ etat: "coupe" });
  });

  it("🔴 C4 — un mois qui lève est REMONTÉ à Sentry (pas seulement console.error), sans donnée personnelle", async () => {
    captureException.mockClear();
    const d = deps({
      ecrireMois: vi.fn(async () => {
        throw new Error("unique constraint trainer_fee_lines_mission_unique");
      }),
    });
    expect(await passerPaiementsMission(MAINTENANT, d)).toMatchObject({ erreurs: 1 });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0]![1]).toMatchObject({
      tags: { action: "paiement-mission:mois_non_ecrit" },
    });
    // Une panne de la passe entière aussi.
    const panne = deps({ candidats: vi.fn(async () => Promise.reject(new Error("base"))) });
    await passerPaiementsMission(MAINTENANT, panne);
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException.mock.calls[1]![1]).toMatchObject({
      tags: { action: "paiement-mission:passage_en_echec" },
    });
  });

  it("unique historique encore en base (M-D non fait) : bloqué, rien n'est écrit", async () => {
    const d = deps({ uniqueHistoriqueRetire: vi.fn(async () => false) });
    expect(await passerPaiementsMission(MAINTENANT, d)).toEqual({ etat: "bloque_contract" });
    expect(d.ecrireMois).not.toHaveBeenCalled();
  });

  it("compte ce qui est écrit, déjà écrit ou en conflit ; ne lève jamais", async () => {
    const issues = ["ecrit", "deja_ecrit", "revendique_par_le_mensuel"] as const;
    let i = 0;
    const d = deps({
      candidats: vi.fn(async () => [
        candidat(),
        candidat({ sessionId: "s2" }),
        candidat({ sessionId: "s3" }),
      ]),
      ecrireMois: vi.fn(async () => issues[i++]!),
    });
    expect(await passerPaiementsMission(MAINTENANT, d)).toMatchObject({
      etat: "fait",
      ecrits: 1,
      dejaEcrits: 1,
      conflits: 1,
      complements: 0,
      erreurs: 0,
    });
    // Une erreur sur un mois n'arrête pas les autres ; un complément est compté à part.
    let j = 0;
    const melange = deps({
      candidats: vi.fn(async () => [
        candidat(),
        candidat({ sessionId: "s2" }),
        candidat({ sessionId: "s3" }),
      ]),
      ecrireMois: vi.fn(async () => {
        j += 1;
        if (j === 1) throw new Error("verrou");
        return j === 2 ? ("complement_a_traiter" as const) : ("ecrit" as const);
      }),
    });
    expect(await passerPaiementsMission(MAINTENANT, melange)).toMatchObject({
      ecrits: 1,
      complements: 1,
      erreurs: 1,
    });
    const panne = deps({ candidats: vi.fn(async () => Promise.reject(new Error("base"))) });
    expect(await passerPaiementsMission(MAINTENANT, panne)).toEqual({
      etat: "echec",
      message: "base",
    });
  });
});

describe("le run mensuel après la bascule", () => {
  const prestations = [
    { sessionId: "s1", affectations: [{ trainerId: "ind" }, { trainerId: "sal" }] },
    { sessionId: "s2", affectations: [{ trainerId: "ind" }] },
    { sessionId: null, affectations: [{ trainerId: "ind" }] },
  ];
  const statutParTrainer = new Map([
    ["ind", "sous_traitant"],
    ["sal", "salarie"],
  ]);

  it("sans date de bascule : les prestations sont rendues telles quelles", () => {
    expect(
      filtrerPrestationsApresBascule(prestations, {
        dateBascule: null,
        statutParTrainer,
        revendications: new Map(),
        premiereJourneeParSession: new Map(),
      }),
    ).toEqual(prestations);
  });

  it("après la bascule : seul ce qui appartient au paiement par mission est écarté ; salariés et coachings inchangés", () => {
    const r = filtrerPrestationsApresBascule(
      [...prestations, { sessionId: "s3", affectations: [{ trainerId: "ind" }] }],
      {
        dateBascule: "2026-12-01",
        statutParTrainer,
        // s1 : revendiquée par mission → écartée. s2 : revendiquée au mensuel → gardée.
        // s3 : revendiquée par personne mais commencée AVANT la bascule → gardée (jamais payée par personne).
        revendications: new Map([
          ["ind|s1", "par_mission"],
          ["ind|s2", "releve_mensuel"],
        ]),
        premiereJourneeParSession: new Map([
          ["s1", "2026-12-03"],
          ["s2", "2026-11-28"],
          ["s3", "2026-11-20"],
        ]),
      },
    );
    expect(r.map((p) => [p.sessionId, p.affectations.map((a) => a.trainerId)])).toEqual([
      ["s1", ["sal"]],
      ["s2", ["ind"]],
      [null, ["ind"]],
      ["s3", ["ind"]],
    ]);
  });

  it("une session d'après la bascule revendiquée par personne : écartée (le passage la paiera)", () => {
    const r = filtrerPrestationsApresBascule(
      [{ sessionId: "s4", affectations: [{ trainerId: "ind" }] }],
      {
        dateBascule: "2026-12-01",
        statutParTrainer,
        revendications: new Map(),
        premiereJourneeParSession: new Map([["s4", "2026-12-01"]]),
      },
    );
    expect(r[0]!.affectations).toEqual([]);
  });
});

describe("planifierPassage — lot G2 : le bilan de fin de formation", () => {
  it("sans exigence (interrupteur éteint) : rien ne change, le mois signé est écrit", () => {
    const p = planifierPassage([candidat()], "2026-12-01");
    expect(p.aEcrire).toHaveLength(1);
    expect(p.enAttente).toEqual([]);
  });

  it("bilan exigé et non terminé : aucun relevé, en attente « bilan » ; aucun montant ne bouge", () => {
    const p = planifierPassage(
      [candidat({ bilanFinFormation: { termine: false, payerQuandMeme: false } })],
      "2026-12-01",
    );
    expect(p.aEcrire).toEqual([]);
    expect(p.enAttente).toEqual([
      {
        trainerId: "t1",
        sessionId: "s1",
        mois: "2026-12",
        raison: "bilan_fin_formation_manquant",
        manquantes: 0,
      },
    ]);
  });

  it("bilan terminé ou « payer quand même » : le même relevé, au même montant", () => {
    const temoin = planifierPassage([candidat()], "2026-12-01").aEcrire;
    for (const bilan of [
      { termine: true, payerQuandMeme: false },
      { termine: false, payerQuandMeme: true },
    ]) {
      const p = planifierPassage([candidat({ bilanFinFormation: bilan })], "2026-12-01");
      expect(p.aEcrire).toEqual(temoin);
    }
  });

  // Décision de Will : sur une mission payée sur plusieurs mois, SEUL le dernier mois (celui
  // de la dernière journée prévue du formateur) attend le bilan ; les mois précédents se
  // paient sur les feuilles contresignées seules.
  const TROIS_MOIS = ["2027-01-25", "2027-02-08", "2027-03-08"];
  const missionTroisMois = (over: Partial<CandidatMission> = {}) =>
    candidat({
      premiereJournee: TROIS_MOIS[0]!,
      contresignatures: TROIS_MOIS.map(SIG),
      journeesPrevues: TROIS_MOIS.map(JOUR),
      ...over,
    });

  it("mission sur trois mois, bilan non terminé : mois 1 et 2 écrits, seul le dernier attend", () => {
    const p = planifierPassage(
      [missionTroisMois({ bilanFinFormation: { termine: false, payerQuandMeme: false } })],
      "2027-01-01",
    );
    expect(p.aEcrire.map((m) => m.releve.mois)).toEqual(["2027-01", "2027-02"]);
    expect(p.enAttente).toEqual([
      {
        trainerId: "t1",
        sessionId: "s1",
        mois: "2027-03",
        raison: "bilan_fin_formation_manquant",
        manquantes: 0,
      },
    ]);
    // Les mois payés sans bilan ont exactement le montant de la règle des feuilles seule.
    const temoin = planifierPassage([missionTroisMois()], "2027-01-01").aEcrire;
    expect(p.aEcrire).toEqual(temoin.slice(0, 2));
  });

  it("mois signé AVANT le dernier mois prévu (la suite pas encore faite) : payable sans bilan", () => {
    const p = planifierPassage(
      [
        missionTroisMois({
          contresignatures: [SIG(TROIS_MOIS[0]!)],
          bilanFinFormation: { termine: false, payerQuandMeme: false },
        }),
      ],
      "2027-01-01",
      undefined,
      "2027-01-31",
    );
    expect(p.aEcrire.map((m) => m.releve.mois)).toEqual(["2027-01"]);
    expect(p.enAttente).toEqual([]);
  });

  it("mission sur trois mois, bilan terminé ou « payer quand même » : le dernier mois est écrit au même montant", () => {
    const temoin = planifierPassage([missionTroisMois()], "2027-01-01").aEcrire;
    expect(temoin.map((m) => m.releve.mois)).toEqual(["2027-01", "2027-02", "2027-03"]);
    for (const bilan of [
      { termine: true, payerQuandMeme: false },
      { termine: false, payerQuandMeme: true },
    ]) {
      const p = planifierPassage([missionTroisMois({ bilanFinFormation: bilan })], "2027-01-01");
      expect(p.aEcrire).toEqual(temoin);
      expect(p.enAttente).toEqual([]);
    }
  });
});
