/**
 * ⛔ UN PROSPECT EST ENREGISTRABLE SANS ATTENDRE LE PRÉAVIS (PR 5 ; décision
 * de Will du 29/09).
 *
 * Le préavis protège les clients ACTIFS seulement. Même avant son envoi
 * (`preavis = null`), une rencontre :
 *   · sans client validé (prospect « à classer ») ;
 *   · rangée chez un client SANS aucune pièce (prospect validé) ;
 *   · dont le client actif n'est que PROPOSÉ (A4 : jamais rangé d'office) ;
 * s'enregistre normalement.
 *
 * Mutation qui rougit : faire bloquer `blocagePreavis` sur toute rencontre
 * (ou sur `clientProposeId`) → ces cas rendent 409.
 * Contre-témoin : `un-client-actif-n-est-pas-enregistre-avant-la-fin-du-preavis`.
 */

import { describe, expect, it } from "vitest";

import { listerRencontresDuJour } from "../rencontres-du-jour";
import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  semerRencontreCalendly,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

type Base = ReturnType<typeof fausseBase>;

async function demarrer(db: Base, appareil: { id: string; adminUserId: string }, id: string) {
  return creerOuReprendreSession(commePrisma(db), {
    appareil,
    corps: corpsSession(id),
    mode: "ouvert",
    maintenant: T0,
    preavis: null,
  });
}

describe("⛔ un prospect est enregistrable sans attendre le préavis", () => {
  it("rencontre Calendly à classer, sans client : acceptée, sans bandeau", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const liste = await listerRencontresDuJour(commePrisma(db), {
      maintenant: T0,
      mode: "ouvert",
      preavis: null,
    });
    expect(liste[0]?.preavis).toBeNull();
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId as string);
    expect(r.statut).toBe(200);
  });

  it("client validé sans aucune pièce : accepté", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const client = db.semer("client", { raisonSociale: "Prospect Fictif" });
    const { rencontreId } = semerRencontreTest(db, {
      clientId: String(client["id"]),
      estTestInterne: false,
    });
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId);
    expect(r.statut).toBe(200);
  });

  it("client actif seulement PROPOSÉ (pas rangé) : accepté", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const client = db.semer("client", { raisonSociale: "Client Actif Fictif" });
    db.semer("factureFormation", { clientId: client["id"] });
    const { rencontreId } = semerRencontreCalendly(db);
    const rencontre = db.lignes("rencontre")[0] as Record<string, unknown>;
    rencontre["clientProposeId"] = client["id"];
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId as string);
    expect(r.statut).toBe(200);
  });
});
