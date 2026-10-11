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

  it("un formateur retiré est payé pour SES demi-journées signées, même sans journée prévue", () => {
    const p = planifierPassage([candidat({ journeesPrevues: [] })], "2026-12-01");
    expect(p.aEcrire.map((m) => [m.releve.totalHtCents, m.sansEcart])).toEqual([[35_000, false]]);
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
        revendiqueesMensuel: new Set(),
      }),
    ).toEqual(prestations);
  });

  it("après la bascule : l'indépendant ne reste que sur ses sessions revendiquées par le mensuel ; salariés et coachings inchangés", () => {
    const r = filtrerPrestationsApresBascule(prestations, {
      dateBascule: "2026-12-01",
      statutParTrainer,
      revendiqueesMensuel: new Set(["ind|s2"]),
    });
    expect(r.map((p) => [p.sessionId, p.affectations.map((a) => a.trainerId)])).toEqual([
      ["s1", ["sal"]],
      ["s2", ["ind"]],
      [null, ["ind"]],
    ]);
  });
});
