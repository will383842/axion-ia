/**
 * ⛔ « CRÉER QUAND MÊME » EXIGE UN MOTIF ET LE JOURNALISE (plan §3.17 point 3,
 * signal 2 : même adresse e-mail sur une autre fiche).
 *
 *   · sans motif, ou avec moins de 10 caractères : `motif_requis`, RIEN n'est
 *     écrit ;
 *   · avec un motif : la fiche est créée ET une ligne `ActivityLog`
 *     `client.creation_forcee` porte le motif et la fiche proche — dans la
 *     MÊME transaction.
 *
 * Mutation qui fait rougir : retirer le contrôle de longueur, ou l'écriture du
 * journal.
 * Contre-témoin : une adresse inconnue crée la fiche sans motif et sans ligne
 * de journal.
 * Angle mort : le motif est libre ; « aaaaaaaaaa » passe. Sa qualité se lit
 * dans le journal, elle ne se contrôle pas.
 */

import { describe, expect, it } from "vitest";
import { ACTION_CREATION_FORCEE, creerOuRetrouverClient } from "../porte-client";
import { adresse, baseEnMemoire, commePrisma, ficheClient, personne } from "./_base-en-memoire";

function base() {
  const fiche = ficheClient({ numero: "AXI-CLI-010", raisonSociale: "Cabinet Fictif" });
  const contact = personne(fiche.id, "Claire Fictive", true);
  return baseEnMemoire({
    clients: [fiche],
    contacts: [contact],
    adresses: [adresse(contact.id, "claire@cabinet-fictif.example")],
  });
}

const DONNEES = { raisonSociale: "Nouvelle Société Fictive" };
const PERSONNE = { nom: "Claire Fictive", email: "Claire@Cabinet-Fictif.example" };

describe("⛔ créer quand même exige un motif et le journalise", () => {
  it("sans motif : motif requis, rien n'est écrit", async () => {
    const db = base();
    const r = await creerOuRetrouverClient(commePrisma(db), DONNEES, PERSONNE, {
      parAdminId: "a1",
    });
    expect(r.statut).toBe("motif_requis");
    if (r.statut !== "motif_requis") return;
    expect(r.proches[0]?.numero).toBe("AXI-CLI-010");
    expect(r.proches[0]?.signal).toBe("email");
    expect(db.etat.clients).toHaveLength(1);
    expect(db.etat.journal).toEqual([]);
  });

  it("un motif trop court (9 caractères) ne suffit pas", async () => {
    const db = base();
    const r = await creerOuRetrouverClient(commePrisma(db), DONNEES, PERSONNE, {
      parAdminId: "a1",
      motifCreationForcee: "  123456789  ",
    });
    expect(r.statut).toBe("motif_requis");
    expect(db.etat.clients).toHaveLength(1);
  });

  it("avec un motif : créée, et journalisée dans la même transaction", async () => {
    const db = base();
    const r = await creerOuRetrouverClient(commePrisma(db), DONNEES, PERSONNE, {
      parAdminId: "a1",
      motifCreationForcee: "Claire a quitté le cabinet et crée sa propre société",
    });
    expect(r.statut).toBe("cree");
    if (r.statut !== "cree") return;
    expect(r.creationForcee).toBe(true);
    expect(db.etat.clients).toHaveLength(2);
    expect(db.etat.journal).toEqual([
      expect.objectContaining({
        action: ACTION_CREATION_FORCEE,
        adminUserId: "a1",
        targetType: "Client",
        targetId: r.id,
        changes: {
          motif: "Claire a quitté le cabinet et crée sa propre société",
          fichesProches: [{ numero: "AXI-CLI-010", signal: "email" }],
        },
      }),
    ]);
    expect(ACTION_CREATION_FORCEE).toBe("client.creation_forcee");
  });

  it("contre-témoin : une adresse inconnue crée sans motif ni journal", async () => {
    const db = base();
    const r = await creerOuRetrouverClient(
      commePrisma(db),
      DONNEES,
      { nom: "Paul Fictif", email: "paul@autre-fictif.example" },
      { parAdminId: "a1" },
    );
    expect(r.statut).toBe("cree");
    expect(db.etat.journal).toEqual([]);
  });
});
