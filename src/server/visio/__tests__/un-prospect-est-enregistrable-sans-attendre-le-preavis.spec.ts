/**
 * ⛔ UN PROSPECT EST ENREGISTRABLE SANS ATTENDRE LE PRÉAVIS — MAIS PAS UN
 * CLIENT ACTIF QUI RÉSERVE SANS ÊTRE ENCORE RANGÉ (PR 5 ; décision de Will du
 * 29/09 : « SEULES les visios de ce(s) client(s) actif(s) sont refusées […]
 * bloquées automatiquement »).
 *
 * Le préavis protège les clients ACTIFS seulement. Même avant son envoi
 * (`preavis = null`), une rencontre :
 *   · sans aucun lien vers un client (vrai prospect « à classer ») ;
 *   · rangée chez un client SANS aucune pièce (prospect validé) ;
 * s'enregistre normalement.
 *
 * Mais une rencontre Calendly naît « à classer » (A4 : validée « Après
 * l'appel »). Elle est REFUSÉE, bandeau compris, si elle se rattache déjà à un
 * client actif :
 *   · client actif PROPOSÉ (`clientProposeId`) ;
 *   · adresse de l'invité connue d'une personne d'un client actif ;
 *   · participant rattaché à un client actif.
 *
 * Mutation qui rougit : faire bloquer `blocagePreavis` sur toute rencontre →
 * les deux premiers cas rendent 409 ; ne regarder que `clientId` dans
 * `clientsDeLaRencontre` → les trois derniers rendent 200.
 * Contre-témoin : `un-client-actif-n-est-pas-enregistre-avant-la-fin-du-preavis`.
 * Angle mort : un client actif qui réserve avec une adresse que la console ne
 * connaît pas encore reste un prospect jusqu'au rattachement ; `POST accord`
 * revérifie alors (rattachement pendant l'appel).
 */

import { describe, expect, it } from "vitest";

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { listerRencontresDuJour } from "../liste-enregistreur";
import { creerOuReprendreSession } from "../sessions";
import { refusPourPreavis } from "../visio-annonce";
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

async function bandeau(db: Base) {
  const liste = await listerRencontresDuJour(commePrisma(db), {
    maintenant: T0,
    mode: "ouvert",
    preavis: null,
  });
  return liste[0]?.preavis;
}

function clientActif(db: Base) {
  const client = db.semer("client", { raisonSociale: "Client Actif Fictif" });
  db.semer("factureFormation", { clientId: client["id"] });
  return String(client["id"]);
}

describe("⛔ un prospect est enregistrable sans attendre le préavis", () => {
  it("rencontre Calendly à classer, sans aucun lien : acceptée, sans bandeau", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    // Un client actif EXISTE, mais rien ne relie ce prospect à lui.
    const clientId = clientActif(db);
    const contact = db.semer("clientContact", { clientId, nom: "Autre Personne" });
    db.semer("clientContactAdresse", {
      contactId: contact["id"],
      email: "autre@exemple.test",
      emailHash: hashEmailForLookup("autre@exemple.test"),
    });
    const { rencontreId } = semerRencontreCalendly(db);
    expect(await bandeau(db)).toBeNull();
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

  it("client actif seulement PROPOSÉ (pas encore rangé) : refusé, bandeau", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const clientId = clientActif(db);
    const { rencontreId } = semerRencontreCalendly(db);
    const rencontre = db.lignes("rencontre")[0] as Record<string, unknown>;
    rencontre["clientProposeId"] = clientId;
    expect(await bandeau(db)).toEqual({ finLe: null });
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("invité Calendly dont l'adresse est celle d'une personne d'un client actif : refusé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const clientId = clientActif(db);
    const contact = db.semer("clientContact", { clientId, nom: "Camille Exemple" });
    db.semer("clientContactAdresse", {
      contactId: contact["id"],
      email: "camille@client-actif.test",
      emailHash: hashEmailForLookup("camille@client-actif.test"),
    });
    // Casse différente : la clé est normalisée comme partout (citext).
    const { rencontreId } = semerRencontreCalendly(db, {
      inviteeEmail: "Camille@Client-Actif.test",
    });
    expect(await bandeau(db)).toEqual({ finLe: null });
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
  });

  it("participant rattaché à un client actif : refusé", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const clientId = clientActif(db);
    const { rencontreId } = semerRencontreCalendly(db);
    db.semer("rencontreParticipant", {
      rencontreId,
      clientId,
      nomAffiche: "Camille Exemple",
      role: "client",
    });
    const r = await demarrer(db, { id: appareilId, adminUserId }, rencontreId as string);
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("client_actif_preavis_en_cours");
  });
});

// ── La règle pure (`visio-annonce.ts`, source unique D2 ; cas repris de main, #1226).
describe("un prospect est enregistrable sans attendre le préavis (règle pure)", () => {
  it("🔴 prospect non validé, préavis pas encore parti : enregistrable", () => {
    expect(refusPourPreavis({ valide: false, actif: false }, new Date(), null)).toEqual({
      refuse: false,
    });
  });

  it("🔴 fiche non validée même si elle ressemble à un client actif : enregistrable", () => {
    expect(refusPourPreavis({ valide: false, actif: true }, new Date(), null).refuse).toBe(false);
  });
});
