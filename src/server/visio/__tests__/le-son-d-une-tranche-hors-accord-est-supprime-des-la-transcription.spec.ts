/**
 * ⛔ LE SON D'UNE TRANCHE HORS ACCORD EST SUPPRIMÉ DÈS LA TRANSCRIPTION (V2, N5).
 *
 * La notice dit « Sans accord, rien n'est enregistré ». Or une tranche qui
 * chevauche une fenêtre hors accord (une personne entrée sans accord) était
 * seulement ÉCARTÉE de la transcription : son son restait chiffré sur R2
 * jusqu'à la validation du compte rendu, ou 30 jours. Désormais l'étape
 * `transcrire` le supprime tout de suite (suppression puis vérification).
 *
 * Mutation qui rougit : ne pas appeler `purgerSonTranche` dans la branche
 * hors accord (1er cas). Contre-témoin : la tranche hors de la fenêtre garde
 * son son (purgé à la validation comme avant) ; un objet qui résiste laisse
 * la date de suppression vide (2e cas).
 */

import { describe, expect, it } from "vitest";

import { depotDonneesPrisma } from "../depot-donnees";
import { executerEtape } from "../etapes";
import type { TrancheATraiter } from "../port-donnees";
import { transcrire } from "../recevoir-transcription";
import { depsDeTest, FauxDepot } from "../../../../tests/outils/faux-circuit-visio";
import { fauxClient } from "../../../../tests/outils/faux-openai-visio";
import {
  commePrisma,
  fausseBase,
  fauxStockage,
  semerAppareil,
  semerEnregistrement,
  semerRencontreTest,
} from "../../../../tests/outils/fixtures-enregistreur";
import { enregistrement, portTranscription, T0 } from "./outils-pipeline";

function tranche(numero: number): TrancheATraiter {
  return {
    id: `tc${numero}`,
    piste: "client",
    numero,
    debutCaptureEpochMs: T0.getTime() + numero * 180_000,
    dureeMs: 180_000,
    niveauFinMuet: true,
    statut: "complete",
    empreinteAnnoncee: "x",
  };
}

describe("le son d'une tranche hors accord est supprimé dès la transcription", () => {
  it("la tranche dans la fenêtre est purgée, l'autre garde son son", async () => {
    const depot = new FauxDepot();
    const t = depot.ajouter({
      rencontreId: "00000000-0000-4000-8000-0000000000f1",
      etape: "transcrire",
    });
    const e = enregistrement({
      fenetresHorsAccord: [{ debutMs: 200_000, finMs: 230_000 }],
      tranches: [tranche(0), tranche(1)],
    });
    const { port } = portTranscription(e);
    const purgees: string[] = [];
    port.purgerSonTranche = async (id) => {
      purgees.push(id);
      return true;
    };
    const f = fauxClient(undefined, { transcriptions: [{ text: "", segments: [] }] });
    const deps = depsDeTest({
      depot,
      client: f.client,
      donnees: port,
      gestionnaires: { transcrire },
    });
    expect(await executerEtape(deps, t.id)).toBe("reussie");
    expect(purgees).toEqual(["tc1"]);
  });

  it("le dépôt supprime les objets, vérifie, puis date la suppression ; un objet qui résiste ne la date pas", async () => {
    const db = fausseBase();
    const { appareilId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const enr = semerEnregistrement(db, { rencontreId, appareilId, statut: "en_traitement" });
    const tr = db.semer("enregistrementTranche", {
      enregistrementId: enr,
      piste: "client",
      numero: 1,
      statut: "complete",
      debutCaptureEpochMs: BigInt(0),
      motifDebut: "nouvelle_tranche",
      tailleOctets: 20,
    });
    const stockage = fauxStockage();
    for (const seq of [0, 1]) {
      const cle = `audio/${enr}/client/1/${seq}`;
      stockage.objets.set(cle, Buffer.from("x"));
      db.semer("enregistrementMorceau", { trancheId: tr["id"], seq, cleR2: cle });
    }
    const port = depotDonneesPrisma(commePrisma(db), stockage);
    expect(await port.purgerSonTranche(String(tr["id"]))).toBe(true);
    expect(stockage.objets.size).toBe(0);
    expect(db.lignes("enregistrementTranche")[0]?.["audioSupprimeLe"]).toBeInstanceOf(Date);

    const resiste = fauxStockage({ echecSuppression: true });
    resiste.objets.set("audio/x", Buffer.from("x"));
    const tr2 = db.semer("enregistrementTranche", {
      enregistrementId: enr,
      piste: "client",
      numero: 2,
      statut: "complete",
      debutCaptureEpochMs: BigInt(0),
      motifDebut: "nouvelle_tranche",
    });
    db.semer("enregistrementMorceau", { trancheId: tr2["id"], seq: 0, cleR2: "audio/x" });
    const port2 = depotDonneesPrisma(commePrisma(db), resiste);
    expect(await port2.purgerSonTranche(String(tr2["id"]))).toBe(false);
    expect(
      db.lignes("enregistrementTranche").find((l) => l["id"] === tr2["id"])?.["audioSupprimeLe"],
    ).toBeFalsy();
  });
});
