/**
 * ⛔ LES MINEURS DU CIRCUIT (V2, m1 à m5).
 *
 *   · m1 — la prolongation du verrou qui ÉCHOUE (base coupée) n'est plus un
 *     rejet non attrapé : deux échecs de suite et la main est tenue pour
 *     perdue (le résultat devient orphelin, rien n'est écrit) ;
 *   · m2 — un arrêt « normal » du circuit (piste client muette, compte rendu
 *     rejeté deux fois…) prévient Will, avec un motif lisible ;
 *   · m3 — à la clôture d'office, une tranche dont les morceaux sont contigus
 *     depuis le premier est complète (Chrome a planté avant sa fin) ;
 *   · m4 — une question à Will dont le son a été purgé est close, et le geste
 *     de réponse est refusé ;
 *   · m5 — les tranches d'un enregistrement sont relues juste avant de le
 *     transcrire : une tranche complétée pendant la transcription du premier
 *     n'est pas oubliée.
 *
 * Mutations qui rougissent : retirer le `.catch` de la minuterie (m1) ; ne
 * pas alerter dans la branche `ArretVisio` (m2) ; ne pas compléter les
 * tranches contiguës (m3) ; accepter la réponse sans son (m4) ; transcrire
 * sur la liste lue au début (m5).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { ArretVisio, executerEtape, type Gestionnaire } from "../etapes";
import { confirmerFenetresVerifiees, GesteRefuse } from "../gestes-compte-rendu";
import { cloturerEnregistrements } from "../cloture";
import { transcrire } from "../recevoir-transcription";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import {
  commePrisma,
  fausseBase,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
  T0 as T0_ENR,
} from "../../../../tests/outils/fixtures-enregistreur";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

const RENCONTRE = "00000000-0000-4000-8000-0000000000f1";

afterEach(() => {
  vi.useRealTimers();
});

describe("les mineurs du circuit (V2)", () => {
  it("m1 — une prolongation qui échoue deux fois : la main est perdue, sans rejet non attrapé", async () => {
    vi.useFakeTimers();
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "extraire" });
    depot.prolonger = () => Promise.reject(new Error("base coupée"));
    const rejets: unknown[] = [];
    const ecoute = (e: unknown) => rejets.push(e);
    process.on("unhandledRejection", ecoute);
    const g: Gestionnaire = async () => {
      await new Promise((r) => setTimeout(r, 150_000));
      return { ecrire: async () => [] };
    };
    const issue = executerEtape(depsDeTest({ depot, gestionnaires: { extraire: g } }), t.id);
    await vi.advanceTimersByTimeAsync(150_000);
    expect(await issue).toBe("orphelin");
    await Promise.resolve();
    process.off("unhandledRejection", ecoute);
    expect(rejets).toEqual([]);
  });

  it("m2 — un arrêt normal du circuit prévient Will avec un motif lisible", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "precontroler" });
    const g: Gestionnaire = async () => {
      throw new ArretVisio("piste_muette");
    };
    const deps = depsDeTest({ depot, gestionnaires: { precontroler: g } });
    expect(await executerEtape(deps, t.id)).toBe("echec_definitif");
    expect(deps.alertes).toHaveLength(1);
    expect(deps.alertes[0]?.code).toBe("visio.etape_en_echec");
    expect(deps.alertes[0]?.rencontreId).toBe(RENCONTRE);
    expect(deps.alertes[0]?.message).toMatch(/client/i);
  });

  it("m3 — à la clôture d'office, une tranche aux morceaux contigus depuis 0 est complète", async () => {
    const db = fausseBase();
    const { appareilId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId,
      statut: "interrompu",
      updatedAt: T0_ENR,
    });
    const contigue = db.semer("enregistrementTranche", {
      enregistrementId: id,
      piste: "client",
      numero: 7,
      statut: "en_reception",
      nbMorceauxAnnonces: null,
      debutCaptureEpochMs: BigInt(0),
      motifDebut: "nouvelle_tranche",
    });
    const trouee = db.semer("enregistrementTranche", {
      enregistrementId: id,
      piste: "axion",
      numero: 7,
      statut: "en_reception",
      nbMorceauxAnnonces: null,
      debutCaptureEpochMs: BigInt(0),
      motifDebut: "nouvelle_tranche",
    });
    for (const seq of [0, 1, 2]) {
      db.semer("enregistrementMorceau", { trancheId: contigue["id"], seq, cleR2: `c/${seq}` });
    }
    for (const seq of [0, 2]) {
      db.semer("enregistrementMorceau", { trancheId: trouee["id"], seq, cleR2: `t/${seq}` });
    }
    await cloturerEnregistrements(commePrisma(db), new Date(T0_ENR.getTime() + 3 * 3_600_000));
    expect(db.lignes("enregistrement")[0]?.["statut"]).toBe("depose");
    const statut = (tid: unknown) =>
      db.lignes("enregistrementTranche").find((x) => x["id"] === tid)?.["statut"];
    expect(statut(contigue["id"])).toBe("complete");
    expect(statut(trouee["id"])).toBe("en_reception");
  });

  it("m4 — répondre à une question dont le son est purgé est refusé", async () => {
    const b = baseEspion({ "enregistrement.findFirst": () => null });
    await expect(
      confirmerFenetresVerifiees(b.base, {
        rencontreId: RENCONTRE,
        enregistrementId: "e1",
        maintenant: T0,
      }),
    ).rejects.toBeInstanceOf(GesteRefuse);
    const filtre = b.de("enregistrement", "findFirst")[0]?.args["where"] as Record<string, unknown>;
    expect(filtre).toMatchObject({ audioSupprimeLe: null });
  });

  it("m5 — une tranche complétée pendant la transcription du premier enregistrement est transcrite", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({ rencontreId: RENCONTRE, etape: "transcrire" });
    const e1 = enregistrement({ id: "e1" });
    const e2 = enregistrement({
      id: "e2",
      tranches: [{ ...e1.tranches[0]!, id: "tard", statut: "en_reception" }],
    });
    const { port, journal } = portTranscription([e1, e2]);
    let lectures = 0;
    port.aTranscrire = async () => {
      lectures += 1;
      // À la relecture, la tranche du 2e enregistrement est devenue complète.
      return lectures === 1
        ? [e1, e2]
        : [e1, { ...e2, tranches: [{ ...e2.tranches[0]!, statut: "complete" as const }] }];
    };
    const vide = { text: "", segments: [] };
    const f = fauxClient(undefined, { transcriptions: [vide, vide, vide] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(journal).toContain("lire:tard");
  });
});
