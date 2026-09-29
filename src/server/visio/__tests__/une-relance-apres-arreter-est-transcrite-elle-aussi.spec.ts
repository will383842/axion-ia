/**
 * ⛔ UNE RELANCE APRÈS « ARRÊTER » EST TRANSCRITE ELLE AUSSI.
 *
 * Will clique « Arrêter », puis relance l'enregistrement dans le même
 * rendez-vous : la rencontre a DEUX enregistrements déposés. La PR 5 n'interdit
 * qu'un second enregistrement ACTIF. Avant ce correctif, `aTranscrire` ne
 * prenait que le dernier et le balayage ne recréait plus `transcrire` : une
 * partie de l'appel n'était jamais transcrite.
 *
 *   · `transcrire` transcrit TOUS les enregistrements déposés, sur une même
 *     origine d'horodatage, et ne refait jamais celui qui l'est déjà ;
 *   · le balayage REDONNE `transcrire` à une rencontre dont l'étape était
 *     terminée quand un nouvel enregistrement est déposé ;
 *   · une demande d'arrêt entendue dans la première partie coupe AUSSI la
 *     relance (sa parole n'est jamais gardée).
 *
 * Mutations qui rougissent : ne transcrire que `liste[liste.length - 1]` ;
 * rétablir `NOT EXISTS (… etape = 'transcrire')` sans la condition sur
 * `reussie` ; ne pas propager `refusAvant`. Contre-témoin : un seul
 * enregistrement se comporte comme avant. Angle mort : la chaîne de Gate D ne
 * rejoue pas une relance sur une vraie base (le SQL du balayage est lu ici).
 */

import { describe, expect, it } from "vitest";

import { balayerCircuit } from "../balayage-circuit";
import { depotDonneesPrisma } from "../depot-donnees";
import { executerEtape } from "../etapes";
import { plansDePrecontrole } from "../precontroles";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient, fauxCout } from "../../../../tests/outils/faux-openai-visio";
import { baseEspion } from "../../../../tests/outils/base-espion";
import {
  conversation,
  enregistrement,
  portTranscription,
  precontrole,
  seg,
  T0,
} from "./outils-pipeline";

const QUINZE_MIN = 15 * 60_000;
const vide = { text: "", segments: [] };

function relance() {
  const e1 = enregistrement({ id: "e1" });
  const e2 = enregistrement({
    id: "e2",
    debut: new Date(T0.getTime() + QUINZE_MIN),
    fin: new Date(T0.getTime() + QUINZE_MIN + 600_000),
    tranches: e1.tranches.map((t) => ({
      ...t,
      id: `${t.id}-bis`,
      debutCaptureEpochMs: T0.getTime() + QUINZE_MIN,
    })),
  });
  return { e1, e2 };
}

describe("une relance après « Arrêter » est transcrite elle aussi", () => {
  it("les deux enregistrements sont transcrits et retenus", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    const { e1, e2 } = relance();
    const { port, journal } = portTranscription([e1, e2]);
    const f = fauxClient(undefined, { transcriptions: [vide, vide, vide, vide] });
    const issue = await executerEtape(
      depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      t.id,
    );
    expect(issue).toBe("reussie");
    expect(journal.filter((j) => j.startsWith("lire:"))).toEqual([
      "lire:tc0",
      "lire:ta0",
      "lire:tc0-bis",
      "lire:ta0-bis",
    ]);
    expect(journal.filter((j) => j.startsWith("retenue"))).toEqual(["retenue:e1", "retenue:e2"]);
    // Même origine : la relance commence 15 min après la première partie.
    expect(f.demandesTranscription).toHaveLength(4);
  });

  it("un enregistrement déjà transcrit n'est pas refait", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: "r1", etape: "transcrire" });
    const { e1, e2 } = relance();
    const { port, journal } = portTranscription([{ ...e1, statut: "compte_rendu_pret" }, e2]);
    const f = fauxClient(undefined, { transcriptions: [vide, vide] });
    await executerEtape(
      depsDeTest({ depot, client: f.client, donnees: port, gestionnaires: { transcrire } }),
      t.id,
    );
    expect(journal.filter((j) => j.startsWith("lire:"))).toEqual(["lire:tc0-bis", "lire:ta0-bis"]);
  });

  it("le port réel lit TOUS les enregistrements, sur une seule origine", async () => {
    const base = baseEspion({
      "enregistrement.findMany": () =>
        [
          { id: "e1", debut: T0 },
          { id: "e2", debut: new Date(T0.getTime() + QUINZE_MIN) },
        ].map((e) => ({
          ...e,
          rencontreId: "r1",
          nature: "visio",
          statut: "depose",
          fin: null,
          motifArret: "manuel",
          fenetresHorsAccord: null,
          evenements: null,
          rencontre: { debutReel: null },
          tranches: [],
        })),
    });
    const liste = await depotDonneesPrisma(base.base).aTranscrire("r1");
    expect(liste.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(liste.map((e) => e.origineMs)).toEqual([T0.getTime(), T0.getTime()]);
    const args = base.de("enregistrement", "findMany")[0]!.args as {
      orderBy: unknown;
      take?: number;
    };
    expect(args.take).toBeUndefined();
    expect(args.orderBy).toEqual({ debut: "asc" });
  });

  it("le balayage redonne `transcrire` à une rencontre dont l'étape était terminée", async () => {
    const base = baseEspion();
    await balayerCircuit(base.base, {
      cout: fauxCout().port,
      alerter: async () => {},
      maintenant: () => T0,
    });
    const entree = base.sqls.find((s) => s.sql.includes("e.\"statut\" = 'depose'"))!.sql;
    expect(entree).toMatch(/t\."statut" <> 'reussie'/);
  });

  it("une demande d'arrêt dans la première partie coupe aussi la relance", () => {
    const refus = [
      ...conversation(),
      seg({
        piste: "client",
        debutMs: 500_000,
        texte: "Attendez, je préfère pas qu'on enregistre la suite.",
      }),
      seg({ piste: "client", debutMs: 510_000, texte: "Ce qui suit est confidentiel." }),
    ];
    const suite = conversation().map((s) => ({ ...s, debutMs: s.debutMs + QUINZE_MIN }));
    const plans = plansDePrecontrole([
      precontrole({ segments: refus }),
      precontrole({ enregistrementId: "e2", transcriptionId: "tr2", segments: suite }),
    ]);
    expect(plans[0]!.plan.ordresApresRefus.length).toBeGreaterThan(0);
    expect(plans[1]!.plan.ordresApresRefus).toHaveLength(suite.length);
    expect(plans[1]!.plan.accords).toEqual([]);
  });

  it("contre-témoin : sans demande d'arrêt, la relance est gardée", () => {
    const plans = plansDePrecontrole([
      precontrole(),
      precontrole({ enregistrementId: "e2", transcriptionId: "tr2" }),
    ]);
    expect(plans.map((p) => p.plan.ordresApresRefus.length)).toEqual([0, 0]);
  });
});
