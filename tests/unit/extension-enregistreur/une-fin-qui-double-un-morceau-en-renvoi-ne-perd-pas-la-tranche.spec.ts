/**
 * ⛔ UNE FIN QUI DOUBLE UN MORCEAU EN RENVOI NE PERD PAS LA TRANCHE (V2, M5).
 *
 * L'extension écarte de la file les éléments en délai de renvoi : un morceau
 * refusé par un 503 (déploiement, R2) attend jusqu'à 5 min, et la `fin` de la
 * session, elle, partait. Le site mettait la tranche `incomplete`, déposait
 * l'enregistrement ; le balayage lançait `transcrire` qui passait
 * l'enregistrement `en_traitement` ; le morceau renvoyé ensuite était refusé
 * (409 `enregistrement_clos`) et l'extension DÉTRUISAIT la capture locale.
 *
 * Deux filets :
 *   · l'extension n'envoie la `fin` que s'il ne reste AUCUN morceau ni fin de
 *     tranche de la capture dans sa file, même en délai de renvoi ;
 *   · le circuit tient pour ACTIF (étape reportée, sans compter) un
 *     enregistrement déposé dont une tranche est encore en réception ou
 *     incomplète, pendant 15 minutes après sa fin.
 *
 * Mutations qui rougissent : retirer le contrôle dans `envoyablesMaintenant`
 * (1er cas) ; ne compter que les statuts actifs dans `enregistrementActif`
 * (2e cas). Contre-témoins : sans morceau en attente, la fin part ; passé
 * 15 minutes, la tranche incomplète ne retient plus le circuit.
 */

import { describe, expect, it } from "vitest";

import {
  envoyablesMaintenant,
  sonEnAttentePour,
} from "../../../extensions/enregistreur-meet/lib/file-envoi.js";
import { depotDonneesPrisma } from "@/server/visio/depot-donnees";
import {
  commePrisma,
  fausseBase,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
} from "../../outils/fixtures-enregistreur";

const MAINTENANT = 1_800_000_000_000;
const captures = { k: { accord: true, enregistrementId: "e1" } };

describe("une fin qui double un morceau en renvoi ne perd pas la tranche", () => {
  it("extension : la fin attend le morceau en délai de renvoi", () => {
    const file = [
      { id: "m", type: "morceau", cleClient: "k", creeLe: 1, prochainEssaiMs: MAINTENANT + 60_000 },
      { id: "f", type: "fin", cleClient: "k", creeLe: 2 },
    ];
    expect(envoyablesMaintenant(file, captures, MAINTENANT).map((e) => e.id)).toEqual([]);
  });

  it("extension : juste avant d'envoyer la fin, un morceau du même lot qui vient d'échouer la retient", () => {
    const file = [
      { id: "m", type: "morceau", cleClient: "k", creeLe: 1 },
      { id: "f", type: "fin", cleClient: "k", creeLe: 2 },
    ];
    expect(sonEnAttentePour(file, "k")).toBe(true);
    expect(sonEnAttentePour(file.slice(1), "k")).toBe(false);
  });

  it("contre-témoin : sans morceau ni fin de tranche en attente, la fin part", () => {
    const file = [
      { id: "m", type: "morceau", cleClient: "autre", creeLe: 1 },
      { id: "f", type: "fin", cleClient: "k", creeLe: 2 },
    ];
    const vue = { ...captures, autre: { accord: true, enregistrementId: "e2" } };
    expect(envoyablesMaintenant(file, vue, MAINTENANT).map((e) => e.id)).toEqual(["m", "f"]);
  });

  it("site : un enregistrement déposé avec une tranche incomplète retient le circuit 15 minutes", async () => {
    const db = fausseBase();
    const { appareilId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const id = semerEnregistrement(db, {
      rencontreId,
      appareilId,
      statut: "depose",
      fin: new Date(Date.now() - 2 * 60_000),
    });
    db.semer("enregistrementTranche", {
      enregistrementId: id,
      piste: "client",
      numero: 4,
      statut: "incomplete",
      debutCaptureEpochMs: BigInt(0),
      motifDebut: "nouvelle_tranche",
    });
    const port = depotDonneesPrisma(commePrisma(db));
    expect(await port.enregistrementActif(rencontreId)).toBe(true);

    db.lignes("enregistrement")[0]!["fin"] = new Date(Date.now() - 16 * 60_000);
    expect(await port.enregistrementActif(rencontreId)).toBe(false);
  });
});
