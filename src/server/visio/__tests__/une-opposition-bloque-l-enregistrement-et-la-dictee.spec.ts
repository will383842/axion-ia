/**
 * ⛔ UNE OPPOSITION BLOQUE L'ENREGISTREMENT ET LA DICTÉE (PR 5, art. 21).
 *
 * Une personne de la fiche du client (ou un participant rattaché à un contact)
 * s'est opposée au traitement par IA (`ClientContact.oppositionIaLe`) : ni
 * enregistrement de la visio, ni dictée après l'appel. Le motif est
 * `opposition_ia`, pour la visio COMME pour la dictée — l'opposition est
 * vérifiée avant la nature.
 *
 * Mutation qui rougit : retirer le bloc « opposition » de `motifDeRefus` → la
 * visio est acceptée (1er cas) et la dictée tombe sur un autre motif (2ᵉ cas).
 * Contre-témoin : sans opposition, la visio de test est acceptée.
 * Angle mort : une opposition exprimée hors console (e-mail) n'existe ici que
 * si Will la saisit sur la fiche.
 */

import { describe, expect, it } from "vitest";

import { creerOuReprendreSession } from "../sessions";
import {
  commePrisma,
  corpsSession,
  fausseBase,
  semerAppareil,
  semerRencontreTest,
  T0,
} from "../../../../tests/outils/fixtures-enregistreur";

function preparer(opposition: boolean) {
  const db = fausseBase();
  const { appareilId, adminUserId } = semerAppareil(db);
  const { rencontreId, clientId } = semerRencontreTest(db);
  db.semer("clientContact", {
    clientId,
    nom: "Personne fictive",
    oppositionIaLe: opposition ? new Date("2026-10-01T00:00:00.000Z") : null,
  });
  return { db, appareil: { id: appareilId, adminUserId }, rencontreId };
}

describe("⛔ une opposition bloque l'enregistrement et la dictée", () => {
  it("visio : 409 « opposition_ia », aucun enregistrement", async () => {
    const { db, appareil, rencontreId } = preparer(true);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(409);
    expect(r.corps["erreur"]).toBe("opposition_ia");
    expect(db.lignes("enregistrement")).toHaveLength(0);
  });

  it("dictée : 409 « opposition_ia » aussi", async () => {
    const { db, appareil, rencontreId } = preparer(true);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId, { nature: "dictee" }),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.corps["erreur"]).toBe("opposition_ia");
  });

  it("un participant rattaché à un contact opposé bloque aussi", async () => {
    const db = fausseBase();
    const { appareilId, adminUserId } = semerAppareil(db);
    const { rencontreId } = semerRencontreTest(db);
    const autreClient = String(db.semer("client", { raisonSociale: "Autre fictif" })["id"]);
    const contact = db.semer("clientContact", {
      clientId: autreClient,
      nom: "Invité fictif",
      oppositionIaLe: new Date("2026-10-01T00:00:00.000Z"),
    });
    db.semer("rencontreParticipant", {
      rencontreId,
      contactId: contact["id"],
      role: "client",
      nomAffiche: "Invité",
    });
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil: { id: appareilId, adminUserId },
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.corps["erreur"]).toBe("opposition_ia");
  });

  it("contre-témoin : sans opposition, la visio de test est acceptée", async () => {
    const { db, appareil, rencontreId } = preparer(false);
    const r = await creerOuReprendreSession(commePrisma(db), {
      appareil,
      corps: corpsSession(rencontreId),
      mode: "pilote",
      maintenant: T0,
    });
    expect(r.statut).toBe(200);
  });
});
